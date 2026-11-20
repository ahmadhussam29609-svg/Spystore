// /api/callback.js
// Mengendalikan pengesahan pembayaran ToyyibPay & menolak stok automatik pada Google Sheet (kolum slots)

const SHEET_STOCK_WEBHOOK_URL = process.env.SHEET_STOCK_WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notifyStockWebhook(payload) {
  if (!SHEET_STOCK_WEBHOOK_URL) return { ok: false, reason: 'Missing SHEET_STOCK_WEBHOOK_URL' };
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

async function notifyTelegramAdmin(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('Telegram notify failed:', e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        const params = new URLSearchParams(body);
        body = Object.fromEntries(params.entries());
      }
    }

    const q = req.query || {};
    const status = String(body.status || body.status_id || q.status_id || '').trim();
    const refNo = String(body.refno || body.order_id || q.order_id || q.ref || '').trim();
    const billCode = String(body.billcode || q.billcode || '').trim();
    const appId = String(body.appId || body.app || q.app || '').toLowerCase().trim();
    const appName = String(body.appName || q.appName || appId || 'Subscription').trim();
    const months = parseInt(body.months || q.mo || 1, 10) || 1;
    const totalAmount = String(body.totalAmount || body.amount || '').trim();
    const customerName = String(body.customerName || q.name || '-').trim();
    const customerPhone = String(body.customerPhone || '-').trim();
    const customerDevice = String(body.customerDevice || '-').trim();
    const qty = Math.max(1, parseInt(body.qty || 1, 10));

    if (status !== '1') {
      return res.status(200).json({
        ok: false,
        message: 'Payment not completed (status != 1)'
      });
    }

    const stockResult = await notifyStockWebhook({
      refno: refNo,
      billcode: billCode,
      status: '1',
      appId,
      appName,
      qty
    });

    if (!body.clientConfirm) {
      const tgText = [
        '✅ *PEMBAYARAN BERJAYA — SPYSTORE BY SAMS*',
        `• *No. Rujukan:* ${refNo || '-'}`,
        `• *Bill Code:* ${billCode || '-'}`,
        `• *Aplikasi:* ${appName} (${months} Bulan)`,
        `• *Jumlah:* RM${totalAmount || '-'}`,
        `• *Pelanggan:* ${customerName}`,
        `• *WhatsApp:* ${customerPhone}`,
        `• *Peranti:* ${customerDevice}`,
        `• *Baki Stok (slots):* ${stockResult?.newStock ?? 'Dikemaskini'}`
      ].join('\n');

      await notifyTelegramAdmin(tgText);
    }

    return res.status(200).json({
      ok: true,
      refno: refNo,
      appId,
      stockResult
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Callback processing failed',
      detail: err.message
    });
  }
}
