const TMDB_KEY = process.env.TMDB_API_KEY || '';

const APP_META = {
  netflix: { id: 'netflix', label: 'Netflix', shortLabel: 'Netflix' },
  disney: { id: 'disney', label: 'Disney+', shortLabel: 'Disney+' },
  hbomax: { id: 'hbomax', label: 'HBO Max', shortLabel: 'HBO Max' },
  primevideo: { id: 'primevideo', label: 'Prime Video', shortLabel: 'Prime Video' }
};

const PROVIDER_MAP = {
  8: APP_META.netflix,
  1796: APP_META.netflix,
  337: APP_META.disney,
  122: APP_META.disney,
  390: APP_META.disney,
  1899: APP_META.hbomax,
  384: APP_META.hbomax,
  118: APP_META.hbomax,
  119: APP_META.primevideo,
  9: APP_META.primevideo,
  10: APP_META.primevideo
};

const STUDIO_APP_RULES = [
  {
    app: APP_META.disney,
    companyIds: [420, 2, 3, 1, 7521, 127928],
    networkIds: [2739, 44, 54],
    keywords: ['avengers', 'captain america', 'iron man', 'thor', 'loki', 'wandavision', 'mandalorian', 'star wars', 'pixar', 'toy story', 'inside out', 'frozen', 'moana', 'x-men', 'deadpool', 'guardians of the galaxy', 'black panther', 'doctor strange', 'ant-man', 'falcon', 'hawkeye', 'moon knight', 'ms. marvel', 'she-hulk', 'daredevil', 'agatha', 'thunderbolts', 'fantastic four']
  },
  {
    app: APP_META.hbomax,
    companyIds: [174, 128064, 429, 9993, 3268, 49],
    networkIds: [49, 3186, 6783],
    keywords: ['house of the dragon', 'game of thrones', 'the last of us', 'harry potter', 'fantastic beasts', 'batman', 'superman', 'joker', 'aquaman', 'wonder woman', 'dune', 'euphoria', 'the penguin', 'peacemaker', 'white lotus', 'succession', 'rick and morty', 'conjuring']
  },
  {
    app: APP_META.primevideo,
    companyIds: [20580, 10246],
    networkIds: [1024],
    keywords: ['the boys', 'gen v', 'reacher', 'rings of power', 'jack ryan', 'fallout', 'invincible', 'citadel', 'the terminal list', 'wheel of time', 'mr. & mrs. smith', 'saltburn', 'road house', 'the idea of you']
  },
  {
    app: APP_META.netflix,
    companyIds: [213, 1957],
    networkIds: [213],
    keywords: ['squid game', 'stranger things', 'wednesday', 'bridgerton', 'money heist', 'la casa de papel', 'lupin', 'the witcher', 'one piece', 'queen of tears', 'the glory', 'all of us are dead', 'sweet home', 'extraction', 'red notice', 'glass onion', 'enola holmes', 'boboiboy', 'ejen ali', 'upin & ipin', 'spider-man: no way home', 'spider-man: homecoming', 'spider-man: far from home', 'spider-verse']
  }
];

function dedupeApps(apps = []) {
  const seen = new Set();
  return apps.filter(a => {
    if (!a || !a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function inferFirstPartyApps(title, detailsJson = null) {
  const matched = [];
  const lowerTitle = String(title || '').toLowerCase();
  const companyIds = new Set((detailsJson?.production_companies || []).map(c => c.id));
  const networkIds = new Set((detailsJson?.networks || []).map(n => n.id));

  for (const rule of STUDIO_APP_RULES) {
    const hitCompany = rule.companyIds.some(id => companyIds.has(id));
    const hitNetwork = rule.networkIds.some(id => networkIds.has(id));
    const hitKeyword = rule.keywords.some(kw => lowerTitle.includes(kw));
    if (hitCompany || hitNetwork || hitKeyword) {
      matched.push(rule.app);
    }
  }
  return dedupeApps(matched);
}

function normalizeMatchScore(title, query) {
  const t = String(title || '').toLowerCase().trim();
  const q = String(query || '').toLowerCase().trim();
  if (!t || !q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 600;
  if (t.includes(q)) return 350;
  return 0;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const q = String(req.query.q || '').trim();
  const region = String(req.query.region || 'MY').toUpperCase();

  if (!q) {
    return res.status(200).json({ items: [] });
  }

  if (!TMDB_KEY) {
    return res.status(200).json({
      items: [],
      note: 'Set TMDB_API_KEY in Vercel environment variables to search live movies and TV shows.'
    });
  }

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;
    const sRes = await fetch(searchUrl);
    if (!sRes.ok) {
      return res.status(200).json({ items: [] });
    }
    const sData = await sRes.json();

    const rawResults = Array.isArray(sData.results)
      ? sData.results
          .filter(r => r && (r.media_type === 'movie' || r.media_type === 'tv'))
          .sort((a, b) => {
            const sa = normalizeMatchScore(a.title || a.name, q) + (a.popularity || 0);
            const sb = normalizeMatchScore(b.title || b.name, q) + (b.popularity || 0);
            return sb - sa;
          })
          .slice(0, 12)
      : [];

    const enriched = await Promise.all(rawResults.map(async (item) => {
      const mType = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'Untitled';
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? releaseDate.slice(0, 4) : '-';
      const isBND = /spider-?man:\s*brand\s*new\s*day/i.test(title);

      let availableApps = [];
      let detailsJson = null;

      if (isBND) {
        availableApps = [APP_META.netflix];
      } else {
        try {
          const [wpRes, dRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${mType}/${item.id}/watch/providers?api_key=${encodeURIComponent(TMDB_KEY)}`),
            fetch(`https://api.themoviedb.org/3/${mType}/${item.id}?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US`)
          ]);
          if (dRes.ok) detailsJson = await dRes.json();
          if (wpRes.ok) {
            const wpData = await wpRes.json();
            const regObj = wpData?.results?.[region] || {};
            const sgObj = wpData?.results?.SG || {};
            const usObj = wpData?.results?.US || {};

            const primaryList = [
              ...(Array.isArray(regObj.flatrate) ? regObj.flatrate : []),
              ...(Array.isArray(regObj.free) ? regObj.free : []),
              ...(Array.isArray(regObj.ads) ? regObj.ads : [])
            ];
            primaryList.forEach(p => {
              const mapped = PROVIDER_MAP[p.provider_id];
              if (mapped) availableApps.push(mapped);
            });

            if (!availableApps.length) {
              const studioApps = inferFirstPartyApps(title, detailsJson);
              if (studioApps.length) {
                availableApps = studioApps;
              } else {
                const fallbackList = [
                  ...(Array.isArray(sgObj.flatrate) ? sgObj.flatrate : []),
                  ...(Array.isArray(usObj.flatrate) ? usObj.flatrate : [])
                ];
                fallbackList.forEach(p => {
                  const mapped = PROVIDER_MAP[p.provider_id];
                  if (mapped) availableApps.push(mapped);
                });
              }
            }
          }
        } catch (e) {}

        if (!availableApps.length) {
          availableApps = inferFirstPartyApps(title, detailsJson);
        }
      }

      return {
        id: `${mType}-${item.id}`,
        title,
        year,
        releaseDate,
        mediaType: mType === 'tv' ? 'SERIES' : 'MOVIE',
        rating: isBND
          ? '8.2'
          : (typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : 'N/A'),
        overview: (detailsJson?.overview || item.overview || '').trim(),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
        availableApps: dedupeApps(availableApps)
      };
    }));

    return res.status(200).json({ region, items: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', items: [] });
  }
};
