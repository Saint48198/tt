import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticateRequest } from '../utils/authUtil';

const router = Router();

const ENTITY_TYPE_CITIES = 'cities';

type Photo = {
  photo_id: string;
  url: string;
  caption?: string | null;
};

// POST /api/photos/bulk/add
router.post('/api/photos/bulk/add', async (req: Request, res: Response) => {
  try {
    const payload = await authenticateRequest(req, res);
    if (!payload) return;

    const { entityType, entityId, photos } = req.body;

    if (!entityType || !entityId || !photos) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const entityColumn =
      entityType === ENTITY_TYPE_CITIES ? 'city_id' : 'attraction_id';

    const insertPhotos = db.prepare(`
      INSERT INTO photos (photo_id, url, user_id, ${entityColumn}, caption)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: Photo[]) => {
      items.forEach((photo: Photo) => {
        insertPhotos.run(
          photo.photo_id,
          photo.url,
          payload.id,
          entityId,
          photo.caption || null
        );
      });
    });

    insertMany(photos);

    return res.status(201).json({ message: 'Photos added successfully' });
  } catch (error) {
    console.error('Failed to add photos:', error);
    return res.status(500).json({ error: 'Failed to add photos' });
  }
});

export default router;
