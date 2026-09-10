import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { dbGet, dbRun } from '../db/database';
import { authenticateToken, requireRole, flexibleAuth, AuthenticatedRequest } from '../auth/middleware';
import { WhatsAppService } from '../services/whatsapp.service';
import { broadcastEvent } from '../realtime/ws';

export const settingsRouter = Router();

export interface GeneralSettings {
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
  welcomeMessage: string;
  outOfHoursMessage: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  weekdayHoursStart?: string;
  weekdayHoursEnd?: string;
  saturdayHoursStart?: string;
  saturdayHoursEnd?: string;
  sundayClosed?: boolean;
  businessDays: string[];
  queueMode: 'MANUAL' | 'AUTO_ROUND_ROBIN';
  soundAlertsEnabled: boolean;
  desktopNotificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: GeneralSettings = {
  agencyName: 'RealizzeTravel',
  agencyPhone: '(81) 99535-7254',
  agencyEmail: 'realizzetravel@gmail.com',
  welcomeMessage: 'Olá! Seja bem-vindo à RealizzeTravel. Como podemos ajudar no seu roteiro hoje? Em instantes um de nossos consultores irá lhe atender.',
  outOfHoursMessage: 'Nosso horário de atendimento é de Segunda a Sexta das 08h às 19h e Sábados das 08h30 às 13h30. Sua solicitação foi registrada com sucesso e retornaremos no início do próximo expediente!',
  businessHoursStart: '08:00',
  businessHoursEnd: '19:00',
  weekdayHoursStart: '08:00',
  weekdayHoursEnd: '19:00',
  saturdayHoursStart: '08:30',
  saturdayHoursEnd: '13:30',
  sundayClosed: true,
  businessDays: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
  queueMode: 'MANUAL',
  soundAlertsEnabled: true,
  desktopNotificationsEnabled: true,
};

// GET /api/settings/general
settingsRouter.get('/general', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const row = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [orgId, 'general_config']
    );

    let settings: GeneralSettings = { ...DEFAULT_SETTINGS };

    if (row && row.value) {
      try {
        const sanitized = row.value.replace(/VooLivre/g, 'RealizzeTravel').replace(/@voolivre/g, '@realizzetravel');
        const parsed = JSON.parse(sanitized);
        settings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        console.error('Error parsing general settings:', e);
      }
    }

    res.json({ settings });
  } catch (error) {
    console.error('Error fetching general settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações gerais da agência.' });
  }
});

