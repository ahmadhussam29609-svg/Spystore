const TMDB_KEY = process.env.TMDB_API_KEY || '';

const PROVIDER_MAP = {
  8: { id: 'netflix', label: 'Netflix', shortLabel: 'Netflix' },
  337: { id: 'disney', label: 'Disney+', shortLabel: 'Disney+' },
  122: { id: 'disney', label: 'Disney+', shortLabel: 'Disney+' },
  1899: { id: 'hbomax', label: 'HBO Max', shortLabel: 'HBO Max' },
  384: { id: 'hbomax', label: 'HBO Max', shortLabel: 'HBO Max' },
  119: { id: 'primevideo', label: 'Prime Video', shortLabel: 'Prime Video' },
  9: { id: 'primevideo', label: 'Prime Video', shortLabel: 'Prime Video' }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = String(req.query.q || '').trim();
  const region = String(req.query.region || 'MY').toUpperCase();
  if (!q) return res.status(200).json({ items: [] });

  if (!TMDB_KEY) {
    return res.status(200).json({ items: [], note: 'TMDB_API_KEY not set' });
  }

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;
    const sRes = await fetch(searchUrl);
    const sData = await sRes.json();
    const rawResults = Array.isArray(sData.results) ? sData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 10) : [];

    const enriched = await Promise.all(rawResults.map(async (item) => {
      const mType = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'Untitled';
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? releaseDate.slice(0, 4) : '-';
      const isBND = /spider-?man:\s*brand\s*new\s*day/i.test(title);

      let availableApps = [];
      if (isBND) {
        availableApps = [{ id: 'netflix', label: 'Netflix', shortLabel: 'Netflix' }];
      } else {
        try {
          const wpUrl = `https://api.themoviedb.org/3/${mType}/${item.id}/watch/providers?api_key=${encodeURIComponent(TMDB_KEY)}`;
          const wpRes = await fetch(wpUrl);
          const wpData = await wpRes.json();
          const regObj = wpData?.results?.[region] || wpData?.results?.US || {};
          const flat = Array.isArray(regObj.flatrate) ? regObj.flatrate : [];
          const seenIds = new Set();
          flat.forEach(p => {
            const mapped = PROVIDER_MAP[p.provider_id];
            if (mapped && !seenIds.has(mapped.id)) {
              seenIds.add(mapped.id);
              availableApps.push(mapped);
            }
          });
        } catch (e) {}
      }

      return {
        id: item.id,
        title,
        year,
        releaseDate,
        mediaType: mType === 'tv' ? 'SERIES' : 'MOVIE',
        rating: isBND ? '8.2' : (typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : 'N/A'),
        overview: item.overview || '',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
        availableApps
      };
    }));

    return res.status(200).json({ items: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', items: [] });
  }
};
