import { ensureDbReady } from '../../../../server/app';
import { WhatsAppService } from '../../../../server/services/whatsapp.service';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await ensureDbReady();
    const result = await WhatsAppService.syncEvolutionChats('org_realizzetravel');
    return res.status(200).json({
      success: true,
      count: result.count,
      groupCount: result.groupCount,
      message: `Evolution API: ${result.count} conversas e ${result.groupCount} grupos sincronizados com sucesso!`,
    });
  } catch (err: any) {
    console.error('Error in Vercel Evolution sync endpoint:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao sincronizar com WhatsApp',
    });
  }
}
