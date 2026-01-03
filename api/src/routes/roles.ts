import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleApiError } from '../utils/errorHandler';

const router = Router();

/**
 * /api/roles
 */
router.get('/api/roles', (_req: Request, res: Response) => {
  try {
    const roles = db.prepare(`SELECT * FROM roles`).all();
    return res.status(200).json(roles);
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to fetch roles', 500);
  }
});

router.post('/api/roles', (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  try {
    const result = db.prepare(`INSERT INTO roles (name) VALUES (?)`).run(name);
    return res.status(201).json({ id: result.lastInsertRowid });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Role creation failed');
  }
});

router.all('/api/roles', (_req: Request, res: Response) => {
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end('Method Not Allowed');
});

/**
 * /api/roles/:id
 */
router.get('/api/roles/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const role = db.prepare(`SELECT * FROM roles WHERE id = ?`).get(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    return res.status(200).json(role);
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to retrieve role');
  }
});

router.put('/api/roles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const result = db
      .prepare(
        `
        UPDATE roles
        SET name = ?
        WHERE id = ?
      `
      )
      .run(name, id);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ error: 'Role not found or no changes made' });
    }

    return res.status(200).json({ message: 'Role updated successfully' });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to update role');
  }
});

router.delete('/api/roles/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const result = db.prepare(`DELETE FROM roles WHERE id = ?`).run(id);

    if (result.changes === 0) {
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
