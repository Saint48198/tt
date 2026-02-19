import { db } from '../db';
import axios, { AxiosResponse } from 'axios';

interface Tag {
  name: string;
}

interface CloudinaryResource {
  tags?: string[];
}

interface VisionResponse {
  error?: { message: string };
  responses?: any[];
}

class TagService {
  private static instance: TagService;
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  private constructor() {
    // Private constructor prevents direct instantiation
    // Ensure table exists (same behavior as Next.js file-level exec)
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )
    `);

    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  }

  public static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  /**
   * Search tags by query pattern
   * Supports wildcard patterns: * matches any characters, ? matches single character
   */
  public searchTags(query: string): { tags: string[] } {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query parameter');
    }

    // Convert wildcard query to regex (* -> .* , ? -> .), case-insensitive
    const regexPattern = query
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern, 'i');

    const rows = db.prepare('SELECT name FROM tags').all() as Tag[];
    const allTags = rows.map((row) => row.name);
    const filteredTags = allTags.filter((tag) => regex.test(tag));

    return { tags: filteredTags };
  }

  /**
   * Add multiple tags to the database
   * Uses INSERT OR IGNORE to handle duplicates gracefully
   */
  public addTags(tags: string[]): { success: boolean } {
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error('Invalid tags data');
    }

    const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');

    const insertTransaction = db.transaction((items: string[]) => {
      items.forEach((tag) => insertStmt.run(tag));
    });

    insertTransaction(tags);

    return { success: true };
  }

  /**
   * Sync tags from Cloudinary and store them in the database
   */
  public async syncTagsFromCloudinary(): Promise<{ count: number }> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Missing Cloudinary environment variables');
    }

    let nextCursor: string | null = null;
    const allTags = new Set<string>();

    do {
      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/search`;

      const response: AxiosResponse = await axios.post(
        url,
        {
          expression: 'resource_type:image',
          with_field: 'tags',
          max_results: 500,
          next_cursor: nextCursor,
        },
        {
          auth: { username: this.apiKey, password: this.apiSecret },
        }
      );

      const resources = response.data?.resources ?? [];
      resources.forEach((asset: CloudinaryResource) => {
        (asset.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      nextCursor = response.data?.next_cursor || null;
    } while (nextCursor);

    const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');

    const insertTx = db.transaction((tags: string[]) => {
      tags.forEach((tag) => insertStmt.run(tag));
    });

    insertTx(Array.from(allTags));

    return { count: allTags.size };
  }

  /**
   * Suggest tags using Google Vision API
   * Analyzes an image and returns suggested tags
   */
  public async suggestTags(imageBase64: string): Promise<{ tags: string[] }> {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Missing imageBase64');
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GOOGLE_API_KEY');
    }

    // Vision needs RAW base64 (no data URL prefix)
    const content = this.stripDataUrlPrefix(imageBase64);

    // Structure Vision API requires
    const visionBody = {
      requests: [
        {
          image: { content },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 20 },
            { type: 'WEB_DETECTION', maxResults: 10 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          ],
        },
      ],
    };

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const vr = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionBody),
    });

    const vjson = (await vr.json()) as VisionResponse;

    if (!vr.ok) {
      const msg = vjson?.error?.message || 'Vision API error';
      throw new Error(msg);
    }

    const resp = vjson?.responses?.[0] ?? {};

    const labelTags: string[] = (resp.labelAnnotations ?? []).map(
      (a: any) => a.description
    );

    const webGuess: string[] = (resp.webDetection?.bestGuessLabels ?? []).map(
      (x: any) => x.label
    );

    const webEntities: string[] = (resp.webDetection?.webEntities ?? [])
      .filter((e: any) => !!e.description)
      .map((e: any) => e.description);

    const tags = Array.from(new Set([...labelTags, ...webGuess, ...webEntities]))
      .map((tag) => this.normalizeTag(tag))
      .filter(Boolean);

    return { tags };
  }

  /**
   * Strip data URL prefix from base64 string
   */
  private stripDataUrlPrefix(b64: string): string {
    const i = b64.indexOf(';base64,');
    return i !== -1 ? b64.slice(i + ';base64,'.length) : b64;
  }

  /**
   * Normalize tag string
   */
  private normalizeTag(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  }
}

export const tagService = TagService.getInstance();

