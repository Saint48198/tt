import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// Ensure table exists (same behavior as Next.js file-level exec)
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )
`);

// GET /api/tags?query=...
router.get('/api/tags', (req: Request, res: Response) => {
  try {
    const rawQuery = req.query.query;
    const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }

    // Convert wildcard query to regex (* -> .* , ? -> .), case-insensitive
    const regexPattern = query
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern, 'i');

    const rows = db.prepare('SELECT name FROM tags').all() as { name: string }[];
    const allTags = rows.map((row) => row.name);
    const filteredTags = allTags.filter((tag) => regex.test(tag));

    return res.status(200).json({ tags: filteredTags });
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/tags
router.post('/api/tags', (req: Request, res: Response) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Invalid tags data' });
    }

    const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');

    const insertTransaction = db.transaction((items: string[]) => {
      items.forEach((tag) => insertStmt.run(tag));
    });

    insertTransaction(tags);

    return res.status(200).json({ message: 'Tags added successfully' });
  } catch (error) {
    console.error('Failed to add tags:', error);
    return res.status(500).json({ error: 'Failed to add tags' });
  }
});

export default router;
