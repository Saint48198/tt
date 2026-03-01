import { Pool } from 'pg';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Remove ALL photos from both the database and Cloudinary.
 * Run with: npx tsx api/data/remove-all-photos.ts
 */

async function removeAllPhotos() {
  // Configure Cloudinary from env
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker';
  const pool = new Pool({ connectionString: dbUrl });

  try {
    // --- 1. Delete from database ---
    process.stdout.write('--- Clearing photos from database ---\n');

    const photoTagsResult = await pool.query('DELETE FROM photo_tags');
    process.stdout.write(`  Deleted ${photoTagsResult.rowCount} photo_tags rows\n`);

    const photosResult = await pool.query('DELETE FROM photos');
    process.stdout.write(`  Deleted ${photosResult.rowCount} photos rows\n`);

    // --- 2. Delete from Cloudinary ---
    process.stdout.write('\n--- Clearing photos from Cloudinary ---\n');

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      process.stdout.write('  WARNING: CLOUDINARY_CLOUD_NAME not set, skipping Cloudinary cleanup.\n');
    } else {
      let totalDeleted = 0;

      for (const type of ['upload', 'authenticated'] as const) {
        process.stdout.write(`\n  Fetching ${type} resources...\n`);
        let nextCursor: string | undefined;

        while (true) {
          const options: any = {
            type,
            prefix: process.env.CLOUDINARY_FOLDER || '',
            max_results: 500,
          };
          if (nextCursor) options.next_cursor = nextCursor;

          let result;
          try {
            result = await cloudinary.api.resources(options);
          } catch (e: any) {
            process.stdout.write(`  Skipping ${type}: ${e.message}\n`);
            break;
          }
          const resources = result.resources ?? [];

          if (resources.length === 0) {
            process.stdout.write(`  No ${type} resources found.\n`);
            break;
          }

          const publicIds = resources.map((r: any) => r.public_id);
          process.stdout.write(`  Deleting ${publicIds.length} ${type} resources...\n`);

          for (let i = 0; i < publicIds.length; i += 100) {
            const batch = publicIds.slice(i, i + 100);
            await cloudinary.api.delete_resources(batch, { type, resource_type: 'image' });
            totalDeleted += batch.length;
            process.stdout.write(`    Deleted batch of ${batch.length} (total: ${totalDeleted})\n`);
          }

          nextCursor = result.next_cursor;
          if (!nextCursor) break;
        }
      }

      process.stdout.write(`\nTotal Cloudinary resources deleted: ${totalDeleted}\n`);
    }

    process.stdout.write('\n--- Done ---\n');

  } catch (error) {
    process.stderr.write(`Error removing photos: ${error}\n`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeAllPhotos();
