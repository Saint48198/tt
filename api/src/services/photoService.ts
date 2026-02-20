import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import sharp from 'sharp';
import { db } from '../db';

interface CloudinaryPhoto {
  asset_id: string;
  secure_url: string;
  created_at: string;
  format: string;
}

interface CloudinaryResource {
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
}

interface Photo {
  id: string;
  url: string;
  created_at: string;
  format: string;
}

interface SearchPhotoResult {
  photo_id: string;
  url: string;
  title: string;
  caption: string;
  created_at: string;
  format: string;
}

interface SearchPhotosRequest {
  folder?: string;
  tag?: string;
  max_results?: number;
  next_cursor?: string;
}

interface SearchPhotosResponse {
  photos: SearchPhotoResult[];
  next_cursor: string | null;
}

interface UploadFile {
  filepath: string;
  newFilename: string;
}

interface UploadPhotosRequest {
  files: UploadFile[];
  visibility?: string;
  tags?: string;
  title?: string;
  description?: string;
}

interface UploadedPhoto {
  public_id: string;
  secure_url: string;
  url: string;
  [key: string]: any;
}

interface RemovePhotoRequest {
  entityType: string;
  entityId: string | number;
  photoId: string | number;
}

interface SuggestTitlesRequest {
  imageBase64: string;
  mimeType?: string;
  hints?: {
    tags?: string[];
    city?: string;
    state?: string;
    country?: string;
    datetimeOriginal?: string;
  };
}

interface AddPhotoByEntityRequest {
  entityType: string;
  entityId: string | number;
  url: string;
  userId: string;
  caption?: string;
}

interface Photo {
  photo_id: string;
  url: string;
  caption?: string | null;
}

interface BulkAddPhotosRequest {
  entityType: string;
  entityId: string | number;
  photos: Photo[];
  userId: string;
}

interface BulkRemovePhotosRequest {
  entityType: string;
  entityId: string | number;
  photos: { url: string }[];
  userId: string;
}

interface PhotosByEntityResponse {
  photos: Array<{
    id: number;
    url: string;
    user_id: string;
    entity_id: number;
    caption?: string | null;
    created_at: string;
    photo_id: string;
    tags: string[];
  }>;
}

class PhotoService {
  private static instance: PhotoService;
  private cachedModelId: string | null = null;

