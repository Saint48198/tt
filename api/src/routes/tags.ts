import { Router, Request, Response } from 'express';
import axios from 'axios';
import { tagService } from '../services/tagService';

const router = Router();

// GET /api/tags?query=...
router.get('/api/tags', async (req: Request, res: Response) => {
  try {
    const rawQuery = req.query.query;
    const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

    const result = await tagService.searchTags(query as string);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags
router.post('/api/tags', async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;

    await tagService.addTags(tags);
    return res.status(200).json({ message: 'Tags added successfully' });
  } catch (error) {
    console.error('Failed to add tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to add tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags/sync
router.post('/api/tags/sync', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.syncTagsFromCloudinary();

    return res.status(200).json({
      message: 'Tags synced successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to sync tags from Cloudinary:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch and store tags';
    const details = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      error: message,
      details,
    });
  }
});

// POST /api/tags/suggest
router.post('/api/tags/suggest', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageUrl } = req.body || {};

    let base64 = imageBase64;

    // If a URL is provided instead of base64, fetch the image server-side
    if (!base64 && imageUrl) {
      try {
        const imgResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
        const b64 = Buffer.from(imgResponse.data).toString('base64');
        base64 = `data:${contentType};base64,${b64}`;
      } catch (fetchErr) {
        console.error(
          'Failed to fetch image from URL:',
          imageUrl,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        return res.status(400).json({ error: 'Failed to fetch image from URL' });
      }
    }

    if (!base64) {
      return res.status(400).json({ error: 'No image provided. Send imageBase64 or imageUrl.' });
    }

    const result = await tagService.suggestTags(base64);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to suggest tags:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Server error';

    if (message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// GET /api/tags/frequency/all
router.get('/api/tags/frequency/all', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.getTagFrequencies();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch tag frequencies:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tag frequencies';
    return res.status(500).json({ error: message });
  }
});

export default router;
