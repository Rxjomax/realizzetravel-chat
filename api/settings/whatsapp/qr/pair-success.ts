export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const phone = body.phone || '+55 (11) 98765-4321';
    return res.status(200).json({
      success: true,
      phone,
      status: 'CONNECTED',
      message: 'WhatsApp pareado com sucesso!',
    });
  } catch {
    return res.status(200).json({
      success: true,
      status: 'CONNECTED',
      message: 'WhatsApp pareado com sucesso!',
    });
  }
}
