import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import fs from 'fs';
import sharp from 'sharp';

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  categorization: 'google',
  auto_tagging: 0.75,
});

// Optimize an image before upload
const optimizeImage = async (filePath: string, outputPath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found for optimization.');
    }

    const metadata = await sharp(filePath).metadata();
    const format: keyof sharp.FormatEnum =
      metadata.format === 'png' ? 'png' : 'jpeg';
    const width = metadata.width && metadata.width > 2000 ? 2000 : undefined;

    await sharp(filePath)
      .resize(width)
      .toFormat(format, { quality: 80 })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('Image optimization failed:', error);
    return filePath;
  }
};

// Generate a signed URL for private images
const generateSignedUrl = (publicId: string): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, timestamp },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${publicId}?api_key=${process.env.CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}`;
};

function firstFieldValue(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : undefined;
  return String(v);
}

type UploadFile = formidable.File & {
  filepath: string;
  newFilename: string;
};

// POST /api/photos/upload
router.post(
  '/api/photos/upload',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const form = formidable({
        multiples: true,
        uploadDir: '/tmp',
        keepExtensions: true,
      });

      form.parse(req, async (err: any, fields: any, files: any) => {
        if (err) {
          console.error('Form parsing error:', err);
          return res.status(500).json({ error: 'Error parsing form data' });
        }

        const fileField = (files as any).files as
          | UploadFile
          | UploadFile[]
          | undefined;

        if (!fileField) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadedFiles = Array.isArray(fileField)
          ? fileField
          : [fileField];

        const visibility = firstFieldValue((fields as any).visibility);
        const tagsRaw = firstFieldValue((fields as any).tags);
        const title = firstFieldValue((fields as any).title) ?? '';
        const description = firstFieldValue((fields as any).description) ?? '';

        const uploadResults = await Promise.all(
          uploadedFiles.map(async (file) => {
            const optimizedPath = `/tmp/optimized-${file.newFilename}`;
            const finalPath = await optimizeImage(file.filepath, optimizedPath);

            const result = await cloudinary.uploader.upload(finalPath, {
              folder: 'uploads',
              resource_type: 'image',
              type: visibility === 'private' ? 'private' : 'upload',
              access_mode:
                visibility === 'private' ? 'authenticated' : 'public',
              context: {
                caption: title,
                alt: description,
              },
              tags: tagsRaw ? tagsRaw.split(',') : [],
            });

            // cleanup
            try {
              fs.unlinkSync(file.filepath);
            } catch {
              console.warn('Failed to delete temp file:', file.filepath);
            }
            if (finalPath !== file.filepath) {
              try {
                fs.unlinkSync(finalPath);
              } catch {
                console.warn('Failed to delete optimized file:', finalPath);
              }
            }

            return result;
          })
        );

        const processedPhotos = uploadResults.map((photo: any) => ({
          ...photo,
          url:
            photo.type === 'private'
              ? generateSignedUrl(photo.public_id)
              : photo.secure_url,
        }));

        return res.status(200).json({ success: true, images: processedPhotos });
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

export default router;
