export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const gatewayUrl = (process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const instanceName = (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial').trim();
    const apiKey = (process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(`${gatewayUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(id);
    } catch {
      clearTimeout(id);
    }

    return res.status(200).json({
      success: true,
      status: 'DISCONNECTED',
      message: 'WhatsApp desconectado com sucesso.',
    });
  } catch {
    return res.status(200).json({
      success: true,
      status: 'DISCONNECTED',
      message: 'WhatsApp desconectado.',
    });
  }
}
