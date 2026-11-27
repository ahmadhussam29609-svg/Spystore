const TMDB_KEY = process.env.TMDB_API_KEY || '';

const PROVIDERS = [
  { id: 'netflix', label: 'Netflix', tmdbIds: '8', price: 18 },
  { id: 'disney', label: 'Disney+', tmdbIds: '337|122', price: 16 },
  { id: 'hbomax', label: 'HBO Max', tmdbIds: '1899|384', price: 16 },
  { id: 'primevideo', label: 'Prime Video', tmdbIds: '119|9', price: 10 }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!TMDB_KEY) {
    return res.status(200).json({ byApp: {}, items: [], note: 'Using client fallback + search enrichment' });
  }

  try {
    const byApp = {};
    const allItems = [];

    for (const prov of PROVIDERS) {
      const [movRes, tvRes, kdramaRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(TMDB_KEY)}&with_watch_providers=${prov.tmdbIds}&watch_region=MY&sort_by=popularity.desc&page=1`),
        fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${encodeURIComponent(TMDB_KEY)}&with_watch_providers=${prov.tmdbIds}&watch_region=MY&sort_by=popularity.desc&page=1`),
        fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${encodeURIComponent(TMDB_KEY)}&with_watch_providers=${prov.tmdbIds}&watch_region=MY&with_original_language=ko&sort_by=popularity.desc&page=1`)
      ]);

      const movJson = await movRes.json();
      const tvJson = await tvRes.json();
      const kdJson = await kdramaRes.json();

      const mapItem = (raw, mType, idx, extraFlags = {}) => {
        const title = raw.title || raw.name || 'Untitled';
        const rel = raw.release_date || raw.first_air_date || '';
        const yr = rel ? rel.slice(0, 4) : '2026';
        return {
          rank: idx + 1,
          id: raw.id,
          title,
          year: yr,
          mediaType: mType,
          platformId: prov.id,
          platformLabel: prov.label,
          platforms: [{ id: prov.id, label: prov.label }],
          price: prov.price,
          rating: typeof raw.vote_average === 'number' && raw.vote_average > 0 ? raw.vote_average.toFixed(1) : '8.0',
          popularity: Math.round(raw.popularity || (95 - idx * 3)),
          isNew: Number(yr) >= 2025,
          isKdrama: raw.original_language === 'ko' || Boolean(extraFlags.isKdrama),
          isRewatched: (raw.vote_count || 0) > 800,
          isOnlyOn: true,
          overview: raw.overview || '',
          poster: raw.poster_path ? `https://image.tmdb.org/t/p/w342${raw.poster_path}` : '',
          backdrop: raw.backdrop_path ? `https://image.tmdb.org/t/p/w780${raw.backdrop_path}` : ''
        };
      };

      const movies = (movJson.results || [])
        .filter(x => !(prov.id !== 'netflix' && /spider-?man:\s*brand\s*new\s*day/i.test(String(x.title || ''))))
        .slice(0, 10)
        .map((r, i) => mapItem(r, 'MOVIE', i));

      const series = (tvJson.results || []).slice(0, 10).map((r, i) => mapItem(r, 'SERIES', i));
      const kdrama = (kdJson.results || []).slice(0, 10).map((r, i) => mapItem(r, 'SERIES', i, { isKdrama: true }));
      const combined = [...movies, ...series];

      byApp[prov.id] = {
        label: prov.label,
        price: prov.price,
        all: combined,
        movies,
        series,
        newMovies: movies.filter(x => x.isNew),
        newSeries: series.filter(x => x.isNew),
        newReleases: combined.filter(x => x.isNew).slice(0, 10),
        popcorn: movies.slice().sort((a, b) => Number(b.rating) - Number(a.rating)),
        kdrama,
        rewatched: series.slice().sort((a, b) => b.popularity - a.popularity),
        onlyOn: combined.slice(0, 10)
      };

      allItems.push(...combined.slice(0, 3));
    }

    return res.status(200).json({
      byApp,
      items: allItems.slice(0, 6)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Trending fetch failed', byApp: {}, items: [] });
  }
};
