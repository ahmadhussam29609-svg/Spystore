// /api/trending.js
// Menarik carta penstriman wilayah Malaysia (MY) untuk SPYSTORE BY SAMS (Netflix RM18, Disney+ RM16, HBO Max RM15)

const TMDB_API_KEY = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
const WATCH_REGION = 'MY';

const PROVIDERS = [
  { id: 'netflix', label: 'Netflix', providerId: 8, price: 18 },
  { id: 'disney', label: 'Disney+', providerId: 337, price: 16 },
  { id: 'hbomax', label: 'HBO Max', providerId: 1899, price: 15 }
];

const IMG_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const IMG_POSTER = 'https://image.tmdb.org/t/p/w342';

function formatItem(raw, mediaType, platform, rank) {
  const title = raw.title || raw.name || 'Untitled';
  const releaseDate = raw.release_date || raw.first_air_date || '';
  return {
    rank,
    id: raw.id,
    title,
    mediaType: mediaType === 'movie' ? 'MOVIE' : 'SERIES',
    platformId: platform.id,
    platformLabel: platform.label,
    price: platform.price,
    rating: raw.vote_average ? Number(raw.vote_average).toFixed(1) : '7.5',
    popularity: raw.popularity || 0,
    releaseDate,
    overview: raw.overview || '',
    backdrop: raw.backdrop_path ? `${IMG_BACKDROP}${raw.backdrop_path}` : '',
    poster: raw.poster_path ? `${IMG_POSTER}${raw.poster_path}` : ''
  };
}

function isReleased(item) {
  if (!item.releaseDate) return true;
  const todayStr = new Date().toISOString().slice(0, 10);
  return item.releaseDate <= todayStr;
}

