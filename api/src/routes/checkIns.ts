import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /check-ins  (optional ?userId=)
router.get('/check-ins', (req: Request, res: Response) => {
  // userId can be string | string[] | undefined
  const rawUserId = req.query.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  try {
    let query = 'SELECT * FROM user_locations ORDER BY created_at DESC';
    const params: any[] = [];

    if (userId) {
      query =
        'SELECT * FROM user_locations WHERE user_id = ? ORDER BY created_at DESC';
      params.push(userId);
    }

    const stmt = db.prepare(query);
    const checkIns = stmt.all(...params);

    return res.status(200).json({ checkIns });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    return res.status(500).json({ error: 'Failed to fetch check-in logs.' });
  }
});

// DELETE /check-ins?id=...
router.delete('/check-ins', (req: Request, res: Response) => {
  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) {
    return res.status(400).json({ error: 'Check-in ID is required.' });
  }

  try {
    const stmt = db.prepare('DELETE FROM check_ins WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Check-in log not found.' });
    }

    return res
      .status(200)
      .json({ message: 'Check-in log deleted successfully.' });
  } catch (error) {
    console.error('Error deleting check-in:', error);
    return res.status(500).json({ error: 'Failed to delete check-in log.' });
  }
});

export default router;
