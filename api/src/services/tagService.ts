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
  private cachedModelId: string | null = null;

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
   * Dynamically pick an available free Gemini model that supports generateContent.
   * Caches the result so subsequent calls skip the list request.
   */
  private async pickFreeGenerateModel(apiKey: string): Promise<string> {
    if (this.cachedModelId) return this.cachedModelId;
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!resp.ok) {
      // Fall back to flash if listing fails
      return 'gemini-2.0-flash';
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await resp.json()) as { models?: any[] };
    const models = json?.models ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const free = models.find((m: any) => {
      const supports =
        m.supportedGenerationMethods?.includes('generateContent') ||
        m.availableMethods?.includes('generateContent');
      const isPro = /(^|[-])pro($|[-])/i.test(m.baseModelId || m.name || '');
      return supports && !isPro;
    });
    if (!free) return 'gemini-2.0-flash';
    const id =
      free.baseModelId ||
      (free.name?.startsWith('models/') ? free.name.slice('models/'.length) : free.name);
    this.cachedModelId = id || 'gemini-2.0-flash';
    return this.cachedModelId!;
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

    // Dynamically pick an available free model (avoids hitting quota on a single model)
    const modelId = await this.pickFreeGenerateModel(apiKey);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      let errorMessage = `Gemini API error: ${errorText}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {
        // not JSON, use raw text
      }
      throw new Error(errorMessage);
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
    const rows = await db.all<{ id: number; name: string }>(query);
    return { countries: rows };
  }

  /**
   * Get all available states from photos
   */
  public async getAvailableStates(): Promise<{
    states: Array<{ id: number; name: string }>;
  }> {
    const query = `
      SELECT DISTINCT s.id, s.name
      FROM states s
      INNER JOIN photos p ON s.id = p.state_id
      WHERE p.state_id IS NOT NULL
      ORDER BY s.name ASC
    `;
    const rows = await db.all<{ id: number; name: string }>(query);
    return { states: rows };
  }

  /**
   * Get all available cities from photos
   */
  public async getAvailableCities(): Promise<{
    cities: Array<{ id: number; name: string }>;
  }> {
    const query = `
      SELECT DISTINCT c.id, c.name
      FROM cities c
      INNER JOIN photos p ON c.id = p.city_id
      WHERE p.city_id IS NOT NULL
      ORDER BY c.name ASC
    `;
    const rows = await db.all<{ id: number; name: string }>(query);
    return { cities: rows };
  }

  /**
   * Get all available attractions from photos
   */
  public async getAvailableAttractions(): Promise<{
    attractions: Array<{ id: number; name: string }>;
  }> {
    const query = `
      SELECT DISTINCT a.id, a.name
      FROM attractions a
      INNER JOIN photos p ON a.id = p.attraction_id
      WHERE p.attraction_id IS NOT NULL
      ORDER BY a.name ASC
    `;
    const rows = await db.all<{ id: number; name: string }>(query);
    return { attractions: rows };
  }

  /**
   * Get tag frequency data for word cloud with optional filters
   */
  public async getTagFrequencies(
    year?: number,
    countryId?: number,
    stateId?: number,
    cityId?: number,
    attractionId?: number
  ): Promise<{ tags: Array<{ tag: string; count: number }> }> {
    await this.ensureTable();

    let query = `SELECT t.name, COUNT(pt.photo_id) as count
       FROM tags t`;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    const hasFilters = year || countryId || stateId || cityId || attractionId;

    if (hasFilters) {
      query += ` INNER JOIN photo_tags pt ON pt.tag_id = t.id
       INNER JOIN photos p ON pt.photo_id = p.id`;

      if (year) {
        params.push(year);
        conditions.push(`EXTRACT(YEAR FROM p.created_date) = $${params.length}`);
      }
      if (countryId) {
        params.push(countryId);
        conditions.push(`p.country_id = $${params.length}`);
      }
      if (stateId) {
        params.push(stateId);
        conditions.push(`p.state_id = $${params.length}`);
      }
      if (cityId) {
        params.push(cityId);
        conditions.push(`p.city_id = $${params.length}`);
      }
      if (attractionId) {
        params.push(attractionId);
        conditions.push(`p.attraction_id = $${params.length}`);
      }
    } else {
      query += ` LEFT JOIN photo_tags pt ON pt.tag_id = t.id`;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY t.id, t.name ORDER BY count DESC`;

    if (!hasFilters) {
      query += ` LIMIT 150`;
    }

    console.log('Tag frequency query:', query);
    console.log('Parameters:', params);

    const rows = await db.all<{ name: string; count: string }>(query, params);

    return {
      tags: rows.map((r) => ({
        tag: r.name,
        count: parseInt(String(r.count), 10) || 0,
      })),
    };
  }
}

export const tagService = TagService.getInstance();
