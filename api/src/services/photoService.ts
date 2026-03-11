import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import { randomUUID } from 'crypto';
import { db } from '../db';

// --- Interfaces (unchanged public contract) ---

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
  originalFilename?: string;
}
interface UploadPhotosRequest {
  files: UploadFile[];
  visibility?: string;
  tags?: string;
  title?: string;
  description?: string;
  country?: string;
  clientExifData?: Array<{
    title?: string;
    keywords?: string[];
    latitude?: number;
    longitude?: number;
    created_date?: string;
  }>;
}
interface UploadedPhoto {
  public_id: string;
  secure_url: string;
  url: string;
  exif?: ExifMetadata;
  [key: string]: any;
}
interface ExifMetadata {
  title?: string;
  keywords?: string[];
  latitude?: number;
  longitude?: number;
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
interface PhotoItem {
  photo_id: string;
  url: string;
  caption?: string | null;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
}
interface BulkAddPhotosRequest {
  entityType: string;
  entityId: string | number;
  photos: PhotoItem[];
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
  total: number;
  page: number;
  limit: number;
}

class PhotoService {
  private static instance: PhotoService;
  private cachedModelId: string | null = null;
  private initialized = false;
  private s3: S3Client;
  private bucket: string;

  private constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucket = process.env.S3_PHOTO_BUCKET || 'app-tt-photos';
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
    await db.exec(`ALTER TABLE photos ADD COLUMN IF NOT EXISTS original_filename TEXT`);
    this.initialized = true;
  }

  public static getInstance(): PhotoService {
    if (!PhotoService.instance) {
      PhotoService.instance = new PhotoService();
    }
    return PhotoService.instance;
  }

  // --- S3 Helpers ---

  /**
   * Build the S3 object key: uploads/{country}/{uuid}.{ext}
   */
  private buildS3Key(ext: string, country?: string): string {
    const slug = country
      ? country
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      : 'uncategorized';
    const uuid = randomUUID();
    return `uploads/${slug}/${uuid}.${ext}`;
  }

