export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
  const today = new Date().toISOString().split('T')[0];

  try {
    const [nfTv, dpMov, hboTv, nfMov, dpTv] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&watch_region=MY&with_watch_providers=8&with_watch_monetization_types=flatrate&sort_by=popularity.desc&first_air_date.lte=${today}&language=en-US`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&watch_region=MY&with_watch_providers=337&with_watch_monetization_types=flatrate&sort_by=popularity.desc&primary_release_date.lte=${today}&language=en-US`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&watch_region=MY&with_watch_providers=1899|384&with_watch_monetization_types=flatrate&sort_by=popularity.desc&first_air_date.lte=${today}&language=en-US`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&watch_region=MY&with_watch_providers=8&with_watch_monetization_types=flatrate&sort_by=popularity.desc&primary_release_date.lte=${today}&language=en-US`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&watch_region=MY&with_watch_providers=337&with_watch_monetization_types=flatrate&sort_by=popularity.desc&first_air_date.lte=${today}&language=en-US`).then(r => r.json())
    ]);

    const mapItem = (item, platformId, platformLabel, mediaType) => ({
      title: item.title || item.name || 'Trending Title',
      overview: item.overview || '',
      rating: item.vote_average ? item.vote_average.toFixed(1) : '8.0',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : '',
      backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
      platformId,
      platformLabel,
      mediaType
    });

    const nfTvList = (nfTv.results || []).filter(r => r.backdrop_path).map(i => mapItem(i, 'netflix', 'Netflix', 'SERIES'));
    const dpMovList = (dpMov.results || []).filter(r => r.backdrop_path).map(i => mapItem(i, 'disney', 'Disney+', 'MOVIE'));
    const hboTvList = (hboTv.results || []).filter(r => r.backdrop_path).map(i => mapItem(i, 'hbomax', 'HBO Max', 'SERIES'));
    const nfMovList = (nfMov.results || []).filter(r => r.backdrop_path).map(i => mapItem(i, 'netflix', 'Netflix', 'MOVIE'));
    const dpTvList = (dpTv.results || []).filter(r => r.backdrop_path).map(i => mapItem(i, 'disney', 'Disney+', 'SERIES'));

    const heroItems = [nfTvList[0], dpMovList[0], hboTvList[0], nfMovList[0], dpTvList[0]]
      .filter(Boolean)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const top10Movies = [...nfMovList.slice(0, 5), ...dpMovList.slice(0, 5)]
      .slice(0, 10)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const top10Series = [...nfTvList.slice(0, 4), ...dpTvList.slice(0, 3), ...hboTvList.slice(0, 3)]
      .slice(0, 10)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ items: heroItems, top10Movies, top10Series });
  } catch (err) {
    return res.status(500).json({ error: err.message, items: [], top10Movies: [], top10Series: [] });
  }
}
