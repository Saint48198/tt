import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

/**
 * GET /api/trips
 */
router.get('/api/trips', (_req: Request, res: Response) => {
  try {
    const trips = db
      .prepare(
        'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips.countryId = countries.id'
      )
      .all();

    return res.status(200).json(trips);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

/**
 * POST /api/trips
 */
router.post('/api/trips', (req: Request, res: Response) => {
  try {
    const { destination, startDate, endDate, notes, countryId } = req.body ?? {};

    const result = db
      .prepare(
        'INSERT INTO trips (destination, startDate, endDate, notes, countryId) VALUES (?, ?, ?, ?, ?)'
      )
      .run(destination, startDate, endDate, notes, countryId);

    return res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create trip' });
  }
});

router.all('/api/trips', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

/**
 * GET /api/trips/:id
 */
router.get('/api/trips/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const trip = db
      .prepare(
        'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips.countryId = countries.id WHERE trips.id = ?'
      )
      .get(id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    return res.status(200).json(trip);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

/**
 * PUT /api/trips/:id
 */
router.put('/api/trips/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { destination, startDate, endDate, notes, countryId } = req.body ?? {};

    const result = db
      .prepare(
        'UPDATE trips SET destination = ?, startDate = ?, endDate = ?, notes = ?, countryId = ? WHERE id = ?'
      )
      .run(destination, startDate, endDate, notes, countryId, id);

    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update trip' });
  }
});

/**
 * DELETE /api/trips/:id
 */
router.delete('/api/trips/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM trips WHERE id = ?').run(id);
    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete trip' });
  }
});

router.all('/api/trips/:id', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
