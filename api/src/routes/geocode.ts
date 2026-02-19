import { Router, Request, Response } from 'express';
import { geocodeService } from '../services/geocodeService';

const router = Router();

// POST /api/geocode
router.post('/api/geocode', async (req: Request, res: Response) => {
  const { city, country, place, state, latitude, longitude } = req.body;

  try {
    // Case 1: Reverse Geocoding (Lat, Lng → City, State, Country)
    if (latitude && longitude) {
      const result = await geocodeService.reverseGeocode({ latitude, longitude });
      return res.status(200).json(result);
    }

    // Case 2: Forward Geocoding (City, Country → Lat, Lng) or Place → Lat, Lng
    const result = await geocodeService.forwardGeocode({
      city,
      country,
      place,
      state,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';

    // Determine status code based on error message
    if (message.includes('No results found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }

    console.error('Geocode error:', error);
    return res.status(500).json({ error: message });
  }
});

export default router;
