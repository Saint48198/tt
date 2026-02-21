import { Router, Request, Response } from 'express';
import { cityService } from '../services/cityService';

const router = Router();

router.get('/api/cities', async (req: Request, res: Response) => {
  const { country_id, search, page, limit, sortBy, sort } = req.query;
  const pageNum = page !== undefined ? Number(Array.isArray(page) ? page[0] : page) : 1;
  const limitNum = limit !== undefined ? Number(Array.isArray(limit) ? limit[0] : limit) : 25;
  const rawSortBy = Array.isArray(sortBy) ? sortBy?.[0] : sortBy;
  const sortByStr = (rawSortBy ?? 'cities.name').toString();
  const rawSort = Array.isArray(sort) ? sort?.[0] : sort;
  const sortOrderStr = (rawSort ?? 'asc').toString().toLowerCase();
  const rawCountryId = Array.isArray(country_id) ? country_id?.[0] : country_id;
  const countryIdNum = rawCountryId !== undefined ? Number(rawCountryId) : undefined;
  const rawSearch = Array.isArray(search) ? search?.[0] : search;
  const searchStr = rawSearch ? rawSearch.toString() : undefined;

  try {
    const result = await cityService.getCities({ country_id: countryIdNum, search: searchStr, page: pageNum, limit: limitNum, sortBy: sortByStr, sort: sortOrderStr });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch cities';
    return res.status(message.includes('Invalid') ? 400 : 500).json({ error: message });
  }
});

// POST /api/cities
router.post('/api/cities', async (req: Request, res: Response) => {
  const { name, lat, lng, state_id, country_id, last_visited, wiki_term } = req.body;

  if (!name || !lat || !lng || !country_id) {
    return res.status(400).json({
      error: 'City name, latitude, longitude, and country are required.',
    });
  }

  try {
    const result = await cityService.createCity({
      name,
      lat,
      lng,
      state_id,
      country_id,
      last_visited,
      wiki_term,
    });

    return res.status(201).json({
      message: 'City added successfully.',
      id: result.id,
    });
  } catch (error) {
    console.error('Failed to add city:', error);
    return res.status(500).json({ error: 'Failed to add city' });
  }
});

// GET /api/cities/:id
router.get('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const city = await cityService.getCityById(id);

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
router.put('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, lat, lng, state_id, country_id, last_visited, wiki_term } =
    req.body;

  if (!name || !lat || !lng || !country_id) {
    return res.status(400).json({
      error: 'City name, latitude, longitude, and country are required.',
    });
  }

  try {
    const result = await cityService.updateCity(id, {
      name,
      lat,
      lng,
      state_id,
      country_id,
      last_visited,
      wiki_term,
    });

    if (!result.success) {
      return res.status(404).json({ error: 'City not found.' });
    }

    return res.status(200).json({ message: 'City updated successfully.' });
  } catch (error) {
    console.error('Failed to update city:', error);
    return res.status(500).json({ error: 'Failed to update city' });
  }
});

// DELETE /api/cities/:id
router.delete('/api/cities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await cityService.deleteCity(id);

    if (!result.success) {
      return res.status(404).json({ error: 'City not found.' });
    }

    return res.status(200).json({ message: 'City deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete city:', error);
    return res.status(500).json({ error: 'Failed to delete city' });
  }
});

export default router;
