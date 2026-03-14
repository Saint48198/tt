import { Router, Request, Response } from 'express';
import { worldRegionService } from '../services/worldRegionService';

const router = Router();

// GET /api/world-regions - Get all regions with sub-regions
router.get('/api/world-regions', async (_req: Request, res: Response) => {
  try {
    const regions = await worldRegionService.getRegionsWithSubRegions();
    return res.status(200).json(regions);
  } catch (error) {
    console.error('Failed to fetch world regions:', error);
    return res.status(500).json({ error: 'Failed to fetch world regions' });
  }
});

// GET /api/world-regions/:id/sub-regions - Get sub-regions for a specific region
router.get('/api/world-regions/:id/sub-regions', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const subRegions = await worldRegionService.getSubRegions(Number(id));
    return res.status(200).json(subRegions);
  } catch (error) {
    console.error('Failed to fetch sub-regions:', error);
    return res.status(500).json({ error: 'Failed to fetch sub-regions' });
  }
});

export default router;
