import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const validColumns = [
  'name',
  'abbreviation',
  'lat',
  'lng',
  'slug',
  'last_visited',
  'geo_map_id',
];

// GET /api/countries
router.get('/api/countries', (req: Request, res: Response) => {
  const { page, limit, all, sortBy, sortOrder } = req.query;

  const pageNum =
    page !== undefined
      ? Number(Array.isArray(page) ? page[0] : page)
      : 1;

  const limitNum =
    limit !== undefined
      ? Number(Array.isArray(limit) ? limit[0] : limit)
      : 10;

  const rawSortBy = Array.isArray(sortBy) ? sortBy?.[0] : sortBy;
  const sortByStr = (rawSortBy ?? 'name').toString();

  const rawSortOrder = Array.isArray(sortOrder) ? sortOrder?.[0] : sortOrder;
  const sortOrderStr = (rawSortOrder ?? 'asc').toString().toLowerCase();

  if (!validColumns.includes(sortByStr)) {
    return res.status(400).json({ error: 'Invalid sort column.' });
  }

  if (!['asc', 'desc'].includes(sortOrderStr)) {
    return res.status(400).json({ error: 'Invalid sort order.' });
  }

  try {
    if (all === 'true') {
      const countries = db
        .prepare(
          `SELECT * FROM countries ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`
        )
        .all();

      return res.status(200).json({
        total: countries.length,
        countries,
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const totalRow = db
      .prepare('SELECT COUNT(*) AS count FROM countries')
      .get() as { count: number };

    const countries = db
      .prepare(
        `SELECT * FROM countries
         ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
         LIMIT ? OFFSET ?`
      )
      .all(limitNum, offset);

    return res.status(200).json({
      total: totalRow.count,
      countries,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Failed to fetch countries:', error);
    return res.status(500).json({ error: 'Failed to fetch countries.' });
  }
});

// POST /api/countries
router.post('/api/countries', (req: Request, res: Response) => {
  const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
    req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO countries
         (name, abbreviation, lat, lng, slug, last_visited, geo_map_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, abbreviation, lat, lng, slug, last_visited, geo_map_id);

    return res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error('Failed to create country:', error);
    return res.status(500).json({ error: 'Failed to create country.' });
  }
});

// GET /api/countries/:id
router.get('/api/countries/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const country = db.prepare('SELECT * FROM countries WHERE id = ?').get(id);

    if (!country) {
      return res.status(404).json({ message: 'Country not found' });
    }

    return res.status(200).json(country);
  } catch (error) {
    console.error('Failed to fetch country:', error);
    return res.status(500).json({ error: 'Failed to fetch country' });
  }
});

// PUT /api/countries/:id
router.put('/api/countries/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
    req.body;

  try {
    const result = db
      .prepare(
        'UPDATE countries SET name = ?, abbreviation = ?, lat = ?, lng = ?, slug = ?, last_visited = ?, geo_map_id = ? WHERE id = ?'
      )
      .run(name, abbreviation, lat, lng, slug, last_visited, geo_map_id, id);

    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error('Failed to update country:', error);
    return res.status(500).json({ error: 'Failed to update country' });
  }
});

// DELETE /api/countries/:id
router.delete('/api/countries/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM countries WHERE id = ?').run(id);
    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error('Failed to delete country:', error);
    return res.status(500).json({ error: 'Failed to delete country' });
  }
});

export default router;
