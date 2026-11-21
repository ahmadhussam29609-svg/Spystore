// /api/callback.js
// Mengendalikan pengesahan pembayaran & menolak stok automatik pada Google Sheet (kolum slots)

const SHEET_STOCK_WEBHOOK_URL = process.env.SHEET_STOCK_WEBHOOK_URL;

function inferAppId(rawAppId, rawAppName) {
  const candidate = String(rawAppId || '').toLowerCase().trim();
  if (candidate) return candidate;
  const n = String(rawAppName || '').toLowerCase();
  if (n.includes('netflix')) return 'netflix';
  if (n.includes('disney')) return 'disney';
  if (n.includes('hbo') || n.includes('max')) return 'hbomax';
  if (n.includes('prime')) return 'primevideo';
  if (n.includes('youtube')) return 'youtube';
  if (n.includes('spotify')) return 'spotify';
  if (n.includes('canva')) return 'canva';
  if (n.includes('capcut')) return 'capcut';
  return '';
}

async function notifyStockWebhook(payload) {
  if (!SHEET_STOCK_WEBHOOK_URL) {
    return { ok: false, reason: 'Missing SHEET_STOCK_WEBHOOK_URL' };
  }
  const res = await fetch(SHEET_STOCK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  try {
    return await res.json();
  } catch {
    return { ok: res.ok };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const q = req.query || {};

    // Support both Billplz webhook payload (billplz[paid], billplz[id]) and query/JSON confirmation
    const bpPaid = body['billplz[paid]'] ?? q['billplz[paid]'] ?? body.billplz?.paid ?? '';
    const bpId = body['billplz[id]'] ?? q['billplz[id]'] ?? body.billplz?.id ?? '';

    const rawStatus = String(
      body.status ??
      body.status_id ??
      q.status ??
      q.status_id ??
      (String(bpPaid) === 'true' ? '1' : '')
    ).trim();

    const isPaid = rawStatus === '1' || String(bpPaid) === 'true';

    const refno = String(
      body.refno ??
      body.order_id ??
      body.reference_1 ??
      q.order_id ??
      q.refno ??
      bpId ??
      ''
    ).trim();

    const appName = String(body.appName ?? body.description ?? q.appName ?? '').trim();
    const appId = inferAppId(body.appId ?? q.app ?? '', appName);
    const months = parseInt(body.months ?? q.mo ?? 1, 10) || 1;
    const qty = Math.max(1, parseInt(body.qty ?? 1, 10) || 1);
    const totalAmount = String(body.totalAmount ?? q.amount ?? '').trim();
    const customerName = String(body.customerName ?? q.name ?? '').trim();
    const customerPhone = String(body.customerPhone ?? '').trim();
    const customerDevice = String(body.customerDevice ?? '').trim();

    if (!isPaid) {
      return res.status(200).json({
        ok: false,
        reason: 'Payment not marked as paid yet',
        status: rawStatus || 'pending'
      });
    }

    const webhookResult = await notifyStockWebhook({
      status: '1',
      status_id: '1',
      refno,
      appId,
      appName,
      months,
      qty,
      totalAmount,
      customerName,
      customerPhone,
      customerDevice,
      source: 'spystore-callback'
    });

    return res.status(200).json({
      ok: true,
      refno,
      appId,
      qty,
      webhook: webhookResult
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Callback processing error',
      detail: err.message
    });
  }
}
