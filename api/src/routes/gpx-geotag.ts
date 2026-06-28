import { Router, Request, Response } from 'express';
import { execSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import xml2js from 'xml2js';
import os from 'os';
import fileUpload, { UploadedFile } from 'express-fileupload';

declare global {
  namespace Express {
    interface Request {
      files?: Record<string, UploadedFile | UploadedFile[]>;
    }
  }
}

const router = Router();
const xmlParser = new xml2js.Parser();

// Check if exiftool is available
function isExiftoolAvailable(): boolean {
  try {
    const result = spawnSync('which', ['exiftool'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

interface GpsPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date;
}

function parseGpx(gpxContent: string): GpsPoint[] {
  const points: GpsPoint[] = [];
  const trkptRegex =
    /<(?:trkpt|wpt|rtept)\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|wpt|rtept)>/g;

  let match;
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];

    const timeMatch = /<time>([^<]+)<\/time>/.exec(inner);
    const eleMatch = /<ele>([^<]+)<\/ele>/.exec(inner);

    if (!isNaN(lat) && !isNaN(lon) && timeMatch) {
      const time = new Date(timeMatch[1].trim());
      if (!isNaN(time.getTime())) {
        points.push({
          lat,
          lon,
          ele: eleMatch ? parseFloat(eleMatch[1]) : null,
          time,
        });
      }
    }
  }

  return points.sort((a, b) => a.time.getTime() - b.time.getTime());
}

function interpolateGps(
  points: GpsPoint[],
  targetTime: Date
): { lat: number; lon: number; ele: number | null; gap: number; reason?: string } | null {
  if (!points.length) return null;

  const targetMs = targetTime.getTime();
  const firstPointMs = points[0].time.getTime();
  const lastPointMs = points[points.length - 1].time.getTime();

  // Check if photo time is outside the GPX track range
  if (targetMs < firstPointMs) {
    const gapMs = firstPointMs - targetMs;
    const gapMin = Math.round(gapMs / 60000);
    return null; // Photo is before track starts
  }

  if (targetMs > lastPointMs) {
    const gapMs = targetMs - lastPointMs;
    const gapMin = Math.round(gapMs / 60000);
    return null; // Photo is after track ends
  }

  // Photo time is within track range - find the best match
  let lo = 0,
    hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].time.getTime() <= targetMs) lo = mid;
    else hi = mid;
  }

  const a = points[lo];
  const b = points[hi];
  const timeDiff = b.time.getTime() - a.time.getTime();

  if (timeDiff === 0) {
    // Points are at exact same time, use the first one
    return {
      lat: a.lat,
      lon: a.lon,
      ele: a.ele,
      gap: Math.abs(targetMs - a.time.getTime()),
    };
  }

  const ratio = (targetMs - a.time.getTime()) / timeDiff;

  return {
    lat: a.lat + ratio * (b.lat - a.lat),
    lon: a.lon + ratio * (b.lon - a.lon),
    ele: a.ele !== null && b.ele !== null ? a.ele + ratio * (b.ele - a.ele) : null,
    gap: 0,
  };
}

function parseExifDate(dtStr: string, offsetHours: number): Date | null {
  const m = dtStr.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;

  const [, y, mo, d, h, min, s] = m;
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +min, +s);
  const utcDate = new Date(utcMs);
  const adjustedDate = new Date(utcMs - offsetHours * 3600000);

  console.log(
    `[GPS Match] EXIF local time: ${dtStr}, Offset: ${offsetHours}h, Interpreted UTC: ${adjustedDate.toISOString()}`
  );

  return adjustedDate;
}

// Scope express-fileupload middleware to this route only.
// (Registering it globally in main.ts would consume multipart bodies for
// other routes like /api/photos/upload that use formidable.)
router.use('/api/gpx-geotag', fileUpload({ limits: { fileSize: 500 * 1024 * 1024 } }));

