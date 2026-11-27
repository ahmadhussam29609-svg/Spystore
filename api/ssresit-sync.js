const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let memoryOrders = [];

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
        const snap = await db.collection('spystore_orders').orderBy('syncedAt', 'desc').limit(100).get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        if (list.length) memoryOrders = list;
      } catch (e) {}
    }
    return res.status(200).json({ orders: memoryOrders });
  }

  if (req.method === 'POST') {
    const order = req.body || {};
    const recNo = String(order.receiptNo || order.ref || '').trim();
    if (!recNo) return res.status(400).json({ error: 'Missing receiptNo' });

    const record = {
      ...order,
      receiptNo: recNo,
      syncedAt: new Date().toISOString()
    };

    memoryOrders = [record, ...memoryOrders.filter(x => x.receiptNo !== recNo)].slice(0, 100);

    if (db) {
      try {
        await db.collection('spystore_orders').doc(recNo).set(record, { merge: true });
      } catch (e) {}
    }
    return res.status(200).json({ ok: true, order: record });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
