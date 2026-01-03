import { Router, Request, Response } from 'express';

const router = Router();

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

// GET /api/info?query=...
router.get('/api/info', async (req: Request, res: Response) => {
  const rawQuery = req.query.query;
  const query =
    Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Query parameter is required and must be a string.',
    });
  }

  try {
    const response = await fetch(
      `${WIKIPEDIA_API_URL}?action=query&format=json&prop=extracts|info&exintro&explaintext&titles=${encodeURIComponent(
        query
      )}&inprop=url`
    );

    if (!response.ok) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch data from Wikipedia.' });
    }

    const data = await response.json() as { query: any };

    const pages = data.query?.pages;
    if (!pages) {
      return res.status(404).json({ error: 'No results found.' });
    }

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    if (!page || page.missing) {
      return res.status(404).json({ error: 'Page not found.' });
    }

    const result = {
      title: page.title,
      intro: page.extract,
      url: page.fullurl,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch data from Wikipedia:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch data from Wikipedia.' });
  }
});

export default router;
