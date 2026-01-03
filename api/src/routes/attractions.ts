import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const validColumns = [
  'attractions.name',
  'lat',
  'lng',
  'wiki_term',
  'country_name',
];

const getAttractionById = (id: string) => {
  return db
    .prepare(
      `SELECT attractions.id,
              attractions.name,
              attractions.is_unesco,
              attractions.is_national_park,
              attractions.lat,
              attractions.lng,
              attractions.last_visited,
              attractions.wiki_term,
              countries.id as country_id
       FROM attractions
       JOIN countries ON attractions.country_id = countries.id
       WHERE attractions.id = ?`
    )
    .get(id);
};

// GET /api/attractions
router.get('/api/attractions', (req: Request, res: Response) => {
  const { country_id, page, limit, sortBy, sortOrder } = req.query;
  const rawSortOrder = Array.isArray(sortOrder) ? sortOrder?.[0] : sortOrder;

  const pageNum =
    page !== undefined
      ? Number(Array.isArray(page) ? page[0] : page)
      : 1;

  const limitNum =
    limit !== undefined
      ? Number(Array.isArray(limit) ? limit[0] : limit)
      : 25;

  let sortByStr =
    sortBy !== undefined
      ? (Array.isArray(sortBy) ? sortBy[0] : sortBy)
      : 'name';

  const sortOrderStr = (rawSortOrder ?? 'asc').toString().toLowerCase();

  const offset = (pageNum - 1) * limitNum;

  if (sortByStr === 'name') {
    sortByStr = 'attractions.name';
  }

  // Validate sort column
  if (sortOrderStr && !validColumns.includes(<string>sortByStr)) {
    return res.status(400).json({ error: 'Invalid sort column.' });
  }

  // Validate sort order
  if (sortOrderStr && !['asc', 'desc'].includes(sortOrderStr.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid sort order.' });
  }

  try {
    let query = `
      SELECT 
        attractions.id, 
        attractions.name, 
        attractions.lat, 
        attractions.lng, 
        attractions.wiki_term, 
        countries.name AS country_name
      FROM attractions
      JOIN countries ON attractions.country_id = countries.id
    `;

    const params: (string | number)[] = [];

    if (country_id) {
      query += ` WHERE attractions.country_id = ?`;
      params.push(Number(Array.isArray(country_id) ? country_id[0] : country_id));
    }

    query += ` ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const attractions = db.prepare(query).all(...params);

    let countQuery = `SELECT COUNT(*) as total FROM attractions`;
    const countParams: (string | number)[] = [];

    if (country_id) {
      countQuery += ` WHERE country_id = ?`;
      countParams.push(
        Number(Array.isArray(country_id) ? country_id[0] : country_id)
      );
    }

    const totalRow = db.prepare(countQuery).get(...countParams) as {
      total: number;
    };

    return res.status(200).json({
      attractions,
      total: totalRow.total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Failed to fetch attractions:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch attractions.' });
  }
});

// POST /api/attractions
router.post('/api/attractions', (req: Request, res: Response) => {
  const {
    name,
    country_id,
    is_unesco,
    is_national_park,
    lat,
    lng,
    last_visited,
    wiki_term,
  } = req.body;

  if (!name || !country_id || !lat || !lng) {
    return res.status(400).json({
      error: 'Name, country_id, latitude, and longitude are required.',
    });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO attractions 
        (name, country_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const result = stmt.run(
      name,
      Number(country_id),
      is_unesco ? 1 : 0,
      is_national_park ? 1 : 0,
      parseFloat(lat),
      parseFloat(lng),
      last_visited || null,
      wiki_term
    );

    return res.status(201).json({
      message: 'Attraction added successfully.',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Failed to add attraction:', error);
    return res.status(500).json({ error: 'Failed to add attraction.' });
  }
});

// GET /api/attractions/:id
router.get('/api/attractions/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  try {
    const attraction = getAttractionById(id);

    if (!attraction) {
      return res.status(404).json({ error: 'Attraction not found.' });
    }

    return res.status(200).json(attraction);
  } catch (error) {
    console.error('Failed to fetch attraction:', error);
    return res.status(500).json({ error: 'Failed to fetch attraction.' });
  }
});

// PUT /api/attractions/:id
router.put('/api/attractions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    country_id,
    is_unesco,
    is_national_park,
    lat,
    lng,
    last_visited,
    wiki_term,
  } = req.body;

  if (!name || !country_id || !lat || !lng) {
    return res.status(400).json({
      error: 'Name, country_id, latitude, and longitude are required.',
    });
  }

  try {
    const stmt = db.prepare(
      `UPDATE attractions
       SET name = ?, 
           country_id = ?, 
           is_unesco = ?, 
           is_national_park = ?, 
           lat = ?, 
           lng = ?, 
           last_visited = ?, 
           wiki_term = ?
       WHERE id = ?`
    );

    const result = stmt.run(
      name,
      Number(country_id),
      is_unesco ? 1 : 0,
      is_national_park ? 1 : 0,
      parseFloat(lat),
      parseFloat(lng),
      last_visited || null,
      wiki_term,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Attraction not found.' });
    }

    return res
      .status(200)
      .json({ message: 'Attraction updated successfully.' });
  } catch (error) {
    console.error('Failed to update attraction:', error);
    return res.status(500).json({ error: 'Failed to update attraction.' });
  }
});

// DELETE /api/attractions/:id
router.delete('/api/attractions/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare(`DELETE FROM attractions WHERE id = ?`);
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Attraction not found.' });
    }

    return res
      .status(200)
      .json({ message: 'Attraction deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete attraction:', error);
    return res.status(500).json({ error: 'Failed to delete attraction.' });
  }
});

export default router;
