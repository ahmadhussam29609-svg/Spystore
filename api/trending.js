// /api/trending.js
// Netflix (RM18) & HBO Max (RM15) guna wilayah MY; Disney+ (RM16) guna katalog global rasmi Disney+ (US)

const TMDB_API_KEY = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
const WATCH_REGION = 'MY';

const PROVIDERS = [
  { id: 'netflix', label: 'Netflix', providerId: 8, price: 18, region: 'MY' },
  { id: 'disney', label: 'Disney+', providerId: 337, price: 16, region: 'US' },
  { id: 'hbomax', label: 'HBO Max', providerId: 1899, price: 15, region: 'MY' }
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

async function tmdbGetSafe(path) {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const url = `https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_API_KEY}&language=en-US`;
    const res = await fetch(url);
    if (!res.ok) return { results: [] };
    return await res.json();
  } catch {
    return { results: [] };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [
      trendingTvRes,
      trendingMovRes,
      kdramaTvRes,
      kdramaMovRes
    ] = await Promise.all([
      tmdbGetSafe(`/trending/tv/day?watch_region=${WATCH_REGION}`),
      tmdbGetSafe(`/trending/movie/day?watch_region=${WATCH_REGION}`),
      tmdbGetSafe(`/discover/tv?with_original_language=ko&sort_by=popularity.desc&first_air_date.lte=${todayStr}`),
      tmdbGetSafe(`/discover/movie?with_original_language=ko&sort_by=popularity.desc&release_date.lte=${todayStr}`)
    ]);

    const platformBundles = await Promise.all(
      PROVIDERS.map(async (prov) => {
        const reg = prov.region || WATCH_REGION;
        const [movDisc, tvDisc, movNew, tvNew, movKo, tvKo] = await Promise.all([
          tmdbGetSafe(`/discover/movie?watch_region=${reg}&with_watch_providers=${prov.providerId}&sort_by=popularity.desc&release_date.lte=${todayStr}`),
          tmdbGetSafe(`/discover/tv?watch_region=${reg}&with_watch_providers=${prov.providerId}&sort_by=popularity.desc&first_air_date.lte=${todayStr}`),
          tmdbGetSafe(`/discover/movie?watch_region=${reg}&with_watch_providers=${prov.providerId}&sort_by=release_date.desc&release_date.lte=${todayStr}&vote_count.gte=10`),
          tmdbGetSafe(`/discover/tv?watch_region=${reg}&with_watch_providers=${prov.providerId}&sort_by=first_air_date.desc&first_air_date.lte=${todayStr}&vote_count.gte=10`),
          tmdbGetSafe(`/discover/movie?watch_region=${reg}&with_watch_providers=${prov.providerId}&with_original_language=ko&sort_by=popularity.desc&release_date.lte=${todayStr}`),
          tmdbGetSafe(`/discover/tv?watch_region=${reg}&with_watch_providers=${prov.providerId}&with_original_language=ko&sort_by=popularity.desc&first_air_date.lte=${todayStr}`)
        ]);
        return { prov, movDisc, tvDisc, movNew, tvNew, movKo, tvKo };
      })
    );

    const byApp = {};
    platformBundles.forEach(({ prov, movDisc, tvDisc, movNew, tvNew, movKo, tvKo }) => {
      const seenM = new Set();
      const movies = (movDisc.results || [])
        .map((m, i) => formatItem(m, 'movie', prov, i + 1))
        .filter(it => {
          if (seenM.has(it.id) || !isReleased(it)) return false;
          seenM.add(it.id);
          return true;
        })
        .slice(0, 10)
        .map((m, i) => ({ ...m, rank: i + 1 }));

      const seenT = new Set();
      const series = (tvDisc.results || [])
        .map((t, i) => formatItem(t, 'tv', prov, i + 1))
        .filter(it => {
          if (seenT.has(it.id) || !isReleased(it)) return false;
          seenT.add(it.id);
          return true;
        })
        .slice(0, 10)
        .map((t, i) => ({ ...t, rank: i + 1 }));

      const seenNM = new Set();
      const newMovies = (movNew.results || [])
        .map((m, i) => formatItem(m, 'movie', prov, i + 1))
        .filter(it => {
          if (seenNM.has(it.id) || !isReleased(it)) return false;
          seenNM.add(it.id);
          return true;
        })
        .slice(0, 6);

      const seenNT = new Set();
      const newSeries = (tvNew.results || [])
        .map((t, i) => formatItem(t, 'tv', prov, i + 1))
        .filter(it => {
          if (seenNT.has(it.id) || !isReleased(it)) return false;
          seenNT.add(it.id);
          return true;
        })
        .slice(0, 6);

      const seenKo = new Set();
      const kdramaList = [
        ...(tvKo.results || []).map((t, i) => formatItem(t, 'tv', prov, i + 1)),
        ...(movKo.results || []).map((m, i) => formatItem(m, 'movie', prov, i + 1))
      ]
        .filter(it => {
          const key = `${it.mediaType}_${it.id}`;
          if (seenKo.has(key) || !isReleased(it)) return false;
          seenKo.add(key);
          return true;
        })
        .slice(0, 10)
        .map((it, i) => ({ ...it, rank: i + 1 }));

      byApp[prov.id] = {
        movies,
        series,
        newMovies,
        newSeries,
        kdrama: kdramaList,
        price: prov.price,
        label: prov.label
      };
    });

    const idToPlatform = new Map();
    PROVIDERS.forEach(prov => {
      (byApp[prov.id]?.movies || []).forEach(m => {
        if (!idToPlatform.has(`MOVIE_${m.id}`)) idToPlatform.set(`MOVIE_${m.id}`, prov);
      });
      (byApp[prov.id]?.series || []).forEach(t => {
        if (!idToPlatform.has(`SERIES_${t.id}`)) idToPlatform.set(`SERIES_${t.id}`, prov);
      });
    });

    const tvMy = (trendingTvRes.results || [])
      .map((r, idx) => {
        const plat = idToPlatform.get(`SERIES_${r.id}`) || PROVIDERS[idx % PROVIDERS.length];
        return formatItem(r, 'tv', plat, idx + 1);
      })
      .filter(isReleased)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    const movieMy = (trendingMovRes.results || [])
      .map((r, idx) => {
        const plat = idToPlatform.get(`MOVIE_${r.id}`) || PROVIDERS[idx % PROVIDERS.length];
        return formatItem(r, 'movie', plat, idx + 1);
      })
      .filter(isReleased)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    const newPool = [];
    for (let i = 0; i < 5; i++) {
      for (const prov of PROVIDERS) {
        const appObj = byApp[prov.id];
        if (appObj?.newMovies?.[i]) newPool.push(appObj.newMovies[i]);
        if (appObj?.newSeries?.[i]) newPool.push(appObj.newSeries[i]);
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
      .slice(0, 12)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const popcornRaw = [];
    PROVIDERS.forEach(prov => {
      (byApp[prov.id]?.movies || []).forEach(m => popcornRaw.push(m));
    });
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
    const koTvList = kdramaTvRes.results || [];
    const koMovList = kdramaMovRes.results || [];
    for (let i = 0; i < Math.max(koTvList.length, koMovList.length); i++) {
      if (koTvList[i]) {
        const plat = idToPlatform.get(`SERIES_${koTvList[i].id}`) || PROVIDERS[i % PROVIDERS.length];
        kdramaRaw.push(formatItem(koTvList[i], 'tv', plat, kdramaRaw.length + 1));
      }
      if (koMovList[i]) {
        const plat = idToPlatform.get(`MOVIE_${koMovList[i].id}`) || PROVIDERS[i % PROVIDERS.length];
        kdramaRaw.push(formatItem(koMovList[i], 'movie', plat, kdramaRaw.length + 1));
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
    PROVIDERS.forEach(prov => {
      (byApp[prov.id]?.series || []).forEach(s => rewatchedRaw.push(s));
    });
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

    const onlyOnPool = [];
    PROVIDERS.forEach(prov => {
      const mList = byApp[prov.id]?.movies || [];
      const sList = byApp[prov.id]?.series || [];
      if (mList[0]) onlyOnPool.push(mList[0]);
      if (sList[0]) onlyOnPool.push(sList[0]);
      if (mList[1]) onlyOnPool.push(mList[1]);
      if (sList[1]) onlyOnPool.push(sList[1]);
    });
    const seenOnly = new Set();
    const onlyOn = onlyOnPool
      .filter(it => {
        const key = `${it.mediaType}_${it.id}`;
        if (seenOnly.has(key) || !isReleased(it)) return false;
        seenOnly.add(key);
        return true;
      })
      .slice(0, 12)
      .map((it, idx) => ({ ...it, rank: idx + 1 }));

    const heroItems = [
      tvMy[0],
      byApp.disney?.movies?.[0] || movieMy[0],
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
