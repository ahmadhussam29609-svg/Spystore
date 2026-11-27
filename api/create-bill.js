module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { appName, months, totalAmount, customerName, customerPhone } = req.body || {};
  const secretKey = process.env.TOYYIBPAY_SECRET_KEY || '';
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE || '';
  const baseUrl = process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`;

  if (!secretKey || !categoryCode) {
    return res.status(400).json({ error: 'Payment gateway credentials not configured on server.' });
  }

  try {
    const amountCents = Math.round(Number(totalAmount || 0) * 100);
    const refNo = `SPY-${Date.now().toString().slice(-6)}`;
    const params = new URLSearchParams({
      userSecretKey: secretKey,
      categoryCode,
      billName: String(appName || 'SPYSTORE Subscription').slice(0, 30),
      billDescription: `${appName || 'Subscription'} (${months || 1} Month)`,
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(amountCents),
      billReturnUrl: `${baseUrl}/?ref=${encodeURIComponent(refNo)}&app=${encodeURIComponent(appName || '')}&mo=${encodeURIComponent(months || 1)}&name=${encodeURIComponent(customerName || '')}`,
      billCallbackUrl: `${baseUrl}/api/ssresit-sync`,
      billExternalReferenceNo: refNo,
      billTo: customerName || 'Customer',
      billEmail: 'customer@spystore.my',
      billPhone: String(customerPhone || '0189066291').replace(/\D/g, '')
    });

    const tpRes = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const tpData = await tpRes.json();
    const billCode = Array.isArray(tpData) && tpData[0]?.BillCode ? tpData[0].BillCode : '';
    if (!billCode) {
      return res.status(500).json({ error: 'Failed to generate ToyyibPay BillCode.' });
    }
    return res.status(200).json({
      billCode,
      paymentUrl: `https://toyyibpay.com/${billCode}`
    });
  } catch (e) {
    return res.status(500).json({ error: 'Payment gateway connection error.' });
  }
};
