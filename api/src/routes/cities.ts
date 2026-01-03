import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const validColumns = [
  'cities.name',
  'lat',
  'lng',
  'country_name',
  'state_name',
];

// GET /api/cities
router.get('/api/cities', (req: Request, res: Response) => {
  const { country_id, page, limit, sortBy, sort } = req.query;

  const pageNum =
    page !== undefined
      ? Number(Array.isArray(page) ? page[0] : page)
      : 1;

  const limitNum =
    limit !== undefined
      ? Number(Array.isArray(limit) ? limit[0] : limit)
      : 25;

  const offset = (pageNum - 1) * limitNum;

  const rawSortBy = Array.isArray(sortBy) ? sortBy?.[0] : sortBy;
  let sortByStr = (rawSortBy ?? 'cities.name').toString();

  const rawSort = Array.isArray(sort) ? sort?.[0] : sort;
  const sortOrderStr = (rawSort ?? 'asc').toString().toLowerCase();

  if (sortByStr === 'name') {
    sortByStr = 'cities.name';
  }

  if (sortByStr && !validColumns.includes(sortByStr)) {
    return res.status(400).json({ error: 'Invalid sort column.' });
  }

  if (!['asc', 'desc'].includes(sortOrderStr)) {
    return res.status(400).json({ error: 'Invalid sort order.' });
  }

  try {
    let query = `
      SELECT 
        cities.id, 
        cities.name, 
        cities.lat, 
        cities.lng, 
        cities.last_visited, 
        countries.name AS country_name, 
        states.name AS state_name
      FROM cities
      JOIN countries ON cities.country_id = countries.id
      LEFT JOIN states ON cities.state_id = states.id
    `;

    const params: (string | number)[] = [];

    const rawCountryId = Array.isArray(country_id) ? country_id?.[0] : country_id;
    const countryId = rawCountryId !== undefined ? Number(rawCountryId) : undefined;

    if (countryId !== undefined && !Number.isNaN(countryId)) {
      query += ` WHERE cities.country_id = ?`;
      params.push(countryId);
    }

    query += ` ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const cities = db.prepare(query).all(...params);

    let countQuery = `SELECT COUNT(*) as total FROM cities`;
    const countParams: (string | number)[] = [];

    if (countryId !== undefined && !Number.isNaN(countryId)) {
      countQuery += ` WHERE country_id = ?`;
      countParams.push(countryId);
    }

    const totalRow = db.prepare(countQuery).get(...countParams) as { total: number };

    return res.status(200).json({
      cities,
      total: totalRow.total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    return res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// POST /api/cities
router.post('/api/cities', (req: Request, res: Response) => {
  const { name, lat, lng, state_id, country_id, last_visited, wiki_term } =
    req.body;

  if (!name || !lat || !lng || !country_id) {
    return res.status(400).json({
      error: 'City name, latitude, longitude, and country are required.',
    });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO cities (name, lat, lng, state_id, country_id, last_visited, wiki_term) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const result = stmt.run(
      name,
      lat,
      lng,
      state_id || null,
      country_id,
      last_visited,
      wiki_term
    );

    return res.status(201).json({
      message: 'City added successfully.',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Failed to add city:', error);
    return res.status(500).json({ error: 'Failed to add city' });
  }
});

// GET /api/cities/:id
router.get('/api/cities/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const city = db
      .prepare(
        `SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
                cities.country_id AS country_id,
                countries.name AS country_name,
                cities.state_id AS state_id,
                states.name AS state_name,
                cities.wiki_term
         FROM cities
         LEFT JOIN countries ON cities.country_id = countries.id
         LEFT JOIN states ON cities.state_id = states.id
         WHERE cities.id = ?`
      )
      .get(id);

    if (!city) {
      return res.status(404).json({ error: 'City not found.' });
    }

    return res.status(200).json(city);
  } catch (error) {
    console.error('Failed to fetch city:', error);
    return res.status(500).json({ error: 'Failed to fetch city' });
  }
});

// PUT /api/cities/:id
router.put('/api/cities/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, lat, lng, state_id, country_id, last_visited, wiki_term } =
    req.body;

  if (!name || !lat || !lng || !country_id) {
    return res.status(400).json({
      error: 'City name, latitude, longitude, and country are required.',
    });
  }

  try {
    const stmt = db.prepare(
      'UPDATE cities SET name = ?, lat = ?, lng = ?, state_id = ?, country_id = ?, last_visited = ?, wiki_term = ? WHERE id = ?'
    );

    const result = stmt.run(
      name,
      lat,
      lng,
      state_id || null,
      country_id,
      last_visited,
      wiki_term,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found.' });
    }

    return res.status(200).json({ message: 'City updated successfully.' });
  } catch (error) {
    console.error('Failed to update city:', error);
    return res.status(500).json({ error: 'Failed to update city' });
  }
});

// DELETE /api/cities/:id
router.delete('/api/cities/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM cities WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found.' });
    }

    return res.status(200).json({ message: 'City deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete city:', error);
    return res.status(500).json({ error: 'Failed to delete city' });
  }
});

export default router;
