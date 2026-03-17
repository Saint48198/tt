import { db } from '../db';
import axios, { AxiosResponse } from 'axios';

interface Tag {
  name: string;
}

interface CloudinaryResource {
  tags?: string[];
}

class TagService {
  private static instance: TagService;

  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private initialized = false;

  private constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  }

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);
    this.initialized = true;
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
  public async searchTags(query: string): Promise<{ tags: string[] }> {
    if (!query || typeof query !== 'string') throw new Error('Invalid query parameter');
    await this.ensureTable();

    // Convert wildcard query to regex (* -> .* , ? -> .), case-insensitive
    const regexPattern = query.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(regexPattern, 'i');

    const rows = await db.all<Tag>('SELECT name FROM tags');
    const filteredTags = rows.map((r) => r.name).filter((tag) => regex.test(tag));
    return { tags: filteredTags };
  }

  /**
   * Add multiple tags to the database
   * Uses INSERT OR IGNORE to handle duplicates gracefully
   */
  public async addTags(tags: string[]): Promise<{ success: boolean }> {
    if (!Array.isArray(tags) || tags.length === 0) throw new Error('Invalid tags data');
    await this.ensureTable();

    for (const tag of tags) {
      await db.run('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [tag]);
    }
    return { success: true };
  }

  /**
   * Sync tags from Cloudinary and store them in the database
   */
  public async syncTagsFromCloudinary(): Promise<{ count: number }> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Missing Cloudinary environment variables');
    }
    await this.ensureTable();

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
        { auth: { username: this.apiKey, password: this.apiSecret } }
      );

      const resources = response.data?.resources ?? [];
      resources.forEach((asset: CloudinaryResource) => {
        (asset.tags || []).forEach((tag: string) => allTags.add(tag));
      });
      nextCursor = response.data?.next_cursor || null;
    } while (nextCursor);

    for (const tag of allTags) {
      await db.run('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [tag]);
    }
    return { count: allTags.size };
  }

  /**
   * Suggest tags using Google Vision API
   * Analyzes an image and returns suggested tags
   */
  public async suggestTags(imageBase64: string): Promise<{ tags: string[] }> {
    if (!imageBase64 || typeof imageBase64 !== 'string') throw new Error('Missing imageBase64');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

    // Gemini needs RAW base64 (no data URL prefix)
    const content = this.stripDataUrlPrefix(imageBase64);
    const mimeType = this.detectMimeType(imageBase64);

    const prompt = [
      'Analyze this image and suggest relevant tags for categorizing it.',
      'Return descriptive, single-word or hyphenated tags (e.g. "sunset", "beach", "old-town").',
      'Include tags for: objects, scene type, colors, mood, location type, activities.',
      'Return 10-20 tags. Return ONLY a JSON array of lowercase strings. No extra text.',
    ].join(' ');

    const body = {
      contents: [
        {
          parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: content } }],
        },
      ],
    };

    // Use gemini-2.0-flash as default model
    const modelId = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Gemini API error: ${errorText}`);
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

    let tags: string[] = [];
    try {
      tags = JSON.parse(cleaned);
    } catch {
      tags = cleaned
        .split('\n')
        .map((s: string) => s.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
    }

    tags = tags.map((tag) => this.normalizeTag(tag)).filter(Boolean);

    return { tags };
  }

  /**
   * Detect MIME type from base64 data URL prefix
   */
  private detectMimeType(b64: string): string {
    const match = b64.match(/^data:([^;]+);base64,/);
    return match?.[1] || 'image/jpeg';
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

  /**
   * Get total count of all tags in database
   */
  public async getTotalTagCount(): Promise<{ totalCount: number }> {
    const query = `SELECT COUNT(*) as total FROM tags`;

    console.log('Executing query:', query);
    const result = await db.get<{ total: number }>(query);
    const totalCount = result?.total || 0;
    console.log('Total tag count:', totalCount);

    return { totalCount };
  }

  /**
   * Get all available years from photos
   */
  public async getAvailableYears(): Promise<{ years: number[] }> {
    const query = `
      SELECT DISTINCT EXTRACT(YEAR FROM created_date)::int as year
      FROM photos
      WHERE created_date IS NOT NULL
      ORDER BY year DESC
    `;

    console.log('Executing query:', query);
    const rows = await db.all<{ year: number }>(query);
    console.log('Years query result:', rows);
    const years = rows.map((r) => r.year).filter((y) => y > 0);
    console.log('Filtered years:', years);

    return { years };
  }

  /**
   * Get all available countries from photos
   */
  public async getAvailableCountries(): Promise<{
    countries: Array<{ id: number; name: string }>;
  }> {
    const query = `
      SELECT DISTINCT c.id, c.name
      FROM countries c
      INNER JOIN photos p ON c.id = p.country_id
      WHERE p.country_id IS NOT NULL
      ORDER BY c.name ASC
    `;

    console.log('Executing query:', query);
    const rows = await db.all<{ id: number; name: string }>(query);
    console.log('Countries query result:', rows);

    return { countries: rows };
  }

  /**
   * Get tag frequency data for word cloud with optional filters
   * Returns all tags with their frequency count across all photos
   * Can be filtered by year and/or country ID
   */
  public async getTagFrequencies(
    year?: number,
    countryId?: number
  ): Promise<{ tags: Array<{ tag: string; count: number }> }> {
    await this.ensureTable();

    let query = `SELECT t.name, COUNT(pt.photo_id) as count
       FROM tags t`;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // If we have filters, use INNER JOIN to only get photos matching the criteria
    if (year || countryId) {
      query += ` INNER JOIN photo_tags pt ON pt.tag_id = t.id
       INNER JOIN photos p ON pt.photo_id = p.id`;

      // Add year filter if provided
      if (year) {
        params.push(year);
        conditions.push(`EXTRACT(YEAR FROM p.created_date) = $${params.length}`);
      }

      // Add country ID filter if provided
      if (countryId) {
        params.push(countryId);
        conditions.push(`p.country_id = $${params.length}`);
      }
    } else {
      // If no filters, use LEFT JOIN to get all tags even if unused
      query += ` LEFT JOIN photo_tags pt ON pt.tag_id = t.id`;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY t.id, t.name
       ORDER BY count DESC`;

    // Limit to 150 tags when no filters are applied
    if (!year && !countryId) {
      query += ` LIMIT 150`;
    }

    console.log('Tag frequency query:', query);
    console.log('Parameters:', params);

    const rows = await db.all<{ name: string; count: string }>(query, params);

    console.log('Tag frequency results:', rows);

    return {
      tags: rows.map((r) => ({
        tag: r.name,
        count: parseInt(String(r.count), 10) || 0,
      })),
    };
  }
}

export const tagService = TagService.getInstance();