// PUT /api/settings/general (Admin & Supervisor)
settingsRouter.put('/general', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const incoming = req.body;
    const now = new Date().toISOString();

    const row = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [orgId, 'general_config']
    );

    let current: GeneralSettings = { ...DEFAULT_SETTINGS };
    if (row && row.value) {
      try {
        current = { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
      } catch (e) {}
    }

    const updated: GeneralSettings = {
      ...current,
      agencyName: incoming.agencyName !== undefined ? String(incoming.agencyName).trim() : current.agencyName,
      agencyPhone: incoming.agencyPhone !== undefined ? String(incoming.agencyPhone).trim() : current.agencyPhone,
      agencyEmail: incoming.agencyEmail !== undefined ? String(incoming.agencyEmail).trim() : current.agencyEmail,
      welcomeMessage: incoming.welcomeMessage !== undefined ? String(incoming.welcomeMessage).trim() : current.welcomeMessage,
      outOfHoursMessage: incoming.outOfHoursMessage !== undefined ? String(incoming.outOfHoursMessage).trim() : current.outOfHoursMessage,
      businessHoursStart: incoming.businessHoursStart || current.businessHoursStart,
      businessHoursEnd: incoming.businessHoursEnd || current.businessHoursEnd,
      weekdayHoursStart: incoming.weekdayHoursStart !== undefined ? incoming.weekdayHoursStart : (current.weekdayHoursStart || '08:00'),
      weekdayHoursEnd: incoming.weekdayHoursEnd !== undefined ? incoming.weekdayHoursEnd : (current.weekdayHoursEnd || '19:00'),
      saturdayHoursStart: incoming.saturdayHoursStart !== undefined ? incoming.saturdayHoursStart : (current.saturdayHoursStart || '08:30'),
      saturdayHoursEnd: incoming.saturdayHoursEnd !== undefined ? incoming.saturdayHoursEnd : (current.saturdayHoursEnd || '13:30'),
      sundayClosed: incoming.sundayClosed !== undefined ? Boolean(incoming.sundayClosed) : current.sundayClosed,
      businessDays: Array.isArray(incoming.businessDays) ? incoming.businessDays : current.businessDays,
      queueMode: incoming.queueMode === 'AUTO_ROUND_ROBIN' ? 'AUTO_ROUND_ROBIN' : 'MANUAL',
      soundAlertsEnabled: incoming.soundAlertsEnabled !== undefined ? Boolean(incoming.soundAlertsEnabled) : current.soundAlertsEnabled,
      desktopNotificationsEnabled: incoming.desktopNotificationsEnabled !== undefined ? Boolean(incoming.desktopNotificationsEnabled) : current.desktopNotificationsEnabled,
    };

    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, 'general_config', ?, ?, ?)
       ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`set_gen_${orgId}`, orgId, JSON.stringify(updated), now, now]
    );

    // Audit log
    dbRun(
      'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `log_settings_${Date.now()}`,
        orgId,
        req.user!.id,
        'GENERAL_SETTINGS_UPDATED',
        JSON.stringify({ updatedBy: req.user!.name }),
        now,
      ]
    );

    res.json({
      success: true,
      message: 'Configurações gerais salvas com sucesso!',
      settings: updated,
    });
  } catch (error) {
    console.error('Error saving general settings:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações gerais.' });
  }
});

// ==========================================
// WHATSAPP CONFIGURATION & PAIRING ENDPOINTS
// ==========================================

// GET /api/settings/whatsapp
settingsRouter.get('/whatsapp', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const row = dbGet<{ value: string }>('SELECT value FROM settings WHERE organization_id = ? AND key = ?', [
      orgId,
      'whatsapp_config',
    ]);

    let config: any = {
      providerType: 'EVOLUTION_API',
      phoneNumberId: '',
      businessAccountId: '',
      accessToken: '',
      verifyToken: 'viagens_whatsapp_verify_token_2026',
      verifiedName: null,
      qualityRating: null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
      gatewayUrl: process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
      zapiInstanceId: '',
      zapiToken: '',
      zapiClientToken: '',
      qrCodeBase64: null,
      phoneConnected: null,
      batteryLevel: null,
      status: 'DISCONNECTED',
    };

    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        config = {
          providerType: parsed.providerType || 'EVOLUTION_API',
          phoneNumberId: parsed.phoneNumberId || '',
          businessAccountId: parsed.businessAccountId || '',
          accessToken: parsed.accessToken ? '••••••••••••••••' + parsed.accessToken.slice(-6) : '',
          verifyToken: parsed.verifyToken || 'viagens_whatsapp_verify_token_2026',
          verifiedName: parsed.verifiedName || null,
          qualityRating: parsed.qualityRating || null,
          instanceName: (parsed.instanceName && parsed.instanceName !== 'realizze-travel') ? parsed.instanceName : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial'),
          gatewayUrl: parsed.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
          apiKey: parsed.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
          zapiInstanceId: parsed.zapiInstanceId || '',
          zapiToken: parsed.zapiToken || '',
          zapiClientToken: parsed.zapiClientToken || '',
          qrCodeBase64: parsed.qrCodeBase64 || null,
          phoneConnected: parsed.phoneConnected || null,
          batteryLevel: parsed.batteryLevel !== undefined ? parsed.batteryLevel : null,
          status: parsed.status || 'DISCONNECTED',
        };
      } catch (e) {}
    }

    res.json({ config });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações do WhatsApp.' });
  }
});

