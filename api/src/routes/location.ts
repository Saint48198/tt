import { Router, Request, Response } from 'express';
import { locationService } from '../services/locationService';

const router = Router();

// POST /api/location/update-visited
router.post('/api/location/update-visited', async (req: Request, res: Response) => {
  const { city, state, country } = req.body;

  try {
    const result = await locationService.updateLocationVisited({
      city,
      state,
      country,
    });

    if (!result.updated) {
      return res.status(404).json({ error: 'No matching location found in database' });
    }

    return res.status(200).json({ message: 'Location data updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update location records.';

    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }

    console.error('Error updating locations:', error);
    return res.status(500).json({ error: 'Failed to update location records.' });
  }
});

export default router;
