const TMDB_KEY = process.env.TMDB_API_KEY || '';

const APP_META = {
  netflix: { id: 'netflix', label: 'Netflix', shortLabel: 'Netflix' },
  disney: { id: 'disney', label: 'Disney+', shortLabel: 'Disney+' },
  hbomax: { id: 'hbomax', label: 'HBO Max', shortLabel: 'HBO Max' },
  primevideo: { id: 'primevideo', label: 'Prime Video', shortLabel: 'Prime Video' }
};

const PROVIDER_MAP = {
  8: APP_META.netflix,
  1796: APP_META.netflix,
  337: APP_META.disney,
  122: APP_META.disney,
  390: APP_META.disney,
  1899: APP_META.hbomax,
  384: APP_META.hbomax,
  118: APP_META.hbomax,
  119: APP_META.primevideo,
  9: APP_META.primevideo,
  10: APP_META.primevideo
};

function dedupeApps(apps = []) {
  const seen = new Set();
  return apps.filter(a => {
    if (!a || !a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

const OFFICIAL_SPIDERMAN_MOVIES_RX = /^(spider-?man|spider-?man\s*2|spider-?man\s*3|the\s+amazing\s+spider-?man|the\s+amazing\s+spider-?man\s*2|spider-?man:\s*homecoming|spider-?man:\s*far\s+from\s+home|spider-?man:\s*no\s+way\s+home|spider-?man:\s*into\s+the\s+spider-?verse|spider-?man:\s*across\s+the\s+spider-?verse)$/i;

function applySpiderManPlatformAvailability(title, currentApps = [], mediaType = 'MOVIE') {
  const t = String(title || '').toLowerCase().trim();
  const isMovie = String(mediaType || '').toUpperCase() === 'MOVIE' || String(mediaType || '').toLowerCase() === 'movie';
  if (/spider-?man:\s*brand\s*new\s*day/i.test(t)) {
    return [APP_META.netflix];
  }
  if (isMovie && OFFICIAL_SPIDERMAN_MOVIES_RX.test(t)) {
    return [APP_META.netflix, APP_META.disney];
  }
  return dedupeApps(Array.isArray(currentApps) ? [...currentApps] : []);
}

function tokenizeQuery(rawQuery) {
  return String(rawQuery || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function buildQueryVariants(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return [];
  const lower = q.toLowerCase().trim();
  const compact = lower.replace(/[^a-z0-9]/g, '');
  const variants = [q];

  if (compact.includes('spiderman') || lower === 'spider' || lower === 'spider-man') {
    variants.push('Spider-Man', 'Spiderman', 'The Amazing Spider-Man', 'The Amazing Spider-Man 2');
  } else if (compact.includes('marvel')) {
    variants.push('Marvel', 'Captain Marvel', 'The Marvels', 'Ms. Marvel');
  } else if (compact.includes('avengers')) {
    variants.push('Avengers', 'Avengers: Doomsday');
  } else if (compact.includes('wwe')) {
    variants.push('WWE', 'WWE Raw', 'WWE SmackDown');
  } else if (compact.includes('doraemon')) {
    variants.push('Doraemon', 'Stand by Me Doraemon');
  } else if (compact.includes('boboiboy')) {
    variants.push('BoBoiBoy', 'BoBoiBoy Galaxy', 'BoBoiBoy Movie');
  } else if (compact.includes('ejenali')) {
    variants.push('Ejen Ali', 'Ejen Ali: The Movie');
  }

  return Array.from(new Set(variants.map(v => v.trim()).filter(Boolean))).slice(0, 6);
}

function matchesStrictKeyword(title, rawQuery) {
  const tLower = String(title || '').toLowerCase();
  const tCompact = tLower.replace(/[^a-z0-9]/g, '');
  const qLower = String(rawQuery || '').toLowerCase().trim();
  const qCompact = qLower.replace(/[^a-z0-9]/g, '');
  if (!qCompact) return false;

  if (qCompact === 'spiderman' || qCompact === 'spider') {
    return tCompact.includes('spiderman') || tCompact.includes('spider');
  }

  const tokens = tokenizeQuery(rawQuery);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every(tok => {
      const tokCompact = tok.replace(/[^a-z0-9]/g, '');
      return tCompact.includes(tokCompact) || tLower.includes(tok);
    });
    if (allTokensPresent) return true;
  }

  return tCompact.includes(qCompact) || tLower.includes(qLower);
}

function isBlockedNonExistentOrFake(title, yearStr, overviewStr) {
  const t = String(title || '').toLowerCase().trim();
  const ov = String(overviewStr || '').toLowerCase().trim();
  if (!t) return true;

  const isAllowedUpcoming = /avengers:\s*doomsday/i.test(t) || /spider-?man:\s*brand\s*new\s*day/i.test(t);
  if (isAllowedUpcoming) return false;

  const yCheck = parseInt(String(yearStr || ''), 10);
  if (/spider-?man/i.test(t) && !isNaN(yCheck) && yCheck < 2000) {
    return true;
  }

  const blockedPatterns = [
    'evil spiderman',
    'the spiderman',
    'generations: the evolution of spider-man',
    'daredevil vs. spider-man',
    'daredevil vs spider-man',
    'the spider-man story',
    'superman, spider-man or batman',
    'icons unearthed: spider',
    'man-spider',
    'italian spiderman',
    'japanese spiderman',
    'neukölln spiderman',
    'neukolln spiderman',
    'spiderman ultimate',
    'spiderman graveyard',
    'all roads lead to no way home',
    'venom saga',
    'low budget',
    'untitled ',
    'elemental heroes',
    'sinopsis ',
    'synopsis ',
    'fan film',
    'fan-made',
    'fanmade',
    'parody',
    'cancelled',
    'canceled',
    'making of',
    'making the',
    'premiere special',
    'rite of passage',
    'behind the scenes',
    'behind-the-scenes',
    'featurette',
    'deleted scenes',
    'gag reel',
    'bloopers',
    'strikes back'
  ];
  if (blockedPatterns.some(pat => t.includes(pat) || ov.includes('cancelled') || ov.includes('canceled'))) {
    return true;
  }

  const yNum = parseInt(String(yearStr || ''), 10);
  if (!isNaN(yNum) && yNum > 2027) {
    return true;
  }

  return false;
}

function normalizeMatchScore(title, query) {
  const t = String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const q = String(query || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t || !q) return 0;
  let score = 0;
  if (t === q) score = 1000;
  else if (t.startsWith(q)) score = 700;
  else if (t.includes(q)) score = 500;
  return score;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const q = String(req.query.q || '').trim();
  const region = String(req.query.region || 'MY').toUpperCase();

  if (!q) {
    return res.status(200).json({ items: [] });
  }

  if (!TMDB_KEY) {
    return res.status(200).json({
      items: [],
      note: 'Set TMDB_API_KEY in Vercel environment variables to search live movies and TV shows.'
    });
  }

  try {
    const queryVariants = buildQueryVariants(q);
    const pagesToFetch = q.length <= 16 ? [1, 2] : [1];

    const tasks = [];
    for (const qVar of queryVariants) {
      for (const pg of pagesToFetch) {
        tasks.push(
          (async () => {
            const u = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent(qVar)}&include_adult=false&language=en-US&page=${pg}`;
            const r = await fetch(u);
            if (!r.ok) return [];
            const j = await r.json();
            return Array.isArray(j.results) ? j.results : [];
          })()
        );
      }
    }

    if (/spider/i.test(q)) {
      tasks.push(
        (async () => {
          const u = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_KEY)}&query=${encodeURIComponent('The Amazing Spider-Man')}&include_adult=false&language=en-US&page=1`;
          const r = await fetch(u);
          if (!r.ok) return [];
          const j = await r.json();
          const arr = Array.isArray(j.results) ? j.results : [];
          return arr.map(m => ({ ...m, media_type: 'movie' }));
        })()
      );
    }

    const nestedResults = await Promise.all(tasks);
    const combinedRaw = nestedResults.flat().filter(r => r && (r.media_type === 'movie' || r.media_type === 'tv'));

    const seenMedia = new Set();
    const uniqueRaw = combinedRaw.filter(r => {
      const k = `${r.media_type}-${r.id}`;
      if (seenMedia.has(k)) return false;
      seenMedia.add(k);
      return true;
    });

    const filteredRaw = uniqueRaw.filter(r => {
      const t = r.title || r.name || '';
      const rel = r.release_date || r.first_air_date || '';
      const yr = rel ? rel.slice(0, 4) : '';
      const ov = r.overview || '';
      if (isBlockedNonExistentOrFake(t, yr, ov)) return false;
      return matchesStrictKeyword(t, q);
    });

    const rawResults = filteredRaw
      .sort((a, b) => {
        const tA = String(a.title || a.name || '').toLowerCase();
        const tB = String(b.title || b.name || '').toLowerCase();
        const boostA = /^the amazing spider-?man( 2)?$/i.test(tA) ? 5000 : 0;
        const boostB = /^the amazing spider-?man( 2)?$/i.test(tB) ? 5000 : 0;
        const sa = boostA + normalizeMatchScore(a.title || a.name, q) + (a.popularity || 0);
        const sb = boostB + normalizeMatchScore(b.title || b.name, q) + (b.popularity || 0);
        return sb - sa;
      })
      .slice(0, 30);

    const enriched = await Promise.all(rawResults.map(async (item) => {
      const mType = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'Untitled';
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? releaseDate.slice(0, 4) : '-';
      const isBND = /spider-?man:\s*brand\s*new\s*day/i.test(title);
      const isInsidiousOut = /insidious:\s*out\s*of\s*the\s*further/i.test(title);

      let availableApps = [];
      let detailsJson = null;

      if (isBND) {
        availableApps = [APP_META.netflix];
      } else if (isInsidiousOut) {
        availableApps = [];
      } else {
        try {
          const [wpRes, dRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${mType}/${item.id}/watch/providers?api_key=${encodeURIComponent(TMDB_KEY)}`),
            fetch(`https://api.themoviedb.org/3/${mType}/${item.id}?api_key=${encodeURIComponent(TMDB_KEY)}&language=en-US`)
          ]);
          if (dRes.ok) detailsJson = await dRes.json();
          if (wpRes.ok) {
            const wpData = await wpRes.json();
            const regObj = wpData?.results?.[region] || {};
            const providerEntries = [
              ...(Array.isArray(regObj.flatrate) ? regObj.flatrate : []),
              ...(Array.isArray(regObj.free) ? regObj.free : []),
              ...(Array.isArray(regObj.ads) ? regObj.ads : [])
            ];
            providerEntries.forEach(p => {
              const mapped = PROVIDER_MAP[p.provider_id];
              if (mapped) availableApps.push(mapped);
            });
          }
        } catch (e) {}

        availableApps = applySpiderManPlatformAvailability(title, availableApps, mType);
      }

      return {
        id: `${mType}-${item.id}`,
        title,
        year,
        releaseDate,
        mediaType: mType === 'tv' ? 'SERIES' : 'MOVIE',
        rating: isBND
          ? '8.2'
          : (typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : 'N/A'),
        overview: (detailsJson?.overview || item.overview || '').trim(),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
        availableApps: dedupeApps(availableApps)
      };
    }));

    return res.status(200).json({ region, items: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', items: [] });
  }
};
