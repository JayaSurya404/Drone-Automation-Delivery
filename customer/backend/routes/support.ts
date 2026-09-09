import { Router, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET ALL FAQS
router.get('/faqs', (req, res): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM faqs ORDER BY category, id');
    res.json(rows.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FAQs.' });
  }
});

// 2. GET CUSTOMER SUPPORT TICKETS (AUTHENTICATED & ISOLATED)
router.get('/tickets', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const tickets = queryAll<any>(
      'SELECT * FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const formatted = tickets.map((t) => {
      const messages = queryAll<any>(
        'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
        [t.id]
      );
      return {
        id: t.id,
        customerId: t.customer_id,
        orderId: t.order_id,
        subject: t.subject,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        messages: messages.map((m) => ({
          id: m.id,
          senderType: m.sender_type,
          senderName: m.sender_name,
          message: m.message,
          timestamp: m.created_at,
        })),
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
});

// 3. CREATE SUPPORT TICKET (AUTHENTICATED)
router.post('/tickets', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const userName = req.user!.name;
    const { subject, description, category = 'General Inquiry', orderId, priority = 'medium' } = req.body;

    if (!subject || !description) {
      res.status(400).json({ error: 'Subject and description are required.' });
      return;
    }

    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    runCommand(`
      INSERT INTO support_tickets (id, customer_id, order_id, subject, description, category, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `, [ticketId, userId, orderId || null, subject.trim(), description.trim(), category, priority]);

    // Initial user message
    runCommand(`
      INSERT INTO support_messages (id, ticket_id, sender_type, sender_name, message)
      VALUES (?, ?, 'customer', ?, ?)
    `, [`msg_${Date.now()}_1`, ticketId, userName, description.trim()]);

    // Automated SkyNav ground ops acknowledgment
    runCommand(`
      INSERT INTO support_messages (id, ticket_id, sender_type, sender_name, message)
      VALUES (?, ?, 'agent', 'SkyNav Flight Ground Ops', 'We have received your ticket. An aviation operations specialist is reviewing your flight logs.')
    `, [`msg_${Date.now()}_2`, ticketId]);

    const created = queryOne<any>('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    const messages = queryAll<any>('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId]);

    res.status(201).json({
      id: created.id,
      customerId: created.customer_id,
      orderId: created.order_id,
      subject: created.subject,
      description: created.description,
      category: created.category,
      status: created.status,
      priority: created.priority,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      messages: messages.map((m) => ({
        id: m.id,
        senderType: m.sender_type,
        senderName: m.sender_name,
        message: m.message,
        timestamp: m.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

// 4. ADD MESSAGE TO TICKET (AUTHENTICATED & OWNERSHIP VERIFIED)
router.post('/tickets/:id/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;
    const userName = req.user!.name;

    const ticket = queryOne<any>('SELECT * FROM support_tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    if (ticket.customer_id !== userId) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    if (!message || message.trim().length === 0) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    runCommand(`
      INSERT INTO support_messages (id, ticket_id, sender_type, sender_name, message)
      VALUES (?, ?, 'customer', ?, ?)
    `, [msgId, id, userName, message.trim()]);

    runCommand("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?", [id]);

    res.status(201).json({
      id: msgId,
      senderType: 'customer',
      senderName: userName,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post message.' });
  }
});

export default router;
