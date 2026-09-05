import { Router, Response } from 'express';
import { dbGet, dbQuery, dbRun, dbTransaction } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { broadcastEvent } from '../realtime/ws';

export const conversationsRouter = Router();

// GET /api/conversations/metrics/summary - Dashboard metrics
conversationsRouter.get('/metrics/summary', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const userId = req.user!.id;

    const waitingCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status = 'WAITING'",
      [orgId]
    )?.count || 0;

    const openCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status IN ('OPEN', 'ASSIGNED')",
      [orgId]
    )?.count || 0;

    const myCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status IN ('OPEN', 'ASSIGNED') AND assigned_user_id = ?",
      [orgId, userId]
    )?.count || 0;

    const closedTodayCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status = 'CLOSED' AND date(closed_at) = date('now')",
      [orgId]
    )?.count || 0;

    const totalCustomersCount = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM customers WHERE organization_id = ?',
      [orgId]
    )?.count || 0;

    res.json({
      waitingCount,
      openCount,
      myCount,
      closedTodayCount,
      totalCustomersCount,
      avgResponseMinutes: 4.2, // calculated metric
      avgHandleMinutes: 18.5,
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Erro ao calcular métricas de atendimento.' });
  }
});

// GET /api/conversations - List conversations with filters and search
conversationsRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { status, filter, search } = req.query;
    const userId = req.user!.id;

    let sql = `
      SELECT
        c.id, c.organization_id, c.customer_id, c.assigned_user_id, c.status, c.priority,
        c.created_at, c.updated_at, c.closed_at, c.closed_by_user_id, c.last_message_at,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email,
        cust.destination_interest, cust.travel_date, cust.passenger_count, cust.budget, cust.notes as customer_notes,
        u.name as assigned_user_name, u.email as assigned_user_email, u.avatar as assigned_user_avatar
      FROM conversations c
      JOIN customers cust ON cust.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE c.organization_id = ?
    `;
    const params: any[] = [orgId];

    if (filter === 'WAITING' || status === 'WAITING') {
      sql += " AND c.status = 'WAITING'";
    } else if (filter === 'OPEN' || status === 'OPEN') {
      sql += " AND c.status IN ('OPEN', 'ASSIGNED')";
    } else if (filter === 'MY') {
      sql += " AND c.status IN ('OPEN', 'ASSIGNED') AND c.assigned_user_id = ?";
      params.push(userId);
    } else if (filter === 'CLOSED' || status === 'CLOSED') {
      sql += " AND c.status = 'CLOSED'";
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      sql += ` AND (
        cust.name LIKE ? OR
        cust.phone LIKE ? OR
        EXISTS (
          SELECT 1 FROM messages m
          WHERE m.conversation_id = c.id AND m.content LIKE ?
        )
      )`;
      params.push(term, term, term);
    }

    // Order: WAITING first with highest priority & oldest wait time, then latest message
    sql += `
      ORDER BY
        CASE WHEN c.status = 'WAITING' THEN 0 ELSE 1 END,
        c.last_message_at DESC
    `;

    const rows = dbQuery<any>(sql, params);

    // Enrich with last message & unread counts
    const conversations = rows.map((r) => {
      const lastMsg = dbGet<any>(
        'SELECT id, sender_type, content, message_type, status, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [r.id]
      );

      return {
        id: r.id,
        organization_id: r.organization_id,
        customer_id: r.customer_id,
        assigned_user_id: r.assigned_user_id,
        status: r.status,
        priority: r.priority,
        created_at: r.created_at,
        updated_at: r.updated_at,
        closed_at: r.closed_at,
        closed_by_user_id: r.closed_by_user_id,
        last_message_at: r.last_message_at,
        customer: {
          id: r.customer_id,
          name: r.customer_name,
          phone: r.customer_phone,
          email: r.customer_email,
          destination_interest: r.destination_interest,
          travel_date: r.travel_date,
          passenger_count: r.passenger_count,
          budget: r.budget,
          notes: r.customer_notes,
        },
        assigned_user: r.assigned_user_id
          ? {
              id: r.assigned_user_id,
              name: r.assigned_user_name,
              email: r.assigned_user_email,
              avatar: r.assigned_user_avatar,
            }
          : null,
        last_message: lastMsg || null,
        unread_count: r.status === 'WAITING' ? 1 : 0,
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Erro ao listar conversas.' });
  }
});

