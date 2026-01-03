import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type CloudinaryPhoto = {
  public_id: string;
  secure_url: string;
  created_at: string;
  format: string;
  access_mode?: string;
  type?: string;
  context?: {
    custom?: {
      caption?: string;
      alt?: string;
    };
  };
};

type Photo = {
  photo_id: string;
  url: string;
  title: string;
  caption: string;
  created_at: string;
  format: string;
};

// GET /api/photos/search
router.get('/api/photos/search', async (req: Request, res: Response) => {
  try {
    const rawFolder = req.query.folder;
    const folder = Array.isArray(rawFolder) ? rawFolder[0] : rawFolder;

    const rawTag = req.query.tag;
    const tag = Array.isArray(rawTag) ? rawTag[0] : rawTag;

    const rawMaxResults = req.query.max_results;
    const maxResultsStr = Array.isArray(rawMaxResults)
      ? rawMaxResults[0]
      : rawMaxResults;

    const maxResults = maxResultsStr ? Number(maxResultsStr) : 10;

    const rawNextCursor = req.query.next_cursor;
    const nextCursor = Array.isArray(rawNextCursor)
      ? rawNextCursor[0]
      : rawNextCursor;

    const expression: string[] = ['resource_type:image'];
    if (folder) expression.push(`folder=${folder}`);
    if (tag) expression.push(`tags=${tag}`);

    const searchExpression = expression.join(' AND ');

    const searchQuery = cloudinary.search
      .expression(searchExpression)
      .with_field('context')
      .with_field('tags')
      .max_results(maxResults);

    if (nextCursor) {
      searchQuery.next_cursor(String(nextCursor));
    }

    const result = await searchQuery.execute();

    const photos: Photo[] = result.resources.map((photo: CloudinaryPhoto) => {
      const title = photo.context?.custom?.caption || 'Untitled';
      const caption = photo.context?.custom?.alt || '';

      if (photo.access_mode === 'authenticated' || photo.type === 'private') {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = cloudinary.utils.api_sign_request(
          { public_id: photo.public_id, timestamp },
          process.env.CLOUDINARY_API_SECRET as string
        );

        return {
          photo_id: photo.public_id,
          title,
          caption,
          created_at: photo.created_at,
          format: photo.format,
          url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${photo.public_id}?api_key=${process.env.CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}`,
        };
      }

      return {
        photo_id: photo.public_id,
        title,
        caption,
        created_at: photo.created_at,
        format: photo.format,
        url: photo.secure_url,
      };
    });

    return res.status(200).json({
      photos,
      next_cursor: result.next_cursor || null,
    });
  } catch (error) {
    console.error('Cloudinary API error:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

export default router;