// PUT /api/settings/whatsapp
settingsRouter.put('/whatsapp', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const {
      providerType = 'META_CLOUD',
      phoneNumberId,
      businessAccountId,
      accessToken,
      verifyToken,
      instanceName,
      gatewayUrl,
      apiKey,
      zapiInstanceId,
      zapiToken,
      zapiClientToken,
      status,
      phoneConnected,
      verifiedName,
      qualityRating,
    } = req.body;
    const now = new Date().toISOString();

    const existingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [orgId, 'whatsapp_config']
    );

    let currentConfig: any = {};
    if (existingRow && existingRow.value) {
      try {
        currentConfig = JSON.parse(existingRow.value);
      } catch (e) {}
    }

    const tokenToSave =
      accessToken && !accessToken.includes('••••') ? accessToken.trim() : (currentConfig.accessToken || '');
    const apiKeyToSave =
      apiKey && !apiKey.includes('••••') ? apiKey.trim() : (currentConfig.apiKey || '');

    const isConnected =
      providerType === 'META_CLOUD'
        ? Boolean(tokenToSave && phoneNumberId)
        : (status === 'CONNECTED' || currentConfig.status === 'CONNECTED');

    const newConfig = {
      providerType,
      phoneNumberId: phoneNumberId?.trim() || '',
      businessAccountId: businessAccountId?.trim() || '',
      accessToken: tokenToSave,
      verifyToken: verifyToken?.trim() || 'viagens_whatsapp_verify_token_2026',
      verifiedName: verifiedName !== undefined ? verifiedName : (currentConfig.verifiedName || null),
      qualityRating: qualityRating !== undefined ? qualityRating : (currentConfig.qualityRating || null),
      instanceName: instanceName?.trim() || 'realizze-travel',
      gatewayUrl: gatewayUrl?.trim() || '',
      apiKey: apiKeyToSave,
      zapiInstanceId: zapiInstanceId?.trim() || currentConfig.zapiInstanceId || '',
      zapiToken: zapiToken?.trim() || currentConfig.zapiToken || '',
      zapiClientToken: zapiClientToken !== undefined ? zapiClientToken.trim() : (currentConfig.zapiClientToken || ''),
      qrCodeBase64: currentConfig.qrCodeBase64 || null,
      phoneConnected: phoneConnected !== undefined ? phoneConnected : (currentConfig.phoneConnected || null),
      batteryLevel: currentConfig.batteryLevel !== undefined ? currentConfig.batteryLevel : null,
      status: isConnected ? 'CONNECTED' : (status || currentConfig.status || 'DISCONNECTED'),
    };

    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, 'whatsapp_config', ?, ?, ?)
       ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`set_wa_${orgId}`, orgId, JSON.stringify(newConfig), now, now]
    );

    res.json({ success: true, message: 'Configurações do WhatsApp salvas com sucesso.', config: newConfig });
  } catch (error) {
    console.error('Error saving WhatsApp settings:', error);
    res.status(500).json({ error: 'Erro ao salvar credenciais do WhatsApp.' });
  }
});

// POST /api/settings/whatsapp/test-meta - Test official Meta Cloud API connection
settingsRouter.post('/whatsapp/test-meta', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { phoneNumberId, accessToken, businessAccountId } = req.body;
    const result = await WhatsAppService.testMetaConnection({
      phoneNumberId,
      accessToken,
      businessAccountId,
      organizationId: orgId,
    });
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('Error in /whatsapp/test-meta route:', err);
    res.status(500).json({ success: false, error: err.message || 'Erro ao testar conexão com a Meta.' });
  }
});

// POST /api/settings/whatsapp/sync-meta - Synchronize conversations and chats
settingsRouter.post('/whatsapp/sync-meta', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organization_id;
    const result = await WhatsAppService.syncWhatsAppChats(orgId);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /whatsapp/sync-meta route:', err);
    res.status(500).json({ success: false, count: 0, error: err.message || 'Erro ao sincronizar.' });
  }
});

