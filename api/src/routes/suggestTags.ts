import { Router, Request, Response } from 'express';

const router = Router();

function stripDataUrlPrefix(b64: string) {
  const i = b64.indexOf(';base64,');
  return i !== -1 ? b64.slice(i + ';base64,'.length) : b64;
}

function normTag(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

// POST /api/tags/suggest
router.post('/api/tags/suggest', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GOOGLE_API_KEY' });
    }

    // Vision needs RAW base64 (no data URL prefix)
    const content = stripDataUrlPrefix(imageBase64);

    // Structure Vision requires
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

    const vjson = await vr.json() as { error?: { message: string }; responses?: any[] };

    if (!vr.ok) {
      const msg = vjson?.error?.message || 'Vision API error';
      return res.status(400).json({ error: msg });
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
      .map(normTag)
      .filter(Boolean);

    return res.status(200).json({ tags });
  } catch (err: any) {
    console.error('tags/suggest error', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
});

export default router;
