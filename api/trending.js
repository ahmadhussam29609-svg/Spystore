export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
  const today = new Date().toISOString().split('T')[0];

  async function fetchPlatform(type, providerId, region = 'MY') {
    const dateParam = type === 'movie' ? `primary_release_date.lte=${today}` : `first_air_date.lte=${today}`;
    const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${apiKey}&watch_region=${region}&with_watch_providers=${providerId}&sort_by=popularity.desc&${dateParam}&language=en-US`;
    const r = await fetch(url);
    const d = await r.json();
    return (d.results || []).filter(i => i.backdrop_path);
  }

  try {
    let [nfTv, nfMov, dpTv, dpMov, hboTv, hboMov] = await Promise.all([
      fetchPlatform('tv', '8', 'MY'),
      fetchPlatform('movie', '8', 'MY'),
      fetchPlatform('tv', '337|122', 'MY'),
      fetchPlatform('movie', '337|122', 'MY'),
      fetchPlatform('tv', '1899|384', 'MY'),
      fetchPlatform('movie', '1899|384', 'MY')
    ]);

    // Fallback jika MY Disney+/HBO pulangkan hasil sedikit
    if (dpTv.length < 3) dpTv = await fetchPlatform('tv', '337', 'US');
    if (dpMov.length < 3) dpMov = await fetchPlatform('movie', '337', 'US');
    if (hboTv.length < 3) hboTv = await fetchPlatform('tv', '1899', 'US');
    if (hboMov.length < 3) hboMov = await fetchPlatform('movie', '1899', 'US');

    const formatList = (list, platformId, platformLabel, mediaType) =>
      list.slice(0, 10).map((item, idx) => ({
        rank: idx + 1,
        title: item.title || item.name || 'Trending Title',
        overview: item.overview || '',
        rating: item.vote_average ? item.vote_average.toFixed(1) : '8.0',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : '',
        backdrop: `https://image.tmdb.org/t/p/w780${item.backdrop_path}`,
        platformId,
        platformLabel,
        mediaType
      }));

    const byApp = {
      netflix: {
        movies: formatList(nfMov, 'netflix', 'Netflix', 'MOVIE'),
        series: formatList(nfTv, 'netflix', 'Netflix', 'SERIES')
      },
      disney: {
        movies: formatList(dpMov, 'disney', 'Disney+', 'MOVIE'),
        series: formatList(dpTv, 'disney', 'Disney+', 'SERIES')
      },
      hbomax: {
        movies: formatList(hboMov, 'hbomax', 'HBO Max', 'MOVIE'),
        series: formatList(hboTv, 'hbomax', 'HBO Max', 'SERIES')
      }
    };

    const heroItems = [
      byApp.netflix.series[0],
      byApp.disney.movies[0],
      byApp.hbomax.series[0],
      byApp.netflix.movies[0],
      byApp.disney.series[0]
    ]
      .filter(Boolean)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ items: heroItems, byApp });
  } catch (err) {
    return res.status(500).json({ error: err.message, items: [], byApp: {} });
  }
}