  private constructor() {
    // Private constructor prevents direct instantiation
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Ensure photo_tags junction table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE(photo_id, tag_id)
      )
    `);
  }

  public static getInstance(): PhotoService {
    if (!PhotoService.instance) {
      PhotoService.instance = new PhotoService();
    }
    return PhotoService.instance;
  }

  /**
   * Fetch all photos from Cloudinary
   */
  public async getPhotos(): Promise<{ photos: Photo[] }> {
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

    return { photos };
  }

  /**
   * Pick a free Gemini model that supports generateContent
   */
  private async pickFreeGenerateModel(apiKey: string): Promise<string> {
    if (this.cachedModelId) return this.cachedModelId;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!resp.ok) throw new Error(`ListModels failed: ${resp.statusText}`);

    const json = (await resp.json()) as { models?: any[] };
    const models = json?.models ?? [];

    // Pick first model that supports generateContent and is NOT a pro model
    const free = models.find((m: any) => {
      const supports =
        m.supportedGenerationMethods?.includes('generateContent') ||
        m.availableMethods?.includes('generateContent');
      const isPro = /(^|[-])pro($|[-])/i.test(m.baseModelId || m.name || '');
      return supports && !isPro;
    });

    if (!free) throw new Error('No free model supporting generateContent found');

    const id =
      free.baseModelId ||
      (free.name?.startsWith('models/')
        ? free.name.slice('models/'.length)
        : free.name);

    if (!id) throw new Error('Could not determine model ID');

    this.cachedModelId = id;
    return id;
  }

  /**
   * Suggest photo titles using Gemini API
   */
  public async suggestTitles(
    request: SuggestTitlesRequest
  ): Promise<{ suggestions: string[] }> {
    const { imageBase64, mimeType = 'image/jpeg', hints = {} } = request;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    if (!imageBase64) {
      throw new Error('imageBase64 is required');
    }

    // Choose model dynamically (ListModels -> first that supports generateContent)
    const modelId = await this.pickFreeGenerateModel(apiKey);
    console.log('Using Gemini model:', modelId);

    const prompt = [
      'You are helping name personal photos.',
      'Using the image and optional hints, propose 8 concise, creative, title-case photo titles.',
      'No trailing punctuation. Avoid quotes. No more than 5 words each.',
      'Return ONLY a JSON array of strings. No extra text.',
    ].join(' ');

    const hintText = [
      hints.tags?.length ? `Tags: ${hints.tags.join(', ')}` : '',
      hints.city || hints.state || hints.country
        ? `Location: ${[hints.city, hints.state, hints.country]
            .filter(Boolean)
            .join(', ')}`
        : '',
      hints.datetimeOriginal ? `Date: ${hints.datetimeOriginal}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const body = {
      contents: [
        {
          parts: [
            { text: `${prompt}${hintText ? `\nHints: ${hintText}` : ''}` },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelId
      )}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Gemini call failed: ${t}`);
    }

    const data = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

    // Expect a JSON array; try to parse. If model adds code fences, strip them.
    const cleaned = String(text)
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      // fallback: split by lines if not valid JSON
      suggestions = cleaned
        .split('\n')
        .map((s: string) => s.replace(/^-+\s*/, '').trim())
        .filter(Boolean);
    }

    // normalize
    suggestions = suggestions
      .map((s) => s.replace(/^"(.*)"$/, '$1').trim())
      .filter(Boolean);

    return { suggestions };
  }

  /**
   * Add a photo to an entity (city or attraction)
   */
  public addPhotoByEntity(request: AddPhotoByEntityRequest): { id: number } {
    const { entityType, entityId, url, userId, caption } = request;

    // Validate entity type
    if (!['cities', 'attractions'].includes(entityType)) {
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    }

    // Validate required fields
    if (!url || !userId) {
      throw new Error('Missing required fields: url or userId.');
    }

    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const result = db
      .prepare(
        `
        INSERT INTO photos (url, user_id, ${column}, caption)
        VALUES (?, ?, ?, ?)
      `
      )
      .run(url, userId, Number(entityId), caption || null);

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Add multiple photos to an entity in bulk
   */
  public bulkAddPhotos(request: BulkAddPhotosRequest): { success: boolean } {
    const { entityType, entityId, photos, userId } = request;

    // Validate entity type
    if (!['cities', 'attractions'].includes(entityType)) {
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    }

    // Validate required fields
    if (!entityId || !photos || photos.length === 0) {
      throw new Error('Missing required fields: entityId or photos.');
    }

    const entityColumn =
      entityType === 'cities' ? 'city_id' : 'attraction_id';

    const insertPhotos = db.prepare(`
      INSERT INTO photos (photo_id, url, user_id, ${entityColumn}, caption)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: Photo[]) => {
      items.forEach((photo: Photo) => {
        insertPhotos.run(
          photo.photo_id,
          photo.url,
          userId,
          entityId,
          photo.caption || null
        );
      });
    });

    insertMany(photos);

