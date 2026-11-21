const APP_META = {
  netflix: { id: 'netflix', shortLabel: 'Netflix', price: 18 },
  disney: { id: 'disney', shortLabel: 'Disney+', price: 16 },
  hbomax: { id: 'hbomax', shortLabel: 'HBO Max', price: 16 },
  primevideo: { id: 'primevideo', shortLabel: 'Prime Video', price: 10 }
};

const CURATED_MY_CATALOG = [
  {
    id: 'lupin',
    title: 'Lupin',
    year: '2021',
    mediaType: 'SERIES',
    rating: '7.5',
    overview: 'Inspired by the adventures of Arsène Lupin, gentleman thief Assane Diop sets out to avenge his father for an injustice inflicted by a wealthy family.',
    poster: 'https://image.tmdb.org/t/p/w342/sgxawEB0H9u00n3g8t6G9n3n4x3.jpg',
    availableApps: [APP_META.netflix]
  },
  {
    id: 'squid-game',
    title: 'Squid Game',
    year: '2021',
    mediaType: 'SERIES',
    rating: '7.9',
    overview: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games for a tempting prize.",
    poster: 'https://image.tmdb.org/t/p/w342/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg',
    availableApps: [APP_META.netflix]
  },
  {
    id: 'wednesday',
    title: 'Wednesday',
    year: '2022',
    mediaType: 'SERIES',
    rating: '8.5',
    overview: 'Smart, sarcastic and a little dead inside, Wednesday Addams investigates a murder spree while making new friends at Nevermore Academy.',
    poster: 'https://image.tmdb.org/t/p/w342/9PFonBhy4cQy7Jz20PpGkgtgaOI.jpg',
    availableApps: [APP_META.netflix]
  },
  {
    id: 'stranger-things',
    title: 'Stranger Things',
    year: '2016',
    mediaType: 'SERIES',
    rating: '8.6',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    poster: 'https://image.tmdb.org/t/p/w342/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    availableApps: [APP_META.netflix]
  },
  {
    id: 'avengers-endgame',
    title: 'Avengers: Endgame',
    year: '2019',
    mediaType: 'MOVIE',
    rating: '8.3',
    overview: 'After the devastating events of Avengers: Infinity War, the universe is in ruins and the Avengers assemble once more.',
    poster: 'https://image.tmdb.org/t/p/w342/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
    availableApps: [APP_META.disney]
  },
  {
    id: 'avengers-infinity-war',
    title: 'Avengers: Infinity War',
    year: '2018',
    mediaType: 'MOVIE',
    rating: '8.4',
    overview: 'The Avengers and their allies must be willing to sacrifice all in an attempt to defeat the powerful Thanos.',
    poster: 'https://image.tmdb.org/t/p/w342/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
    availableApps: [APP_META.disney]
  },
  {
    id: 'the-avengers',
    title: 'The Avengers',
    year: '2012',
    mediaType: 'MOVIE',
    rating: '7.8',
    overview: "Earth's mightiest heroes must come together and learn to fight as a team if they are going to stop the mischievous Loki.",
    poster: 'https://image.tmdb.org/t/p/w342/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',
    availableApps: [APP_META.disney]
  },
  {
    id: 'doraemon-stand-by-me',
    title: 'Doraemon: Stand by Me',
    year: '2014',
    mediaType: 'MOVIE',
    rating: '7.6',
    overview: 'A robotic cat from the 22nd century arrives to help a clumsy boy named Nobita improve his life and find happiness.',
    poster: 'https://image.tmdb.org/t/p/w342/4m1Au3YkjqsxF8iwQy0fPYSxE0h.jpg',
    availableApps: [APP_META.netflix, APP_META.primevideo]
  },
  {
    id: 'house-of-the-dragon',
    title: 'House of the Dragon',
    year: '2022',
    mediaType: 'SERIES',
    rating: '8.4',
    overview: 'The Targaryen civil war begins as a power struggle divides the realm.',
    poster: 'https://image.tmdb.org/t/p/w342/3iF646K7n4z1f3x4n4o4Z3P9k7.jpg',
    availableApps: [APP_META.hbomax]
  },
  {
    id: 'dune-part-two',
    title: 'Dune: Part Two',
    year: '2024',
    mediaType: 'MOVIE',
    rating: '8.1',
    overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
    poster: 'https://image.tmdb.org/t/p/w342/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    availableApps: [APP_META.hbomax, APP_META.primevideo]
  },
  {
    id: 'the-boys',
    title: 'The Boys',
    year: '2019',
    mediaType: 'SERIES',
    rating: '8.5',
    overview: 'A group of vigilantes sets out to take down corrupt superheroes who abuse their superpowers.',
    poster: 'https://image.tmdb.org/t/p/w342/2zmTngkjx9g2R8b4c9h2e2w8s2g.jpg',
    availableApps: [APP_META.primevideo]
  },
  {
    id: 'reacher',
    title: 'Reacher',
    year: '2022',
    mediaType: 'SERIES',
    rating: '8.1',
    overview: 'Jack Reacher, a veteran military police investigator, is drawn into a complex conspiracy.',
    poster: 'https://image.tmdb.org/t/p/w342/jFuH0vh4i716n5152626953467.jpg',
    availableApps: [APP_META.primevideo]
  }
];

