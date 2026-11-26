export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || '';

  if (!botToken || !chatId) {
    return res.status(501).json({
      error: 'Telegram bot environment variables (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) are not configured.'
    });
  }

  try {
    const { text } = req.body || {};
    const message = String(text || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      return res.status(502).json({
        error: tgData.description || 'Failed to send message via Telegram Bot API.'
      });
    }

    return res.status(200).json({ ok: true, result: tgData.result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
