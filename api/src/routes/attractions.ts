import { Router, Request, Response } from 'express';
import { attractionService } from '../services/attractionService';

const router = Router();


// GET /api/attractions
router.get('/api/attractions', async (req: Request, res: Response) => {
  const { country_id, search, page, limit, sortBy, sortOrder, includeDisabled } = req.query;

  const pageNum =
    page !== undefined
      ? Number(Array.isArray(page) ? page[0] : page)
      : 1;

  const limitNum =
    limit !== undefined
      ? Number(Array.isArray(limit) ? limit[0] : limit)
      : 25;

  const rawSortBy = Array.isArray(sortBy) ? sortBy?.[0] : sortBy;
  const sortByStr = (rawSortBy ?? 'attractions.name').toString();

  const rawSortOrder = Array.isArray(sortOrder) ? sortOrder?.[0] : sortOrder;
  const sortOrderStr = (rawSortOrder ?? 'asc').toString().toLowerCase();

  const rawCountryId = Array.isArray(country_id) ? country_id?.[0] : country_id;
  const countryIdNum = rawCountryId !== undefined ? Number(rawCountryId) : undefined;

  const rawSearch = Array.isArray(search) ? search?.[0] : search;
  const searchStr = rawSearch ? rawSearch.toString() : undefined;

  try {
    const result = await attractionService.getAttractions({
      country_id: countryIdNum,
      search: searchStr,
      page: pageNum,
      limit: limitNum,
      sortBy: sortByStr,
      sortOrder: sortOrderStr,
      includeDisabled: includeDisabled === 'true',
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch attractions:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch attractions.';
    return res.status(message.includes('Invalid') ? 400 : 500).json({ error: message });
  }
});

// POST /api/attractions
router.post('/api/attractions', async (req: Request, res: Response) => {
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
    const result = await attractionService.createAttraction({
      name,
      country_id: Number(country_id),
      is_unesco,
      is_national_park,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      last_visited,
      wiki_term,
    });

    return res.status(201).json({
      message: 'Attraction added successfully.',
      id: result.id,
    });
  } catch (error) {
    console.error('Failed to add attraction:', error);
    return res.status(500).json({ error: 'Failed to add attraction.' });
  }
});

// GET /api/attractions/:id
router.get('/api/attractions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const attraction = await attractionService.getAttractionById(id);

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
router.put('/api/attractions/:id', async (req: Request, res: Response) => {
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
    const result = await attractionService.updateAttraction(id, {
      name,
      country_id: Number(country_id),
      is_unesco,
      is_national_park,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      last_visited,
      wiki_term,
    });

    if (!result.success) {
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
router.delete('/api/attractions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await attractionService.deleteAttraction(id);

    if (!result.success) {
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