async function tmdbGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_API_KEY}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB error ${res.status}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [trendingTvRes, trendingMovRes] = await Promise.all([
      tmdbGet(`/trending/tv/day?watch_region=${WATCH_REGION}`),
      tmdbGet(`/trending/movie/day?watch_region=${WATCH_REGION}`)
    ]);

    const platformBundles = await Promise.all(
      PROVIDERS.map(async (prov) => {
        const [movDisc, tvDisc, movNew, tvNew, kdramaTv, kdramaMov] = await Promise.all([
          tmdbGet(`/discover/movie?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&sort_by=popularity.desc&release_date.lte=${todayStr}`),
          tmdbGet(`/discover/tv?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&sort_by=popularity.desc&first_air_date.lte=${todayStr}`),
          tmdbGet(`/discover/movie?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&sort_by=release_date.desc&release_date.lte=${todayStr}&vote_count.gte=15`),
          tmdbGet(`/discover/tv?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&sort_by=first_air_date.desc&first_air_date.lte=${todayStr}&vote_count.gte=10`),
          tmdbGet(`/discover/tv?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&with_original_language=ko&sort_by=popularity.desc&first_air_date.lte=${todayStr}`),
          tmdbGet(`/discover/movie?watch_region=${WATCH_REGION}&with_watch_providers=${prov.providerId}&with_original_language=ko&sort_by=popularity.desc&release_date.lte=${todayStr}`)
        ]);
        return { prov, movDisc, tvDisc, movNew, tvNew, kdramaTv, kdramaMov };
      })
    );

    const idToPlatform = new Map();
    platformBundles.forEach(({ prov, movDisc, tvDisc }) => {
      (movDisc.results || []).forEach(m => {
        if (!idToPlatform.has(`movie_${m.id}`)) idToPlatform.set(`movie_${m.id}`, prov);
      });
      (tvDisc.results || []).forEach(t => {
        if (!idToPlatform.has(`tv_${t.id}`)) idToPlatform.set(`tv_${t.id}`, prov);
      });
    });

    const tvMy = (trendingTvRes.results || [])
      .map(r => ({ raw: r, plat: idToPlatform.get(`tv_${r.id}`) || PROVIDERS[0] }))
      .map((x, idx) => formatItem(x.raw, 'tv', x.plat, idx + 1))
      .filter(isReleased)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    const movieMy = (trendingMovRes.results || [])
      .map(r => ({ raw: r, plat: idToPlatform.get(`movie_${r.id}`) || PROVIDERS[0] }))
      .map((x, idx) => formatItem(x.raw, 'movie', x.plat, idx + 1))
      .filter(isReleased)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    const newPool = [];
    for (let i = 0; i < 6; i++) {
      for (const { prov, movNew, tvNew } of platformBundles) {
        const pick = (i % 2 === 0 ? movNew.results : tvNew.results)?.[Math.floor(i / 2)];
        const mType = i % 2 === 0 ? 'movie' : 'tv';
        if (pick) newPool.push(formatItem(pick, mType, prov, newPool.length + 1));
      }
    }
    const seenNew = new Set();
    const newIn = newPool
      .filter(it => {
        const key = `${it.mediaType}_${it.id}`;
        if (seenNew.has(key) || !isReleased(it)) return false;
        seenNew.add(key);
        return true;
      })
      .slice(0, 10)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const popcornRaw = [];
    for (const { prov, movDisc } of platformBundles) {
      (movDisc.results || []).forEach(m => {
        const genres = m.genre_ids || [];
        if (genres.some(g => [28, 12, 35, 878].includes(g))) {
          popcornRaw.push(formatItem(m, 'movie', prov, popcornRaw.length + 1));
        }
      });
    }
    const seenPop = new Set();
    const popcorn = popcornRaw
      .filter(it => {
        if (seenPop.has(it.id) || !isReleased(it)) return false;
        seenPop.add(it.id);
        return true;
      })
      .sort((a, b) => Number(b.rating) - Number(a.rating) || b.popularity - a.popularity)
      .slice(0, 10)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const kdramaRaw = [];
    for (let i = 0; i < 6; i++) {
      for (const { prov, kdramaTv, kdramaMov } of platformBundles) {
        const tvItem = (kdramaTv.results || [])[i];
        if (tvItem) kdramaRaw.push(formatItem(tvItem, 'tv', prov, kdramaRaw.length + 1));
        const movItem = (kdramaMov.results || [])[i];
        if (movItem) kdramaRaw.push(formatItem(movItem, 'movie', prov, kdramaRaw.length + 1));
      }
    }
    const seenKd = new Set();
    const kdrama = kdramaRaw
      .filter(it => {
        const key = `${it.mediaType}_${it.id}`;
        if (seenKd.has(key) || !isReleased(it)) return false;
        seenKd.add(key);
        return true;
      })
      .slice(0, 10)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const rewatchedRaw = [];
    for (const { prov, tvDisc } of platformBundles) {
      (tvDisc.results || []).forEach(t => {
        rewatchedRaw.push(formatItem(t, 'tv', prov, rewatchedRaw.length + 1));
      });
    }
    const seenRew = new Set();
    const rewatched = rewatchedRaw
      .filter(it => {
        if (seenRew.has(it.id) || !isReleased(it)) return false;
        seenRew.add(it.id);
        return true;
      })
      .sort((a, b) => (b.popularity * Number(b.rating)) - (a.popularity * Number(a.rating)))
      .slice(0, 10)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const byApp = {};
    const onlyOnPool = [];
    platformBundles.forEach(({ prov, movDisc, tvDisc }) => {
      const movies = (movDisc.results || [])
        .map((m, i) => formatItem(m, 'movie', prov, i + 1))
        .filter(isReleased)
        .slice(0, 10)
        .map((m, i) => ({ ...m, rank: i + 1 }));

      const series = (tvDisc.results || [])
        .map((t, i) => formatItem(t, 'tv', prov, i + 1))
        .filter(isReleased)
        .slice(0, 10)
        .map((t, i) => ({ ...t, rank: i + 1 }));

      byApp[prov.id] = { movies, series, price: prov.price, label: prov.label };

      if (movies[0]) onlyOnPool.push({ ...movies[0], rank: onlyOnPool.length + 1 });
      if (series[0]) onlyOnPool.push({ ...series[0], rank: onlyOnPool.length + 1 });
      if (movies[1]) onlyOnPool.push({ ...movies[1], rank: onlyOnPool.length + 1 });
      if (series[1]) onlyOnPool.push({ ...series[1], rank: onlyOnPool.length + 1 });
    });

    const onlyOn = onlyOnPool.slice(0, 10).map((it, idx) => ({ ...it, rank: idx + 1 }));

    const heroItems = [
      tvMy[0],
      movieMy[0],
      kdrama[0],
      popcorn[0],
      newIn[0]
    ]
      .filter(Boolean)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const categories = {
      tv_my: tvMy,
      movie_my: movieMy,
      new_in: newIn,
      popcorn,
      kdrama,
      rewatched,
      only_on: onlyOn
    };

    return res.status(200).json({
      items: heroItems,
      categories,
      byApp
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to load trending charts',
      detail: err.message
    });
  }
}
