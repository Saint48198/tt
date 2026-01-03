import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// POST /api/geocode
router.post('/api/geocode', async (req: Request, res: Response) => {
  const { city, country, place, state, latitude, longitude } = req.body;

  // Case 1: Reverse Geocoding (Lat, Lng → City, State, Country)
  if (latitude && longitude) {
    try {
      const response = await axios.get(
        'https://api.opencagedata.com/geocode/v1/json',
        {
          params: {
            q: `${latitude},${longitude}`,
            key: process.env.OPENCAGE_API_KEY,
          },
        }
      );

      const { results } = response.data;

      if (results.length > 0) {
        const location = results[0].components;

        const cityName =
          location.city || location.town || location.village || 'Unknown City';
        const stateName = location.state || 'Unknown State';
        const countryName = location.country || 'Unknown Country';

        return res.status(200).json({
          city: cityName,
          state: stateName,
          country: countryName,
        });
      }

      return res
        .status(404)
        .json({ error: 'No results found for the given coordinates.' });
    } catch (error) {
      console.error('Error fetching reverse geocode data:', error);
      return res
        .status(500)
        .json({ error: 'Failed to fetch reverse geocode data.' });
    }
  }

  // Case 2: Forward Geocoding (City, Country → Lat, Lng) or Place → Lat, Lng
  if ((!city || !country) && !place) {
    return res
      .status(400)
      .json({ error: 'At least one of city, country, or place is required.' });
  }

  const query = place || `${city || ''}, ${state || ''}, ${country || ''}`.trim();

  try {
    const response = await axios.get(
      'https://api.opencagedata.com/geocode/v1/json',
      {
        params: {
          q: query,
          key: process.env.OPENCAGE_API_KEY,
        },
      }
    );

    const { results } = response.data;

    if (results.length > 0) {
      const { lat, lng } = results[0].geometry;
      return res.status(200).json({ lat, lng });
    }

    return res
      .status(404)
      .json({ error: 'No results found for the given city and country.' });
  } catch (error) {
    console.error('Failed to fetch geocode data:', error);
    return res.status(500).json({ error: 'Failed to fetch geocode data.' });
  }
});

export default router;
