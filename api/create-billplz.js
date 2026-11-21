// /api/create-billplz.js
// Menjana bil pembayaran Billplz (DuitNow QR / Online Payment) untuk SPYSTORE BY SAMS

const BILLPLZ_API_KEY = process.env.BILLPLZ_API_KEY;
const BILLPLZ_COLLECTION_ID = process.env.BILLPLZ_COLLECTION_ID;
const SITE_URL = process.env.SITE_URL || 'https://spystore.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!BILLPLZ_API_KEY || !BILLPLZ_COLLECTION_ID) {
      return res.status(500).json({ error: 'BILLPLZ_API_KEY atau BILLPLZ_COLLECTION_ID belum ditetapkan di Vercel.' });
    }

    const {
      appId = '',
      appName = 'Subscription',
      months = 1,
      totalAmount,
      customerName = 'Customer',
      customerPhone = '60189066291',
      customerDevice = '-',
      customerEmail = '-'
    } = req.body || {};

    const amountNumber = parseFloat(totalAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: 'Jumlah bayaran tidak sah.' });
    }

    const amountSen = Math.round(amountNumber * 100);
    const orderRef = `SPY-${Date.now()}`;
    const cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '') || '60189066291';
    const validEmail = (customerEmail && customerEmail.includes('@'))
      ? customerEmail.trim()
      : `${cleanPhone}@spystore.my`;

    const redirectUrl = `${SITE_URL}/?status_id=1&ref=${encodeURIComponent(orderRef)}&app=${encodeURIComponent(appName)}&mo=${encodeURIComponent(months)}&name=${encodeURIComponent(customerName)}`;
    const callbackUrl = `${SITE_URL}/api/callback?status=1&order_id=${encodeURIComponent(orderRef)}&app=${encodeURIComponent(appId)}&appName=${encodeURIComponent(appName)}&mo=${encodeURIComponent(months)}&amount=${encodeURIComponent(amountNumber.toFixed(2))}&name=${encodeURIComponent(customerName)}`;

    const params = new URLSearchParams();
    params.append('collection_id', BILLPLZ_COLLECTION_ID);
    params.append('email', validEmail);
    params.append('mobile', cleanPhone);
    params.append('name', String(customerName).slice(0, 120));
    params.append('amount', String(amountSen));
    params.append('description', `${appName} (${months} Bulan) - ${orderRef}`.slice(0, 200));
    params.append('callback_url', callbackUrl);
    params.append('redirect_url', redirectUrl);
    params.append('reference_1_label', 'Order Ref');
    params.append('reference_1', orderRef);
    params.append('reference_2_label', 'Device');
    params.append('reference_2', String(customerDevice || '-').slice(0, 120));

    const basicAuth = Buffer.from(`${BILLPLZ_API_KEY}:`).toString('base64');
    const bpRes = await fetch('https://www.billplz.com/api/v3/bills', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const bpJson = await bpRes.json();
    if (!bpRes.ok || !bpJson.url) {
      return res.status(502).json({
        error: 'Gagal menjana bil Billplz.',
        detail: bpJson
      });
    }

    return res.status(200).json({
      ok: true,
      billId: bpJson.id,
      orderRef,
      paymentUrl: bpJson.url
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Ralat pelayan semasa menjana bil Billplz.',
      detail: err.message
    });
  }
}
