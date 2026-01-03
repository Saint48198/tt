import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /api/photos/add/:entityType/:entityId
router.post(
  '/api/photos/add/:entityType/:entityId',
  (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;

    if (!entityType || !entityId || Number.isNaN(Number(entityId))) {
      return res.status(400).json({ error: 'Invalid entityType or entityId' });
    }

    if (!['cities', 'attractions'].includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entityType. Must be "cities" or "attractions".',
      });
    }

    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const { url, userId, caption } = req.body;

    if (!url || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: url or userId.',
      });
    }

    try {
      const insert = db
        .prepare(
          `
          INSERT INTO photos (url, user_id, ${column}, caption)
          VALUES (?, ?, ?, ?)
        `
        )
        .run(url, userId, Number(entityId), caption || null);

      return res.status(201).json({
        message: 'Photo added successfully.',
        id: insert.lastInsertRowid,
      });
    } catch (error) {
      console.error('Failed to add photo:', error);
      return res.status(500).json({ error: 'Failed to add photo' });
    }
  }
);

export default router;
