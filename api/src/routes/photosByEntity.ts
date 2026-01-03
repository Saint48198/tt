import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const ENTITY_TYPE_CITIES = 'cities';
const ENTITY_TYPE_ATTRACTIONS = 'attractions';

// GET /api/photos/:entityType/:entityId
router.get('/api/photos/:entityType/:entityId', (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;

  if (!entityType || !entityId || Number.isNaN(Number(entityId))) {
    return res.status(400).json({ error: 'Invalid entityType or entityId' });
  }

  if (![ENTITY_TYPE_CITIES, ENTITY_TYPE_ATTRACTIONS].includes(entityType)) {
    return res.status(400).json({
      error: 'Invalid entityType. Must be "cities" or "attractions".',
    });
  }

  const column = entityType === ENTITY_TYPE_CITIES ? 'city_id' : 'attraction_id';

  try {
    const photos = db
      .prepare(
        `
        SELECT id, url, user_id, ${column} AS entity_id, caption, created_at, photo_id
        FROM photos
        WHERE ${column} = ?
      `
      )
      .all(Number(entityId));

    return res.status(200).json({ photos });
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

export default router;
