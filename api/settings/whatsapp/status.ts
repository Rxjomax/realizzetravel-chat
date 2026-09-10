async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 2500): Promise<Response> {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const gatewayUrl = (process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const instanceName = (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial').trim();
    const apiKey = (process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    };

    let isLiveConnected = false;
    let connectedPhone: string | null = null;

    try {
      const stateRes = await fetchWithTimeout(`${gatewayUrl}/instance/connectionState/${instanceName}`, { headers }, 2000);
      if (stateRes.ok) {
        const stateData: any = await stateRes.json();
        if (stateData?.instance?.state === 'open' || stateData?.status === 'CONNECTED') {
          isLiveConnected = true;
          connectedPhone = stateData?.instance?.owner || null;
        }
      }
    } catch {}

    return res.status(200).json({
      connected: isLiveConnected,
      status: isLiveConnected ? 'CONNECTED' : 'DISCONNECTED',
      phoneConnected: connectedPhone,
    });
  } catch {
    return res.status(200).json({
      connected: false,
      status: 'DISCONNECTED',
      phoneConnected: null,
    });
  }
}