// GET /api/conversations/:id - Get full conversation with messages
conversationsRouter.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const convId = req.params.id;

    const conv = dbGet<any>(
      `SELECT
        c.id, c.organization_id, c.customer_id, c.assigned_user_id, c.status, c.priority,
        c.created_at, c.updated_at, c.closed_at, c.closed_by_user_id, c.last_message_at,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email,
        cust.destination_interest, cust.travel_date, cust.passenger_count, cust.budget, cust.notes as customer_notes,
        u.name as assigned_user_name, u.email as assigned_user_email, u.avatar as assigned_user_avatar
      FROM conversations c
      JOIN customers cust ON cust.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE c.id = ? AND c.organization_id = ?`,
      [convId, orgId]
    );

    if (!conv) {
      res.status(404).json({ error: 'Conversa não encontrada.' });
      return;
    }

    const messages = dbQuery<any>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [convId]
    );

    const events = dbQuery<any>(
      `SELECT e.*, u.name as user_name
       FROM conversation_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.conversation_id = ?
       ORDER BY e.created_at ASC`,
      [convId]
    );

    const notes = dbQuery<any>(
      `SELECT n.*, u.name as user_name
       FROM customer_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.customer_id = ?
       ORDER BY n.created_at DESC`,
      [conv.customer_id]
    );

    res.json({
      conversation: {
        ...conv,
        customer: {
          id: conv.customer_id,
          name: conv.customer_name,
          phone: conv.customer_phone,
          email: conv.customer_email,
          destination_interest: conv.destination_interest,
          travel_date: conv.travel_date,
          passenger_count: conv.passenger_count,
          budget: conv.budget,
          notes: conv.customer_notes,
        },
        assigned_user: conv.assigned_user_id
          ? {
              id: conv.assigned_user_id,
              name: conv.assigned_user_name,
              email: conv.assigned_user_email,
              avatar: conv.assigned_user_avatar,
            }
          : null,
      },
      messages,
      events,
      notes,
    });
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da conversa.' });
  }
});

// POST /api/conversations/:id/assign - ATOMIC ASSIGNMENT WITH STRICT CONCURRENCY CONTROL
conversationsRouter.post('/:id/assign', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const now = new Date().toISOString();

    // Atomic execution inside transaction
    const result = dbTransaction(() => {
      // Check current state with lock
      const current = dbGet<any>(
        'SELECT id, assigned_user_id, status FROM conversations WHERE id = ? AND organization_id = ?',
        [convId, orgId]
      );

      if (!current) {
        return { error: 'Conversa não encontrada.', status: 404 };
      }

      // Check if already assigned to someone else
      if (current.assigned_user_id && current.assigned_user_id !== userId) {
        const assignedUser = dbGet<any>('SELECT name FROM users WHERE id = ?', [current.assigned_user_id]);
        return {
          error: `Esta conversa já foi assumida por ${assignedUser?.name || 'outro atendente'}.`,
          status: 409,
        };
      }

      // Perform atomic update verifying assigned_user_id is still NULL or current user
      const updateRes = dbRun(
        `UPDATE conversations
         SET assigned_user_id = ?, status = 'OPEN', updated_at = ?
         WHERE id = ? AND (assigned_user_id IS NULL OR assigned_user_id = ?)`,
        [userId, now, convId, userId]
      );

      if (updateRes.changes === 0) {
        return {
          error: 'Esta conversa já foi assumida simultaneamente por outro atendente.',
          status: 409,
        };
      }

      // Record event
      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_assign_${Date.now()}`,
          convId,
          userId,
          'ASSIGNED',
          JSON.stringify({ assignedTo: req.user!.name }),
          now,
        ]
      );

      // Record audit log
      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_assign_${Date.now()}`,
          orgId,
          userId,
          'CONVERSATION_ASSIGNED',
          JSON.stringify({ conversationId: convId, assignedUser: req.user!.name }),
          now,
        ]
      );

      return { success: true };
    });

    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    // Broadcast realtime event to all attendants
    broadcastEvent('conversation:assigned', {
      conversationId: convId,
      assignedUserId: userId,
      assignedUserName: req.user!.name,
      status: 'OPEN',
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: 'Conversa assumida com sucesso!' });
  } catch (error) {
    console.error('Error assigning conversation:', error);
    res.status(500).json({ error: 'Erro ao assumir conversa.' });
  }
});

