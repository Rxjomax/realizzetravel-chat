import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbQuery, dbRun } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { broadcastAttendantsList } from '../realtime/ws';

export const usersRouter = Router();

// GET /api/users - List users in the organization
usersRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const users = dbQuery<any>(
      `SELECT id, organization_id, name, email, role, status, avatar, created_at, updated_at, last_seen_at
       FROM users
       WHERE organization_id = ?
       ORDER BY
         CASE WHEN status = 'ONLINE' THEN 1 WHEN status = 'BUSY' THEN 2 ELSE 3 END,
         name ASC`,
      [orgId]
    );

    // Also get counts for conversations assigned per user
    const stats = dbQuery<{ assigned_user_id: string; active_count: number }>(
      `SELECT assigned_user_id, COUNT(*) as active_count
       FROM conversations
       WHERE organization_id = ? AND status IN ('OPEN', 'ASSIGNED') AND assigned_user_id IS NOT NULL
       GROUP BY assigned_user_id`,
      [orgId]
    );

    const statsMap = new Map<string, number>();
    stats.forEach((s) => statsMap.set(s.assigned_user_id, s.active_count));

    const enriched = users.map((u) => ({
      ...u,
      active_conversations_count: statsMap.get(u.id) || 0,
    }));

    res.json({ users: enriched });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Erro ao buscar atendentes e usuários.' });
  }
});

// PUT /api/users/:id/status - Update user status (ONLINE, BUSY, OFFLINE)
usersRouter.put('/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { status } = req.body;
    const targetUserId = req.params.id;

    // Only self or Admin/Supervisor can change status
    if (req.user!.id !== targetUserId && req.user!.role === 'AGENT') {
      res.status(403).json({ error: 'Você só pode alterar seu próprio status.' });
      return;
    }

    if (!['ONLINE', 'BUSY', 'OFFLINE'].includes(status)) {
      res.status(400).json({ error: 'Status inválido. Deve ser ONLINE, BUSY ou OFFLINE.' });
      return;
    }

    const now = new Date().toISOString();
    dbRun('UPDATE users SET status = ?, updated_at = ?, last_seen_at = ? WHERE id = ?', [
      status,
      now,
      now,
      targetUserId,
    ]);

    broadcastAttendantsList();

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status do atendente.' });
  }
});

// POST /api/users - Create new attendant (Admin only)
usersRouter.post('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, avatar } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Nome, e-mail, senha e cargo são obrigatórios.' });
      return;
    }

    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
      return;
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const orgId = req.user!.organization_id;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    dbRun(
      `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, name.trim(), email.toLowerCase().trim(), passwordHash, role, 'OFFLINE', avatar || null, now, now, now]
    );

    // Audit log
    dbRun(
      'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `log_user_create_${Date.now()}`,
        orgId,
        req.user!.id,
        'USER_CREATED',
        JSON.stringify({ createdUserId: id, email, role }),
        now,
      ]
    );

    broadcastAttendantsList();

    res.status(201).json({
      user: {
        id,
        organization_id: orgId,
        name,
        email,
        role,
        status: 'OFFLINE',
        avatar,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Erro interno ao criar atendente.' });
  }
});

// PUT /api/users/profile/me - Update logged in user profile and password
usersRouter.put('/profile/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, avatar, currentPassword, newPassword } = req.body;

    const user = dbGet<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const now = new Date().toISOString();

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Informe sua senha atual para definir uma nova senha.' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
        return;
      }

      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        res.status(400).json({ error: 'Senha atual incorreta.' });
        return;
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      dbRun('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, userId]);
    }

    // Update profile info
    if (name || avatar !== undefined) {
      dbRun(
        'UPDATE users SET name = COALESCE(?, name), avatar = COALESCE(?, avatar), updated_at = ? WHERE id = ?',
        [name ? name.trim() : null, avatar || null, now, userId]
      );
    }

    broadcastAttendantsList();

    const updated = dbGet<any>(
      'SELECT id, organization_id, name, email, role, status, avatar FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      user: updated,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados de perfil.' });
  }
});

usersRouter.put('/:id', authenticateToken, requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { name, email, role, avatar } = req.body;
    const targetUserId = req.params.id;

    const user = dbGet('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const now = new Date().toISOString();
    dbRun(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role), avatar = COALESCE(?, avatar), updated_at = ? WHERE id = ?',
      [name?.trim() || null, email?.toLowerCase().trim() || null, role || null, avatar || null, now, targetUserId]
    );

    broadcastAttendantsList();

    res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados do usuário.' });
  }
});
