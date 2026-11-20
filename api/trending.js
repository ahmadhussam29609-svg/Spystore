// /api/trending.js
// Menarik carta penstriman untuk SPYSTORE BY SAMS dengan jaminan senarai sentiasa terisi

const TMDB_API_KEY = process.env.TMDB_API_KEY || '4d8856163cb184c1dc7eda6063f78d1a';
const WATCH_REGION = 'MY';

const PROVIDERS = [
  { id: 'netflix', label: 'Netflix', providerId: 8, price: 18, region: 'MY' },
  { id: 'disney', label: 'Disney+', providerId: 337, price: 16, region: 'US' },
  { id: 'hbomax', label: 'HBO Max', providerId: 1899, price: 15, region: 'MY' }
];

const IMG_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const IMG_POSTER = 'https://image.tmdb.org/t/p/w342';

const FALLBACK_CATALOG = {
  netflix: [
    { id: 93405, title: 'Squid Game', mediaType: 'SERIES', rating: '7.9', overview: 'Hundreds of cash-strapped players accept a strange invitation to compete in children's games for a tempting prize.' },
    { id: 119051, title: 'Wednesday', mediaType: 'SERIES', rating: '8.5', overview: 'Smart, sarcastic and a little dead inside, Wednesday Addams investigates a murder spree while making new friends at Nevermore.' },
    { id: 66732, title: 'Stranger Things', mediaType: 'SERIES', rating: '8.6', overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.' },
    { id: 202250, title: '3 Body Problem', mediaType: 'SERIES', rating: '7.5', overview: 'Across continents and decades, five brilliant scientists make startling discoveries as the laws of science unspool before their eyes.' },
    { id: 1399, title: 'Game of Thrones', mediaType: 'SERIES', rating: '8.5', overview: 'Seven noble families fight for control of the mythical land of Westeros.' }
  ],
  disney: [
    { id: 299534, title: 'Avengers: Endgame', mediaType: 'MOVIE', rating: '8.3', overview: 'After the devastating events of Avengers: Infinity War, the universe is in ruins due to the efforts of Thanos.' },
    { id: 82684, title: 'The Mandalorian', mediaType: 'SERIES', rating: '8.5', overview: 'After the fall of the Galactic Empire, a lone gunfighter makes his way through the outer reaches of the galaxy.' },
    { id: 1022796, title: 'Inside Out 2', mediaType: 'MOVIE', rating: '7.6', overview: 'Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for something completely unexpected: new Emotions!' },
    { id: 92749, title: 'Moon Knight', mediaType: 'SERIES', rating: '7.8', overview: 'When Steven Grant, a mild-mannered gift-shop employee, becomes plagued with blackouts and memories of another life, he discovers he has dissociative identity disorder.' },
    { id: 150540, title: 'Inside Out', mediaType: 'MOVIE', rating: '7.9', overview: 'When 11-year-old Riley moves to a new city, her Emotions team up to help her through the transition.' }
  ],
  hbomax: [
    { id: 94997, title: 'House of the Dragon', mediaType: 'SERIES', rating: '8.4', overview: 'The story of the Targaryen civil war that took place about 200 years before events portrayed in Game of Thrones.' },
    { id: 693134, title: 'Dune: Part Two', mediaType: 'MOVIE', rating: '8.1', overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge.' },
    { id: 155, title: 'The Dark Knight', mediaType: 'MOVIE', rating: '8.5', overview: 'Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and District Attorney Harvey Dent.' },
    { id: 87108, title: 'Succession', mediaType: 'SERIES', rating: '8.3', overview: 'The Roy family is known for controlling the biggest media and entertainment company in the world.' },
    { id: 1622, title: 'Supernatural', mediaType: 'SERIES', rating: '8.3', overview: 'When they were boys, Sam and Dean Winchester lost their mother to a mysterious and demonic supernatural force.' }
  ]
};

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
    rating: raw.vote_average ? Number(raw.vote_average).toFixed(1) : (raw.rating || '7.8'),
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
      const fbList = FALLBACK_CATALOG[prov.id] || [];
      const fbMovies = fbList.filter(x => x.mediaType === 'MOVIE');
      const fbSeries = fbList.filter(x => x.mediaType === 'SERIES');

      const rawMovSource = (movDisc.results && movDisc.results.length) ? movDisc.results : fbMovies;
      const rawTvSource = (tvDisc.results && tvDisc.results.length) ? tvDisc.results : fbSeries;

      const seenM = new Set();
      const movies = rawMovSource
        .map((m, i) => formatItem(m, 'movie', prov, i + 1))
        .filter(it => {
          if (seenM.has(it.id) || !isReleased(it)) return false;
          seenM.add(it.id);
          return true;
        })
        .slice(0, 10)
        .map((m, i) => ({ ...m, rank: i + 1 }));

      const seenT = new Set();
      const series = rawTvSource
        .map((t, i) => formatItem(t, 'tv', prov, i + 1))
        .filter(it => {
          if (seenT.has(it.id) || !isReleased(it)) return false;
          seenT.add(it.id);
          return true;
        })
        .slice(0, 10)
        .map((t, i) => ({ ...t, rank: i + 1 }));

      const rawNewMovSource = (movNew.results && movNew.results.length) ? movNew.results : rawMovSource;
      const rawNewTvSource = (tvNew.results && tvNew.results.length) ? tvNew.results : rawTvSource;

      const seenNM = new Set();
      const newMovies = rawNewMovSource
        .map((m, i) => formatItem(m, 'movie', prov, i + 1))
        .filter(it => {
          if (seenNM.has(it.id) || !isReleased(it)) return false;
          seenNM.add(it.id);
          return true;
        })
        .slice(0, 6);

      const seenNT = new Set();
      const newSeries = rawNewTvSource
        .map((t, i) => formatItem(t, 'tv', prov, i + 1))
        .filter(it => {
          if (seenNT.has(it.id) || !isReleased(it)) return false;
          seenNT.add(it.id);
          return true;
        })
        .slice(0, 6);

      const seenKo = new Set();
      const koRaw = [
        ...(tvKo.results || []).map((t, i) => formatItem(t, 'tv', prov, i + 1)),
        ...(movKo.results || []).map((m, i) => formatItem(m, 'movie', prov, i + 1))
      ];
      const kdramaList = (koRaw.length ? koRaw : [...series, ...movies])
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

    const tvSource = (trendingTvRes.results && trendingTvRes.results.length)
      ? trendingTvRes.results
      : [...(byApp.netflix?.series || []), ...(byApp.disney?.series || []), ...(byApp.hbomax?.series || [])];

    const tvMy = tvSource
      .map((r, idx) => {
        const plat = idToPlatform.get(`SERIES_${r.id}`) || PROVIDERS[idx % PROVIDERS.length];
        return formatItem(r, 'tv', plat, idx + 1);
      })
      .filter(isReleased)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    const movSource = (trendingMovRes.results && trendingMovRes.results.length)
      ? trendingMovRes.results
      : [...(byApp.disney?.movies || []), ...(byApp.hbomax?.movies || []), ...(byApp.netflix?.movies || [])];

    const movieMy = movSource
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
    const kdrama = (kdramaRaw.length ? kdramaRaw : [
      ...(byApp.netflix?.kdrama || []),
      ...(byApp.disney?.kdrama || []),
      ...(byApp.hbomax?.kdrama || [])
    ])
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
