export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';

  try {
    const trendingRes = await fetch(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=en-US`
    );
    const trendingData = await trendingRes.json();
    const topItems = (trendingData.results || []).slice(0, 5);

    const enriched = await Promise.all(
      topItems.map(async (item, index) => {
        const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
        const title = item.title || item.name || 'Trending Title';
        const overview = item.overview || '';
        const backdrop = item.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
          : '';

        let platformId = 'netflix';
        let platformLabel = 'Netflix';

        try {
          const provRes = await fetch(
            `https://api.themoviedb.org/3/${mediaType}/${item.id}/watch/providers?api_key=${apiKey}`
          );
          const provData = await provRes.json();
          const myProviders = provData.results?.MY?.flatrate || provData.results?.US?.flatrate || [];
          const names = myProviders.map((p) => (p.provider_name || '').toLowerCase()).join(' ');

          if (names.includes('disney')) {
            platformId = 'disney';
            platformLabel = 'Disney+';
          } else if (names.includes('hbo') || names.includes('max')) {
            platformId = 'hbomax';
            platformLabel = 'HBO Max';
          } else if (names.includes('netflix')) {
            platformId = 'netflix';
            platformLabel = 'Netflix';
          }
        } catch (e) {}

        return {
          rank: index + 1,
          title,
          overview,
          backdrop,
          platformId,
          platformLabel,
          mediaType: mediaType === 'tv' ? 'SERIES' : 'MOVIE'
        };
      })
    );

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ items: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message, items: [] });
  }
}
