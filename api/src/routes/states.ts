import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleApiError } from '../utils/errorHandler';
import { CountRow } from '@shared/types';

const router = Router();

const validColumns = [
  'states.name',
  'abbr',
  'country_id',
  'last_visited',
  'country_name',
] as const;

const toError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

/**
 * GET /api/states
 * POST /api/states
 */
router.get('/api/states', (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    all,
    sortBy = 'name',
    sortOrder = 'asc',
  } = req.query as Record<string, string | undefined>;

  let sortByStr = sortBy || 'states.name';
  const sortOrderStr = sortOrder || 'asc';

  if (sortByStr === 'name') sortByStr = 'states.name';

  if (sortByStr && !validColumns.includes(sortByStr as any)) {
    return handleApiError(null, res, 'Invalid sort column.', 400);
  }

  if (sortOrderStr && !['asc', 'desc'].includes(sortOrderStr.toLowerCase())) {
    return handleApiError(null, res, 'Invalid sort order.', 400);
  }

  try {
    if (all === 'true') {
      const states = db
        .prepare(
          `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                  countries.name as country_name
           FROM states
           JOIN countries ON states.country_id = countries.id
           ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`
        )
        .all();

      return res.status(200).json({ total: states.length, states });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const total = (db.prepare('SELECT COUNT(*) AS count FROM states').get() as CountRow)
      .count as number;

    const states = db
      .prepare(
        `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                countries.name as country_name
         FROM states
         JOIN countries ON states.country_id = countries.id
         ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
         LIMIT ? OFFSET ?`
      )
      .all(limitNum, offset);

    return res.status(200).json({ total, states, page: pageNum, limit: limitNum });
  } catch (error: unknown) {
    return handleApiError(toError(error), res, 'Failed to fetch states.', 500);
  }
});

router.post('/api/states', (req: Request, res: Response) => {
  const { name, abbr, country_id, last_visited } = req.body ?? {};

  if (!name || !country_id) {
    return handleApiError(null, res, 'Name and country_id are required.', 400);
  }

  try {
    const result = db
      .prepare(
        'INSERT INTO states (name, abbr, country_id, last_visited) VALUES (?, ?, ?, ?)'
      )
      .run(name, abbr || null, country_id, last_visited);

    return res.status(201).json({
      message: 'State created successfully.',
      id: result.lastInsertRowid,
    });
  } catch (error: unknown) {
    return handleApiError(toError(error), res, 'Failed to create state.', 500);
  }
});

router.all('/api/states', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

/**
 * GET /api/states/:id
 * PUT /api/states/:id
 * DELETE /api/states/:id
 */
router.get('/api/states/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  try {
    const state = db
      .prepare(
        `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                countries.name as country_name
         FROM states
         JOIN countries ON states.country_id = countries.id
         WHERE states.id = ?`
      )
      .get(id);

    if (!state) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json(state);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch state.' });
  }
});

router.put('/api/states/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  const { name, abbr, country_id, last_visited } = req.body ?? {};

  if (!name || !country_id) {
    return res.status(400).json({ error: 'Name and country_id are required.' });
  }

  try {
    const result = db
      .prepare(
        'UPDATE states SET name = ?, abbr = ?, country_id = ?, last_visited = ? WHERE id = ?'
      )
      .run(name, abbr || null, country_id, last_visited, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json({ message: 'State updated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update state.' });
  }
});

router.delete('/api/states/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  try {
    const result = db.prepare('DELETE FROM states WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json({ message: 'State deleted successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete state.' });
  }
});

router.all('/api/states/:id', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
