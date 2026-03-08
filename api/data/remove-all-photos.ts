import 'dotenv/config';
import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

/**
 * Remove ALL photos from both the database and the S3 bucket.
 * Run with: npx tsx api/data/remove-all-photos.ts
 */

async function removeAllPhotos() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker';
  const pool = new Pool({ connectionString: dbUrl });

  const region = process.env.AWS_REGION || 'us-east-2';
  const bucket = process.env.S3_PHOTO_BUCKET || 'app-tt-photos';
  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  try {
    // --- 1. Delete from database ---
    process.stdout.write('--- Clearing photos from database ---\n');

    const photoTagsResult = await pool.query('DELETE FROM photo_tags');
    process.stdout.write(`  Deleted ${photoTagsResult.rowCount} photo_tags rows\n`);

    const photosResult = await pool.query('DELETE FROM photos');
    process.stdout.write(`  Deleted ${photosResult.rowCount} photos rows\n`);

    // --- 2. Delete from S3 ---
    process.stdout.write('\n--- Clearing photos from S3 ---\n');
    process.stdout.write(`  Bucket: ${bucket} (region: ${region})\n`);

    let totalDeleted = 0;
    let continuationToken: string | undefined;

    do {
      const listResponse = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      );

      const objects = listResponse.Contents;
      if (!objects || objects.length === 0) {
        if (totalDeleted === 0) {
          process.stdout.write('  No objects found in bucket.\n');
        }
        break;
      }

      process.stdout.write(`  Deleting ${objects.length} objects...\n`);

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        })
      );

      totalDeleted += objects.length;
      process.stdout.write(`  Deleted batch of ${objects.length} (total: ${totalDeleted})\n`);

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    process.stdout.write(`\n  Total S3 objects deleted: ${totalDeleted}\n`);
    process.stdout.write('\n--- Done ---\n');
  } catch (error) {
    process.stderr.write(`Error removing photos: ${error}\n`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeAllPhotos();
