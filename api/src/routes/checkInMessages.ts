import { Router, Request, Response } from 'express';
import { db } from '../db';
import { isUUID } from 'validator';

const router = Router();

// GET /check-ins/messages?id=<uuid>
router.get('/check-ins/messages', (req: Request, res: Response) => {
  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== 'string' || !isUUID(id)) {
    return res.status(400).json({ error: 'Check-in ID is required.' });
  }

  try {
    const stmt = db.prepare(
      'SELECT * FROM check_in_messages WHERE check_in_id = ? ORDER BY created_at ASC'
    );
    const messages = stmt.all(id);

    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// POST /check-ins/messages
router.post('/check-ins/messages', (req: Request, res: Response) => {
  const { checkInId, userId, message } = req.body;

  if (!checkInId || !userId || !message) {
    return res.status(400).json({
      error: 'Check-in ID, user ID, and message are required.',
    });
  }

  try {
    const checkInExists = db
      .prepare('SELECT id FROM user_locations WHERE id = ?')
      .get(checkInId);

    if (!checkInExists) {
      return res.status(404).json({
        error: 'Check-in not found in user_locations.',
      });
    }

    const stmt = db.prepare(`
      INSERT INTO user_locations_messages (check_in_id, user_id, message)
      VALUES (?, ?, ?)
    `);

    stmt.run(checkInId, userId, message);

    return res.status(201).json({ message: 'Message added successfully.' });
  } catch (error) {
    console.error('Failed to add message:', error);
    return res.status(500).json({ error: 'Failed to add message.' });
  }
});

export default router;