  /**
   * Upload a file buffer to S3 and return the object key.
   */
  private async uploadToS3(filePath: string, key: string, contentType: string): Promise<void> {
    const body = fs.readFileSync(filePath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  /**
   * Get the public URL for an S3 object key.
   */
  private getPublicUrl(key: string): string {
    const region = process.env.AWS_REGION || 'us-east-2';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Delete an object from S3 by key.
   */
  private async deleteFromS3(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Move an S3 object from one key to another (copy + delete).
   */
  private async moveS3Object(oldKey: string, newKey: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${oldKey}`,
        Key: newKey,
      })
    );
    await this.deleteFromS3(oldKey);
  }

  /**
   * Resolve country name from city_id or attraction_id.
   */
  private async resolveCountryName(
    cityId?: number | null,
    attractionId?: number | null
  ): Promise<string | undefined> {
    if (cityId) {
      const row = await db.get<{ name: string }>(
        `SELECT co.name FROM cities c JOIN countries co ON c.country_id = co.id WHERE c.id = $1`,
        [cityId]
      );
      return row?.name;
    }
    if (attractionId) {
      const row = await db.get<{ name: string }>(
        `SELECT co.name FROM attractions a JOIN countries co ON a.country_id = co.id WHERE a.id = $1`,
        [attractionId]
      );
      return row?.name;
    }
    return undefined;
  }

  // --- Public API ---

  public async getPhotos(): Promise<{ photos: Photo[] }> {
    const rows = await db.all<any>(
      `SELECT id, photo_id, caption, created_at, url FROM photos WHERE disabled_date IS NULL ORDER BY created_at DESC LIMIT 50`
    );
    const photos: Photo[] = [];
    for (const row of rows) {
      const ext = row.photo_id ? path.extname(row.photo_id).replace('.', '') : 'jpg';
      const url = row.photo_id ? this.getPublicUrl(row.photo_id) : row.url;
      photos.push({ id: String(row.id), url, created_at: row.created_at, format: ext });
    }
    return { photos };
  }

  private async pickFreeGenerateModel(apiKey: string): Promise<string> {
    if (this.cachedModelId) return this.cachedModelId;
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!resp.ok) throw new Error(`ListModels failed: ${resp.statusText}`);
    const json = (await resp.json()) as { models?: any[] };
    const models = json?.models ?? [];
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
      (free.name?.startsWith('models/') ? free.name.slice('models/'.length) : free.name);
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
    const prompt = [
      'You are helping name personal photos.',
      'Using the image and optional hints, propose 8 concise, creative, title-case photo titles.',
      'No trailing punctuation. Avoid quotes. No more than 5 words each.',
      'Return ONLY a JSON array of strings. No extra text.',
    ].join(' ');
    const hintText = [
      hints.tags?.length ? `Tags: ${hints.tags.join(', ')}` : '',
      hints.city || hints.state || hints.country
        ? `Location: ${[hints.city, hints.state, hints.country].filter(Boolean).join(', ')}`
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
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`,
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
    const cleaned = String(text)
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = cleaned
        .split('\n')
        .map((s: string) => s.replace(/^-+\s*/, '').trim())
        .filter(Boolean);
    }
    suggestions = suggestions.map((s) => s.replace(/^"(.*)"$/, '$1').trim()).filter(Boolean);
    return { suggestions };
  }

  public async addPhotoByEntity(request: AddPhotoByEntityRequest): Promise<{ id: number }> {
    const { entityType, entityId, url, userId, caption } = request;
    if (!['cities', 'attractions'].includes(entityType))
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!url || !userId) throw new Error('Missing required fields: url or userId.');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    const result = await db.run(
      `INSERT INTO photos (url, user_id, ${column}, caption) VALUES ($1, $2, $3, $4) RETURNING id`,
      [url, userId, Number(entityId), caption || null]
    );
    return { id: result.rows[0].id };
  }

  public async addPhotoToDb(params: {
    photo_id: string;
    url: string;
    caption?: string | null;
    city_id?: number | null;
    attraction_id?: number | null;
    user_id?: number;
    latitude?: number | null;
    longitude?: number | null;
    country_id?: number | null;
    state_id?: number | null;
    tags?: string[];
    created_date?: string | null;
    original_filename?: string | null;
  }): Promise<{ id: number }> {
    await this.ensureTable();
    const {
      photo_id,
      url,
      caption,
      city_id,
      attraction_id,
      latitude,
      longitude,
      country_id,
      created_date,
      original_filename,
    } = params;
    let { state_id } = params;
    if (!photo_id || !url) throw new Error('Missing required fields: photo_id and url.');

    // Check for duplicate by original_filename
    if (original_filename) {
      const existing = await db.get<{ id: number }>(
        'SELECT id FROM photos WHERE original_filename = $1 AND disabled_date IS NULL',
        [original_filename]
      );
      if (existing) {
        throw new Error(`DUPLICATE: A photo with filename "${original_filename}" already exists.`);
      }
    }

    let userId = params.user_id;
    if (userId) {
      const userExists = await db.get('SELECT id FROM users WHERE id = $1', [userId]);
      if (!userExists) userId = undefined;
    }
    if (!userId) {
      const firstUser = await db.get<{ id: number }>(
        'SELECT id FROM users ORDER BY id ASC LIMIT 1'
      );
      if (!firstUser) throw new Error('No users found in the database. Cannot assign photo.');
      userId = firstUser.id;
    }

    // Resolve country_id: use explicit param, or derive from city/attraction, or from S3 key
    let resolvedCountryId = country_id ?? null;
    if (!resolvedCountryId && city_id) {
      const city = await db.get<{ country_id: number; state_id: number | null }>(
        'SELECT country_id, state_id FROM cities WHERE id = $1',
        [city_id]
      );
      resolvedCountryId = city?.country_id || null;
      if (!state_id && city?.state_id) state_id = city.state_id;
    }
    if (!resolvedCountryId && attraction_id) {
      const attr = await db.get<{ country_id: number }>(
        'SELECT country_id FROM attractions WHERE id = $1',
        [attraction_id]
      );
      resolvedCountryId = attr?.country_id || null;
    }
    // Last resort: extract country slug from S3 key (uploads/{country-slug}/{uuid}.ext)
    if (!resolvedCountryId && photo_id) {
      const parts = photo_id.split('/');
      if (parts.length >= 3 && parts[0] === 'uploads') {
        const slug = parts[1];
        if (slug && slug !== 'uncategorized') {
          const country = await db.get<{ id: number }>(
            `SELECT id FROM countries WHERE LOWER(REPLACE(name, ' ', '-')) = $1 AND disabled_date IS NULL`,
            [slug]
          );
          resolvedCountryId = country?.id || null;
        }
      }
    }

    if (city_id) {
      const cityExists = await db.get('SELECT id FROM cities WHERE id = $1', [city_id]);
      if (!cityExists) throw new Error(`City with id ${city_id} not found.`);
    }
    if (attraction_id) {
      const attractionExists = await db.get('SELECT id FROM attractions WHERE id = $1', [
        attraction_id,
      ]);
      if (!attractionExists) throw new Error(`Attraction with id ${attraction_id} not found.`);
    }

    const result = await db.run(
      `INSERT INTO photos (photo_id, url, user_id, city_id, attraction_id, caption, latitude, longitude, country_id, state_id, created_date, original_filename) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        photo_id,
        url,
        userId,
        city_id ?? null,
        attraction_id ?? null,
        caption ?? null,
        latitude ?? null,
        longitude ?? null,
        resolvedCountryId,
        state_id ?? null,
        created_date ?? new Date().toISOString(),
        original_filename ?? null,
      ]
    );
    const newId = result.rows[0].id;

    if (params.tags && params.tags.length > 0) {
      await this.setTagsForPhoto(newId, params.tags);
    }

    return { id: newId };
  }

  public async bulkAddPhotos(request: BulkAddPhotosRequest): Promise<{ success: boolean }> {
    const { entityType, entityId, photos, userId } = request;
    if (!['cities', 'attractions'].includes(entityType))
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photos || photos.length === 0)
      throw new Error('Missing required fields: entityId or photos.');
    const entityColumn = entityType === 'cities' ? 'city_id' : 'attraction_id';

    // Resolve country_id from entity
    const countryTable = entityType === 'cities' ? 'cities' : 'attractions';
    const entityRow = await db.get<{ country_id: number }>(
      `SELECT country_id FROM ${countryTable} WHERE id = $1`,
      [Number(entityId)]
    );
    const countryId = entityRow?.country_id || null;

    await this.ensureTable();

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const photo of photos) {
        const insertResult = await client.query(
          `INSERT INTO photos (photo_id, url, user_id, ${entityColumn}, caption, latitude, longitude, country_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            photo.photo_id,
            photo.url,
            userId,
            entityId,
            photo.caption || null,
            photo.latitude || null,
            photo.longitude || null,
            countryId,
          ]
        );
        if (photo.tags && photo.tags.length > 0 && insertResult.rows[0]?.id) {
          const photoDbId = insertResult.rows[0].id;
          const uniqueTags = [
            ...new Set(photo.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
          ];
          for (const name of uniqueTags) {
            await client.query(
              'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
              [name]
            );
            const tagRow = await client.query('SELECT id FROM tags WHERE name = $1', [name]);
            const tagId = tagRow.rows[0].id;
            await client.query(
              'INSERT INTO photo_tags (photo_id, tag_id) VALUES ($1, $2) ON CONFLICT (photo_id, tag_id) DO NOTHING',
              [photoDbId, tagId]
            );
          }
        }
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
    if (!['cities', 'attractions'].includes(entityType))
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photos || photos.length === 0)
      throw new Error('Missing required fields: entityId or photos.');
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

  public async getPhotosByEntity(
    entityType: string,
    entityId: string | number,
    page = 1,
    limit = 15
  ): Promise<PhotosByEntityResponse> {
    if (!['cities', 'attractions'].includes(entityType))
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    await this.ensureTable();

    const offset = (page - 1) * limit;

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM photos WHERE ${column} = $1 AND disabled_date IS NULL`,
      [Number(entityId)]
    );
    const total = countRow?.count ?? 0;

    const rows = await db.all<any>(
      `SELECT id, url, user_id, ${column} AS entity_id, caption, created_at, photo_id, latitude, longitude, created_date, updated_date, disabled_date FROM photos WHERE ${column} = $1 AND disabled_date IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [Number(entityId), limit, offset]
    );
    const photos = [];
    for (const row of rows) {
      // photo_id stores the S3 key — use public URL
      const url = row.photo_id ? this.getPublicUrl(row.photo_id) : row.url;
      photos.push({ ...row, url, tags: await this.getTagsForPhoto(row.id) });
    }
    return { photos, total, page, limit };
  }

  public async searchPhotos(request: SearchPhotosRequest): Promise<SearchPhotosResponse> {
    const { tag, max_results = 10, next_cursor } = request;

    // Search is now DB-driven since S3 doesn't have metadata search
    const params: any[] = [];
    let idx = 1;
    let whereExtra = '';

    if (tag) {
      whereExtra += ` AND EXISTS (
        SELECT 1 FROM photo_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.photo_id = p.id AND t.name = $${idx++}
      )`;
      params.push(tag.toLowerCase());
    }

    if (next_cursor) {
      whereExtra += ` AND p.id < $${idx++}`;
      params.push(Number(next_cursor));
    }

    params.push(max_results);
    const limitIdx = idx++;

    const query = `
      SELECT p.id, p.photo_id, p.caption, p.created_at, p.url
      FROM photos p
      WHERE p.disabled_date IS NULL${whereExtra}
      ORDER BY p.created_at DESC
      LIMIT $${limitIdx}
    `;

    const rows = await db.all<any>(query, params);
    const photos: SearchPhotoResult[] = [];

    for (const row of rows) {
      const ext = row.photo_id ? path.extname(row.photo_id).replace('.', '') : 'jpg';
      const url = row.photo_id ? this.getPublicUrl(row.photo_id) : row.url;
      photos.push({
        photo_id: row.photo_id || String(row.id),
        title: row.caption || 'Untitled',
        caption: row.caption || '',
        created_at: row.created_at,
        format: ext,
        url,
      });
    }

    const lastId = rows.length > 0 ? String(rows[rows.length - 1].id) : null;
    return { photos, next_cursor: rows.length >= max_results ? lastId : null };
  }

  private async extractExifMetadata(
    filePath: string
  ): Promise<ExifMetadata & { created_date?: string }> {
    const metadata: ExifMetadata & { created_date?: string } = {};
    try {
      const buffer = fs.readFileSync(filePath);
      const tags = ExifReader.load(buffer, { expanded: true });

      const xmpTitle = tags.xmp?.['dc:title']?.description || tags.xmp?.title?.description;
      const iptcTitle = tags.iptc?.['Object Name']?.description;
      const exifTitle =
        tags.exif?.ImageDescription?.description || tags.exif?.['XPTitle']?.description;
      metadata.title = xmpTitle || iptcTitle || exifTitle || undefined;

      const xmpSubject = tags.xmp?.['dc:subject'] || tags.xmp?.subject;
      const iptcKeywords = tags.iptc?.Keywords;
      const exifKeywords = tags.exif?.['XPKeywords']?.description;

      if (xmpSubject) {
        if (Array.isArray(xmpSubject)) {
          metadata.keywords = xmpSubject
            .map((k: any) => (typeof k === 'string' ? k : k.description || String(k)))
            .filter(Boolean);
        } else if (typeof xmpSubject === 'object' && (xmpSubject as any).description) {
          const val = (xmpSubject as any).description;
          metadata.keywords = val.includes(',')
            ? val
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [val];
        }
      } else if (iptcKeywords) {
        if (Array.isArray(iptcKeywords)) {
          metadata.keywords = iptcKeywords
            .map((k: any) => (typeof k === 'string' ? k : k.description || String(k)))
            .filter(Boolean);
        } else if (typeof iptcKeywords === 'object' && (iptcKeywords as any).description) {
          const val = (iptcKeywords as any).description;
          metadata.keywords = val.includes(',')
            ? val
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [val];
        }
      } else if (exifKeywords && typeof exifKeywords === 'string') {
        metadata.keywords = exifKeywords
          .split(/[;,]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      const gps = tags.gps;
      if (gps?.Latitude !== undefined && gps?.Longitude !== undefined) {
        metadata.latitude = gps.Latitude;
        metadata.longitude = gps.Longitude;
      }

      // Extract original date taken from DateTimeOriginal
      const dateOriginal = tags.exif?.DateTimeOriginal?.description;
      if (dateOriginal) {
        // EXIF date format is "YYYY:MM:DD HH:MM:SS" — convert to ISO
        // Append 'Z' to treat as UTC so the date doesn't shift due to local timezone
        const isoDate = dateOriginal.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const parsed = new Date(isoDate + 'Z');
        if (!isNaN(parsed.getTime())) {
          metadata.created_date = parsed.toISOString();
        }
      }
    } catch (err) {
      console.warn('Failed to extract EXIF metadata:', err);
    }
    return metadata;
  }

  private async optimizeImage(filePath: string, outputPath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) throw new Error('File not found for optimization.');
      const imgMeta = await sharp(filePath).metadata();
      const format: keyof sharp.FormatEnum = imgMeta.format === 'png' ? 'png' : 'jpeg';
      const width = imgMeta.width && imgMeta.width > 2000 ? 2000 : undefined;
      await sharp(filePath).resize(width).toFormat(format, { quality: 80 }).toFile(outputPath);
      return outputPath;
    } catch (error) {
      console.error('Image optimization failed:', error);
      return filePath;
    }
  }

  public async uploadPhotos(
    request: UploadPhotosRequest
  ): Promise<{ success: boolean; images: UploadedPhoto[] }> {
    const { files, tags: tagsRaw, title = '', description = '', country, clientExifData } = request;
    if (!files || files.length === 0) throw new Error('No files provided for upload');

    const uploadResults: UploadedPhoto[] = [];

    // Process files sequentially to avoid memory/sharp concurrency issues
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Extract EXIF metadata before optimization (which may strip it)
      const serverExif = await this.extractExifMetadata(file.filepath);
      // Merge with client-provided EXIF (client data is fallback when server extraction returns empty,
      // e.g. after canvas resize in the browser strips metadata)
      const clientExif = clientExifData?.[i] || {};
      const exif: ExifMetadata = {
        title: serverExif.title || clientExif.title || undefined,
        keywords: serverExif.keywords?.length
          ? serverExif.keywords
          : clientExif.keywords || undefined,
        latitude: serverExif.latitude ?? clientExif.latitude ?? undefined,
        longitude: serverExif.longitude ?? clientExif.longitude ?? undefined,
      };
      const dateTaken = serverExif.created_date || clientExif.created_date || undefined;
      console.log(
        '[EXIF] Merged metadata for',
        file.newFilename,
        JSON.stringify(exif),
        'created_date:',
        dateTaken
      );

      const effectiveTitle = title || exif.title || '';
      const userTags = tagsRaw
        ? tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const exifTags = exif.keywords || [];
      const mergedTags = [...new Set([...userTags, ...exifTags])];

      // Optimize image
      const optimizedPath = `/tmp/optimized-${file.newFilename}`;
      const finalPath = await this.optimizeImage(file.filepath, optimizedPath);

      // Determine format and content type
      const imgMeta = await sharp(finalPath)
        .metadata()
        .catch(() => ({ format: 'jpeg' as const }));
      const format = imgMeta.format === 'png' ? 'png' : 'jpeg';
      const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';

      // Build S3 key with country folder structure
      const s3Key = this.buildS3Key(ext, country);

      // Upload to S3
      await this.uploadToS3(finalPath, s3Key, contentType);

      // Generate public URL for immediate use
      const publicUrl = this.getPublicUrl(s3Key);

      // Clean up temp files
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

      uploadResults.push({
        public_id: s3Key,
        secure_url: publicUrl,
        url: publicUrl,
        format,
        created_at: new Date().toISOString(),
        created_date: dateTaken || new Date().toISOString(),
        original_filename: file.originalFilename || file.newFilename,
        tags: mergedTags,
        context: { custom: { caption: effectiveTitle, alt: description } },
        exif,
      });
    }

    return { success: true, images: uploadResults };
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
        await client.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [
          name,
        ]);
        const tagRow = await client.query('SELECT id FROM tags WHERE name = $1', [name]);
        const tagId = tagRow.rows[0].id;
        await client.query(
          'INSERT INTO photo_tags (photo_id, tag_id) VALUES ($1, $2) ON CONFLICT (photo_id, tag_id) DO NOTHING',
          [photoId, tagId]
        );
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
    photoId: number,
    caption: string | null,
    tags?: string[],
    cityId?: number | null,
    attractionId?: number | null,
    latitude?: number | null,
    longitude?: number | null,
    stateId?: number | null,
    countryId?: number | null
  ): Promise<{ success: boolean }> {
    const setClauses = ['caption = $1', 'updated_date = NOW()'];
    const params: any[] = [caption];
    let idx = 2;

    if (cityId !== undefined) {
      setClauses.push(`city_id = $${idx++}`);
      params.push(cityId);
    }
    if (attractionId !== undefined) {
      setClauses.push(`attraction_id = $${idx++}`);
      params.push(attractionId);
    }
    if (latitude !== undefined) {
      setClauses.push(`latitude = $${idx++}`);
      params.push(latitude);
    }
    if (longitude !== undefined) {
      setClauses.push(`longitude = $${idx++}`);
      params.push(longitude);
    }
    if (stateId !== undefined) {
      setClauses.push(`state_id = $${idx++}`);
      params.push(stateId);
    }

    // If country_id is explicitly provided, use it directly
    if (countryId !== undefined) {
      setClauses.push(`country_id = $${idx++}`);
      params.push(countryId);

      // Move S3 file to the new country folder
      if (countryId != null) {
        try {
          const photo = await db.get<{ photo_id: string }>(
            'SELECT photo_id FROM photos WHERE id = $1',
            [photoId]
          );
          if (photo?.photo_id) {
            const oldKey = photo.photo_id;
            // Look up new country name
            const country = await db.get<{ name: string }>(
              'SELECT name FROM countries WHERE id = $1',
              [countryId]
            );
            if (country?.name) {
              // Extract extension from old key
              const ext = oldKey.split('.').pop() || 'jpg';
              const newKey = this.buildS3Key(ext, country.name);
              await this.moveS3Object(oldKey, newKey);
              // Update photo_id (S3 key) in the DB
              setClauses.push(`photo_id = $${idx++}`);
              params.push(newKey);
              console.log(`[S3] Moved photo from "${oldKey}" to "${newKey}"`);
            }
          }
        } catch (err) {
          console.warn('[S3] Failed to move photo to new country folder:', err);
        }
      }
    } else if (cityId !== undefined || attractionId !== undefined) {
      // Resolve country_id from city or attraction when not explicitly provided
      let resolvedCountryId: number | null = null;
      const effectiveCityId = cityId !== undefined ? cityId : null;
      const effectiveAttractionId = attractionId !== undefined ? attractionId : null;
      if (effectiveCityId) {
        const city = await db.get<{ country_id: number; state_id: number | null }>(
          'SELECT country_id, state_id FROM cities WHERE id = $1',
          [effectiveCityId]
        );
        resolvedCountryId = city?.country_id || null;
        // Auto-resolve state from city if not explicitly provided
        if (stateId === undefined && city?.state_id) {
          setClauses.push(`state_id = $${idx++}`);
          params.push(city.state_id);
        }
      } else if (effectiveAttractionId) {
        const attr = await db.get<{ country_id: number }>(
          'SELECT country_id FROM attractions WHERE id = $1',
          [effectiveAttractionId]
        );
        resolvedCountryId = attr?.country_id || null;
      }
      setClauses.push(`country_id = $${idx++}`);
      params.push(resolvedCountryId);
    }

    params.push(photoId);
    const result = await db.run(
      `UPDATE photos SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );
    if (result.rowCount === 0) throw new Error('Photo not found.');

    if (tags !== undefined) {
      await this.setTagsForPhoto(photoId, tags);
    }

    return { success: true };
  }

  private async getAllDbPhotos(): Promise<Array<any>> {
    await this.ensureTable();
    const rows = await db.all<any>(
      `SELECT p.id, p.url, p.user_id, p.city_id, p.attraction_id, p.caption, p.created_at, p.photo_id,
              p.latitude, p.longitude, p.created_date, p.updated_date, p.disabled_date, p.country_id, p.state_id,
              p.original_filename,
              c.name as city_name, a.name as attraction_name, s.name as state_name, co.name as country_name
       FROM photos p
       LEFT JOIN cities c ON p.city_id = c.id
       LEFT JOIN attractions a ON p.attraction_id = a.id
       LEFT JOIN states s ON p.state_id = s.id
       LEFT JOIN countries co ON p.country_id = co.id
       WHERE p.disabled_date IS NULL
       ORDER BY p.created_at DESC`
    );
    const result = [];
    for (const row of rows) {
      const url = row.photo_id ? this.getPublicUrl(row.photo_id) : row.url;
      result.push({
        id: row.id,
        url,
        user_id: row.user_id,
        caption: row.caption,
        created_at: row.created_at,
        photo_id: row.photo_id,
        latitude: row.latitude || null,
        longitude: row.longitude || null,
        created_date: row.created_date,
        updated_date: row.updated_date,
        disabled_date: row.disabled_date,
        original_filename: row.original_filename || null,
        city_id: row.city_id || null,
        city_name: row.city_name || null,
        attraction_id: row.attraction_id || null,
        attraction_name: row.attraction_name || null,
        state_id: row.state_id || null,
        state_name: row.state_name || null,
        country_id: row.country_id || null,
        country_name: row.country_name || null,
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
    page?: number;
    limit?: number;
    search?: string;
    noTags?: boolean;
    entityType?: string;
    entityId?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ photos: any[]; total: number }> {
    const {
      page = 1,
      limit = 25,
      search,
      noTags,
      entityType,
      entityId,
      sortBy,
      sortOrder,
    } = params;

    // All photos are now in the database — S3 is just storage, DB is the source of truth
    let photos = await this.getAllDbPhotos();

    if (entityType === 'country') {
      photos = photos.filter((p) => (entityId ? p.country_id === entityId : p.country_id != null));
    } else if (entityType === 'state') {
      photos = photos.filter((p) => (entityId ? p.state_id === entityId : p.state_id != null));
    } else if (entityType === 'city') {
      photos = photos.filter((p) => (entityId ? p.city_id === entityId : p.city_id != null));
    } else if (entityType === 'attraction') {
      photos = photos.filter((p) =>
        entityId ? p.attraction_id === entityId : p.attraction_id != null
      );
    } else if (entityType === 'unassigned') {
      photos = photos.filter(
        (p) =>
          p.city_id == null && p.attraction_id == null && p.country_id == null && p.state_id == null
      );
    }

    if (noTags) {
      photos = photos.filter((p) => !p.tags || p.tags.length === 0);
    }
    if (search) {
      const s = search.toLowerCase();
      photos = photos.filter(
        (p) =>
          (p.caption && p.caption.toLowerCase().includes(s)) ||
          (p.photo_id && p.photo_id.toLowerCase().includes(s)) ||
          (p.entity_name && p.entity_name.toLowerCase().includes(s)) ||
          (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(s)))
      );
    }

    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'created_date') {
      photos.sort((a, b) => {
        const aDate = a.created_date ? new Date(a.created_date).getTime() : 0;
        const bDate = b.created_date ? new Date(b.created_date).getTime() : 0;
        return (aDate - bDate) * order;
      });
    } else if (sortBy === 'updated_date') {
      photos.sort((a, b) => {
        const aDate = a.updated_date ? new Date(a.updated_date).getTime() : 0;
        const bDate = b.updated_date ? new Date(b.updated_date).getTime() : 0;
        return (aDate - bDate) * order;
      });
    } else if (sortBy === 'created_at') {
      photos.sort(
        (a, b) =>
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * order
      );
    } else {
      photos.sort(
        (a, b) =>
          (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) *
          (sortOrder === 'asc' ? -1 : 1)
      );
    }

    const total = photos.length;
    const offset = (page - 1) * limit;
    const paginated = photos.slice(offset, offset + limit);

    const result = paginated.map((p) => ({
      ...p,
      source: 'database',
      in_database: true,
      in_cloudinary: false,
    }));

    return { photos: result, total };
  }

  public async removePhoto(request: RemovePhotoRequest): Promise<{ success: boolean }> {
    const { entityType, entityId, photoId } = request;
    if (!['cities', 'attractions'].includes(entityType))
      throw new Error('Invalid entityType. Must be "cities" or "attractions".');
    if (!entityId || !photoId) throw new Error('Missing required fields: entityId or photoId.');
    const column = entityType === 'cities' ? 'city_id' : 'attraction_id';
    const result = await db.run(
      `UPDATE photos SET disabled_date = NOW() WHERE id = $1 AND ${column} = $2 AND disabled_date IS NULL`,
      [photoId, Number(entityId)]
    );
    if (result.rowCount === 0)
      throw new Error('Photo not found or does not belong to this entity.');
    return { success: true };
  }

  /**
   * Get all photos that have location data (own lat/lng or from their associated city/attraction).
   * Returns photos with resolved coordinates for map display.
   */
  public async getPhotosForMap(opts?: { cityId?: number; attractionId?: number }): Promise<
    Array<{
      id: number;
      url: string;
      caption: string | null;
      latitude: number;
      longitude: number;
      city_name: string | null;
      attraction_name: string | null;
      country_name: string | null;
      state_name: string | null;
      photo_id: string | null;
      created_at: string;
    }>
  > {
    await this.ensureTable();

    const conditions = ['p.disabled_date IS NULL'];
    const params: number[] = [];

    if (opts?.cityId) {
      params.push(opts.cityId);
      conditions.push(`p.city_id = $${params.length}`);
    }
    if (opts?.attractionId) {
      params.push(opts.attractionId);
      conditions.push(`p.attraction_id = $${params.length}`);
    }

    const rows = await db.all<any>(
      `SELECT p.id, p.url, p.photo_id, p.caption, p.created_at,
              p.latitude AS photo_lat, p.longitude AS photo_lng,
              c.name AS city_name, c.lat AS city_lat, c.lng AS city_lng,
              a.name AS attraction_name, a.lat AS attraction_lat, a.lng AS attraction_lng,
              s.name AS state_name, co.name AS country_name
       FROM photos p
       LEFT JOIN cities c ON p.city_id = c.id
       LEFT JOIN attractions a ON p.attraction_id = a.id
       LEFT JOIN states s ON p.state_id = s.id
       LEFT JOIN countries co ON p.country_id = co.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC`,
      params
    );
    const result = [];
    for (const row of rows) {
      // Resolve lat/lng: prefer photo's own coordinates, fallback to city, then attraction
      const lat = row.photo_lat || row.city_lat || row.attraction_lat;
      const lng = row.photo_lng || row.city_lng || row.attraction_lng;
      if (!lat || !lng) continue; // skip photos without any location
      const url = row.photo_id ? this.getPublicUrl(row.photo_id) : row.url;
      result.push({
        id: row.id,
        url,
        caption: row.caption || null,
        latitude: lat,
        longitude: lng,
        city_name: row.city_name || null,
        attraction_name: row.attraction_name || null,
        country_name: row.country_name || null,
        state_name: row.state_name || null,
        photo_id: row.photo_id || null,
        created_at: row.created_at,
      });
    }
    return result;
  }

  public async deletePhotoById(id: number): Promise<{ success: boolean }> {
    const photo = await db.get<{ id: number; photo_id: string }>(
      'SELECT id, photo_id FROM photos WHERE id = $1',
      [id]
    );
    if (!photo) throw new Error('Photo not found.');

    // Delete from S3 if it has an S3 key
    if (photo.photo_id) {
      try {
        await this.deleteFromS3(photo.photo_id);
      } catch (err) {
        console.warn('Failed to delete from S3:', err);
      }
    }

    // Delete tags and photo record
    await db.run('DELETE FROM photo_tags WHERE photo_id = $1', [id]);
    await db.run('DELETE FROM photos WHERE id = $1', [id]);

    return { success: true };
  }
}

export const photoService = PhotoService.getInstance();
