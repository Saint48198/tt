import { Router, Request, Response } from 'express';
import { stateService } from '../services/stateService';
import { handleApiError } from '../utils/errorHandler';

const router = Router();


const toError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

/**
 * GET /api/states
 * POST /api/states
 */
router.get('/api/states', async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    all,
    sortBy = 'states.name',
    sortOrder = 'asc',
  } = req.query as Record<string, string | undefined>;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  try {
    const result = await stateService.getStates({
      page: pageNum,
      limit: limitNum,
      all: all === 'true',
      sortBy: sortBy || 'states.name',
      sortOrder: sortOrder || 'asc',
    });

    return res.status(200).json(result);
  } catch (error: unknown) {
    return handleApiError(toError(error), res, 'Failed to fetch states.', error instanceof Error && error.message.includes('Invalid') ? 400 : 500);
  }
});

router.post('/api/states', async (req: Request, res: Response) => {
  const { name, abbr, country_id, last_visited } = req.body ?? {};

  if (!name || !country_id) {
    return handleApiError(null, res, 'Name and country_id are required.', 400);
  }

  try {
    const result = await stateService.createState({
      name,
      abbr,
      country_id,
      last_visited,
    });

    return res.status(201).json({
      message: 'State created successfully.',
      id: result.id,
    });
  } catch (error: unknown) {
    return handleApiError(toError(error), res, 'Failed to create state.', 500);
  }
});

router.all('/api/states', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

/**
 * GET /api/states/:id
 * PUT /api/states/:id
 * DELETE /api/states/:id
 */
router.get('/api/states/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  try {
    const state = await stateService.getStateById(id);

    if (!state) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json(state);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch state.' });
  }
});

router.put('/api/states/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  const { name, abbr, country_id, last_visited } = req.body ?? {};

  if (!name || !country_id) {
    return res.status(400).json({ error: 'Name and country_id are required.' });
  }

  try {
    const result = await stateService.updateState(id, {
      name,
      abbr,
      country_id,
      last_visited,
    });

    if (!result.success) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json({ message: 'State updated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update state.' });
  }
});

router.delete('/api/states/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  try {
    const result = await stateService.deleteState(id);

    if (!result.success) {
      return res.status(404).json({ error: 'State not found.' });
    }

    return res.status(200).json({ message: 'State deleted successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete state.' });
  }
});

router.all('/api/states/:id', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
