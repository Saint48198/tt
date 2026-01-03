import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /api/location/update-visited
router.post('/api/location/update-visited', async (req: Request, res: Response) => {
  const { city, state, country } = req.body;

  if (!country) {
    return res
      .status(400)
      .json({ error: 'Country is required for location update.' });
  }

  try {
    let updated = false;

    if (city) {
      const stmt = db.prepare(`
        UPDATE cities
        SET last_visited = datetime('now')
        WHERE name = ?
      `);

      const result = stmt.run(city);
      if (result.changes > 0) updated = true;
    }

    if (state && (country === 'United States' || country === 'Canada')) {
      const stmt = db.prepare(`
        UPDATE states
        SET last_visited = datetime('now')
        WHERE name = ?
      `);

      const result = stmt.run(state);
      if (result.changes > 0) updated = true;
    }

    if (country) {
      const stmt = db.prepare(`
        UPDATE countries
        SET last_visited = datetime('now')
        WHERE name = ?
      `);

      const result = stmt.run(country);
      if (result.changes > 0) updated = true;
    }

    if (updated) {
      return res
        .status(200)
        .json({ message: 'Location data updated successfully' });
    }

    return res
      .status(404)
      .json({ error: 'No matching location found in database' });
  } catch (error) {
    console.error('Error updating locations:', error);
    return res
      .status(500)
      .json({ error: 'Failed to update location records.' });
  }
});

export default router;
