#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

// Simple CLI to merge tags in the database.
// Usage examples:
//   node tools/merge-tags.js --from "old tag" --to "new-tag" --dry-run
//   node tools/merge-tags.js --from-id 12 --to-id 3 --confirm
//   node tools/merge-tags.js --from "old tag" --to "new-tag" --create-target --confirm

const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--from' && args[i + 1]) {
      out.from = args[++i];
    } else if (a === '--to' && args[i + 1]) {
      out.to = args[++i];
    } else if (a === '--from-id' && args[i + 1]) {
      out.fromId = Number(args[++i]);
    } else if (a === '--to-id' && args[i + 1]) {
      out.toId = Number(args[++i]);
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--create-target') {
      out.createTarget = true;
    } else if (a === '--confirm') {
      out.confirm = true;
    } else if (a === '--verbose') {
      out.verbose = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function helpAndExit(code = 0) {
  console.log(`merge-tags.js - Merge a tag into another tag and update photo_tags

Usage:
  node tools/merge-tags.js --from "old tag" --to "new tag" [--dry-run] [--create-target] [--confirm]
  node tools/merge-tags.js --from-id 12 --to-id 3 [--dry-run] [--confirm]

Options:
  --from         Source tag name to merge (string)
  --to           Target tag name to merge into (string)
  --from-id      Source tag id to merge (numeric)
  --to-id        Target tag id to merge (numeric)
  --dry-run      Show what would change, don't modify the database
  --create-target Create the target tag if it does not exist
  --confirm      Actually perform the merge (without this script only shows info unless --dry-run omitted)
  --verbose      More output
  --help, -h     Show this help

Notes:
  - The script uses DATABASE_URL environment variable or falls back to postgresql://localhost:5432/trip_tracker
  - The operation is performed inside a transaction for safety.
`);
  process.exit(code);
}

async function main() {
  const opts = parseArgs();
  if (opts.help) return helpAndExit(0);

  if (!opts.from && !opts.fromId) {
    console.error('Missing --from or --from-id');
    return helpAndExit(2);
  }
  if (!opts.to && !opts.toId && !opts.createTarget) {
    console.error('Missing --to or --to-id (or pass --create-target to create it)');
    return helpAndExit(2);
  }

  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker';
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      // Resolve source tag
      let fromRow;
      if (opts.fromId) {
        const res = await client.query('SELECT id, name FROM tags WHERE id = $1', [opts.fromId]);
        fromRow = res.rows[0];
      } else {
        const res = await client.query('SELECT id, name FROM tags WHERE name = $1', [opts.from]);
        fromRow = res.rows[0];
      }
      if (!fromRow) {
        console.error('Source tag not found');
        process.exit(3);
      }

      // Resolve/ensure target tag
      let toRow;
      if (opts.toId) {
        const res = await client.query('SELECT id, name FROM tags WHERE id = $1', [opts.toId]);
        toRow = res.rows[0];
      } else if (opts.to) {
        const res = await client.query('SELECT id, name FROM tags WHERE name = $1', [opts.to]);
        toRow = res.rows[0];
        if (!toRow && opts.createTarget) {
          const insert = await client.query(
            'INSERT INTO tags (name) VALUES ($1) RETURNING id, name',
            [opts.to]
          );
          toRow = insert.rows[0];
          if (opts.verbose) console.log('Created target tag:', toRow);
        }
      }

      if (!toRow) {
        console.error('Target tag not found. Use --create-target to create it.');
        process.exit(4);
      }

      const fromId = fromRow.id;
      const toId = toRow.id;

      if (fromId === toId) {
        console.log('Source and target are the same tag. Nothing to do.');
        process.exit(0);
      }

      // Dry-run queries to show counts
      const willMoveRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM photo_tags WHERE tag_id = $1 AND photo_id NOT IN (SELECT photo_id FROM photo_tags WHERE tag_id = $2)`,
        [fromId, toId]
      );
      const willDeleteDuplicatesRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM photo_tags WHERE tag_id = $1 AND photo_id IN (SELECT photo_id FROM photo_tags WHERE tag_id = $2)`,
        [fromId, toId]
      );
      const willDeleteTagRes = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM tags WHERE id = $1',
        [fromId]
      );

      const moveCount = willMoveRes.rows[0].cnt || 0;
      const deleteDupCount = willDeleteDuplicatesRes.rows[0].cnt || 0;
      const tagExists = (willDeleteTagRes.rows[0].cnt || 0) > 0;

      console.log(
        `About to merge tag '${fromRow.name}' (id=${fromId}) into '${toRow.name}' (id=${toId})`
      );
      console.log(` - photo_tags that will be moved to target: ${moveCount}`);
      console.log(` - photo_tags duplicates that will be removed: ${deleteDupCount}`);
      console.log(` - source tag exists: ${tagExists}`);

      if (opts.dryRun) {
        console.log('Dry run: no changes made. Use --confirm to perform the merge.');
        process.exit(0);
      }

      if (!opts.confirm) {
        console.log(
          'Not confirmed. Re-run with --confirm to perform the merge, or --dry-run to preview.'
        );
        process.exit(0);
      }

      // Perform the merge inside a transaction
      await client.query('BEGIN');
      try {
        // 1) Move photo_tags that don't collide
        const moveRes = await client.query(
          `UPDATE photo_tags SET tag_id = $1 WHERE tag_id = $2 AND photo_id NOT IN (SELECT photo_id FROM photo_tags WHERE tag_id = $1)`,
          [toId, fromId]
        );

        // 2) Remove remaining photo_tags for fromId (they are duplicates)
        const delDupRes = await client.query('DELETE FROM photo_tags WHERE tag_id = $1', [fromId]);

        // 3) Delete the old tag row. If zero rows affected, try fallback delete by name.
        let delTagRes = await client.query('DELETE FROM tags WHERE id = $1', [fromId]);
        if (delTagRes.rowCount === 0) {
          try {
            delTagRes = await client.query('DELETE FROM tags WHERE id = $1 OR name = $2', [
              fromId,
              fromRow.name,
            ]);
          } catch (e) {
            // ignore - we'll report zero deleted rows
          }
        }

        await client.query('COMMIT');

        console.log('Merge completed successfully. Summary:');
        console.log(` - moved photo_tags: ${moveRes.rowCount}`);
        console.log(` - deleted duplicate photo_tags: ${delDupRes.rowCount}`);
        console.log(` - deleted source tag rows: ${delTagRes.rowCount}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(10);
  } finally {
    try {
      await pool.end();
    } catch (_) {}
  }
}

if (require.main === module) {
  main();
}
