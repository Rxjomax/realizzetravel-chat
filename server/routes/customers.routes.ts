import { Router, Response } from 'express';
import { dbGet, dbQuery, dbRun } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

export const customersRouter = Router();

// GET /api/customers - List all customers with search
customersRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { search } = req.query;

    let sql = 'SELECT * FROM customers WHERE organization_id = ?';
    const params: any[] = [orgId];

    if (search && typeof search === 'string' && search.trim() !== '') {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR destination_interest LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY updated_at DESC';

    const customers = dbQuery<any>(sql, params);
    res.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// GET /api/customers/:id - Customer details with notes
customersRouter.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const customer = dbGet('SELECT * FROM customers WHERE id = ? AND organization_id = ?', [
      req.params.id,
      orgId,
    ]);

    if (!customer) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }

    const notes = dbQuery<any>(
      `SELECT n.*, u.name as user_name
       FROM customer_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.customer_id = ?
       ORDER BY n.created_at DESC`,
      [req.params.id]
    );

    const conversations = dbQuery<any>(
      `SELECT c.*, u.name as assigned_user_name
       FROM conversations c
       LEFT JOIN users u ON u.id = c.assigned_user_id
       WHERE c.customer_id = ?
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );

    res.json({ customer, notes, conversations });
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente.' });
  }
});

// PUT /api/customers/:id - Update travel parameters
customersRouter.put('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const customerId = req.params.id;
    const { name, phone, email, notes, destination_interest, travel_date, passenger_count, budget } =
      req.body;

    const now = new Date().toISOString();

    dbRun(
      `UPDATE customers
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           notes = COALESCE(?, notes),
           destination_interest = COALESCE(?, destination_interest),
           travel_date = COALESCE(?, travel_date),
           passenger_count = COALESCE(?, passenger_count),
           budget = COALESCE(?, budget),
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        name?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        notes?.trim() || null,
        destination_interest?.trim() || null,
        travel_date || null,
        passenger_count || null,
        budget?.trim() || null,
        now,
        customerId,
        orgId,
      ]
    );

    res.json({ success: true, message: 'Dados da viagem atualizados com sucesso.' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados do cliente.' });
  }
});

// POST /api/customers/:id/notes - Add attendant note
customersRouter.post('/:id/notes', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const customerId = req.params.id;
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'O conteúdo da anotação não pode ser vazio.' });
      return;
    }

    const noteId = `not_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    dbRun(
      'INSERT INTO customer_notes (id, customer_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [noteId, customerId, userId, content.trim(), now]
    );

    res.status(201).json({
      note: {
        id: noteId,
        customer_id: customerId,
        user_id: userId,
        user_name: req.user!.name,
        content: content.trim(),
        created_at: now,
      },
    });
  } catch (error) {
    console.error('Error adding customer note:', error);
    res.status(500).json({ error: 'Erro ao registrar anotação interna.' });
  }
});
