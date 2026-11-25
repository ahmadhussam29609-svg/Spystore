import fs from 'fs';

const SSRESIT_QUEUE_FILE = '/tmp/spystore_ssresit_orders.json';
const SSRESIT_BASE_URL = process.env.SSRESIT_URL || 'https://ssresit.vercel.app';
const SSRESIT_WEBHOOK_URL = process.env.SSRESIT_WEBHOOK_URL || '';

function readQueue() {
  if (!global.__SPYSTORE_SSRESIT_QUEUE) {
    try {
      if (fs.existsSync(SSRESIT_QUEUE_FILE)) {
        global.__SPYSTORE_SSRESIT_QUEUE = JSON.parse(fs.readFileSync(SSRESIT_QUEUE_FILE, 'utf8'));
      }
    } catch (e) {}
  }
  if (!Array.isArray(global.__SPYSTORE_SSRESIT_QUEUE)) {
    global.__SPYSTORE_SSRESIT_QUEUE = [];
  }
  return global.__SPYSTORE_SSRESIT_QUEUE;
}

function writeQueue(list) {
  global.__SPYSTORE_SSRESIT_QUEUE = list;
  try {
    fs.writeFileSync(SSRESIT_QUEUE_FILE, JSON.stringify(list), 'utf8');
  } catch (e) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queue = readQueue();

  if (req.method === 'GET') {
    const ref = String(req.query.ref || '').trim();
    if (ref) {
      const found = queue.find(x => x.receiptNo === ref || x.ref === ref);
      return res.status(200).json({ ok: true, order: found || null });
    }
    return res.status(200).json({ ok: true, orders: queue.slice(0, 50) });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const receiptNo = String(body.receiptNo || body.ref || `RES-SPY-${Date.now()}`).trim();
    const record = {
      source: 'spystore.vercel.app',
      company: 'SPYSTORE OFFICIAL OUTLET',
      companyPhone: '60189066291',
      receiptNo,
      ref: String(body.ref || receiptNo).trim(),
      customerName: String(body.customerName || 'Customer').trim(),
      customerPhone: String(body.customerPhone || '-').trim(),
      customerEmail: String(body.customerEmail || '-').trim(),
      customerDevice: String(body.customerDevice || '-').trim(),
      product: String(body.product || `${body.app || 'Subscription'} (${body.months || 1} Month)`).trim(),
      app: String(body.app || 'Subscription').trim(),
      months: Number(body.months || 1),
      total: String(body.total || '0.00').trim(),
      paymentMethod: String(body.paymentMethod || 'Online Transfer').trim(),
      date: String(body.date || new Date().toLocaleDateString('en-MY')).trim(),
      status: String(body.status || 'PAID').trim(),
      syncedAt: new Date().toISOString()
    };

    const nextQueue = [record, ...queue.filter(x => x.receiptNo !== receiptNo)].slice(0, 100);
    writeQueue(nextQueue);

    if (SSRESIT_WEBHOOK_URL) {
      try {
        await fetch(SSRESIT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });
      } catch (e) {}
    }

    return res.status(200).json({
      ok: true,
      order: record,
      ssresitUrl: `${SSRESIT_BASE_URL}/?receiptNo=${encodeURIComponent(record.receiptNo)}&ref=${encodeURIComponent(record.ref)}&customer=${encodeURIComponent(record.customerName)}&phone=${encodeURIComponent(record.customerPhone)}&product=${encodeURIComponent(record.product)}&amount=${encodeURIComponent(record.total)}&method=${encodeURIComponent(record.paymentMethod)}&date=${encodeURIComponent(record.date)}`
    });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
