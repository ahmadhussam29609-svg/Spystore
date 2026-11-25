export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const src = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    const dedupe = (val) => {
      const parts = String(val ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const unique = Array.from(new Set(parts));
      return unique.length ? unique[unique.length - 1] : '-';
    };

    const refno = dedupe(src.refno || src.ref || src.order_id || src.billcode || 'SPY-ORDER');
    const billcode = dedupe(src.billcode || '-');
    const appName = dedupe(src.appName || src.app || 'Subscription');
    const months = dedupe(src.months || src.mo || '1');
    const rawAmt = parseFloat(dedupe(src.totalAmount ?? src.amount ?? ''));
    const amountText = !isNaN(rawAmt) ? `RM${rawAmt.toFixed(2)}` : '-';
    const customerName = dedupe(src.customerName || src.name || '-');
    const customerPhone = dedupe(src.customerPhone || src.phone || '-');
    const customerDevice = dedupe(src.customerDevice || src.device || '-');
    const statusOk = String(dedupe(src.status ?? '1')) === '1';

    const tgMessage = [
      statusOk
        ? '🔔 *TEMPAHAN BAHARU BERJAYA — SPYSTORE BY SAMS*'
        : '⚠️ *KEMAS KINI TEMPAHAN — SPYSTORE BY SAMS*',
      '━━━━━━━━━━━━━━━━━━━━━━',
      `🧾 *No. Rujukan:* \`${refno}\``,
      `💳 *Bill Code:* \`${billcode}\``,
      `📱 *Produk:* ${appName} (${months} Bulan)`,
      `💰 *Jumlah:* ${amountText}`,
      `👤 *Pelanggan:* ${customerName}`,
      `📲 *WhatsApp:* ${customerPhone}`,
      `💻 *Peranti:* ${customerDevice}`,
      `📌 *Status:* ${statusOk ? 'BERJAYA ✅' : 'PENDING ⏳'}`,
      '━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgMessage,
          parse_mode: 'Markdown'
        })
      });
    }

    const ssresitWebhook = process.env.SSRESIT_WEBHOOK_URL || '';
    if (ssresitWebhook && statusOk) {
      try {
        await fetch(ssresitWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'spystore.vercel.app',
            company: 'SPYSTORE OFFICIAL OUTLET',
            companyPhone: '60189066291',
            receiptNo: refno,
            ref: refno,
            customerName,
            customerPhone,
            customerDevice,
            product: `${appName} (${months} Month)`,
            total: !isNaN(rawAmt) ? rawAmt.toFixed(2) : '0.00',
            paymentMethod: 'Online Transfer',
            status: 'PAID'
          })
        });
      } catch (e) {}
    }

    return res.status(200).json({ ok: true, message: tgMessage });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Callback error' });
  }
}
