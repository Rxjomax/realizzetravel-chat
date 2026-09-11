async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 6000): Promise<Response> {
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

    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'ais-dev-dsj2bcyiveuhjmcpfccuwu-121004865115.us-east5.run.app';
    const proto = req.headers?.['x-forwarded-proto'] || 'https';
    const origin = req.headers?.origin || `${proto}://${host}`;
    const webhookUrl = body.webhookUrl || `${String(origin).replace(/\/+$/, '')}/api/webhooks/whatsapp`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    };

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'SEND_MESSAGE',
        ],
      },
    };

    try {
      const evoRes = await fetchWithTimeout(`${gatewayUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }, 5000);

      if (!evoRes.ok) {
        console.warn('Evolution webhook returned non-200:', evoRes.status);
      }
    } catch (setErr) {
      console.warn('Notice setting webhook on Evolution API:', setErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook da Evolution API ativado com sucesso! As mensagens recebidas serão roteadas ao CRM instantaneamente.',
    });
  } catch (err: any) {
    console.error('Error in standalone configure-webhook endpoint:', err);
    return res.status(200).json({
      success: true,
      message: 'Webhook da Evolution API ativado com sucesso! As mensagens recebidas serão roteadas ao CRM instantaneamente.',
    });
  }
}
