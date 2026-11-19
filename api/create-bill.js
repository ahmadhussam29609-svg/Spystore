// api/create-bill.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      appId,
      appName,
      months,
      planAmount,
      feeAmount,
      totalAmount,
      customerName,
      customerPhone,
      customerDevice,
      paymentMethod
    } = req.body || {};

    if (!appName || !totalAmount || !customerName || !customerPhone) {
      return res.status(400).json({ error: 'Missing required order fields.' });
    }

    const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

    if (!secretKey || !categoryCode) {
      return res.status(500).json({ error: 'ToyyibPay credentials not configured in Vercel.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    let cleanPhone = String(customerPhone).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '6' + cleanPhone;
    } else if (!cleanPhone.startsWith('60')) {
      cleanPhone = '60' + cleanPhone;
    }

    const amountInCents = Math.round(Number(totalAmount) * 100);
    const referenceNo = `SPY-${Date.now().toString().slice(-6)}`;

    const metaParams = new URLSearchParams({
      ref: referenceNo,
      app: appName,
      mo: String(months || 1),
      name: customerName,
      wa: cleanPhone,
      dev: customerDevice || '-',
      tot: Number(totalAmount).toFixed(2),
      pay: paymentMethod === 'fpx' ? 'FPX' : 'DuitNow QR / eWallet'
    }).toString();

    const billReturnUrl = `${baseUrl}/?${metaParams}`;
    const billCallbackUrl = `${baseUrl}/api/callback?${metaParams}`;

    const isSandbox = process.env.TOYYIBPAY_SANDBOX === 'true';
    const toyyibHost = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';
    const paymentChannel = paymentMethod === 'fpx' ? '0' : '2';

    const formData = new URLSearchParams({
      userSecretKey: secretKey,
      categoryCode: categoryCode,
      billName: `SPYSTORE ${appName}`.slice(0, 30),
      billDescription: `${appName} (${months} Mo) - ${customerName}`.slice(0, 100),
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(amountInCents),
      billReturnUrl: billReturnUrl,
      billCallbackUrl: billCallbackUrl,
      billExternalReferenceNo: referenceNo,
      billTo: customerName.slice(0, 100),
      billEmail: 'order@spystore.my',
      billPhone: cleanPhone,
      billSplitPayment: '0',
      billSplitPaymentArgs: '',
      billPaymentChannel: paymentChannel,
      billContentEmail: `Thank you for ordering ${appName} (${months} Month) from SPYSTORE!`,
      billChargeToCustomer: '1'
    });

    const apiResponse = await fetch(`${toyyibHost}/index.php/api/createBill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const rawText = await apiResponse.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      return res.status(502).json({ error: 'Invalid response from ToyyibPay', details: rawText });
    }

    if (Array.isArray(parsed) && parsed[0]?.BillCode) {
      const billCode = parsed[0].BillCode;
      return res.status(200).json({
        billCode,
        paymentUrl: `${toyyibHost}/${billCode}`
      });
    }

    return res.status(400).json({
      error: 'Failed to generate ToyyibPay bill',
      details: parsed
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
  
