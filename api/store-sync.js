const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let memoryStore = {
  verifiedAdmins: [],
  catalog: null,
  trendingTabs: null,
  templates: null,
  updatedAt: null
};

function getDb() {
  try {
    const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCreds) return null;
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(rawCreds)) });
    }
    return getFirestore();
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = getDb();

  if (req.method === 'GET') {
    if (db) {
      try {
        const snap = await db.collection('spystore_config').doc('shared_store').get();
        if (snap.exists) {
          memoryStore = { ...memoryStore, ...snap.data() };
        }
      } catch (e) {}
    }
    return res.status(200).json(memoryStore);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (Array.isArray(body.verifiedAdmins)) {
      memoryStore.verifiedAdmins = Array.from(new Set(body.verifiedAdmins.map(x => String(x || '').trim().toLowerCase()).filter(Boolean)));
    }
    if (Array.isArray(body.catalog)) {
      memoryStore.catalog = body.catalog;
    }
    if (Array.isArray(body.trendingTabs)) {
      memoryStore.trendingTabs = body.trendingTabs;
    }
    if (body.templates && typeof body.templates === 'object') {
      memoryStore.templates = body.templates;
    }
    memoryStore.updatedAt = new Date().toISOString();

    if (db) {
      try {
        await db.collection('spystore_config').doc('shared_store').set(memoryStore, { merge: true });
      } catch (e) {}
    }
    return res.status(200).json({ ok: true, ...memoryStore });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
