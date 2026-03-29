import { Router, Request, Response } from 'express';
import axios from 'axios';
import { tagService } from '../services/tagService';
import { db } from '../db';

const router = Router();

// GET /api/tags/total-count - Get total count of all tags in database
router.get('/api/tags/total-count', async (_req: Request, res: Response) => {
  try {
    console.log('GET /api/tags/total-count called');
    const result = await tagService.getTotalTagCount();
    console.log('Total tag count result:', result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch total tag count:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch total tag count';
    return res.status(500).json({ error: message });
  }
});

// GET /api/tags - Multi-purpose endpoint:
// - ?filterOptions=true - Get available years and countries for filters
// - ?year=2024&countryId=1 - Get tag frequencies filtered by year and/or country
// - ?query=... - Search tags by query
router.get('/api/tags', async (req: Request, res: Response) => {
  try {
    // Handle filter options request
    if (req.query.filterOptions === 'true') {
      const requestedFields = req.query.fields
        ? String(req.query.fields).split(',')
        : ['years', 'countries', 'states', 'cities', 'attractions'];

      const [years, countries, states, cities, attractions] = await Promise.all([
        requestedFields.includes('years')
          ? tagService.getAvailableYears()
          : Promise.resolve({ years: [] }),
        requestedFields.includes('countries')
          ? tagService.getAvailableCountries()
          : Promise.resolve({ countries: [] }),
        requestedFields.includes('states')
          ? tagService.getAvailableStates()
          : Promise.resolve({ states: [] }),
        requestedFields.includes('cities')
          ? tagService.getAvailableCities()
          : Promise.resolve({ cities: [] }),
        requestedFields.includes('attractions')
          ? tagService.getAvailableAttractions()
          : Promise.resolve({ attractions: [] }),
      ]);

      return res.status(200).json({
        years: years.years,
        countries: countries.countries,
        states: states.states,
        cities: cities.cities,
        attractions: attractions.attractions,
      });
    }

    // Handle tag frequency filtering (for word cloud)
    if (
      req.query.year ||
      req.query.countryId ||
      req.query.stateId ||
      req.query.cityId ||
      req.query.attractionId
    ) {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      const countryId = req.query.countryId ? parseInt(String(req.query.countryId), 10) : undefined;
      const stateId = req.query.stateId ? parseInt(String(req.query.stateId), 10) : undefined;
      const cityId = req.query.cityId ? parseInt(String(req.query.cityId), 10) : undefined;
      const attractionId = req.query.attractionId
        ? parseInt(String(req.query.attractionId), 10)
        : undefined;

      console.log('GET /api/tags with filters:', {
        year,
        countryId,
        stateId,
        cityId,
        attractionId,
      });
      const result = await tagService.getTagFrequencies(
        year,
        countryId,
        stateId,
        cityId,
        attractionId
      );
      return res.status(200).json(result);
    }

    // Handle regular tag search
    const rawQuery = req.query.query;
    if (!rawQuery) {
      // No query provided, return all tags with their frequencies
      const result = await tagService.getTagFrequencies();
      console.log('All tags result:', result);
      return res.status(200).json(result);
    }

    const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    const result = await tagService.searchTags(query as string);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags
router.post('/api/tags', async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;

    await tagService.addTags(tags);
    return res.status(200).json({ message: 'Tags added successfully' });
  } catch (error) {
    console.error('Failed to add tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to add tags';
    return res
      .status(error instanceof Error && message.includes('Invalid') ? 400 : 500)
      .json({ error: message });
  }
});

// POST /api/tags/sync
router.post('/api/tags/sync', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.syncTagsFromCloudinary();

    return res.status(200).json({
      message: 'Tags synced successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to sync tags from Cloudinary:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch and store tags';
    const details = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      error: message,
      details,
    });
  }
});

// POST /api/tags/suggest
router.post('/api/tags/suggest', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageUrl } = req.body || {};

    let base64 = imageBase64;

    // If a URL is provided instead of base64, fetch the image server-side
    if (!base64 && imageUrl) {
      try {
        const imgResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
        const b64 = Buffer.from(imgResponse.data).toString('base64');
        base64 = `data:${contentType};base64,${b64}`;
      } catch (fetchErr) {
        console.error(
          'Failed to fetch image from URL:',
          imageUrl,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        return res.status(400).json({ error: 'Failed to fetch image from URL' });
      }
    }

    if (!base64) {
      return res.status(400).json({ error: 'No image provided. Send imageBase64 or imageUrl.' });
    }

    const result = await tagService.suggestTags(base64);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to suggest tags:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Server error';

    if (message.includes('Missing')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// POST /api/tags/cleanup
router.post('/api/tags/cleanup', async (_req: Request, res: Response) => {
  try {
    const result = await tagService.cleanupTags();
    return res.status(200).json({
      message: 'Tags cleaned up successfully',
      ...result,
    });
  } catch (error) {
    console.error('Failed to clean up tags:', error);
    const message = error instanceof Error ? error.message : 'Failed to clean up tags';
    return res.status(500).json({ error: message });
  }
});

// POST /api/tags/merge
// Body: { fromId?, fromName?, toId?, toName?, createTarget?: boolean, dryRun?: boolean }
router.post('/api/tags/merge', async (req: Request, res: Response) => {
  const { fromId, fromName, toId, toName, createTarget, dryRun } = req.body || {};

  if (!fromId && !fromName) {
    return res.status(400).json({ error: 'Missing fromId or fromName' });
  }
  if (!toId && !toName && !createTarget) {
    return res.status(400).json({ error: 'Missing toId or toName (or set createTarget)' });
  }

  const client = await db.pool.connect();
  try {
    // Resolve source tag
    let source;
    if (fromId) {
      const r = await client.query('SELECT id, name FROM tags WHERE id = $1', [fromId]);
      source = r.rows[0];
    } else {
      const r = await client.query('SELECT id, name FROM tags WHERE name = $1', [fromName]);
      source = r.rows[0];
    }
    if (!source) return res.status(404).json({ error: 'Source tag not found' });

    // Resolve or create target tag
    let target;
    if (toId) {
      const r = await client.query('SELECT id, name FROM tags WHERE id = $1', [toId]);
      target = r.rows[0];
    } else if (toName) {
      const r = await client.query('SELECT id, name FROM tags WHERE name = $1', [toName]);
      target = r.rows[0];
      if (!target && createTarget) {
        const ins = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id, name', [
          toName,
        ]);
        target = ins.rows[0];
      }
    }
    if (!target) return res.status(404).json({ error: 'Target tag not found' });

    const sId = source.id;
    const tId = target.id;

    if (sId === tId)
      return res.status(200).json({ message: 'Source and target are the same, nothing to do' });

    // Counts for preview
    const moveCountRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM photo_tags WHERE tag_id = $1 AND photo_id NOT IN (SELECT photo_id FROM photo_tags WHERE tag_id = $2)`,
      [sId, tId]
    );
    const dupCountRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM photo_tags WHERE tag_id = $1 AND photo_id IN (SELECT photo_id FROM photo_tags WHERE tag_id = $2)`,
      [sId, tId]
    );

    const moveCount = moveCountRes.rows[0]?.cnt ?? 0;
    const dupCount = dupCountRes.rows[0]?.cnt ?? 0;

    if (dryRun) {
      return res
        .status(200)
        .json({ from: source, to: target, moveCount, duplicateCount: dupCount });
    }

    // Perform transactional merge
    await client.query('BEGIN');
    try {
      const moveRes = await client.query(
        `UPDATE photo_tags SET tag_id = $1 WHERE tag_id = $2 AND photo_id NOT IN (SELECT photo_id FROM photo_tags WHERE tag_id = $1)`,
        [tId, sId]
      );
      const delDup = await client.query('DELETE FROM photo_tags WHERE tag_id = $1', [sId]);

      // Try to delete the source tag. If the first delete affects 0 rows, attempt fallback by name
      let delTag = await client.query('DELETE FROM tags WHERE id = $1', [sId]);
      if (delTag.rowCount === 0) {
        // fallback: try deleting by name (handles situations where id lookup mismatched)
        try {
          delTag = await client.query('DELETE FROM tags WHERE id = $1 OR name = $2', [
            sId,
            source.name,
          ]);
        } catch (e) {
          // swallow and handle below
        }
      }

      await client.query('COMMIT');

      return res.status(200).json({
        message: 'Merge completed',
        moved: moveRes.rowCount,
        deletedDuplicates: delDup.rowCount,
        deletedTags: delTag.rowCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Merge failed:', err);
      return res
        .status(500)
        .json({ error: 'Merge failed', details: err instanceof Error ? err.message : err });
    }
  } catch (err) {
    console.error('Error in /api/tags/merge:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});

// Simple HTML UI to call the merge endpoint
router.get('/merge-tags', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Merge Tags</title>
  <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:20px}label{display:block;margin-top:8px}</style>
</head>
<body>
  <h1>Merge Tags</h1>
  <form id="mergeForm">
    <label>From Tag Name: <input name="fromName" /></label>
    <label>From Tag ID: <input name="fromId" type="number" /></label>
    <label>To Tag Name: <input name="toName" /></label>
    <label>To Tag ID: <input name="toId" type="number" /></label>
    <label><input type="checkbox" name="createTarget" /> Create target if missing</label>
    <label><input type="checkbox" name="dryRun" checked /> Dry run</label>
    <div style="margin-top:12px">
      <button type="submit">Submit</button>
    </div>
  </form>
  <pre id="out" style="white-space:pre-wrap;margin-top:12px;border:1px solid #ddd;padding:8px;background:#fafafa"></pre>
  <script>
    const form = document.getElementById('mergeForm');
    const out = document.getElementById('out');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {};
      if (fd.get('fromId')) body.fromId = Number(fd.get('fromId'));
      if (fd.get('fromName')) body.fromName = fd.get('fromName');
      if (fd.get('toId')) body.toId = Number(fd.get('toId'));
      if (fd.get('toName')) body.toName = fd.get('toName');
      if (fd.get('createTarget')) body.createTarget = true;
      if (fd.get('dryRun')) body.dryRun = true;

      out.textContent = 'Working...';
      try {
        const resp = await fetch('/api/tags/merge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await resp.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = String(err);
      }
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
