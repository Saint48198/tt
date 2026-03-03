/**
 * Script to empty the S3 photo bucket.
 * Deletes ALL objects in the configured S3_PHOTO_BUCKET.
 *
 * Usage: npx ts-node api/data/empty-s3-bucket.ts
 */
import 'dotenv/config';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'us-east-2';
const bucket = process.env.S3_PHOTO_BUCKET || 'app-tt-photos';

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

async function emptyBucket() {
  console.log(`Emptying S3 bucket: ${bucket} (region: ${region})`);
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
      console.log('No more objects to delete.');
      break;
    }

    console.log(`Found ${objects.length} objects to delete...`);

    const deleteParams = {
      Bucket: bucket,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key! })),
        Quiet: true,
      },
    };

    await s3.send(new DeleteObjectsCommand(deleteParams));
    totalDeleted += objects.length;
    console.log(`Deleted ${objects.length} objects (total: ${totalDeleted})`);

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(`\nDone! Deleted ${totalDeleted} total objects from bucket "${bucket}".`);
}

emptyBucket().catch((err) => {
  console.error('Error emptying bucket:', err);
  process.exit(1);
});

