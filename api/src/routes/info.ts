import { Router, Request, Response } from 'express';
import { infoService } from '../services/infoService';

const router = Router();

// GET /api/info?query=...
router.get('/api/info', async (req: Request, res: Response) => {
  const rawQuery = req.query.query;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  try {
    const result = await infoService.getInfo(query as string);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch data from Wikipedia:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch data from Wikipedia.';

    if (message.includes('required') || message.includes('must be a string')) {
      return res.status(400).json({ error: message });
    }

    if (message.includes('No results found') || message.includes('Page not found')) {
      return res.status(404).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

export default router;
