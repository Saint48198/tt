import { Router, Request, Response } from 'express';
import axios from 'axios';
import { tagService } from '../services/tagService';

const router = Router();

// GET /api/tags/total-count - Get total count of all tags in database
router.get('/api/tags/total-count', async (_req: Request, res: Response) => {
  try {
    console.log('GET /api/tags/total-count called');
    const result = await tagService.getTotalTagCount();
    console.log('Total tag count result:', result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch total tag count:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch total tag count';
    return res.status(500).json({ error: message });
  }
});

// GET /api/tags - Multi-purpose endpoint:
// - ?filterOptions=true - Get available years and countries for filters
// - ?year=2024&countryId=1 - Get tag frequencies filtered by year and/or country
// - ?query=... - Search tags by query
router.get('/api/tags', async (req: Request, res: Response) => {
  try {
    // Handle filter options request
    if (req.query.filterOptions === 'true') {
      const requestedFields = req.query.fields
        ? String(req.query.fields).split(',')
        : ['years', 'countries', 'states', 'cities', 'attractions'];

      const [years, countries, states, cities, attractions] = await Promise.all([
        requestedFields.includes('years')
          ? tagService.getAvailableYears()
          : Promise.resolve({ years: [] }),
        requestedFields.includes('countries')
          ? tagService.getAvailableCountries()
          : Promise.resolve({ countries: [] }),
        requestedFields.includes('states')
          ? tagService.getAvailableStates()
          : Promise.resolve({ states: [] }),
        requestedFields.includes('cities')
          ? tagService.getAvailableCities()
          : Promise.resolve({ cities: [] }),
        requestedFields.includes('attractions')
          ? tagService.getAvailableAttractions()
          : Promise.resolve({ attractions: [] }),
      ]);

      return res.status(200).json({
        years: years.years,
        countries: countries.countries,
        states: states.states,
        cities: cities.cities,
        attractions: attractions.attractions,
      });
    }

    // Handle tag frequency filtering (for word cloud)
    if (
      req.query.year ||
      req.query.countryId ||
      req.query.stateId ||
      req.query.cityId ||
      req.query.attractionId
    ) {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const countryId = req.query.countryId ? parseInt(String(req.query.countryId), 10) : undefined;
      const stateId = req.query.stateId ? parseInt(String(req.query.stateId), 10) : undefined;
      const cityId = req.query.cityId ? parseInt(String(req.query.cityId), 10) : undefined;
      const attractionId = req.query.attractionId
        ? parseInt(String(req.query.attractionId), 10)
        : undefined;

      console.log('GET /api/tags with filters:', {
        year,
        countryId,
        stateId,
        cityId,
        attractionId,
      });
      const result = await tagService.getTagFrequencies(
        year,
        countryId,
        stateId,
        cityId,
        attractionId
      );
      return res.status(200).json(result);
    }

    // Handle regular tag search
    const rawQuery = req.query.query;
    if (!rawQuery) {
      // No query provided, return all tags with their frequencies
      const result = await tagService.getTagFrequencies();
      console.log('All tags result:', result);
      return res.status(200).json(result);
    }

    const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    const result = await tagService.searchTags(query as string);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags
router.post('/api/tags', async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;

    await tagService.addTags(tags);
    return res.status(200).json({ message: 'Tags added successfully' });
  } catch (error) {
    console.error('Failed to add tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to add tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags/sync
router.post('/api/tags/sync', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.syncTagsFromCloudinary();

    return res.status(200).json({
      message: 'Tags synced successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to sync tags from Cloudinary:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch and store tags';
    const details = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      error: message,
      details,
    });
  }
});

// POST /api/tags/suggest
router.post('/api/tags/suggest', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageUrl } = req.body || {};

    let base64 = imageBase64;

    // If a URL is provided instead of base64, fetch the image server-side
    if (!base64 && imageUrl) {
      try {
        const imgResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
        const b64 = Buffer.from(imgResponse.data).toString('base64');
        base64 = `data:${contentType};base64,${b64}`;
      } catch (fetchErr) {
        console.error(
          'Failed to fetch image from URL:',
          imageUrl,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        return res.status(400).json({ error: 'Failed to fetch image from URL' });
      }
    }

    if (!base64) {
      return res.status(400).json({ error: 'No image provided. Send imageBase64 or imageUrl.' });
    }

    const result = await tagService.suggestTags(base64);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to suggest tags:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Server error';

    if (message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// POST /api/tags/cleanup
router.post('/api/tags/cleanup', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.cleanupTags();
    return res.status(200).json({
      message: 'Tags cleaned up successfully',
      ...result,
    });
  } catch (error) {
    console.error('Failed to clean up tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to clean up tags';
    return res.status(500).json({ error: message });
  }
});

export default router;
