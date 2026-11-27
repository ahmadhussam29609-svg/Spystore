module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const { text } = req.body || {};

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text || 'New order received on SPYSTORE.')
      })
    });
    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      return res.status(500).json({ error: tgJson.description || 'Telegram API error' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reach Telegram API.' });
  }
};
