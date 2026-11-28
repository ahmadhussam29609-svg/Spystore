const TMDB_KEY = process.env.TMDB_API_KEY || '';

const APP_META = {
  netflix: { id: 'netflix', label: 'Netflix', price: 18 },
  disney: { id: 'disney', label: 'Disney+', price: 16 },
  hbomax: { id: 'hbomax', label: 'HBO Max', price: 16 },
  primevideo: { id: 'primevideo', label: 'Prime Video', price: 10 }
};

const PROVIDER_MAP = {
  8: 'netflix',
  1796: 'netflix',
  337: 'disney',
  122: 'disney',
  390: 'disney',
  1899: 'hbomax',
  384: 'hbomax',
  118: 'hbomax',
  119: 'primevideo',
  9: 'primevideo',
  10: 'primevideo'
};

function getTodayKeyMY() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function isFreshTitle(yearStr, titleStr = '') {
  const t = String(titleStr || '').toLowerCase();
  if (/the\s+odyssey|avengers:\s*doomsday/i.test(t)) return false;
  const y = parseInt(String(yearStr || ''), 10);
  if (isNaN(y)) return true;
  return y >= 2025 && y <= 2026;
}

async function fetchJsonSafe(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const dayKey = getTodayKeyMY();

  if (!TMDB_KEY) {
    return res.status(200).json({ day: dayKey, items: [], byApp: {}, categories: {} });
  }

  try {
    const [trAll1, trAll2, trMov, trTv, discMov25, discMov26, discTv25, discTv26] = await Promise.all([
      fetchJsonSafe(`https://api.themoviedb.org/3/trending/all/day?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/trending/all/day?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US&page=2`),
      fetchJsonSafe(`https://api.themoviedb.org/3/trending/movie/day?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/trending/tv/day?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(TMDB_KEY)}&sort_by=popularity.desc&primary_release_date.gte=2025-01-01&primary_release_date.lte=2026-11-28&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(TMDB_KEY)}&sort_by=popularity.desc&primary_release_date.gte=2026-01-01&primary_release_date.lte=2026-11-28&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/discover/tv?api_key=${encodeURIComponent(TMDB_KEY)}&sort_by=popularity.desc&first_air_date.gte=2025-01-01&first_air_date.lte=2026-11-28&page=1`),
      fetchJsonSafe(`https://api.themoviedb.org/3/discover/tv?api_key=${encodeURIComponent(TMDB_KEY)}&sort_by=popularity.desc&first_air_date.gte=2026-01-01&first_air_date.lte=2026-11-28&page=1`)
    ]);

    const rawPool = [
      ...(Array.isArray(trAll1?.results) ? trAll1.results.map((x, i) => ({ ...x, _searchBoost: 120 - i })) : []),
      ...(Array.isArray(trAll2?.results) ? trAll2.results.map((x, i) => ({ ...x, _searchBoost: 80 - i })) : []),
      ...(Array.isArray(trMov?.results) ? trMov.results.map((x, i) => ({ ...x, media_type: 'movie', _searchBoost: 110 - i })) : []),
      ...(Array.isArray(trTv?.results) ? trTv.results.map((x, i) => ({ ...x, media_type: 'tv', _searchBoost: 110 - i })) : []),
      ...(Array.isArray(discMov26?.results) ? discMov26.results.map((x, i) => ({ ...x, media_type: 'movie', _searchBoost: 95 - i })) : []),
      ...(Array.isArray(discMov25?.results) ? discMov25.results.map((x, i) => ({ ...x, media_type: 'movie', _searchBoost: 85 - i })) : []),
      ...(Array.isArray(discTv26?.results) ? discTv26.results.map((x, i) => ({ ...x, media_type: 'tv', _searchBoost: 95 - i })) : []),
      ...(Array.isArray(discTv25?.results) ? discTv25.results.map((x, i) => ({ ...x, media_type: 'tv', _searchBoost: 85 - i })) : [])
    ].filter(r => r && (r.media_type === 'movie' || r.media_type === 'tv') && (r.title || r.name));

    const seen = new Set();
    const freshSorted = rawPool
      .filter(r => {
        const k = `${r.media_type}-${r.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        const title = r.title || r.name || '';
        const rel = r.release_date || r.first_air_date || '';
        const yr = rel ? rel.slice(0, 4) : '2026';
        return isFreshTitle(yr, title);
      })
      .sort((a, b) => {
        const scoreA = (a._searchBoost || 0) * 10 + (a.popularity || 0);
        const scoreB = (b._searchBoost || 0) * 10 + (b.popularity || 0);
        return scoreB - scoreA;
      })
      .slice(0, 36);

    const enriched = await Promise.all(freshSorted.map(async (item, idx) => {
      const mType = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'Untitled';
      const rel = item.release_date || item.first_air_date || '';
      const year = rel ? rel.slice(0, 4) : '2026';
      const origLang = String(item.original_language || '').toLowerCase();
      const isKdrama = origLang === 'ko';
      const isNew = year === '2026' || year === '2025';
      const rating = typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : '8.0';
      const dailySearchScore = Math.round((item._searchBoost || 50) * 10 + (item.popularity || 50));

      let detectedApp = '';
      const platforms = [];
      try {
        const wp = await fetchJsonSafe(`https://api.themoviedb.org/3/${mType}/${item.id}/watch/providers?api_key=${encodeURIComponent(TMDB_KEY)}`);
        const myObj = wp?.results?.MY || {};
        const flat = [...(Array.isArray(myObj.flatrate) ? myObj.flatrate : []), ...(Array.isArray(myObj.free) ? myObj.free : [])];
        const added = new Set();
        for (const p of flat) {
          const appId = PROVIDER_MAP[p.provider_id];
          if (appId && !added.has(appId)) {
            added.add(appId);
            platforms.push({ id: appId, label: APP_META[appId].label });
            if (!detectedApp) detectedApp = appId;
          }
        }
      } catch (e) {}

      if (!detectedApp) {
        const fallbackApps = ['netflix', 'disney', 'hbomax', 'primevideo'];
        detectedApp = fallbackApps[idx % fallbackApps.length];
        platforms.push({ id: detectedApp, label: APP_META[detectedApp].label });
      }

      return {
        rank: idx + 1,
        id: item.id,
        title,
        year,
        mediaType: mType === 'tv' ? 'SERIES' : 'MOVIE',
        platformId: detectedApp,
        platformLabel: APP_META[detectedApp]?.label || 'Netflix',
        platforms,
        price: APP_META[detectedApp]?.price || 18,
        rating,
        popularity: dailySearchScore,
        dailySearchScore,
        day: dayKey,
        isNew,
        isKdrama,
        isRewatched: dailySearchScore >= 400,
        isOnlyOn: platforms.length === 1,
        overview: (item.overview || `${title} (${year}) — top daily search pick for ${dayKey}.`).trim(),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : ''
      };
    }));

    const byApp = {};
    Object.keys(APP_META).forEach(appKey => {
      const appList = enriched.filter(x => x.platformId === appKey);
      const baseList = appList.length >= 6 ? appList : enriched.map((x, i) => ({
        ...x,
        platformId: appKey,
        platformLabel: APP_META[appKey].label,
        platforms: [{ id: appKey, label: APP_META[appKey].label }],
        price: APP_META[appKey].price,
        rank: i + 1
      }));
      const movies = baseList.filter(x => x.mediaType === 'MOVIE');
      const series = baseList.filter(x => x.mediaType === 'SERIES');
      byApp[appKey] = {
        label: APP_META[appKey].label,
        price: APP_META[appKey].price,
        all: baseList,
        movies: movies.length ? movies : baseList,
        series: series.length ? series : baseList,
        newMovies: movies.filter(x => x.isNew),
        newSeries: series.filter(x => x.isNew),
        newReleases: baseList.filter(x => x.isNew).slice(0, 10),
        popcorn: (movies.length ? movies : baseList).slice().sort((a, b) => (b.dailySearchScore || 0) - (a.dailySearchScore || 0)),
        kdrama: baseList.filter(x => x.isKdrama),
        rewatched: baseList.filter(x => x.isRewatched),
        onlyOn: baseList.filter(x => x.isOnlyOn)
      };
    });

    const categories = {
      tv_my: enriched.filter(x => x.mediaType === 'SERIES').slice(0, 10),
      movie_my: enriched.filter(x => x.mediaType === 'MOVIE').slice(0, 10),
      new_in: enriched.filter(x => x.isNew).slice(0, 10),
      popcorn: enriched.filter(x => x.mediaType === 'MOVIE').slice(0, 10),
      kdrama: enriched.filter(x => x.isKdrama).slice(0, 10),
      rewatched: enriched.filter(x => x.isRewatched).slice(0, 10),
      only_on: enriched.filter(x => x.isOnlyOn).slice(0, 10)
    };

    return res.status(200).json({
      day: dayKey,
      items: enriched.slice(0, 6),
      byApp,
      categories
    });
  } catch (err) {
    return res.status(500).json({ day: dayKey, items: [], byApp: {}, categories: {} });
  }
};
