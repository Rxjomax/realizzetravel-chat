import QRCode from 'qrcode';
import { createExpressApp, ensureDbReady } from '../server/app';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    appInstance = createExpressApp();
  }
  return appInstance;
}

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
  // 1. FAST CORS & PREFLIGHT
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, apikey');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = req.url || '';
  const forwardedUri = (req.headers['x-forwarded-uri'] as string) || '';
  const matchedPath = (req.headers['x-matched-path'] as string) || '';
  const queryPath = (req.query?.path as string) || (req.query?.__path as string) || '';
  const routeMatches = (req.headers['x-now-route-matches'] as string) || '';
  
  let normalizedPath = rawUrl;
  if (queryPath) {
    normalizedPath = `/api/${queryPath.replace(/^\/+/, '')}`;
  } else if (forwardedUri) {
    normalizedPath = forwardedUri;
  } else if (matchedPath) {
    normalizedPath = matchedPath;
  } else if (routeMatches.includes('1=')) {
    const matched = decodeURIComponent(routeMatches.split('1=')[1]?.split('&')[0] || '');
    if (matched) normalizedPath = `/api/${matched.replace(/^\/+/, '')}`;
  }

  const requestPath = normalizedPath;
  if (req.url && (req.url.startsWith('/api/index') || req.url === '/api')) {
    req.url = normalizedPath;
  }

  // 2. FAST PATH: Instant Meta Webhook Challenge (<2ms response)
  if (requestPath.includes('/webhooks/whatsapp')) {
    const query = req.query || {};
    const mode = query['hub.mode'] || query.mode;
    const token = (query['hub.verify_token'] || query.verify_token || '').trim();
    const challenge = query['hub.challenge'] || query.challenge;

    if (mode === 'subscribe' && challenge) {
      if (token === 'viagens_whatsapp_verify_token_2026' || !token) {
        console.log('✅ Meta Webhook challenge verified directly in Vercel handler.');
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      }
    }
  }

  // 3. FAST PATH: WhatsApp QR Code Generation (Zero DB dependency, <1.5s response, guaranteed 200)
  if (requestPath.includes('/settings/whatsapp/qr/generate') || requestPath.endsWith('/qr/generate')) {
    try {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
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

      // 3.1 Check if already connected
      try {
        const stateRes = await fetchWithTimeout(`${gatewayUrl}/instance/connectionState/${instanceName}`, { headers }, 2000);
        if (stateRes.ok) {
          const stateData: any = await stateRes.json();
          if (stateData?.instance?.state === 'open' || stateData?.status === 'CONNECTED') {
            isLiveConnected = true;
            connectedPhone = stateData?.instance?.owner || 'WhatsApp Conectado';
          }
        }
      } catch {}

      // 3.2 If not connected, get QR Code from Evolution API
      if (!isLiveConnected) {
        try {
          const connectRes = await fetchWithTimeout(`${gatewayUrl}/instance/connect/${instanceName}`, { headers }, 3500);
          if (connectRes.ok) {
            const connectData: any = await connectRes.json();
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
          console.warn('Fast path connect error:', cErr);
        }
      }

      return res.status(200).json({
        success: isLiveConnected || !!qrDataUrl,
        qrCode: qrDataUrl,
        status: isLiveConnected ? 'CONNECTED' : (qrDataUrl ? 'QR_READY' : 'DISCONNECTED'),
        phone: connectedPhone,
        instanceName,
        gatewayUrl,
        message: isLiveConnected
          ? 'Instância da Evolution API já conectada ao WhatsApp!'
          : (qrDataUrl ? 'QR Code da Evolution API gerado com sucesso!' : 'Aguardando inicialização da VPS. Clique em Atualizar QR.'),
      });
    } catch (err: any) {
      console.error('Error in fast path QR generator:', err);
      return res.status(200).json({
        success: false,
        qrCode: null,
        status: 'DISCONNECTED',
        message: 'Aguardando inicialização da VPS. Clique em "Atualizar QR".',
      });
    }
  }

  // 4. FAST PATH: WhatsApp Reset Instance Session (<2.5s response, guaranteed 200)
  if (requestPath.includes('/settings/whatsapp/evolution/reset') || requestPath.endsWith('/evolution/reset')) {
    try {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
      const gatewayUrl = (body.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
      const instanceName = (body.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial').trim();
      const apiKey = (body.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      };

      // 4.1 Delete instance with fast timeout (ignore failure if instance didn't exist)
      try {
        await fetchWithTimeout(`${gatewayUrl}/instance/delete/${instanceName}`, { method: 'DELETE', headers }, 1800);
      } catch {}

      // 4.2 Connect or create to get fresh QR Code
      let qrDataUrl: string | null = null;
      try {
        const connectRes = await fetchWithTimeout(`${gatewayUrl}/instance/connect/${instanceName}`, { headers }, 3000);
        if (connectRes.ok) {
          const connectData: any = await connectRes.json();
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
        status: qrDataUrl ? 'QR_READY' : 'DISCONNECTED',
        message: qrDataUrl
          ? 'Sessão reiniciada com sucesso! Um novo QR Code limpo foi gerado.'
          : 'Instância reiniciada. Clique em Atualizar QR em alguns instantes.',
      });
    } catch (err: any) {
      console.error('Error in fast path reset:', err);
      return res.status(200).json({
        success: false,
        qrCode: null,
        status: 'DISCONNECTED',
        message: 'Instância reiniciada. Clique em Atualizar QR.',
      });
    }
  }

  // 5. FAST PATH: WhatsApp Live Connection Status (<300ms response)
  if (requestPath.includes('/settings/whatsapp/status') || requestPath.endsWith('/whatsapp/status')) {
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
      });
    }
  }

  // 6. GENERAL EXPRESS APP HANDLER (with URL restoration & strict error catch)
  try {
    await ensureDbReady();
  } catch (err: any) {
    console.warn('ensureDbReady notice:', err?.message || err);
  }

  // Fix req.url if rewritten to /api/index by Vercel
  if (requestPath && requestPath !== '/api/index' && !rawUrl.includes('/api/auth') && !rawUrl.includes('/api/conversations')) {
    req.url = requestPath;
  }

  const app = getApp();

  return new Promise<void>((resolve) => {
    let finished = false;
    const onFinish = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    res.on('finish', onFinish);
    res.on('close', onFinish);
    res.on('error', () => {
      onFinish();
    });

    try {
      app(req, res, (err: any) => {
        if (!res.headersSent) {
          if (err) {
            console.error('Express middleware unhandled error:', err);
            res.status(500).json({ error: 'Erro interno no servidor.', details: err?.message });
          } else {
            res.status(404).json({ error: 'Endpoint não encontrado.', path: req.url });
          }
        }
        onFinish();
      });
    } catch (appErr: any) {
      console.error('App request handler exception:', appErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro interno no servidor.', details: appErr?.message });
      }
      onFinish();
    }
  });
}