// Helper for fast non-blocking fetch with timeout (guarantees Vercel/serverless never hangs)
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3500): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Helper to extract crisp QR Code data URL from Evolution API response
async function extractQrDataUrl(data: any): Promise<string | null> {
  if (!data) return null;
  const rawCode = data.code || data.qrcode?.code;
  if (rawCode && typeof rawCode === 'string') {
    try {
      return await QRCode.toDataURL(rawCode, {
        errorCorrectionLevel: 'M',
        margin: 3,
        width: 400,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (qrErr) {
      console.warn('Notice generating QR code from code string:', qrErr);
    }
  }
  const b64 = data.base64 || data.qrcode?.base64;
  if (b64 && typeof b64 === 'string') {
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  }
  return null;
}

// POST /api/settings/whatsapp/qr/generate - Connect & Request QR code for phone pairing (Evolution API & Direct QR)
settingsRouter.post('/whatsapp/qr/generate', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const {
      gatewayUrl = process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
      instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
      apiKey = process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
      forceRestart = false,
    } = req.body;

    let qrDataUrl: string | null = null;
    let isLiveConnected = false;
    let connectedPhone: string | null = null;

    const cleanBase = (gatewayUrl || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const inst = (instanceName || 'realizze-oficial').trim();
    const key = (apiKey || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    };

    let currentState = 'close';
    let instanceExists = true;

    // 1. Check Evolution API instance state
    try {
      const stateRes = await fetchWithTimeout(`${cleanBase}/instance/connectionState/${inst}`, { headers }, 3500);
      if (stateRes.ok) {
        const stateData: any = await stateRes.json();
        currentState = stateData?.instance?.state || stateData?.state || 'close';
        if (currentState === 'open' || currentState === 'CONNECTED') {
          isLiveConnected = true;
          connectedPhone = stateData?.instance?.owner || stateData?.owner || 'WhatsApp Conectado';
          try {
            WhatsAppService.updateGatewayConnectionStatus(orgId, 'CONNECTED', connectedPhone || undefined);
          } catch {}
          res.json({
            success: true,
            qrCode: null,
            status: 'CONNECTED',
            phone: connectedPhone,
            instanceName: inst,
            gatewayUrl: cleanBase,
            message: 'Instância da Evolution API já conectada ao WhatsApp!',
          });
          return;
        }
      } else if (stateRes.status === 404) {
        instanceExists = false;
      }
    } catch (evoErr) {
      console.warn('Notice checking instance state:', evoErr);
    }

    // 2. If instance doesn't exist, create it
    if (!instanceExists) {
      try {
        const createRes = await fetchWithTimeout(`${cleanBase}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: inst,
            token: key,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        }, 6000);
        if (createRes.ok) {
          const createData: any = await createRes.json();
          qrDataUrl = await extractQrDataUrl(createData);
        }
      } catch (cErr) {
        console.warn('Notice creating instance on Evolution API:', cErr);
      }
    }

    // 3. If forceRestart was explicitly requested OR state is 'close', restart socket to get immediate fresh QR
    if (!qrDataUrl && (forceRestart || currentState === 'close')) {
      try {
        const restartRes = await fetchWithTimeout(`${cleanBase}/instance/restart/${inst}`, {
          method: 'POST',
          headers,
        }, 7000);
        if (restartRes.ok) {
          const restartData: any = await restartRes.json();
          qrDataUrl = await extractQrDataUrl(restartData);
        }
      } catch (rErr) {
        console.warn('Notice restarting instance on Evolution API:', rErr);
      }
    }

    // 4. If still no QR, call /instance/connect
    if (!qrDataUrl) {
      try {
        const connectRes = await fetchWithTimeout(`${cleanBase}/instance/connect/${inst}`, { headers }, 7000);
        if (connectRes.ok) {
          const connectData: any = await connectRes.json();
          qrDataUrl = await extractQrDataUrl(connectData);

          if (connectData?.instance?.state === 'open' || connectData?.status === 'CONNECTED') {
            isLiveConnected = true;
            connectedPhone = connectData?.instance?.owner || 'WhatsApp Conectado';
            try {
              WhatsAppService.updateGatewayConnectionStatus(orgId, 'CONNECTED', connectedPhone);
            } catch {}
          }
        }
      } catch (connErr) {
        console.warn('Notice fetching QR code from connect endpoint:', connErr);
      }
    }

    // 5. Fallback: if connect timed out or failed to return a QR, force restart the socket
    if (!qrDataUrl && !isLiveConnected) {
      try {
        const fallbackRestart = await fetchWithTimeout(`${cleanBase}/instance/restart/${inst}`, {
          method: 'POST',
          headers,
        }, 6000);
        if (fallbackRestart.ok) {
          const fallbackData: any = await fallbackRestart.json();
          qrDataUrl = await extractQrDataUrl(fallbackData);
        }
      } catch (fbErr) {
        console.warn('Notice in fallback restart for QR:', fbErr);
      }
    }

    if (qrDataUrl) {
      try {
        WhatsAppService.updateGatewayQrCode(orgId, qrDataUrl);
      } catch {}
      res.json({
        success: true,
        qrCode: qrDataUrl,
        status: isLiveConnected ? 'CONNECTED' : 'QR_READY',
        phone: connectedPhone,
        instanceName: inst,
        gatewayUrl: cleanBase,
        message: isLiveConnected
          ? 'Instância da Evolution API já conectada ao WhatsApp!'
          : 'QR Code da Evolution API gerado com sucesso! Aponte o WhatsApp do seu celular em Aparelhos Conectados.',
      });
    } else {
      res.json({
        success: false,
        qrCode: null,
        status: isLiveConnected ? 'CONNECTED' : 'DISCONNECTED',
        phone: connectedPhone,
        instanceName: inst,
        gatewayUrl: cleanBase,
        message: 'Aguardando inicialização da instância na VPS. Clique em "Atualizar QR Code".',
      });
    }
  } catch (err: any) {
    console.error('Error generating QR code:', err);
    res.status(200).json({
      success: false,
      qrCode: null,
      status: 'DISCONNECTED',
      message: 'Falha temporária ao comunicar com a VPS. Clique em "Reiniciar Conexão".',
    });
  }
});

// POST /api/settings/whatsapp/pairing-code - Generate real 8-digit Baileys WhatsApp pairing code
settingsRouter.post('/whatsapp/pairing-code', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      phoneNumber,
      gatewayUrl = process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
      instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
      apiKey = process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
    } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ success: false, message: 'Número de telefone é obrigatório.' });
      return;
    }

    let cleanNumber = String(phoneNumber).replace(/\D/g, '');
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = '55' + cleanNumber;
    }

    const cleanBase = (gatewayUrl || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const inst = (instanceName || 'realizze-oficial').trim();
    const key = (apiKey || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    };

    // 1. Fast path: try connect with number directly on existing instance (< 400ms)
    let pairingCode: string | null = null;
    try {
      const fastRes = await fetchWithTimeout(
        `${cleanBase}/instance/connect/${inst}?number=${cleanNumber}`,
        { headers },
        2500
      );
      if (fastRes.ok) {
        const data: any = await fastRes.json();
        pairingCode = data.pairingCode || null;
      }
    } catch (fastErr) {
      console.warn('Fast pairing code attempt notice:', fastErr);
    }

    // 2. Fallback path: If instance is missing or did not return code, create/ensure instance and retry
    if (!pairingCode) {
      try {
        await fetchWithTimeout(
          `${cleanBase}/instance/create`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              instanceName: inst,
              token: key,
              qrcode: true,
              number: cleanNumber,
              integration: 'WHATSAPP-BAILEYS',
            }),
          },
          3000
        );

        const retryRes = await fetchWithTimeout(
          `${cleanBase}/instance/connect/${inst}?number=${cleanNumber}`,
          { headers },
          2500
        );
        if (retryRes.ok) {
          const retryData: any = await retryRes.json();
          pairingCode = retryData.pairingCode || null;
        }
      } catch (retryErr) {
        console.warn('Fallback pairing code retry notice:', retryErr);
      }
    }

    if (pairingCode) {
      res.json({
        success: true,
        pairingCode,
        number: cleanNumber,
        message: 'Código de 8 dígitos gerado pela Evolution API com sucesso!',
      });
    } else {
      res.status(500).json({
        success: false,
        pairingCode: null,
        message: 'A Evolution API não retornou o código de pareamento. Tente novamente em alguns instantes.',
      });
    }
  } catch (err: any) {
    console.error('Error generating pairing code:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Erro ao gerar código de pareamento.',
    });
  }
});

// POST /api/settings/whatsapp/evolution/reset - Reset instance session on Evolution API (fixes stale session / pairing issues)
settingsRouter.post('/whatsapp/evolution/reset', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const {
      gatewayUrl = process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
      instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
      apiKey = process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
    } = req.body;

    const cleanBase = (gatewayUrl || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const inst = (instanceName || 'realizze-oficial').trim();
    const key = (apiKey || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    };

    // 1. Logout and Delete existing instance session
    try {
      await fetchWithTimeout(`${cleanBase}/instance/logout/${inst}`, {
        method: 'DELETE',
        headers,
      }, 4000);
    } catch {}

    try {
      await fetchWithTimeout(`${cleanBase}/instance/delete/${inst}`, {
        method: 'DELETE',
        headers,
      }, 4000);
    } catch (delErr) {
      console.warn('Notice deleting instance on reset:', delErr);
    }

    // 2. Create brand new instance
    let qrDataUrl: string | null = null;
    try {
      const createRes = await fetchWithTimeout(`${cleanBase}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName: inst,
          token: key,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      }, 5000);

      if (createRes.ok) {
        const createData: any = await createRes.json();
        qrDataUrl = await extractQrDataUrl(createData);
      }
    } catch (createErr) {
      console.warn('Notice creating fresh instance on reset:', createErr);
    }

    // 3. Connect to get fresh QR code at count 1
    if (!qrDataUrl) {
      try {
        const connectRes = await fetchWithTimeout(`${cleanBase}/instance/connect/${inst}`, { headers }, 6000);
        if (connectRes.ok) {
          const connectData: any = await connectRes.json();
          qrDataUrl = await extractQrDataUrl(connectData);
        }
      } catch (cErr) {
        console.warn('Notice connecting after reset:', cErr);
      }
    }

    // 4. Fallback: restart instance
    if (!qrDataUrl) {
      try {
        const restartRes = await fetchWithTimeout(`${cleanBase}/instance/restart/${inst}`, {
          method: 'POST',
          headers,
        }, 5000);
        if (restartRes.ok) {
          const restartData: any = await restartRes.json();
          qrDataUrl = await extractQrDataUrl(restartData);
        }
      } catch {}
    }

    if (qrDataUrl) {
      try {
        WhatsAppService.updateGatewayQrCode(orgId, qrDataUrl);
      } catch {}
      res.json({
        success: true,
        qrCode: qrDataUrl,
        status: 'QR_READY',
        message: 'Sessão reiniciada com sucesso! Um novo QR Code limpo e atualizado foi gerado.',
      });
    } else {
      res.json({
        success: false,
        qrCode: null,
        status: 'DISCONNECTED',
        message: 'A instância foi recriada. Clique em "Atualizar QR Code" em alguns segundos.',
      });
    }
  } catch (err: any) {
    console.error('Error resetting WhatsApp session:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Erro ao reiniciar sessão na Evolution API.',
    });
  }
});

// GET /api/settings/whatsapp/status - Live check Evolution API connection status
settingsRouter.get('/whatsapp/status', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const creds = WhatsAppService.getCredentials(orgId);

    if (creds.providerType === 'EVOLUTION_API' && creds.gatewayUrl) {
      const cleanBase = creds.gatewayUrl.trim().replace(/\/+$/, '');
      const inst = (creds.instanceName || 'realizze-oficial').trim();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': creds.apiKey || 'Realizze@SecretKey2026',
      };

      try {
        const stateRes = await fetchWithTimeout(`${cleanBase}/instance/connectionState/${inst}`, { headers }, 3000);
        if (stateRes.ok) {
          const data: any = await stateRes.json();
          const state = data?.instance?.state || data?.state;
          const isConnected = state === 'open';
          const owner = data?.instance?.owner || data?.owner;

          if (isConnected) {
            if (creds.status !== 'CONNECTED') {
              try { WhatsAppService.updateGatewayConnectionStatus(orgId, 'CONNECTED', owner || undefined); } catch {}
            }
            res.json({
              connected: true,
              status: 'CONNECTED',
              state: 'open',
              phoneConnected: owner || creds.phoneConnected || null,
            });
            return;
          } else {
            if (creds.status === 'CONNECTED' && (state === 'close' || state === 'connecting')) {
              try { WhatsAppService.updateGatewayConnectionStatus(orgId, 'DISCONNECTED', null); } catch {}
            }
            res.json({
              connected: false,
              status: creds.qrCodeBase64 ? 'QR_READY' : 'DISCONNECTED',
              state: state || 'close',
              phoneConnected: null,
            });
            return;
          }
        }
      } catch (err) {
        // VPS fetch failed or timed out, fallback to DB status smoothly
      }
    }

    res.json({
      connected: creds.status === 'CONNECTED',
      status: creds.status || 'DISCONNECTED',
      phoneConnected: creds.phoneConnected || null,
    });
  } catch (err: any) {
    res.json({
      connected: false,
      status: 'DISCONNECTED',
      phoneConnected: null,
    });
  }
});

