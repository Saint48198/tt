import { Router, Request, Response } from 'express';

const router = Router();

type ReqBody = {
  imageBase64: string; // raw base64 (no data: prefix)
  mimeType?: string; // e.g. "image/jpeg"
  hints?: {
    tags?: string[];
    city?: string;
    state?: string;
    country?: string;
    datetimeOriginal?: string;
  };
};

// Simple in-memory cache for the selected model
let cachedModelId: string | null = null;

async function pickFreeGenerateModel(apiKey: string): Promise<string> {
  if (cachedModelId) return cachedModelId;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!resp.ok) throw new Error(`ListModels failed: ${resp.statusText}`);

  const json = await resp.json() as { models?: any[] };
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

  cachedModelId = id;
  return id;
}

// POST /api/suggest-titles
router.post('/api/suggest-titles', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', hints = {} } =
      (req.body ?? {}) as ReqBody;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 required' });
    }

    // Choose model dynamically (ListModels -> first that supports generateContent)
    const modelId = await pickFreeGenerateModel(apiKey);
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
      return res.status(502).json({ error: 'Gemini call failed', detail: t });
    }

    const data = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
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

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('suggest-titles error:', err);
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
