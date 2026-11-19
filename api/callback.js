// api/callback.js
export default async function handler(req, res) {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const statusId = String(body.status_id || body.status || query.status_id || '');
    const billCode = body.billcode || query.billcode || '-';
    const orderId = body.order_id || query.ref || '-';
    const transactionId = body.transaction_id || '-';

    const appName = query.app || 'Digital Subscription';
    const months = query.mo || '1';
    const customerName = query.name || 'Customer';
    const customerWa = query.wa || '';
    const customerDevice = query.dev || '-';
    const totalPaid = query.tot || '0.00';
    const payMethod = query.pay || 'ToyyibPay';

    if (statusId === '1') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const waReplyText = encodeURIComponent(
          `Hi ${customerName}! Terima kasih membeli di SPYSTORE.\n\n` +
          `Berikut ialah butiran akaun ${appName} (${months} Bulan) anda:\n` +
          `Email: \nPassword: \nProfile/PIN: \n\n` +
          `Sila maklumkan jika sudah berjaya log masuk. Waranti penuh aktif sepanjang tempoh langganan!`
        );

        const waDirectLink = customerWa
          ? `https://wa.me/${customerWa}?text=${waReplyText}`
          : 'https://wa.me/60189066291';

        const telegramMessage =
          `✅ *TEMPAHAN BAHARU SPYSTORE (DIBAYAR)*\n\n` +
          `🧾 *No. Rujukan:* \`${orderId}\`\n` +
          `💳 *Bill Code:* \`${billCode}\`\n` +
          `🔖 *ID Transaksi:* \`${transactionId}\`\n\n` +
          `📦 *Aplikasi:* ${appName} (${months} Bulan)\n` +
          `💰 *Jumlah Dibayar:* RM${totalPaid} (${payMethod})\n\n` +
          `👤 *Nama Pelanggan:* ${customerName}\n` +
          `📱 *No. WhatsApp:* ${customerWa || '-'}\n` +
          `💻 *Peranti:* ${customerDevice}\n\n` +
          `👉 [Klik Untuk Hantar Akaun ke WhatsApp Pelanggan](${waDirectLink})`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: telegramMessage,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        });
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Callback Error:', error);
    return res.status(200).send('OK');
  }
}