// POST /api/settings/whatsapp/evolution/configure-webhook - Automatically set webhook on Evolution API
settingsRouter.post('/whatsapp/evolution/configure-webhook', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gatewayUrl, instanceName, apiKey } = req.body;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const webhookUrl = `${protocol}://${host}/api/webhooks/whatsapp`;

    const result = await WhatsAppService.configureEvolutionWebhook({
      gatewayUrl,
      instanceName,
      apiKey,
      webhookUrl,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Erro ao configurar webhook na Evolution API.' });
  }
});

// POST /api/settings/whatsapp/evolution/sync - Sync chats from Evolution API
settingsRouter.post('/whatsapp/evolution/sync', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const result = await WhatsAppService.syncEvolutionChats(orgId);
    res.json({
      success: true,
      count: result.count,
      message: `Evolution API: ${result.count} conversas sincronizadas com sucesso!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, count: 0, error: err.message || 'Erro ao sincronizar Evolution API.' });
  }
});

// POST /api/settings/whatsapp/evolution/test - Test Evolution API connection
settingsRouter.post('/whatsapp/evolution/test', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gatewayUrl, instanceName, apiKey } = req.body;
    if (!gatewayUrl || !instanceName) {
      res.status(400).json({ success: false, message: 'URL do servidor e nome da instância são obrigatórios.' });
      return;
    }
    const cleanBase = gatewayUrl.trim().replace(/\/+$/, '');
    const inst = instanceName.trim();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['apikey'] = apiKey.trim();
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetchWithTimeout(`${cleanBase}/instance/connectionState/${inst}`, { headers }, 3500);
    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      res.json({
        success: false,
        message: errData?.message || `Servidor respondeu com status HTTP ${response.status}. Verifique se a instância existe e a chave de API está correta.`,
      });
      return;
    }

    const data: any = await response.json();
    const state = data?.instance?.state || data?.state;
    const isConnected = state === 'open' || state === 'CONNECTED';
    const owner = data?.instance?.owner || data?.owner;

    res.json({
      success: true,
      connected: isConnected,
      state: state || 'close',
      ownerPhone: owner,
      message: isConnected
        ? `Instância "${inst}" conectada e ativa na Evolution API!`
        : `Instância "${inst}" encontrada na Evolution API. Estado atual: ${state || 'Aguardando leitura do QR Code'}.`,
    });
  } catch (err: any) {
    res.json({
      success: false,
      message: `Não foi possível conectar ao servidor Evolution API: ${err.message}`,
    });
  }
});

// POST /api/settings/whatsapp/qr/pair-success - Mark as connected when paired
settingsRouter.post('/whatsapp/qr/pair-success', flexibleAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { phone } = req.body;

    const existingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [orgId, 'whatsapp_config']
    );
    let currentConfig: any = {};
    if (existingRow && existingRow.value) {
      try {
        currentConfig = JSON.parse(existingRow.value);
      } catch (e) {}
    }

    const connectedPhone = phone || currentConfig.phoneConnected || 'WhatsApp Conectado';
    WhatsAppService.updateGatewayConnectionStatus(orgId, 'CONNECTED', connectedPhone);

    res.json({
      success: true,
      message: 'WhatsApp pareado com sucesso! Canal ativo e sincronizado.',
      status: 'CONNECTED',
      phone: connectedPhone,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao parear WhatsApp.' });
  }
});

// POST /api/settings/whatsapp/disconnect - Disconnect WhatsApp
settingsRouter.post('/whatsapp/disconnect', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const result = await WhatsAppService.disconnectEvolution(orgId);
    res.json({
      success: true,
      message: result.message,
      status: 'DISCONNECTED',
      qrCode: result.qrCode || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao desconectar WhatsApp.' });
  }
});

// POST /api/settings/whatsapp/clear-history - Clear all mock/fake conversations, messages, and customers
settingsRouter.post(['/whatsapp/clear-history', '/clear-mock-data'], authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    dbRun('DELETE FROM messages WHERE organization_id = ?', [orgId]);
    dbRun('DELETE FROM conversation_events WHERE conversation_id NOT IN (SELECT id FROM conversations WHERE organization_id = ?)', [orgId]);
    dbRun('DELETE FROM conversations WHERE organization_id = ?', [orgId]);
    dbRun('DELETE FROM customers WHERE organization_id = ?', [orgId]);

    broadcastEvent('conversation:cleared', { organizationId: orgId }, orgId);

    res.json({
      success: true,
      message: 'Histórico e dados fictícios limpos com sucesso! O sistema está limpo para receber o WhatsApp da agência.',
    });
  } catch (err: any) {
    console.error('Error clearing mock data:', err);
    res.status(500).json({ error: err.message || 'Erro ao limpar histórico de conversas.' });
  }
});

// POST /api/settings/whatsapp/simulate-incoming - Real-time Inbound WhatsApp Message Simulator
settingsRouter.post('/whatsapp/simulate-incoming', flexibleAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { phone = '+55 11 98888-7777', name = 'Cliente WhatsApp', content = 'Olá! Gostaria de informações sobre pacotes de viagem.', messageType = 'text', avatar, avatarUrl } = req.body;

    const result = WhatsAppService.processInboundMessage({
      organizationId: orgId,
      phone: phone.trim(),
      name: name.trim(),
      avatarUrl: avatar || avatarUrl || null,
      content: content.trim(),
      messageType,
      whatsappMessageId: `sim_wamid_${Date.now()}`,
    });

    res.json({
      success: true,
      message: 'Mensagem recebida e processada com sucesso no WhatsApp da agência!',
      conversationId: result.conversationId,
      status: result.status,
      autoReplySent: result.autoReplySent,
    });
  } catch (err: any) {
    console.error('Error simulating incoming WhatsApp message:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar mensagem simulada.' });
  }
});

// POST /api/settings/whatsapp/sync-zapi - Sync recent chats from Z-API
settingsRouter.post('/whatsapp/sync-zapi', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR', 'AGENT']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const result = await WhatsAppService.syncZapiRecentChats(orgId);
    res.json({
      success: true,
      message: `Sincronização concluída! ${result.count} conversas foram verificadas e atualizadas do WhatsApp.`,
      count: result.count,
    });
  } catch (err: any) {
    console.error('Error syncing Z-API:', err);
    res.status(500).json({ error: err.message || 'Erro ao sincronizar conversas do Z-API.' });
  }
});


