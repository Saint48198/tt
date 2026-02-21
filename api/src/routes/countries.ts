import { Router, Request, Response } from 'express';
import { countryService } from '../services/countryService';

const router = Router();


// GET /api/countries
router.get('/api/countries', async (req: Request, res: Response) => {
  const { page, limit, all, sortBy, sortOrder, includeDisabled } = req.query;

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

  try {
    const result = await countryService.getCountries({
      page: pageNum,
      limit: limitNum,
      all: all === 'true',
      sortBy: sortByStr,
      sortOrder: sortOrderStr,
      includeDisabled: includeDisabled === 'true',
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch countries:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch countries.';
    return res.status(message.includes('Invalid') ? 400 : 500).json({ error: message });
  }
});

// POST /api/countries
router.post('/api/countries', async (req: Request, res: Response) => {
  const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
    req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const result = await countryService.createCountry({
      name,
      abbreviation,
      lat,
      lng,
      slug,
      last_visited,
      geo_map_id,
    });

    return res.status(201).json({ id: result.id });
  } catch (error) {
    console.error('Failed to create country:', error);
    return res.status(500).json({ error: 'Failed to create country.' });
  }
});

// GET /api/countries/:id
router.get('/api/countries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const country = await countryService.getCountryById(id);

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
router.put('/api/countries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
    req.body;

  try {
    const result = await countryService.updateCountry(id, {
      name,
      abbreviation,
      lat,
      lng,
      slug,
      last_visited,
      geo_map_id,
    });

    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error('Failed to update country:', error);
    return res.status(500).json({ error: 'Failed to update country' });
  }
});

// DELETE /api/countries/:id
router.delete('/api/countries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await countryService.deleteCountry(id);
    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error('Failed to delete country:', error);
    return res.status(500).json({ error: 'Failed to delete country' });
  }
});

export default router;
