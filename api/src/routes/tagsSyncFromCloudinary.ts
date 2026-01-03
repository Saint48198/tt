import { Router, Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import { db } from '../db';

const router = Router();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME as string;
const API_KEY = process.env.CLOUDINARY_API_KEY as string;
const API_SECRET = process.env.CLOUDINARY_API_SECRET as string;

// Ensure table exists (same behavior as Next.js file-level exec)
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )
`);

// POST /api/tags/sync
router.post('/api/tags/sync', async (_req: Request, res: Response) => {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return res.status(500).json({ error: 'Missing Cloudinary env vars' });
  }

  try {
    let nextCursor: string | null = null;
    const allTags = new Set<string>();

    do {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;

      const response: AxiosResponse = await axios.post(
        url,
        {
          expression: 'resource_type:image',
          with_field: 'tags',
          max_results: 500,
          next_cursor: nextCursor,
        },
        {
          auth: { username: API_KEY, password: API_SECRET },
        }
      );

      const resources = response.data?.resources ?? [];
      resources.forEach((asset: { tags?: string[] }) => {
        (asset.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      nextCursor = response.data?.next_cursor || null;
    } while (nextCursor);

    const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');

    const insertTx = db.transaction((tags: string[]) => {
      tags.forEach((tag) => insertStmt.run(tag));
    });

    insertTx(Array.from(allTags));

    return res.status(200).json({
      message: 'Tags synced successfully',
      count: allTags.size,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Failed to fetch and store tags',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
