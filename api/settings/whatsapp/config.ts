export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const defaultConfig = {
    providerType: 'EVOLUTION_API',
    gatewayUrl: process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
    apiKey: process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
    status: 'DISCONNECTED',
    phoneConnected: null,
    verifyToken: 'viagens_whatsapp_verify_token_2026',
  };

  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      message: 'Configurações do WhatsApp salvas com sucesso!',
      config: { ...defaultConfig, ...(req.body || {}) },
    });
  }

  return res.status(200).json({
    success: true,
    config: defaultConfig,
  });
}
