import { Router, Request, Response } from 'express';
import { roleService } from '../services/roleService';
import { handleApiError } from '../utils/errorHandler';

const router = Router();

/**
 * GET /api/roles
 */
router.get('/api/roles', async (_req: Request, res: Response) => {
  try {
    const result = await roleService.getAllRoles();
    return res.status(200).json(result.roles);
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to fetch roles', 500);
  }
});

/**
 * POST /api/roles
 */
router.post('/api/roles', async (req: Request, res: Response) => {
  const { name } = req.body;

  try {
    const result = await roleService.createRole(name);
    return res.status(201).json({ id: result.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Role creation failed';
    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }
    return handleApiError(err, res, 'Role creation failed');
  }
});

router.all('/api/roles', (_req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end('Method Not Allowed');
});

/**
 * GET /api/roles/:id
 */
router.get('/api/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const role = await roleService.getRoleById(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    return res.status(200).json(role);
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to retrieve role');
  }
});

/**
 * PUT /api/roles/:id
 */
router.put('/api/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const result = await roleService.updateRole(id, name);

    if (!result.success) {
      return res.status(404).json({ error: 'Role not found or no changes made' });
    }

    return res.status(200).json({ message: 'Role updated successfully' });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to update role');
  }
});

/**
 * DELETE /api/roles/:id
 */
router.delete('/api/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const result = await roleService.deleteRole(id);

    if (!result.success) {
      return res.status(404).json({ error: 'Role not found' });
    }

    return res.status(204).end();
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to delete role');
  }
});

router.all('/api/roles/:id', (req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