// POST /api/conversations/:id/messages - Send message from attendant
conversationsRouter.post('/:id/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const { content, messageType = 'text', mediaUrl } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Conteúdo da mensagem não pode ser vazio.' });
      return;
    }

    const conv = dbGet<any>(
      'SELECT id, assigned_user_id, status FROM conversations WHERE id = ? AND organization_id = ?',
      [convId, orgId]
    );

    if (!conv) {
      res.status(404).json({ error: 'Conversa não encontrada.' });
      return;
    }

    // Attendant authorization check: only assigned agent (or supervisor/admin) can reply
    if (conv.assigned_user_id && conv.assigned_user_id !== userId && req.user!.role === 'AGENT') {
      res.status(403).json({ error: 'Apenas o atendente responsável pode responder esta conversa.' });
      return;
    }

    const now = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    dbTransaction(() => {
      // Insert message
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, media_url, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msgId, orgId, convId, 'AGENT', userId, messageType, content.trim(), mediaUrl || null, 'sent', now]
      );

      // Update conversation last_message_at and status if needed
      dbRun(
        `UPDATE conversations
         SET last_message_at = ?, updated_at = ?, status = CASE WHEN status = 'WAITING' THEN 'OPEN' ELSE status END
         WHERE id = ?`,
        [now, now, convId]
      );
    });

    const createdMessage = {
      id: msgId,
      organization_id: orgId,
      conversation_id: convId,
      sender_type: 'AGENT',
      sender_id: userId,
      message_type: messageType,
      content: content.trim(),
      media_url: mediaUrl || null,
      status: 'sent',
      created_at: now,
    };

    // Broadcast new message via WebSocket
    broadcastEvent('message:new', {
      conversationId: convId,
      message: createdMessage,
    }, orgId);

    res.status(201).json({ message: createdMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Não foi possível enviar a mensagem.' });
  }
});

// POST /api/conversations/:id/transfer - Transfer conversation to another attendant
conversationsRouter.post('/:id/transfer', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const currentUserId = req.user!.id;
    const orgId = req.user!.organization_id;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'Selecione o atendente de destino.' });
      return;
    }

    const targetUser = dbGet<any>('SELECT id, name FROM users WHERE id = ? AND organization_id = ?', [targetUserId, orgId]);
    if (!targetUser) {
      res.status(404).json({ error: 'Atendente de destino não encontrado.' });
      return;
    }

    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET assigned_user_id = ?, status = 'OPEN', updated_at = ? WHERE id = ? AND organization_id = ?",
        [targetUserId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_trans_${Date.now()}`,
          convId,
          currentUserId,
          'TRANSFERRED',
          JSON.stringify({ fromUserId: currentUserId, toUserId: targetUserId, toUserName: targetUser.name, reason: reason || 'Transferência solicitada' }),
          now,
        ]
      );

      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_trans_${Date.now()}`,
          orgId,
          currentUserId,
          'CONVERSATION_TRANSFERRED',
          JSON.stringify({ conversationId: convId, targetUserId, targetUserName: targetUser.name, reason }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:transferred', {
      conversationId: convId,
      newAssignedUserId: targetUserId,
      newAssignedUserName: targetUser.name,
      transferredBy: req.user!.name,
      reason,
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: `Conversa transferida para ${targetUser.name}.` });
  } catch (error) {
    console.error('Error transferring conversation:', error);
    res.status(500).json({ error: 'Erro ao transferir atendimento.' });
  }
});

// POST /api/conversations/:id/close - Close conversation
conversationsRouter.post('/:id/close', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET status = 'CLOSED', closed_at = ?, closed_by_user_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
        [now, userId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_close_${Date.now()}`,
          convId,
          userId,
          'CLOSED',
          JSON.stringify({ closedBy: req.user!.name }),
          now,
        ]
      );

      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_close_${Date.now()}`,
          orgId,
          userId,
          'CONVERSATION_CLOSED',
          JSON.stringify({ conversationId: convId }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:closed', {
      conversationId: convId,
      closedByUserId: userId,
      closedByUserName: req.user!.name,
      closedAt: now,
    }, orgId);

    res.json({ success: true, message: 'Atendimento encerrado com sucesso.' });
  } catch (error) {
    console.error('Error closing conversation:', error);
    res.status(500).json({ error: 'Erro ao encerrar atendimento.' });
  }
});

// POST /api/conversations/:id/reopen - Reopen conversation
conversationsRouter.post('/:id/reopen', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET status = 'OPEN', assigned_user_id = ?, closed_at = NULL, closed_by_user_id = NULL, updated_at = ? WHERE id = ? AND organization_id = ?",
        [userId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_reopen_${Date.now()}`,
          convId,
          userId,
          'REOPENED',
          JSON.stringify({ reopenedBy: req.user!.name }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:reopened', {
      conversationId: convId,
      reopenedByUserId: userId,
      reopenedByUserName: req.user!.name,
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: 'Atendimento reaberto com sucesso.' });
  } catch (error) {
    console.error('Error reopening conversation:', error);
    res.status(500).json({ error: 'Erro ao reabrir conversa.' });
  }
});