    return { success: true };
  }

  /**
   * Remove multiple photos from an entity in bulk
   */
  public bulkRemovePhotos(request: BulkRemovePhotosRequest): { success: boolean } {
    const { entityType, entityId, photos, userId } = request;

    // Validate entity type
    if (!['cities', 'attractions'].includes(entityType)) {
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    }

    // Validate required fields
    if (!entityId || !photos || photos.length === 0) {
      throw new Error('Missing required fields: entityId or photos.');
    }

    const entityColumn =
      entityType === 'cities' ? 'city_id' : 'attraction_id';

    const deletePhotos = db.prepare(`
      DELETE FROM photos
      WHERE url = ? AND user_id = ? AND ${entityColumn} = ?
    `);

    const deleteMany = db.transaction((items: { url: string }[]) => {
      items.forEach((photo) => {
        deletePhotos.run(photo.url, userId, entityId);
      });
    });

    deleteMany(photos);

    return { success: true };
  }

  /**
   * Get photos for a specific entity (city or attraction)
   */
  public getPhotosByEntity(
    entityType: string,
    entityId: string | number
  ): PhotosByEntityResponse {
    // Validate entity type
    if (!['cities', 'attractions'].includes(entityType)) {
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    }

    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const rows = db
      .prepare(
        `
        SELECT id, url, user_id, ${column} AS entity_id, caption, created_at, photo_id
        FROM photos
        WHERE ${column} = ?
      `
      )
      .all(Number(entityId)) as Array<{
      id: number;
      url: string;
      user_id: string;
      entity_id: number;
      caption?: string | null;
      created_at: string;
      photo_id: string;
    }>;

    const photos = rows.map((row) => ({
      ...row,
      tags: this.getTagsForPhoto(row.id),
    }));

    return { photos };
  }

  /**
   * Search photos in Cloudinary by folder and/or tag
   */
  public async searchPhotos(request: SearchPhotosRequest): Promise<SearchPhotosResponse> {
    const { folder, tag, max_results = 10, next_cursor } = request;

    const expression: string[] = ['resource_type:image'];
    if (folder) expression.push(`folder=${folder}`);
    if (tag) expression.push(`tags=${tag}`);

    const searchExpression = expression.join(' AND ');

    const searchQuery = cloudinary.search
      .expression(searchExpression)
      .with_field('context')
      .with_field('tags')
      .max_results(max_results);

    if (next_cursor) {
      searchQuery.next_cursor(String(next_cursor));
    }

    const result = await searchQuery.execute();

    const photos: SearchPhotoResult[] = result.resources.map((photo: CloudinaryResource) => {
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

    return {
      photos,
      next_cursor: result.next_cursor || null,
    };
  }

  /**
   * Optimize an image before upload
   */
  private async optimizeImage(filePath: string, outputPath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found for optimization.');
      }

      const metadata = await sharp(filePath).metadata();
      const format: keyof sharp.FormatEnum =
        metadata.format === 'png' ? 'png' : 'jpeg';
      const width = metadata.width && metadata.width > 2000 ? 2000 : undefined;

      await sharp(filePath)
        .resize(width)
        .toFormat(format, { quality: 80 })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Image optimization failed:', error);
      return filePath;
    }
  }

  /**
   * Generate a signed URL for private images
   */
  private generateSignedUrl(publicId: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp },
      process.env.CLOUDINARY_API_SECRET as string
    );

    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${publicId}?api_key=${process.env.CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}`;
  }

  /**
   * Upload photos to Cloudinary
   */
  public async uploadPhotos(request: UploadPhotosRequest): Promise<{ success: boolean; images: UploadedPhoto[] }> {
    const { files, visibility, tags: tagsRaw, title = '', description = '' } = request;

    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const optimizedPath = `/tmp/optimized-${file.newFilename}`;
        const finalPath = await this.optimizeImage(file.filepath, optimizedPath);

        const result = await cloudinary.uploader.upload(finalPath, {
          folder: 'uploads',
          resource_type: 'image',
          type: visibility === 'private' ? 'private' : 'upload',
          access_mode:
            visibility === 'private' ? 'authenticated' : 'public',
          context: {
            caption: title,
            alt: description,
          },
          tags: tagsRaw ? tagsRaw.split(',') : [],
        });

        // cleanup
        try {
          fs.unlinkSync(file.filepath);
        } catch {
          console.warn('Failed to delete temp file:', file.filepath);
        }
        if (finalPath !== file.filepath) {
          try {
            fs.unlinkSync(finalPath);
          } catch {
            console.warn('Failed to delete optimized file:', finalPath);
          }
        }

        return result;
      })
    );

    const processedPhotos = uploadResults.map((photo: any) => ({
      ...photo,
      url:
        photo.type === 'private'
          ? this.generateSignedUrl(photo.public_id)
          : photo.secure_url,
    }));

    return { success: true, images: processedPhotos };
  }

  /**
   * Get tags for a photo
   */
  public getTagsForPhoto(photoId: number): string[] {
    const rows = db
      .prepare(
        `SELECT t.name FROM tags t
         JOIN photo_tags pt ON pt.tag_id = t.id
         WHERE pt.photo_id = ?
         ORDER BY t.name`
      )
      .all(photoId) as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  /**
   * Set tags for a photo (replaces existing tags)
   */
  public setTagsForPhoto(photoId: number, tags: string[]): void {
    const uniqueTags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

    const setTags = db.transaction((tagNames: string[]) => {
      // Remove existing tags for this photo
      db.prepare(`DELETE FROM photo_tags WHERE photo_id = ?`).run(photoId);

      for (const name of tagNames) {
        // Ensure tag exists
        db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run(name);
        const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name) as { id: number };
        // Link tag to photo
        db.prepare(`INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)`).run(photoId, tag.id);
      }
    });

    setTags(uniqueTags);
  }

  /**
   * Update a photo's caption, tags, and entity assignments
   */
  public updatePhoto(
    photoId: number,
    caption: string | null,
    tags?: string[],
    cityId?: number | null,
    attractionId?: number | null,
  ): { success: boolean } {
    const setClauses = ['caption = ?'];
    const params: any[] = [caption];

    if (cityId !== undefined) {
      setClauses.push('city_id = ?');
      params.push(cityId);
    }
    if (attractionId !== undefined) {
      setClauses.push('attraction_id = ?');
      params.push(attractionId);
    }

    params.push(photoId);
    const result = db
      .prepare(`UPDATE photos SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...params);

    if (result.changes === 0) {
      throw new Error('Photo not found.');
    }

    if (tags !== undefined) {
      this.setTagsForPhoto(photoId, tags);
    }

    return { success: true };
  }

  /**
   * Get all photos from the database (no pagination applied here, used for merging)
   */
  private getAllDbPhotos(): Array<{
    id: number;
    url: string;
    user_id: string;
    caption: string | null;
    created_at: string;
    photo_id: string;
    city_id: number | null;
    city_name: string | null;
    attraction_id: number | null;
    attraction_name: string | null;
    entity_type: string | null;
    entity_id: number | null;
    entity_name: string | null;
    tags: string[];
    source: 'database';
  }> {
    const rows = db
      .prepare(
        `SELECT p.id, p.url, p.user_id, p.city_id, p.attraction_id, p.caption, p.created_at, p.photo_id,
                c.name as city_name, a.name as attraction_name
         FROM photos p
         LEFT JOIN cities c ON p.city_id = c.id
         LEFT JOIN attractions a ON p.attraction_id = a.id
         ORDER BY p.created_at DESC`
      )
      .all() as any[];

    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      user_id: row.user_id,
      caption: row.caption,
      created_at: row.created_at,
      photo_id: row.photo_id,
      city_id: row.city_id || null,
      city_name: row.city_name || null,
      attraction_id: row.attraction_id || null,
      attraction_name: row.attraction_name || null,
      entity_type: row.city_id ? 'cities' : row.attraction_id ? 'attractions' : null,
      entity_id: row.city_id || row.attraction_id || null,
      entity_name: row.city_name || row.attraction_name || null,
      tags: this.getTagsForPhoto(row.id),
      source: 'database' as const,
    }));
  }

  /**
   * Get all photos merged from Cloudinary and the database.
   * Cloudinary-only photos are included; DB photos that match a Cloudinary photo are merged.
   * Supports filtering by source ('all' | 'database' | 'cloudinary') and search.
   */
  public async getAllPhotosMerged(params: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
  }): Promise<{ photos: any[]; total: number }> {
    const { page = 1, limit = 25, source = 'all', search } = params;

    // Fetch DB photos
    const dbPhotos = this.getAllDbPhotos();

    // Build a lookup of DB photos by their photo_id (Cloudinary public_id) for merging
    const dbByPhotoId = new Map<string, typeof dbPhotos[0]>();
    const dbByUrl = new Map<string, typeof dbPhotos[0]>();
    for (const p of dbPhotos) {
      if (p.photo_id) dbByPhotoId.set(p.photo_id, p);
      if (p.url) dbByUrl.set(p.url, p);
    }

    let merged: any[] = [];

    if (source === 'database') {
      // Only DB photos
      merged = dbPhotos.map((p) => ({ ...p, source: 'database', in_database: true, in_cloudinary: false }));
    } else {
      // Fetch from Cloudinary (source === 'all' or 'cloudinary')
      const cloudinaryPhotos: any[] = [];
      try {
        const folder = process.env.CLOUDINARY_FOLDER || '';
        let nextCursor: string | undefined;
        // Paginate through all Cloudinary resources (up to a reasonable cap)
        const maxFetches = 10; // cap at ~5000 photos
        for (let i = 0; i < maxFetches; i++) {
          const options: any = {
            type: 'upload',
            prefix: folder,
            max_results: 500,
            context: true,
          };
          if (nextCursor) options.next_cursor = nextCursor;

          const result = await cloudinary.api.resources(options);
          const resources = result.resources ?? [];

          for (const r of resources) {
            cloudinaryPhotos.push({
              photo_id: r.public_id,
              url: r.secure_url,
              caption: r.context?.custom?.caption || r.context?.custom?.alt || null,
              created_at: r.created_at,
              format: r.format,
            });
          }

          nextCursor = result.next_cursor;
          if (!nextCursor) break;
        }
      } catch (err) {
        console.error('Failed to fetch Cloudinary photos for merge:', err);
        // Fall back to DB-only if Cloudinary fails
        if (source === 'cloudinary') {
          return { photos: [], total: 0 };
        }
      }

      // Merge: start with Cloudinary photos, enrich with DB data
      const seenPhotoIds = new Set<string>();

      for (const cp of cloudinaryPhotos) {
        const dbMatch = dbByPhotoId.get(cp.photo_id) || dbByUrl.get(cp.url);
        seenPhotoIds.add(cp.photo_id);
        if (cp.url) seenPhotoIds.add(cp.url);

        if (dbMatch) {
          merged.push({
            id: dbMatch.id,
            url: cp.url,
            user_id: dbMatch.user_id,
            caption: dbMatch.caption || cp.caption,
            created_at: cp.created_at,
            photo_id: cp.photo_id,
            city_id: dbMatch.city_id,
            city_name: dbMatch.city_name,
            attraction_id: dbMatch.attraction_id,
            attraction_name: dbMatch.attraction_name,
            entity_type: dbMatch.entity_type,
            entity_id: dbMatch.entity_id,
            entity_name: dbMatch.entity_name,
            tags: dbMatch.tags,
            source: 'both',
            in_database: true,
            in_cloudinary: true,
          });
        } else {
          if (source !== 'database') {
            merged.push({
              id: null,
              url: cp.url,
              user_id: null,
              caption: cp.caption,
              created_at: cp.created_at,
              photo_id: cp.photo_id,
              city_id: null,
              city_name: null,
              attraction_id: null,
              attraction_name: null,
              entity_type: null,
              entity_id: null,
              entity_name: null,
              tags: [],
              source: 'cloudinary',
              in_database: false,
              in_cloudinary: true,
            });
          }
        }
      }

      // Add DB-only photos (not found in Cloudinary) when source is 'all' or 'database'
      if (source === 'all') {
        for (const dp of dbPhotos) {
          if (!seenPhotoIds.has(dp.photo_id) && !seenPhotoIds.has(dp.url)) {
            merged.push({
              ...dp,
              source: 'database',
              in_database: true,
              in_cloudinary: false,
            });
          }
        }
      }
    }

    // Filter by source if needed
    if (source === 'cloudinary') {
      merged = merged.filter((p) => p.in_cloudinary && !p.in_database);
    }

    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      merged = merged.filter(
        (p) =>
          (p.caption && p.caption.toLowerCase().includes(s)) ||
          (p.url && p.url.toLowerCase().includes(s)) ||
          (p.photo_id && p.photo_id.toLowerCase().includes(s)) ||
          (p.entity_name && p.entity_name.toLowerCase().includes(s)) ||
          (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(s)))
      );
    }

    // Sort by created_at descending
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = merged.length;
    const offset = (page - 1) * limit;
    const paginated = merged.slice(offset, offset + limit);

    return { photos: paginated, total };
  }

  /**
   * Remove a photo from an entity
   */
  public removePhoto(request: RemovePhotoRequest): { success: boolean } {
    const { entityType, entityId, photoId } = request;

    // Validate entity type
    if (!['cities', 'attractions'].includes(entityType)) {
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    }

    // Validate required fields
    if (!entityId || !photoId) {
      throw new Error('Missing required fields: entityId or photoId.');
    }

    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const result = db
      .prepare(
        `
        DELETE FROM photos
        WHERE id = ? AND ${column} = ?
      `
      )
      .run(photoId, Number(entityId));

    if (result.changes === 0) {
      throw new Error('Photo not found or does not belong to this entity.');
    }

    return { success: true };
  }
}

export const photoService = PhotoService.getInstance();

