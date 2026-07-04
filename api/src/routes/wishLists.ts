import { Router, Request, Response } from 'express';
import { wishListService, WishListType } from '../services/wishListService';
import { authenticateRequest } from '../utils/authUtil';

const router = Router();

const VALID_TYPES: WishListType[] = ['country', 'city', 'attraction'];

/**
 * GET /api/wish-list
 * Optional query: ?type=country|city|attraction
 * Scoped to the authenticated user.
 */
router.get('/api/wish-list', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  try {
    const typeParam = (req.query.type as string | undefined)?.toLowerCase();
    const type =
      typeParam && VALID_TYPES.includes(typeParam as WishListType)
        ? (typeParam as WishListType)
        : undefined;
    const items = await wishListService.getAll(auth.id, type);
    return res.status(200).json(items);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch wish list' });
  }
});

/**
 * POST /api/wish-list
 */
router.post('/api/wish-list', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  try {
    const { type, country_id, city_id, attraction_id, notes, priority } = req.body ?? {};

    if (!type || !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: 'Valid type is required (country, city, or attraction)' });
    }

    const result = await wishListService.create(auth.id, {
      type,
      // name is derived server-side from the chosen entity
      name: '',
      country_id,
      city_id,
      attraction_id,
      notes,
      priority,
    });
    return res.status(201).json({ id: result.id });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : 'Failed to create wish list item';
    const isClient =
      msg.includes('required') || msg.includes('not found') || msg.includes('Invalid');
    return res.status(isClient ? 400 : 500).json({ error: msg });
  }
});

router.all('/api/wish-list', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

/**
 * GET /api/wish-list/:id
 */
router.get('/api/wish-list/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  try {
    const item = await wishListService.getById(auth.id, req.params.id);
    if (!item) return res.status(404).json({ error: 'Wish list item not found' });
    return res.status(200).json(item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch wish list item' });
  }
});

/**
 * PUT /api/wish-list/:id
 */
router.put('/api/wish-list/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  try {
    const { type, country_id, city_id, attraction_id, notes, priority } = req.body ?? {};
    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    const result = await wishListService.update(auth.id, req.params.id, {
      type,
      country_id,
      city_id,
      attraction_id,
      notes,
      priority,
    });
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }
    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : 'Failed to update wish list item';
    const isClient =
      msg.includes('required') || msg.includes('not found') || msg.includes('Invalid');
    return res.status(isClient ? 400 : 500).json({ error: msg });
  }
});

/**
 * DELETE /api/wish-list/:id
 */
router.delete('/api/wish-list/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req, res);
  if (!auth) return;

  try {
    const result = await wishListService.remove(auth.id, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Wish list item not found' });
    }
    return res.status(200).json({ changes: result.changes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete wish list item' });
  }
});

router.all('/api/wish-list/:id', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
