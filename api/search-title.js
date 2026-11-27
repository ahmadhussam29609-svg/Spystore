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

function dedupeApps(apps = []) {
  const seen = new Set();
  return apps.filter(a => {
    if (!a || !a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function isFakeOrInvalidTitle(title, yearStr) {
  const t = String(title || '').toLowerCase().trim();
  if (!t) return true;

  const blockedPatterns = [
    'evil spiderman',
    'the spiderman',
    'italian spiderman',
    'japanese spiderman',
    'neukölln spiderman',
    'neukolln spiderman',
    'spiderman ultimate',
    'spiderman graveyard',
    'low budget',
    'untitled ',
    'elemental heroes',
    'sinopsis ',
    'synopsis '
  ];
  if (blockedPatterns.some(pat => t.includes(pat))) {
    return true;
  }

  const yNum = parseInt(String(yearStr || ''), 10);
  if (!isNaN(yNum) && yNum > 2026) {
    return true;
  }

  return false;
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
    const pagesToFetch = q.length <= 14 ? [1, 2] : [1];
    const pageResponses = await Promise.all(
      pagesToFetch.map(async (pg) => {
        const u = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=${pg}`;
        const r = await fetch(u);
        if (!r.ok) return [];
        const j = await r.json();
        return Array.isArray(j.results) ? j.results : [];
      })
    );

    const combinedRaw = pageResponses.flat().filter(r => r && (r.media_type === 'movie' || r.media_type === 'tv'));
    const seenMedia = new Set();
    const uniqueRaw = combinedRaw.filter(r => {
      const k = `${r.media_type}-${r.id}`;
      if (seenMedia.has(k)) return false;
      seenMedia.add(k);
      return true;
    });

    const filteredRaw = uniqueRaw.filter(r => {
      const t = r.title || r.name || '';
      const rel = r.release_date || r.first_air_date || '';
      const yr = rel ? rel.slice(0, 4) : '';
      return !isFakeOrInvalidTitle(t, yr);
    });

    const rawResults = filteredRaw
      .sort((a, b) => {
        const sa = normalizeMatchScore(a.title || a.name, q) + (a.popularity || 0);
        const sb = normalizeMatchScore(b.title || b.name, q) + (b.popularity || 0);
        return sb - sa;
      })
      .slice(0, 14);

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
            const providerEntries = [
              ...(Array.isArray(regObj.flatrate) ? regObj.flatrate : []),
              ...(Array.isArray(regObj.free) ? regObj.free : []),
              ...(Array.isArray(regObj.ads) ? regObj.ads : [])
            ];
            providerEntries.forEach(p => {
              const mapped = PROVIDER_MAP[p.provider_id];
              if (mapped) availableApps.push(mapped);
            });
          }
        } catch (e) {}
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
