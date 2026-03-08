import { Router, Request, Response } from 'express';
import { statsService } from '../services/statsService';

const router = Router();

// GET /api/stats
router.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await statsService.getDashboardStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
