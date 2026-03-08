import { Router, Request, Response } from 'express';
import { photoService } from '../services/photoService';
import { authenticateRequest } from '../utils/authUtil';
import formidable from 'formidable';

const router = Router();

// GET /api/photos
router.get('/api/photos', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;

  // Validate token (placeholder logic preserved)
  if (!token || token !== 'your-secure-token') {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  try {
    const result = await photoService.getPhotos();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /api/photos/all
router.get('/api/photos/all', async (req: Request, res: Response) => {
  try {

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const search = req.query.search as string | undefined;
    const noTags = req.query.noTags === 'true';
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;

    const result = await photoService.getAllPhotosMerged({ page, limit, search, noTags, entityType, entityId });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch all photos:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /api/photos/:entityType/:entityId
router.get('/api/photos/:entityType/:entityId', async (req: Request, res: Response) => {

  const { entityType, entityId } = req.params;
  const { page, limit } = req.query;

  if (!entityType || !entityId || Number.isNaN(Number(entityId))) {
    return res.status(400).json({ error: 'Invalid entityType or entityId' });
  }

  const pageNum = page !== undefined ? Number(Array.isArray(page) ? page[0] : page) : 1;
  const limitNum = limit !== undefined ? Number(Array.isArray(limit) ? limit[0] : limit) : 15;

  try {
    const result = await photoService.getPhotosByEntity(entityType, entityId, pageNum, limitNum);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch photos';

    if (message.includes('Invalid')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// ...existing code...

// POST /api/photos/suggest-titles
router.post('/api/photos/suggest-titles', async (req: Request, res: Response) => {
  try {

    const { imageBase64, mimeType, hints } = req.body || {};

    const result = await photoService.suggestTitles({
      imageBase64,
      mimeType,
      hints,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('suggest-titles error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions';

    if (message.includes('required') || message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// POST /api/photos/add/:entityType/:entityId
router.post(
  '/api/photos/add/:entityType/:entityId',
  async (req: Request, res: Response) => {

    const { entityType, entityId } = req.params;

    if (!entityType || !entityId || Number.isNaN(Number(entityId))) {
      return res.status(400).json({ error: 'Invalid entityType or entityId' });
    }

    const { url, userId, caption } = req.body;

    try {
      const result = await photoService.addPhotoByEntity({
        entityType,
        entityId: Number(entityId),
        url,
        userId,
        caption,
      });

      return res.status(201).json({
        message: 'Photo added successfully.',
        id: result.id,
      });
    } catch (error) {
      console.error('Failed to add photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to add photo';

      if (message.includes('Invalid') || message.includes('Missing')) {
        return res.status(400).json({ error: message });
      }

      return res.status(500).json({ error: message });
    }
  }
);

// POST /api/photos/bulk/add
router.post('/api/photos/bulk/add', async (req: Request, res: Response) => {
  try {
    const payload = await authenticateRequest(req, res);
    if (!payload) return;

    const { entityType, entityId, photos } = req.body;

    if (!entityType || !entityId || !photos) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await photoService.bulkAddPhotos({
      entityType,
      entityId,
      photos,
      userId: String(payload.id),
    });

    return res.status(201).json({ message: 'Photos added successfully' });
  } catch (error) {
    console.error('Failed to add photos:', error);
    const message = error instanceof Error ? error.message : 'Failed to add photos';

    if (message.includes('Invalid') || message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// DELETE /api/photos/bulk/remove
router.delete('/api/photos/bulk/remove', async (req: Request, res: Response) => {
  try {
    const payload = await authenticateRequest(req, res);
    if (!payload) return;

    const { entityType, entityId, photos } = req.body;

    if (!entityType || !entityId || !photos) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await photoService.bulkRemovePhotos({
      entityType,
      entityId,
      photos,
      userId: String(payload.id),
    });

    return res.status(200).json({ message: 'Photos removed successfully' });
  } catch (error) {
    console.error('Failed to remove photos:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove photos';

    if (message.includes('Invalid') || message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// GET /api/photos/search
router.get('/api/photos/search', async (req: Request, res: Response) => {
  try {

    const rawFolder = req.query.folder;
    const folder = (typeof rawFolder === 'string' ? rawFolder : Array.isArray(rawFolder) ? rawFolder[0] : undefined) as string | undefined;

    const rawTag = req.query.tag;
    const tag = (typeof rawTag === 'string' ? rawTag : Array.isArray(rawTag) ? rawTag[0] : undefined) as string | undefined;

    const rawMaxResults = req.query.max_results;
    const maxResultsStr = (typeof rawMaxResults === 'string' ? rawMaxResults : Array.isArray(rawMaxResults)
      ? rawMaxResults[0]
      : undefined) as string | undefined;

    const maxResults = maxResultsStr ? Number(maxResultsStr) : 10;

    const rawNextCursor = req.query.next_cursor;
    const nextCursor = (typeof rawNextCursor === 'string' ? rawNextCursor : Array.isArray(rawNextCursor)
      ? rawNextCursor[0]
      : undefined) as string | undefined;

    const result = await photoService.searchPhotos({
      folder,
      tag,
      max_results: maxResults,
      next_cursor: nextCursor,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Cloudinary API error:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/photos/upload
router.post(
  '/api/photos/upload',
  async (req: Request, res: Response): Promise<any> => {
    try {

      const form = formidable({
        multiples: true,
        uploadDir: '/tmp',
        keepExtensions: true,
        maxFileSize: 50 * 1024 * 1024, // 50MB per file
        maxTotalFileSize: 500 * 1024 * 1024, // 500MB total
        maxFiles: 50,
      });

      form.parse(req, async (err: any, fields: any, files: any) => {
        if (err) {
          console.error('Form parsing error:', err);
          return res.status(500).json({ error: 'Error parsing form data' });
        }

        console.log('[Upload] Files keys:', Object.keys(files || {}));
        const fileField = (files as any).files;
        console.log('[Upload] fileField type:', typeof fileField, 'isArray:', Array.isArray(fileField), 'length:', Array.isArray(fileField) ? fileField.length : fileField ? 1 : 0);

        if (!fileField) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadedFiles = Array.isArray(fileField)
          ? fileField
          : [fileField];

        const firstFieldValue = (v: unknown): string | undefined => {
          if (v == null) return undefined;
          if (Array.isArray(v)) return v[0] != null ? String(v[0]) : undefined;
          return String(v);
        };

        const visibility = firstFieldValue((fields as any).visibility);
        const tagsRaw = firstFieldValue((fields as any).tags);
        const title = firstFieldValue((fields as any).title) ?? '';
        const description = firstFieldValue((fields as any).description) ?? '';
        const country = firstFieldValue((fields as any).country);
        const exifDataRaw = firstFieldValue((fields as any).exifData);
        let clientExifData: Array<{ title?: string; keywords?: string[]; latitude?: number; longitude?: number; created_date?: string }> | undefined;
        try {
          if (exifDataRaw) clientExifData = JSON.parse(exifDataRaw);
        } catch { /* ignore parse errors */ }

        try {
          const result = await photoService.uploadPhotos({
            files: uploadedFiles.map((f: any) => ({
              filepath: f.filepath,
              newFilename: f.newFilename,
              originalFilename: f.originalFilename || undefined,
            })),
            visibility,
            tags: tagsRaw,
            title,
            description,
            country,
            clientExifData,
          });

          return res.status(200).json(result);
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          return res.status(500).json({ error: 'Failed to upload images' });
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

// POST /api/photos/add — add a Cloudinary photo to the database
router.post('/api/photos/add', async (req: Request, res: Response) => {

  const { photo_id, url, caption, city_id, attraction_id, user_id, latitude, longitude, tags, country_id, state_id, created_date, original_filename } = req.body;

  if (!photo_id || !url) {
    return res.status(400).json({ error: 'Missing required fields: photo_id and url.' });
  }


  try {
    const result = await photoService.addPhotoToDb({
      photo_id,
      url,
      caption,
      city_id,
      attraction_id,
      user_id: user_id != null ? Number(user_id) : undefined,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      country_id: country_id != null ? Number(country_id) : undefined,
      state_id: state_id != null ? Number(state_id) : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      created_date: created_date || undefined,
      original_filename: original_filename || undefined,
    });
    return res.status(201).json({ message: 'Photo added to database.', id: result.id });
  } catch (error) {
    console.error('Failed to add photo:', error);
    const message = error instanceof Error ? error.message : 'Failed to add photo';
    return res.status(500).json({ error: message });
  }
});

// PATCH /api/photos/:id
router.patch('/api/photos/:id', async (req: Request, res: Response) => {

  const { id } = req.params;

  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid photo id' });
  }

  const { caption, tags, city_id, attraction_id, latitude, longitude, state_id, country_id } = req.body;

  try {
    await photoService.updatePhoto(Number(id), caption ?? null, tags, city_id, attraction_id, latitude, longitude, state_id, country_id);
    return res.status(200).json({ message: 'Photo updated successfully.' });
  } catch (error) {
    console.error('Failed to update photo:', error);
    const message = error instanceof Error ? error.message : 'Failed to update photo';

    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// DELETE /api/photos/remove/:entityType/:entityId
router.delete(
  '/api/photos/remove/:entityType/:entityId',
  async (req: Request, res: Response) => {

    const { entityType, entityId } = req.params;

    if (!entityType || !entityId || Number.isNaN(Number(entityId))) {
      return res.status(400).json({ error: 'Invalid entityType or entityId' });
    }

    const { photoId } = req.body;

    if (!photoId) {
      return res.status(400).json({ error: 'Missing required field: photoId.' });
    }

    try {
      await photoService.removePhoto({
        entityType,
        entityId: Number(entityId),
        photoId,
      });

      return res.status(200).json({ message: 'Photo removed successfully.' });
    } catch (error) {
      console.error('Failed to remove photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove photo';

      if (message.includes('Invalid') || message.includes('Missing') || message.includes('not found')) {
        return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
      }

      return res.status(500).json({ error: message });
    }
  }
);

// DELETE /api/photos/:id — delete a photo by DB id (removes from S3 and database)
router.delete('/api/photos/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid photo id' });
  }

  try {
    await photoService.deletePhotoById(Number(id));
    return res.status(200).json({ message: 'Photo deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete photo:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete photo';
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

export default router;