// POST /api/gpx-geotag - Process files and return geotagged versions or preview
router.post('/api/gpx-geotag', async (req: Request, res: Response) => {
  const tempDir = path.join(os.tmpdir(), `geotag-${Date.now()}`);

  try {
    // Check if exiftool is available
    const exiftoolAvailable = isExiftoolAvailable();
    if (!exiftoolAvailable) {
      return res.status(500).json({
        error:
          'exiftool is not installed or not in PATH. Please install exiftool to use this feature.',
      });
    }

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Get files and form data
    if (!req.files) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Expect gpx file and image files
    const gpxFiles = req.files.gpx as any;
    const imageFiles = req.files.images as any;

    if (!gpxFiles) {
      return res.status(400).json({ error: 'GPX file required' });
    }
    if (!imageFiles) {
      return res.status(400).json({ error: 'Image files required' });
    }

    const gpxFile = Array.isArray(gpxFiles) ? gpxFiles[0] : gpxFiles;
    const images = Array.isArray(imageFiles) ? imageFiles : [imageFiles];
    const cameraOffsetHours = parseFloat(req.body.offset || '0') || 0;
    const previewMode = req.query.preview === 'true' || req.body.preview === 'true';

    // Read GPX file
    const gpxContent = gpxFile.data.toString('utf-8');
    const gpsPoints = parseGpx(gpxContent);

    if (gpsPoints.length === 0) {
      return res.status(400).json({ error: 'No GPS points found in GPX file' });
    }

    // Get GPX track time range for error messages
    const gpxStartTime = gpsPoints[0].time.toISOString();
    const gpxEndTime = gpsPoints[gpsPoints.length - 1].time.toISOString();

    const results = { updated: [] as any[], failed: [] as any[] };
    const outputFiles: Map<string, Buffer> = new Map();

    console.log(
      `\n[Image Processing] Starting to process ${images.length} images with ${gpsPoints.length} GPS points`
    );

    // Process each image
    for (const imageFile of images) {
      const imagePath = path.join(tempDir, imageFile.name);
      const outputPath = path.join(tempDir, `output_${imageFile.name}`);
      const fileExt = path.extname(imageFile.name).toLowerCase();
      const isCR2 = fileExt === '.cr2';

      try {
        // Write image to temp file
        await fs.writeFile(imagePath, imageFile.data);

        // Read EXIF date using exiftool
        let exifDate;
        try {
          const exifOutput = execSync(`exiftool -s3 -DateTimeOriginal "${imagePath}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();

          if (!exifOutput) {
            const reason = isCR2
              ? `CR2 file has no EXIF timestamp (may be corrupted or unsupported)`
              : 'No EXIF timestamp found';
            results.failed.push({
              name: imageFile.name,
              reason,
            });
            continue;
          }

          exifDate = parseExifDate(exifOutput, cameraOffsetHours);
        } catch (e) {
          const errMsg = (e as Error).message;
          let reason = 'Failed to read EXIF data';

          if (errMsg.includes('command not found')) {
            reason = 'exiftool not installed';
          } else if (isCR2) {
            reason = `CR2 processing error: ${errMsg.substring(0, 50)}...`;
          } else {
            reason = 'No EXIF timestamp found';
          }

          results.failed.push({
            name: imageFile.name,
            reason,
          });
          continue;
        }

        if (!exifDate) {
          results.failed.push({
            name: imageFile.name,
            reason: 'Invalid EXIF date format',
          });
          continue;
        }

        // Interpolate GPS
        const gpsData = interpolateGps(gpsPoints, exifDate);
        if (!gpsData) {
          // Provide specific reason for the mismatch
          const photoTime = exifDate.toISOString();
          let reason = 'No matching track point';

          if (exifDate.getTime() < gpsPoints[0].time.getTime()) {
            const gapMs = gpsPoints[0].time.getTime() - exifDate.getTime();
            const gapMin = Math.round(gapMs / 60000);
            reason = `Photo (${photoTime}) is before track starts (${gpxStartTime}) by ~${gapMin}m`;
          } else if (exifDate.getTime() > gpsPoints[gpsPoints.length - 1].time.getTime()) {
            const gapMs = exifDate.getTime() - gpsPoints[gpsPoints.length - 1].time.getTime();
            const gapMin = Math.round(gapMs / 60000);
            reason = `Photo (${photoTime}) is after track ends (${gpxEndTime}) by ~${gapMin}m`;
          }

          results.failed.push({
            name: imageFile.name,
            reason,
          });
          continue;
        }

        // Copy file to output location first
        await fs.copyFile(imagePath, outputPath);

        // Write GPS EXIF using exiftool with -overwrite_original on the output file
        const lat = Math.abs(gpsData.lat);
        const latRef = gpsData.lat >= 0 ? 'N' : 'S';
        const lon = Math.abs(gpsData.lon);
        const lonRef = gpsData.lon >= 0 ? 'E' : 'W';

        // Use full path to exiftool
        const exiftoolPath = '/opt/homebrew/bin/exiftool';
        let exiftoolCmd = `${exiftoolPath} -overwrite_original -GPSLatitude=${lat} -GPSLatitudeRef=${latRef} -GPSLongitude=${lon} -GPSLongitudeRef=${lonRef}`;

        if (gpsData.ele !== null) {
          const ele = Math.abs(gpsData.ele);
          const eleRef = gpsData.ele >= 0 ? '0' : '1';
          exiftoolCmd += ` -GPSAltitude=${ele} -GPSAltitudeRef=${eleRef}`;
        }

        exiftoolCmd += ` "${outputPath}"`;

        console.log(`\n[Processing] File: ${imageFile.name}`);
        console.log(`  [exiftool command] ${exiftoolCmd}`);

        try {
          const result = execSync(exiftoolCmd, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/bash',
          });
          console.log(`✓ exiftool STDOUT: ${result.trim().substring(0, 150)}`);

          // Verify the file was actually modified by checking file size changed
          const outputStats = await fs.stat(outputPath);
          console.log(`✓ Output file size after exiftool: ${outputStats.size} bytes`);
        } catch (e) {
          const err = e as any;
          const errMsg = err.message || String(err);
          let stderr = '';
          let stdout = '';

          try {
            if (err.stderr) {
              stderr = err.stderr.toString();
            }
            if (err.stdout) {
              stdout = err.stdout.toString();
            }
          } catch (ignoreErr) {
            // Ignore parsing errors
          }

          console.error(`✗ exiftool ERROR for ${imageFile.name}:`, errMsg.substring(0, 150));
          if (stderr) console.error(`  stderr: ${stderr.substring(0, 200)}`);
          if (stdout) console.error(`  stdout: ${stdout.substring(0, 200)}`);
          console.error(`  Status code: ${err.status}`);
          results.failed.push({
            name: imageFile.name,
            reason: `Failed to write GPS tags: ${errMsg.substring(0, 50)}`,
          });
          continue;
        }

        // Verify GPS data was actually written
        try {
          const verifyCmd = `exiftool -GPSLatitude -GPSLongitude "${outputPath}"`;
          const verifyResult = execSync(verifyCmd, { encoding: 'utf-8' });
          if (!verifyResult.includes('GPS')) {
            console.warn(`Warning: GPS tags may not have been written to ${imageFile.name}`);
          }
        } catch {
          // Ignore verification errors
        }

        // Clean up exiftool backup file (filename_original)
        const backupPath = `${outputPath}_original`;
        try {
          await fs.rm(backupPath, { force: true });
        } catch {
          // Ignore if backup file doesn't exist
        }

        // Verify file was modified and read it
        const outputData = await fs.readFile(outputPath);
        if (outputData.length === 0) {
          results.failed.push({
            name: imageFile.name,
            reason: 'File processing resulted in empty output',
          });
          continue;
        }
        console.log(
          `[File Processing] Successfully processed ${imageFile.name} - size: ${outputData.length} bytes`
        );
        outputFiles.set(imageFile.name, outputData);

        const gapSec = Math.round(gpsData.gap / 1000);
        const latHem = gpsData.lat >= 0 ? 'N' : 'S';
        const lonHem = gpsData.lon >= 0 ? 'E' : 'W';
        results.updated.push({
          name: imageFile.name,
          time: exifDate.toISOString().slice(0, 19),
          lat: Math.abs(gpsData.lat).toFixed(6),
          latHem,
          lon: Math.abs(gpsData.lon).toFixed(6),
          lonHem,
          gap: gapSec < 60 ? `${gapSec}s` : `${Math.floor(gapSec / 60)}m`,
        });
      } catch (e) {
        results.failed.push({
          name: imageFile.name,
          reason: `Error: ${(e as Error).message.substring(0, 50)}`,
        });
      }
    }

    // If not downloading, return JSON for preview
    if (previewMode) {
      const cleanResults = {
        updated: results.updated.map((r) => ({
          name: r.name,
          time: r.time,
          lat: r.lat,
          latHem: r.latHem,
          lon: r.lon,
          lonHem: r.lonHem,
          gap: r.gap,
        })),
        failed: results.failed,
      };
      res.json(cleanResults);

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      return;
    }

    // Create ZIP archive for download
    const outputZip = path.join(tempDir, 'geotagged.zip');
    console.log(
      `\n[ZIP DEBUG] Creating ZIP with ${outputFiles.size} updated files and ${results.failed.length} failed files`
    );
    console.log(`[ZIP DEBUG] Updated files: ${Array.from(outputFiles.keys()).join(', ')}`);
    const stream = require('fs').createWriteStream(outputZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      stream.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(stream);

      // Add updated files
      for (const [name, data] of outputFiles) {
        archive.append(data, { name });
      }

      // Add failed files (unmodified)
      for (const item of results.failed) {
        for (const imageFile of images) {
          if (imageFile.name === item.name) {
            archive.append(imageFile.data, { name: `FAILED_${item.name}` });
          }
        }
      }

      // Add log file
      const logContent = [
        'GPS GEOTAG UPDATE LOG',
        '======================',
        '',
        ...results.updated.map(
          (r) => `UPDATED: ${r.name} - GPS: ${r.latHem}${r.lat}, ${r.lonHem}${r.lon}`
        ),
        ...results.failed.map((f) => `FAILED: ${f.name} - ${f.reason}`),
      ].join('\n');

      archive.append(logContent, { name: 'UPDATE_LOG.txt' });
      archive.finalize();
    });

    // Send ZIP file
    const zipData = await fs.readFile(outputZip);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=geotagged-photos.zip');
    res.send(zipData);

    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (err) {
    console.error('GPX geotag error:', err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Server error: ${errorMsg.substring(0, 100)}` });

    // Attempt cleanup even on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

export default router;
