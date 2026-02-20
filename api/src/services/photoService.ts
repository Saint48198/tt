import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import sharp from 'sharp';
import { db } from '../db';

interface CloudinaryPhoto { asset_id: string; secure_url: string; created_at: string; format: string; }
interface CloudinaryResource {
  public_id: string; secure_url: string; created_at: string; format: string;
  access_mode?: string; type?: string;
  context?: { custom?: { caption?: string; alt?: string } };
}
interface Photo { id: string; url: string; created_at: string; format: string; }
interface SearchPhotoResult { photo_id: string; url: string; title: string; caption: string; created_at: string; format: string; }
interface SearchPhotosRequest { folder?: string; tag?: string; max_results?: number; next_cursor?: string; }
interface SearchPhotosResponse { photos: SearchPhotoResult[]; next_cursor: string | null; }
interface UploadFile { filepath: string; newFilename: string; }
interface UploadPhotosRequest { files: UploadFile[]; visibility?: string; tags?: string; title?: string; description?: string; }
interface UploadedPhoto { public_id: string; secure_url: string; url: string; [key: string]: any; }
interface RemovePhotoRequest { entityType: string; entityId: string | number; photoId: string | number; }
interface SuggestTitlesRequest { imageBase64: string; mimeType?: string; hints?: { tags?: string[]; city?: string; state?: string; country?: string; datetimeOriginal?: string; }; }
interface AddPhotoByEntityRequest { entityType: string; entityId: string | number; url: string; userId: string; caption?: string; }
interface PhotoItem { photo_id: string; url: string; caption?: string | null; }
interface BulkAddPhotosRequest { entityType: string; entityId: string | number; photos: PhotoItem[]; userId: string; }
interface BulkRemovePhotosRequest { entityType: string; entityId: string | number; photos: { url: string }[]; userId: string; }
interface PhotosByEntityResponse {
  photos: Array<{ id: number; url: string; user_id: string; entity_id: number; caption?: string | null; created_at: string; photo_id: string; tags: string[]; }>;
}

class PhotoService {
  private static instance: PhotoService;
  private cachedModelId: string | null = null;
  private initialized = false;

