import QRCode from 'qrcode';

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

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

    const gatewayUrl = (body.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const instanceName = (body.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial').trim();
    const apiKey = (body.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    };

    // 1. Delete old instance
    try {
      await fetchWithTimeout(`${gatewayUrl}/instance/delete/${instanceName}`, { method: 'DELETE', headers }, 2000);
    } catch {}

    // 2. Connect to get new QR
    let qrDataUrl: string | null = null;
    let pairingCode: string | null = null;
    try {
      const connectRes = await fetchWithTimeout(`${gatewayUrl}/instance/connect/${instanceName}`, { headers }, 3500);
      if (connectRes.ok) {
        const connectData: any = await connectRes.json();
        if (connectData?.pairingCode) {
          pairingCode = connectData.pairingCode;
        }
        if (connectData?.code) {
          qrDataUrl = await QRCode.toDataURL(connectData.code, {
            errorCorrectionLevel: 'M',
            margin: 3,
            width: 400,
            color: { dark: '#000000', light: '#ffffff' },
          });
        } else if (connectData?.base64) {
          qrDataUrl = connectData.base64.startsWith('data:') ? connectData.base64 : `data:image/png;base64,${connectData.base64}`;
        }
      }
    } catch {}

    return res.status(200).json({
      success: !!qrDataUrl,
      qrCode: qrDataUrl,
      pairingCode: pairingCode,
      status: qrDataUrl ? 'QR_READY' : 'DISCONNECTED',
      message: qrDataUrl
        ? 'Sessão reiniciada com sucesso! Um novo QR Code limpo e atualizado foi gerado.'
        : 'Instância reiniciada. Clique em Atualizar QR em alguns instantes.',
    });
  } catch (err: any) {
    console.error('Error in dedicated reset endpoint:', err);
    return res.status(200).json({
      success: false,
      message: 'Instância reiniciada. Clique em Atualizar QR.',
    });
  }
}
