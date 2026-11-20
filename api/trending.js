export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
  const today = new Date().toISOString().split('T')[0];

  try {
    // Tarik cerita yang SUDAH release dan boleh distrim di Malaysia (watch_region=MY)
    const platforms = [
      { id: 'netflix', label: 'Netflix', providerId: '8', type: 'tv' },
      { id: 'disney', label: 'Disney+', providerId: '337', type: 'movie' },
      { id: 'hbomax', label: 'HBO Max', providerId: '1899|384', type: 'tv' },
      { id: 'prime', label: 'Prime Video', providerId: '119', type: 'movie' },
      { id: 'netflix', label: 'Netflix', providerId: '8', type: 'movie' }
    ];

    const results = await Promise.all(
      platforms.map(async (plat, index) => {
        const dateParam = plat.type === 'movie'
          ? `primary_release_date.lte=${today}`
          : `first_air_date.lte=${today}`;

        const url = `https://api.themoviedb.org/3/discover/${plat.type}?api_key=${apiKey}&watch_region=MY&with_watch_providers=${plat.providerId}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&${dateParam}&language=en-US`;

        const resp = await fetch(url);
        const data = await resp.json();
        const item = (data.results || []).find(r => r.backdrop_path) || (data.results || [])[0];

        if (!item) return null;

        return {
          rank: index + 1,
          title: item.title || item.name || 'Trending Now',
          overview: item.overview || '',
          backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
          platformId: plat.id,
          platformLabel: plat.label,
          mediaType: plat.type === 'tv' ? 'SERIES' : 'MOVIE'
        };
      })
    );

    const validItems = results.filter(Boolean);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ items: validItems });
  } catch (err) {
    return res.status(500).json({ error: err.message, items: [] });
  }
}