  private constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    await db.exec(`
      CREATE TABLE IF NOT EXISTS photo_tags (
        id SERIAL PRIMARY KEY,
        photo_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE(photo_id, tag_id)
      )
    `);
    this.initialized = true;
  }

  public static getInstance(): PhotoService {
    if (!PhotoService.instance) { PhotoService.instance = new PhotoService(); }
    return PhotoService.instance;
  }

  public async getPhotos(): Promise<{ photos: Photo[] }> {
    const folder = process.env.CLOUDINARY_FOLDER || '';
    const resources = await cloudinary.api.resources({ type: 'upload', prefix: folder, max_results: 50 });
    const photos: Photo[] = (resources.resources ?? []).map((r: CloudinaryPhoto) => ({
      id: r.asset_id, url: r.secure_url, created_at: r.created_at, format: r.format,
    }));
    return { photos };
  }

  private async pickFreeGenerateModel(apiKey: string): Promise<string> {
    if (this.cachedModelId) return this.cachedModelId;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!resp.ok) throw new Error(`ListModels failed: ${resp.statusText}`);
    const json = (await resp.json()) as { models?: any[] };
    const models = json?.models ?? [];
    const free = models.find((m: any) => {
      const supports = m.supportedGenerationMethods?.includes('generateContent') || m.availableMethods?.includes('generateContent');
      const isPro = /(^|[-])pro($|[-])/i.test(m.baseModelId || m.name || '');
      return supports && !isPro;
    });
    if (!free) throw new Error('No free model supporting generateContent found');
    const id = free.baseModelId || (free.name?.startsWith('models/') ? free.name.slice('models/'.length) : free.name);
    if (!id) throw new Error('Could not determine model ID');
    this.cachedModelId = id;
    return id;
  }

  public async suggestTitles(request: SuggestTitlesRequest): Promise<{ suggestions: string[] }> {
    const { imageBase64, mimeType = 'image/jpeg', hints = {} } = request;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
    if (!imageBase64) throw new Error('imageBase64 is required');

    const modelId = await this.pickFreeGenerateModel(apiKey);
    const prompt = ['You are helping name personal photos.', 'Using the image and optional hints, propose 8 concise, creative, title-case photo titles.', 'No trailing punctuation. Avoid quotes. No more than 5 words each.', 'Return ONLY a JSON array of strings. No extra text.'].join(' ');
    const hintText = [hints.tags?.length ? `Tags: ${hints.tags.join(', ')}` : '', hints.city || hints.state || hints.country ? `Location: ${[hints.city, hints.state, hints.country].filter(Boolean).join(', ')}` : '', hints.datetimeOriginal ? `Date: ${hints.datetimeOriginal}` : ''].filter(Boolean).join(' | ');
    const body = { contents: [{ parts: [{ text: `${prompt}${hintText ? `\nHints: ${hintText}` : ''}` }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }] };
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) { const t = await resp.text(); throw new Error(`Gemini call failed: ${t}`); }
    const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let suggestions: string[] = [];
    try { suggestions = JSON.parse(cleaned); } catch { suggestions = cleaned.split('\n').map((s: string) => s.replace(/^-+\s*/, '').trim()).filter(Boolean); }
    suggestions = suggestions.map((s) => s.replace(/^"(.*)"$/, '$1').trim()).filter(Boolean);
    return { suggestions };
  }

  public async addPhotoByEntity(request: AddPhotoByEntityRequest): Promise<{ id: number }> {
    const { entityType, entityId, url, userId, caption } = request;
    if (!['cities', 'attractions'].includes(entityType)) throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!url || !userId) throw new Error('Missing required fields: url or userId.');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    const result = await db.run(
      `INSERT INTO photos (url, user_id, ${column}, caption) VALUES ($1, $2, $3, $4) RETURNING id`,
      [url, userId, Number(entityId), caption || null]
    );
    return { id: result.rows[0].id };
  }

  public async addPhotoToDb(params: {
    photo_id: string; url: string; caption?: string | null;
    city_id?: number | null; attraction_id?: number | null; user_id?: number;
  }): Promise<{ id: number }> {
    const { photo_id, url, caption, city_id, attraction_id } = params;
    if (!photo_id || !url) throw new Error('Missing required fields: photo_id and url.');

    let userId = params.user_id;
    if (userId) {
      const userExists = await db.get('SELECT id FROM users WHERE id = $1', [userId]);
      if (!userExists) userId = undefined;
    }
    if (!userId) {
      const firstUser = await db.get<{ id: number }>('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      if (!firstUser) throw new Error('No users found in the database. Cannot assign photo.');
      userId = firstUser.id;
    }

    if (city_id) {
      const cityExists = await db.get('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (!cityExists) throw new Error(`City with id ${city_id} not found.`);
    }
    if (attraction_id) {
      const attractionExists = await db.get('SELECT id FROM attractions WHERE id = $1', [attraction_id]);
      if (!attractionExists) throw new Error(`Attraction with id ${attraction_id} not found.`);
    }

    const result = await db.run(
      `INSERT INTO photos (photo_id, url, user_id, city_id, attraction_id, caption) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [photo_id, url, userId, city_id || null, attraction_id || null, caption || null]
    );
    return { id: result.rows[0].id };
  }

  public async bulkAddPhotos(request: BulkAddPhotosRequest): Promise<{ success: boolean }> {
    const { entityType, entityId, photos, userId } = request;
    if (!['cities', 'attractions'].includes(entityType)) throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photos || photos.length === 0) throw new Error('Missing required fields: entityId or photos.');
    const entityColumn = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const photo of photos) {
        await client.query(
          `INSERT INTO photos (photo_id, url, user_id, ${entityColumn}, caption) VALUES ($1,$2,$3,$4,$5)`,
          [photo.photo_id, photo.url, userId, entityId, photo.caption || null]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { success: true };
  }

  public async bulkRemovePhotos(request: BulkRemovePhotosRequest): Promise<{ success: boolean }> {
    const { entityType, entityId, photos, userId } = request;
    if (!['cities', 'attractions'].includes(entityType)) throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photos || photos.length === 0) throw new Error('Missing required fields: entityId or photos.');
    const entityColumn = entityType === 'cities' ? 'city_id' : 'attraction_id';

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const photo of photos) {
        await client.query(
          `DELETE FROM photos WHERE url = $1 AND user_id = $2 AND ${entityColumn} = $3`,
          [photo.url, userId, entityId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { success: true };
  }

  public async getPhotosByEntity(entityType: string, entityId: string | number): Promise<PhotosByEntityResponse> {
    if (!['cities', 'attractions'].includes(entityType)) throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    await this.ensureTable();

    const rows = await db.all<any>(
      `SELECT id, url, user_id, ${column} AS entity_id, caption, created_at, photo_id FROM photos WHERE ${column} = $1`,
      [Number(entityId)]
    );
    const photos = [];
    for (const row of rows) {
      photos.push({ ...row, tags: await this.getTagsForPhoto(row.id) });
    }
    return { photos };
  }

  public async searchPhotos(request: SearchPhotosRequest): Promise<SearchPhotosResponse> {
    const { folder, tag, max_results = 10, next_cursor } = request;
    const expression: string[] = ['resource_type:image'];
    if (folder) expression.push(`folder=${folder}`);
    if (tag) expression.push(`tags=${tag}`);
    const searchExpression = expression.join(' AND ');
    const searchQuery = cloudinary.search.expression(searchExpression).with_field('context').with_field('tags').max_results(max_results);
    if (next_cursor) searchQuery.next_cursor(String(next_cursor));
    const result = await searchQuery.execute();
    const photos: SearchPhotoResult[] = result.resources.map((photo: CloudinaryResource) => {
      const title = photo.context?.custom?.caption || 'Untitled';
      const caption = photo.context?.custom?.alt || '';
      if (photo.access_mode === 'authenticated' || photo.type === 'private') {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = cloudinary.utils.api_sign_request({ public_id: photo.public_id, timestamp }, process.env.CLOUDINARY_API_SECRET as string);
        return { photo_id: photo.public_id, title, caption, created_at: photo.created_at, format: photo.format, url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${photo.public_id}?api_key=${process.env.CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}` };
      }
      return { photo_id: photo.public_id, title, caption, created_at: photo.created_at, format: photo.format, url: photo.secure_url };
    });
    return { photos, next_cursor: result.next_cursor || null };
  }

  private async optimizeImage(filePath: string, outputPath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) throw new Error('File not found for optimization.');
      const metadata = await sharp(filePath).metadata();
      const format: keyof sharp.FormatEnum = metadata.format === 'png' ? 'png' : 'jpeg';
      const width = metadata.width && metadata.width > 2000 ? 2000 : undefined;
      await sharp(filePath).resize(width).toFormat(format, { quality: 80 }).toFile(outputPath);
      return outputPath;
    } catch (error) {
      console.error('Image optimization failed:', error);
      return filePath;
    }
  }

  private generateSignedUrl(publicId: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp }, process.env.CLOUDINARY_API_SECRET as string);
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${publicId}?api_key=${process.env.CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}`;
  }

  public async uploadPhotos(request: UploadPhotosRequest): Promise<{ success: boolean; images: UploadedPhoto[] }> {
    const { files, visibility, tags: tagsRaw, title = '', description = '' } = request;
    if (!files || files.length === 0) throw new Error('No files provided for upload');
    const uploadResults = await Promise.all(files.map(async (file) => {
      const optimizedPath = `/tmp/optimized-${file.newFilename}`;
      const finalPath = await this.optimizeImage(file.filepath, optimizedPath);
      const result = await cloudinary.uploader.upload(finalPath, {
        folder: 'uploads', resource_type: 'image',
        type: visibility === 'private' ? 'private' : 'upload',
        access_mode: visibility === 'private' ? 'authenticated' : 'public',
        context: { caption: title, alt: description },
        tags: tagsRaw ? tagsRaw.split(',') : [],
      });
      try { fs.unlinkSync(file.filepath); } catch { console.warn('Failed to delete temp file:', file.filepath); }
      if (finalPath !== file.filepath) { try { fs.unlinkSync(finalPath); } catch { console.warn('Failed to delete optimized file:', finalPath); } }
      return result;
    }));
    const processedPhotos = uploadResults.map((photo: any) => ({
      ...photo, url: photo.type === 'private' ? this.generateSignedUrl(photo.public_id) : photo.secure_url,
    }));
    return { success: true, images: processedPhotos };
  }

  public async getTagsForPhoto(photoId: number): Promise<string[]> {
    await this.ensureTable();
    const rows = await db.all<{ name: string }>(
      `SELECT t.name FROM tags t JOIN photo_tags pt ON pt.tag_id = t.id WHERE pt.photo_id = $1 ORDER BY t.name`,
      [photoId]
    );
    return rows.map((r) => r.name);
  }

  public async setTagsForPhoto(photoId: number, tags: string[]): Promise<void> {
    await this.ensureTable();
    const uniqueTags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM photo_tags WHERE photo_id = $1', [photoId]);
      for (const name of uniqueTags) {
        await client.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
        const tagRow = await client.query('SELECT id FROM tags WHERE name = $1', [name]);
        const tagId = tagRow.rows[0].id;
        await client.query('INSERT INTO photo_tags (photo_id, tag_id) VALUES ($1, $2) ON CONFLICT (photo_id, tag_id) DO NOTHING', [photoId, tagId]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updatePhoto(
    photoId: number, caption: string | null, tags?: string[],
    cityId?: number | null, attractionId?: number | null,
  ): Promise<{ success: boolean; deleted?: boolean }> {
    if (cityId === null && attractionId === null) {
      const existing = await db.get('SELECT id FROM photos WHERE id = $1', [photoId]);
      if (!existing) throw new Error('Photo not found.');
      await db.run('DELETE FROM photo_tags WHERE photo_id = $1', [photoId]);
      await db.run('DELETE FROM photos WHERE id = $1', [photoId]);
      return { success: true, deleted: true };
    }

    const setClauses = ['caption = $1'];
    const params: any[] = [caption];
    let idx = 2;

    if (cityId !== undefined) { setClauses.push(`city_id = $${idx++}`); params.push(cityId); }
    if (attractionId !== undefined) { setClauses.push(`attraction_id = $${idx++}`); params.push(attractionId); }

    params.push(photoId);
    const result = await db.run(`UPDATE photos SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);
    if (result.rowCount === 0) throw new Error('Photo not found.');

    const updated = await db.get<{ city_id: number | null; attraction_id: number | null }>(
      'SELECT city_id, attraction_id FROM photos WHERE id = $1', [photoId]
    );
    if (updated && updated.city_id === null && updated.attraction_id === null) {
      await db.run('DELETE FROM photo_tags WHERE photo_id = $1', [photoId]);
      await db.run('DELETE FROM photos WHERE id = $1', [photoId]);
      return { success: true, deleted: true };
    }

    if (tags !== undefined) { await this.setTagsForPhoto(photoId, tags); }
    return { success: true };
  }

  private async getAllDbPhotos(): Promise<Array<any>> {
    const rows = await db.all<any>(
      `SELECT p.id, p.url, p.user_id, p.city_id, p.attraction_id, p.caption, p.created_at, p.photo_id,
              c.name as city_name, a.name as attraction_name
       FROM photos p
       LEFT JOIN cities c ON p.city_id = c.id
       LEFT JOIN attractions a ON p.attraction_id = a.id
       ORDER BY p.created_at DESC`
    );
    const result = [];
    for (const row of rows) {
      result.push({
        id: row.id, url: row.url, user_id: row.user_id, caption: row.caption,
        created_at: row.created_at, photo_id: row.photo_id,
        city_id: row.city_id || null, city_name: row.city_name || null,
        attraction_id: row.attraction_id || null, attraction_name: row.attraction_name || null,
        entity_type: row.city_id ? 'cities' : row.attraction_id ? 'attractions' : null,
        entity_id: row.city_id || row.attraction_id || null,
        entity_name: row.city_name || row.attraction_name || null,
        tags: await this.getTagsForPhoto(row.id),
        source: 'database' as const,
      });
    }
    return result;
  }

  public async getAllPhotosMerged(params: {
    page?: number; limit?: number; source?: string; search?: string;
  }): Promise<{ photos: any[]; total: number }> {
    const { page = 1, limit = 25, source = 'all', search } = params;
    const dbPhotos = await this.getAllDbPhotos();

    const dbByPhotoId = new Map<string, any>();
    const dbByUrl = new Map<string, any>();
    for (const p of dbPhotos) {
      if (p.photo_id) dbByPhotoId.set(p.photo_id, p);
      if (p.url) dbByUrl.set(p.url, p);
    }

    let merged: any[] = [];

    if (source === 'database') {
      merged = dbPhotos.map((p) => ({ ...p, source: 'database', in_database: true, in_cloudinary: false }));
    } else {
      const cloudinaryPhotos: any[] = [];
      try {
        const folder = process.env.CLOUDINARY_FOLDER || '';
        let nextCursor: string | undefined;
        const maxFetches = 10;
        for (let i = 0; i < maxFetches; i++) {
          const options: any = { type: 'upload', prefix: folder, max_results: 500, context: true };
          if (nextCursor) options.next_cursor = nextCursor;
          const result = await cloudinary.api.resources(options);
          const resources = result.resources ?? [];
          for (const r of resources) {
            cloudinaryPhotos.push({
              photo_id: r.public_id, url: r.secure_url,
              caption: r.context?.custom?.caption || r.context?.custom?.alt || null,
              created_at: r.created_at, format: r.format,
            });
          }
          nextCursor = result.next_cursor;
          if (!nextCursor) break;
        }
      } catch (err) {
        console.error('Failed to fetch Cloudinary photos for merge:', err);
        if (source === 'cloudinary') return { photos: [], total: 0 };
      }

      const seenPhotoIds = new Set<string>();
      for (const cp of cloudinaryPhotos) {
        const dbMatch = dbByPhotoId.get(cp.photo_id) || dbByUrl.get(cp.url);
        seenPhotoIds.add(cp.photo_id);
        if (cp.url) seenPhotoIds.add(cp.url);
        if (dbMatch) {
          merged.push({ id: dbMatch.id, url: cp.url, user_id: dbMatch.user_id, caption: dbMatch.caption || cp.caption, created_at: cp.created_at, photo_id: cp.photo_id, city_id: dbMatch.city_id, city_name: dbMatch.city_name, attraction_id: dbMatch.attraction_id, attraction_name: dbMatch.attraction_name, entity_type: dbMatch.entity_type, entity_id: dbMatch.entity_id, entity_name: dbMatch.entity_name, tags: dbMatch.tags, source: 'both', in_database: true, in_cloudinary: true });
        } else if (source !== 'database') {
          merged.push({ id: null, url: cp.url, user_id: null, caption: cp.caption, created_at: cp.created_at, photo_id: cp.photo_id, city_id: null, city_name: null, attraction_id: null, attraction_name: null, entity_type: null, entity_id: null, entity_name: null, tags: [], source: 'cloudinary', in_database: false, in_cloudinary: true });
        }
      }
      if (source === 'all') {
        for (const dp of dbPhotos) {
          if (!seenPhotoIds.has(dp.photo_id) && !seenPhotoIds.has(dp.url)) {
            merged.push({ ...dp, source: 'database', in_database: true, in_cloudinary: false });
          }
        }
      }
    }

    if (source === 'cloudinary') merged = merged.filter((p) => p.in_cloudinary && !p.in_database);
    if (search) {
      const s = search.toLowerCase();
      merged = merged.filter((p) =>
        (p.caption && p.caption.toLowerCase().includes(s)) || (p.url && p.url.toLowerCase().includes(s)) ||
        (p.photo_id && p.photo_id.toLowerCase().includes(s)) || (p.entity_name && p.entity_name.toLowerCase().includes(s)) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(s)))
      );
    }
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total = merged.length;
    const offset = (page - 1) * limit;
    const paginated = merged.slice(offset, offset + limit);
    return { photos: paginated, total };
  }

  public async removePhoto(request: RemovePhotoRequest): Promise<{ success: boolean }> {
    const { entityType, entityId, photoId } = request;
    if (!['cities', 'attractions'].includes(entityType)) throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photoId) throw new Error('Missing required fields: entityId or photoId.');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    const result = await db.run(`DELETE FROM photos WHERE id = $1 AND ${column} = $2`, [photoId, Number(entityId)]);
    if (result.rowCount === 0) throw new Error('Photo not found or does not belong to this entity.');
    return { success: true };
  }
}

export const photoService = PhotoService.getInstance();

