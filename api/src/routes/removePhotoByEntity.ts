import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// DELETE /api/photos/remove/:entityType/:entityId
router.delete(
  '/api/photos/remove/:entityType/:entityId',
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

    const { photoId } = req.body;

    if (!photoId) {
      return res
        .status(400)
        .json({ error: 'Missing required field: photoId.' });
    }

    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';

    try {
      const result = db
        .prepare(
          `
          DELETE FROM photos
          WHERE id = ? AND ${column} = ?
        `
        )
        .run(photoId, Number(entityId));

      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Photo not found or does not belong to this entity.',
        });
      }

      return res.status(200).json({ message: 'Photo removed successfully.' });
    } catch (error) {
      console.error('Failed to remove photo:', error);
      return res.status(500).json({ error: 'Failed to remove photo' });
    }
  }
);

export default router;
