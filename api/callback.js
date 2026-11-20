export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const status = String(body.status || body.status_id || '');
    const refNo = body.order_id || body.refno || '-';
    const billCode = body.billcode || '-';
    const amountRaw = body.amount || body.totalAmount || '0';

    if (status === '1') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      const sheetWebhook = process.env.GOOGLE_SHEET_WEBHOOK;

      const appName = body.appName || body.billname || 'Langganan Digital';
      const months = body.months || '1';
      const customerName = body.customerName || '-';
      const customerPhone = body.customerPhone || '-';
      const customerDevice = body.customerDevice || '-';

      const formattedAmount = Number(amountRaw) > 100 && !String(amountRaw).includes('.')
        ? (Number(amountRaw) / 100).toFixed(2)
        : Number(amountRaw || 0).toFixed(2);

      // 1. Hantar Notifikasi ke Telegram
      if (botToken && chatId) {
        const message = [
          ` *TEMPAHAN BAHARU — SPYSTORE BY SAMS*`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `• *No. Rujukan:* ${refNo}`,
          `• *Kod Bil:* ${billCode}`,
          `• *Produk:* ${appName} (${months} Bulan)`,
          `• *Jumlah Bayaran:* RM${formattedAmount} (FPX)`,
          `• *Pelanggan:* ${customerName}`,
          `• *WhatsApp:* ${customerPhone}`,
          `• *Peranti:* ${customerDevice}`,
          `• *Status:* BERJAYA ✅`
        ].join('\n');

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
          })
        });
      }

      // 2. Tolak Stok Google Sheets Secara Automatik
      if (sheetWebhook) {
        await fetch(sheetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refNo,
            appName,
            months
          })
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Callback Error:', err);
    return res.status(200).json({ received: true, warning: err.message });
  }
}