function mapProviderIdsToApps(providerIds = []) {
  const set = new Set(providerIds);
  const apps = [];
  if (set.has(8)) apps.push(APP_META.netflix);
  if (set.has(337)) apps.push(APP_META.disney);
  if (set.has(1899) || set.has(384)) apps.push(APP_META.hbomax);
  if (set.has(119)) apps.push(APP_META.primevideo);
  return apps;
}

async function searchViaTmdb(q, region) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(q)}&language=en-US&page=1`;
  const r = await fetch(searchUrl);
  if (!r.ok) return null;
  const json = await r.json();
  const raw = (json.results || []).filter(it => it.media_type === 'movie' || it.media_type === 'tv').slice(0, 8);
  if (!raw.length) return [];

  const enriched = await Promise.all(raw.map(async (it) => {
    const typePath = it.media_type === 'tv' ? 'tv' : 'movie';
    let availableApps = [];
    try {
      const pRes = await fetch(`https://api.themoviedb.org/3/${typePath}/${it.id}/watch/providers?api_key=${encodeURIComponent(apiKey)}`);
      if (pRes.ok) {
        const pJson = await pRes.json();
        const flatrate = pJson.results?.[region]?.flatrate || [];
        availableApps = mapProviderIdsToApps(flatrate.map(x => x.provider_id));
      }
    } catch (e) {}

    const title = it.title || it.name || 'Untitled';
    const dateStr = it.release_date || it.first_air_date || '';
    const year = dateStr ? dateStr.slice(0, 4) : '-';

    return {
      id: `${typePath}-${it.id}`,
      title,
      year,
      mediaType: it.media_type === 'tv' ? 'SERIES' : 'MOVIE',
      rating: it.vote_average ? Number(it.vote_average).toFixed(1) : 'N/A',
      overview: it.overview || '',
      poster: it.poster_path ? `https://image.tmdb.org/t/p/w342${it.poster_path}` : '',
      availableApps
    };
  }));

  return enriched;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = String(req.query.q || '').trim();
  const region = String(req.query.region || 'MY').toUpperCase();

  if (!q) {
    return res.status(200).json({ items: [] });
  }

  try {
    const tmdbItems = await searchViaTmdb(q, region);
    if (Array.isArray(tmdbItems)) {
      return res.status(200).json({ region, items: tmdbItems });
    }
  } catch (e) {}

  const ql = q.toLowerCase();
  const matched = CURATED_MY_CATALOG.filter(item =>
    item.title.toLowerCase().includes(ql) ||
    item.overview.toLowerCase().includes(ql) ||
    item.availableApps.some(a => a.shortLabel.toLowerCase().includes(ql))
  );

  return res.status(200).json({ region, items: matched });
}
