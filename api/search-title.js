// api/search-title.js
// Live catalog lookup:
// - Netflix, Prime Video, HBO Max: strictly Malaysia (MY) active flatrate subscription catalog (excludes removed/expired & rent/buy-only)
// - Disney+: checks Malaysia (MY) first, plus Global (US/SG) fallback since Disney+ follows global catalog availability

const APP_MAP = {
  // Netflix
  8: { id: 'netflix', shortLabel: 'Netflix', name: 'Netflix Premium', price: 18 },
  175: { id: 'netflix', shortLabel: 'Netflix', name: 'Netflix Premium', price: 18 },
  // Disney+ / Disney+ Hotstar
  337: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  122: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  390: { id: 'disney', shortLabel: 'Disney+', name: 'Disney+ Premium', price: 16 },
  // HBO Max / Max
  1899: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  384: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  425: { id: 'hbomax', shortLabel: 'HBO Max', name: 'HBO Max', price: 16 },
  // Amazon Prime Video
  119: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 },
  9: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 },
  10: { id: 'primevideo', shortLabel: 'Prime Video', name: 'Prime Video', price: 10 }
};

function mapProvidersToApps(flatrateList, allowedIds = null) {
  if (!Array.isArray(flatrateList)) return [];
  const seen = new Set();
  const apps = [];
  for (const prov of flatrateList) {
    const pid = Number(prov.provider_id || prov.id);
    const mapped = APP_MAP[pid];
    if (!mapped) continue;
    if (allowedIds && !allowedIds.includes(mapped.id)) continue;
    if (!seen.has(mapped.id)) {
      seen.add(mapped.id);
      apps.push({ ...mapped });
    }
  }
  return apps;
}

async function fetchJustWatchCountry(query, country) {
  const endpoint = 'https://apis.justwatch.com/graphql';
  const gql = {
    operationName: 'GetSearchTitles',
    variables: {
      searchTitlesFilter: { searchQuery: query },
      country,
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
      'User-Agent': 'SPYSTORE-Catalog-Checker/2.1'
    },
    body: JSON.stringify(gql)
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data?.data?.popularTitles?.edges || [];
}

function extractAppsFromOffers(offers, allowedIds = null) {
  if (!Array.isArray(offers)) return [];
  // STRICTLY FLATRATE (active subscription only — ignores RENT, BUY, FREE, ADS, or removed titles)
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

    if (!appObj) continue;
    if (allowedIds && !allowedIds.includes(appObj.id)) continue;
    if (!seen.has(appObj.id)) {
      seen.add(appObj.id);
      apps.push({ ...appObj });
    }
  }
  return apps;
}

async function queryLiveCatalogs(query) {
  // 1. Fetch live Malaysia (MY) catalog for Netflix, Prime Video, HBO Max, and Disney+ MY
  // 2. Fetch live Global (US) catalog specifically for Disney+ (since Disney+ follows global catalog)
  const [myEdges, globalEdges] = await Promise.all([
    fetchJustWatchCountry(query, 'MY').catch(() => []),
    fetchJustWatchCountry(query, 'US').catch(() => [])
  ]);

  const globalDisneyByTitle = new Map();
  for (const edge of globalEdges) {
    const node = edge.node || {};
    const titleKey = String(node?.content?.title || '').toLowerCase().trim();
    const yearKey = String(node?.content?.originalReleaseYear || '');
    const disneyOnly = extractAppsFromOffers(node.offers || [], ['disney']);
    if (disneyOnly.length > 0 && titleKey) {
      globalDisneyByTitle.set(`${titleKey}|${yearKey}`, disneyOnly[0]);
      if (!globalDisneyByTitle.has(titleKey)) {
        globalDisneyByTitle.set(titleKey, disneyOnly[0]);
      }
    }
  }

  const baseEdges = myEdges.length > 0 ? myEdges : globalEdges;

  return baseEdges.map(edge => {
    const node = edge.node || {};
    const content = node.content || {};
    const isFromMy = myEdges.length > 0;

    // For Netflix, Prime Video, HBO Max: strictly Malaysia (MY) active flatrate ONLY
    const myApps = isFromMy
      ? extractAppsFromOffers(node.offers || [], ['netflix', 'primevideo', 'hbomax', 'disney'])
      : [];

    const availableApps = [...myApps];
    const hasDisney = availableApps.some(a => a.id === 'disney');

    // For Disney+: include if available in MY OR in Global Disney+ catalog
    if (!hasDisney) {
      const titleKey = String(content.title || '').toLowerCase().trim();
      const yearKey = String(content.originalReleaseYear || '');
      const globalDisney =
        globalDisneyByTitle.get(`${titleKey}|${yearKey}`) ||
        globalDisneyByTitle.get(titleKey) ||
        (!isFromMy ? extractAppsFromOffers(node.offers || [], ['disney'])[0] : null);

      if (globalDisney) {
        availableApps.push({ ...globalDisney });
      }
    }

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
      checkedRegions: {
        netflix: 'MY',
        primevideo: 'MY',
        hbomax: 'MY',
        disney: 'GLOBAL'
      },
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
    let items = await queryLiveCatalogs(q);

    // TMDB fallback if JustWatch returns empty and TMDB_API_KEY is configured
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
                const results = pData?.results || {};
                // Netflix, Prime Video, HBO Max strictly from MY flatrate
                const myApps = mapProvidersToApps(results?.MY?.flatrate || [], ['netflix', 'primevideo', 'hbomax', 'disney']);
                availableApps = [...myApps];
                // Disney+ also checks Global (US) flatrate
                if (!availableApps.some(a => a.id === 'disney')) {
                  const globalDisney = mapProvidersToApps(results?.US?.flatrate || [], ['disney']);
                  if (globalDisney.length > 0) availableApps.push(globalDisney[0]);
                }
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
              checkedRegions: {
                netflix: 'MY',
                primevideo: 'MY',
                hbomax: 'MY',
                disney: 'GLOBAL'
              },
              subscriptionOnly: true
            };
          })
        );
      }
    }

    return res.status(200).json({
      query: q,
      updatedAt: new Date().toISOString(),
      items: items || []
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to verify live streaming catalog',
      items: []
    });
  }
}
