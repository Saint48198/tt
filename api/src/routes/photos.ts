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
  asset_id: string;
  secure_url: string;
  created_at: string;
  format: string;
};

type Photo = {
  id: string;
  url: string;
  created_at: string;
  format: string;
};

// GET /api/photos
router.get('/api/photos', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;

  // Validate token (placeholder logic preserved)
  if (!token || token !== 'your-secure-token') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  try {
    const folder = process.env.CLOUDINARY_FOLDER || '';

    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 50,
    });

    const photos: Photo[] = (resources.resources ?? []).map(
      (resource: CloudinaryPhoto) => ({
        id: resource.asset_id,
        url: resource.secure_url,
        created_at: resource.created_at,
        format: resource.format,
      })
    );

    return res.status(200).json({ photos });
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

export default router;
