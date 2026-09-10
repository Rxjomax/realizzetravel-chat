import QRCode from 'qrcode';

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 4000): Promise<Response> {
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
  // CORS
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

    let isLiveConnected = false;
    let connectedPhone: string | null = null;
    let qrDataUrl: string | null = null;
    let pairingCode: string | null = null;

    // 1. Check live status
    try {
      const stateRes = await fetchWithTimeout(`${gatewayUrl}/instance/connectionState/${instanceName}`, { headers }, 2500);
      if (stateRes.ok) {
        const stateData: any = await stateRes.json();
        if (stateData?.instance?.state === 'open' || stateData?.status === 'CONNECTED') {
          isLiveConnected = true;
          connectedPhone = stateData?.instance?.owner || 'WhatsApp Conectado';
        }
      }
    } catch {}

    // 2. If not connected, get QR code
    if (!isLiveConnected) {
      try {
        const connectRes = await fetchWithTimeout(`${gatewayUrl}/instance/connect/${instanceName}`, { headers }, 3500);
        if (connectRes.ok) {
          const connectData: any = await connectRes.json();
          if (connectData?.pairingCode) {
            pairingCode = connectData.pairingCode;
          }
          if (connectData?.instance?.state === 'open' || connectData?.status === 'CONNECTED') {
            isLiveConnected = true;
            connectedPhone = connectData?.instance?.owner || 'WhatsApp Conectado';
          } else if (connectData?.code) {
            qrDataUrl = await QRCode.toDataURL(connectData.code, {
              errorCorrectionLevel: 'M',
              margin: 3,
              width: 400,
              color: { dark: '#000000', light: '#ffffff' },
            });
          } else {
            const b64 = connectData?.base64 || connectData?.qrcode?.base64;
            if (b64) {
              qrDataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
            }
          }
        }
      } catch (cErr) {
        console.warn('Connect error on VPS:', cErr);
      }
    }

    return res.status(200).json({
      success: isLiveConnected || !!qrDataUrl,
      qrCode: qrDataUrl,
      pairingCode: pairingCode,
      status: isLiveConnected ? 'CONNECTED' : (qrDataUrl ? 'QR_READY' : 'DISCONNECTED'),
      phone: connectedPhone,
      instanceName,
      gatewayUrl,
      message: isLiveConnected
        ? 'Instância da Evolution API já conectada ao WhatsApp!'
        : (qrDataUrl ? 'QR Code da Evolution API gerado com sucesso!' : 'Aguardando inicialização da VPS. Clique em Atualizar QR.'),
    });
  } catch (err: any) {
    console.error('Error in dedicated QR generator endpoint:', err);
    return res.status(200).json({
      success: false,
      qrCode: null,
      status: 'DISCONNECTED',
      message: 'Falha temporária ao comunicar com a VPS. Clique em "Atualizar QR".',
    });
  }
}
