import { Router, Response } from 'express';
import { dbGet, dbRun } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const settingsRouter = Router();

export interface GeneralSettings {
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
  welcomeMessage: string;
  outOfHoursMessage: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string[];
  queueMode: 'MANUAL' | 'AUTO_ROUND_ROBIN';
  soundAlertsEnabled: boolean;
  desktopNotificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: GeneralSettings = {
  agencyName: 'RealizzeTravel Viagens & Turismo',
  agencyPhone: '+55 (11) 4004-9800',
  agencyEmail: 'contato@realizzetravel.com.br',
  welcomeMessage: 'Olá! Seja bem-vindo à RealizzeTravel Viagens. Como podemos ajudar no seu roteiro hoje? Em instantes um de nossos consultores de turismo irá lhe atender.',
  outOfHoursMessage: 'Nosso horário de atendimento é de Segunda a Sexta das 08h às 19h e Sábados das 09h às 13h. Sua solicitação foi registrada com sucesso e retornaremos no início do próximo expediente!',
  businessHoursStart: '08:00',
  businessHoursEnd: '19:00',
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
