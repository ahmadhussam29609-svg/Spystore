// api/search-title.js
// Strict Malaysia ('MY') active flatrate subscription catalog lookup for Netflix, Disney+, HBO Max, and Prime Video.

const APP_MAP = {
  // Netflix
  8: { id: 'netflix', shortLabel: 'Netflix', name: 'Netflix Premium', price: 18 },
  175: { id: 'netflix', shortLabel: 'Netflix', name: 'Netflix Premium', price: 18 },
  // Disney+ / Disney+ Hotstar MY
  337: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  122: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  390: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  // HBO Max / Max MY
  1899: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  384: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  425: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  // Amazon Prime Video MY
  119: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 },
  9: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 },
  10: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 }
};

function mapProvidersToApps(flatrateList) {
  if (!Array.isArray(flatrateList)) return [];
  const seen = new Set();
  const apps = [];
  for (const prov of flatrateList) {
    const pid = Number(prov.provider_id || prov.id);
    const mapped = APP_MAP[pid];
    if (mapped && !seen.has(mapped.id)) {
      seen.add(mapped.id);
      apps.push({ ...mapped });
    }
  }
  return apps;
}

function extractMyFlatrateApps(offers) {
  if (!Array.isArray(offers)) return [];
  // Strictly FLATRATE (active subscription only; ignores RENT, BUY, FREE, ADS, or expired/removed titles)
  const flatrateOffers = offers.filter(o => String(o.monetizationType || '').toUpperCase() === 'FLATRATE');
  const seen = new Set();
  const apps = [];

  for (const off of flatrateOffers) {
    const pkgName = String(off?.package?.clearName || off?.package?.shortName || '').toLowerCase();
    let appObj = null;
    if (pkgName.includes('netflix')) appObj = APP_MAP[8];
    else if (pkgName.includes('disney')) appObj = APP_MAP[337];
    else if (pkgName.includes('hbo') || pkgName === 'max') appObj = APP_MAP[1899];
    else if (pkgName.includes('prime video') || pkgName.includes('amazon')) appObj = APP_MAP[119];

    if (appObj && !seen.has(appObj.id)) {
      seen.add(appObj.id);
      apps.push({ ...appObj });
    }
  }
  return apps;
}

async function queryJustWatchMY(query) {
  const endpoint = 'https://apis.justwatch.com/graphql';
  const gql = {
    operationName: 'GetSearchTitles',
    variables: {
      searchTitlesFilter: { searchQuery: query },
      country: 'MY',
      language: 'en',
      first: 6,
      formatPoster: 'JPG',
      profile: 'S718'
    },
    query: `query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!, $formatPoster: ImageFormat, $profile: PosterProfile) {
      popularTitles(country: $country, filter: $searchTitlesFilter, first: $first) {
        edges {
          node {
            id
            objectId
            objectType
            content(country: $country, language: $language) {
              title
              originalReleaseYear
              posterUrl(profile: $profile, format: $formatPoster)
              scoring { imdbScore tmdbScore }
            }
            offers(country: $country, platform: WEB) {
              monetizationType
              package {
                packageId
                clearName
                shortName
              }
            }
          }
        }
      }
    }`
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SPYSTORE-Catalog-Checker/3.1'
    },
    body: JSON.stringify(gql)
  });

  if (!res.ok) return [];
  const data = await res.json();
  const edges = data?.data?.popularTitles?.edges || [];

  return edges.map(edge => {
    const node = edge.node || {};
    const content = node.content || {};
    const availableApps = extractMyFlatrateApps(node.offers || []);

    const rawPoster = content.posterUrl || '';
    const poster = rawPoster
      ? (rawPoster.startsWith('http') ? rawPoster : `https://images.justwatch.com${rawPoster.replace('{profile}', 's332').replace('{format}', 'jpg')}`)
      : '';

    const score = content?.scoring?.imdbScore || content?.scoring?.tmdbScore || '-';
    return {
      id: node.objectId || node.id,
      title: content.title || query,
      year: content.originalReleaseYear || '',
      mediaType: node.objectType === 'MOVIE' ? 'MOVIE' : 'SERIES',
      rating: score !== '-' ? Number(score).toFixed(1) : 'N/A',
      poster,
      availableApps,
      checkedRegion: 'MY',
      subscriptionOnly: true
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter q', items: [] });
  }

  const tmdbKey = process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN || '';

  try {
    let items = await queryJustWatchMY(q);

    if ((!items || items.length === 0) && tmdbKey) {
      const isBearer = tmdbKey.length > 40;
      const headers = isBearer
        ? { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' }
        : { accept: 'application/json' };
      const keyParam = isBearer ? '' : `&api_key=${encodeURIComponent(tmdbKey)}`;

      const searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1${keyParam}`;
      const sRes = await fetch(searchUrl, { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        const rawResults = (sData.results || [])
          .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 6);

        items = await Promise.all(
          rawResults.map(async (r) => {
            const mType = r.media_type;
            const provUrl = `https://api.themoviedb.org/3/${mType}/${r.id}/watch/providers?${keyParam.replace(/^&/, '')}`;
            let availableApps = [];
            try {
              const pRes = await fetch(provUrl, { headers });
              if (pRes.ok) {
                const pData = await pRes.json();
                const myProviders = pData?.results?.MY || {};
                availableApps = mapProvidersToApps(myProviders.flatrate || []);
              }
            } catch (e) {}

            const dateStr = r.release_date || r.first_air_date || '';
            return {
              id: r.id,
              title: r.title || r.name || q,
              year: dateStr ? dateStr.slice(0, 4) : '',
              mediaType: mType === 'movie' ? 'MOVIE' : 'SERIES',
              rating: r.vote_average ? Number(r.vote_average).toFixed(1) : 'N/A',
              poster: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : '',
              availableApps,
              checkedRegion: 'MY',
              subscriptionOnly: true
            };
          })
        );
      }
    }

    return res.status(200).json({
      query: q,
      region: 'MY',
      mode: 'flatrate_only',
      updatedAt: new Date().toISOString(),
      items: items || []
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to verify live Malaysia streaming catalog',
      items: []
    });
  }
}
