import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticateRequest } from '../utils/authUtil';

const router = Router();

const ENTITY_TYPE_CITIES = 'cities';

// DELETE /api/photos/bulk/remove
router.delete('/api/photos/bulk/remove', async (req: Request, res: Response) => {
  const payload = await authenticateRequest(req, res);
  if (!payload) return;

  const { entityType, entityId, photos } = req.body;

  if (!entityType || !entityId || !photos) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const entityColumn =
      entityType === ENTITY_TYPE_CITIES ? 'city_id' : 'attraction_id';

    const deletePhotos = db.prepare(`
      DELETE FROM photos
      WHERE url = ? AND user_id = ? AND ${entityColumn} = ?
    `);

    const deleteMany = db.transaction((items: { url: string }[]) => {
      items.forEach((photo) => {
        deletePhotos.run(photo.url, payload.id, entityId);
      });
    });

    deleteMany(photos);

    return res.status(200).json({ message: 'Photos removed successfully' });
  } catch (error) {
    console.error('Failed to remove photos:', error);
    return res.status(500).json({ error: 'Failed to remove photos' });
  }
});

export default router;
