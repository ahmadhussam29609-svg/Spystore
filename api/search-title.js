export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = String(req.query.q || '').trim();
  const region = String(req.query.region || 'MY').toUpperCase();

  if (!q) {
    return res.status(200).json({ items: [] });
  }

  const catalog = [
    {
      id: 'thunderbolts',
      title: 'Thunderbolts*',
      year: '2025',
      mediaType: 'MOVIE',
      rating: '7.4',
      overview: 'An unconventional team of antiheroes is recruited for a dangerous government mission.',
      poster: '',
      availableApps: [{ id: 'disney', shortLabel: 'Disney+', price: 16 }]
    },
    {
      id: 'spiderman-nwh',
      title: 'Spider-Man: No Way Home',
      year: '2021',
      mediaType: 'MOVIE',
      rating: '8.2',
      overview: 'Peter Parker seeks help from Doctor Strange after his identity is revealed, opening the multiverse.',
      poster: '',
      availableApps: [{ id: 'disney', shortLabel: 'Disney+', price: 16 }]
    },
    {
      id: 'iron-fist',
      title: 'Iron Fist',
      year: '2017',
      mediaType: 'SERIES',
      rating: '6.5',
      overview: 'Danny Rand returns to New York to reclaim his family legacy and wield the power of the Iron Fist.',
      poster: '',
      availableApps: [{ id: 'disney', shortLabel: 'Disney+', price: 16 }]
    }
  ];

  const ql = q.toLowerCase();
  const matched = catalog.filter(item => item.title.toLowerCase().includes(ql));
  return res.status(200).json({ region, items: matched.length ? matched : catalog });
}
