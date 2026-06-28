#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * GPX Photo Geotagging Tool
 *
 * Reads GPS coordinates from a GPX track and writes them into JPEG and CR2 (Canon RAW)
 * photo EXIF metadata by matching each photo's EXIF timestamp to the nearest point on
 * the track.
 *
 * Usage:
 *   node tools/gpx-geotag.js --gpx track.gpx --images photo1.jpg photo2.cr2
 *   node tools/gpx-geotag.js --gpx track.gpx --images photos/*.{jpg,cr2} --offset 9 --out ./geotagged
 *   node tools/gpx-geotag.js --gpx track.gpx --images *.cr2 --dry-run
 *
 * Options:
 *   --gpx <file>          GPX track file (required)
 *   --images <file...>    JPEG and/or CR2 image files to geotag (required, shell globs OK)
 *   --offset <hours>      Camera timezone ahead of UTC, e.g. 9 for Tokyo (default: 0)
 *                         The tool subtracts this to get UTC before matching.
 *   --out <dir>           Output directory (default: overwrites originals)
 *   --max-gap <minutes>   Warn when nearest track point exceeds this gap (default: 30)
 *   --dry-run             Show matches without writing files
 *   --help                Show this help message
 */

const fs = require('fs');
const path = require('path');
const ExifReader = require('exifreader');
const piexif = require('piexifjs');

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { images: [] };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help') {
      out.help = true;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if ((a === '--gpx' || a === '-g') && argv[i + 1]) {
      out.gpx = argv[++i];
    } else if ((a === '--offset' || a === '-z') && argv[i + 1]) {
      out.offset = parseFloat(argv[++i]);
    } else if ((a === '--out' || a === '-o') && argv[i + 1]) {
      out.outDir = argv[++i];
    } else if ((a === '--max-gap' || a === '-m') && argv[i + 1]) {
      out.maxGap = parseFloat(argv[++i]);
    } else if (a === '--images' || a === '-i') {
      // Collect all following non-flag arguments as image paths
      i++;
      while (i < argv.length && !argv[i].startsWith('--')) {
        out.images.push(argv[i++]);
      }
      continue;
    }
    i++;
  }
  return out;
}

function printHelp() {
  console.log(`
GPX Photo Geotagging — embed GPS coordinates from a GPX track into JPEG and CR2 (Canon RAW) EXIF.

Usage:
  node tools/gpx-geotag.js --gpx <file> --images <file...> [options]

Options:
  --gpx,      -g <file>    GPX track file (required)
  --images,   -i <file...> JPEG and/or CR2 image files (required; shell globs expand fine)
  --offset,   -z <hours>   Camera timezone offset ahead of UTC (e.g. 9 for JST, -5 for EST)
                           Converts EXIF local time → UTC before matching. Default: 0
  --out,      -o <dir>     Output directory. Default: overwrite originals
  --max-gap,  -m <minutes> Warn if nearest point is farther than N minutes. Default: 30
  --dry-run                Preview matches; do not write any files
  --help                   Show this help

Examples:
  node tools/gpx-geotag.js --gpx track.gpx --images photo.jpg raw.cr2
  node tools/gpx-geotag.js --gpx track.gpx --images *.{jpg,cr2} --offset 9 --out ./geotagged
  node tools/gpx-geotag.js --gpx track.gpx --images *.cr2 --dry-run
`);
}

// ── GPX parsing ──────────────────────────────────────────────────────────────

function parseGpx(xml) {
  const points = [];
  // Match trkpt, wpt, rtept — attribute order may vary, use two passes
  const trkptRe = /<(?:trkpt|wpt|rtept)\b([^>]+)>([\s\S]*?)<\/(?:trkpt|wpt|rtept)>/g;
  let m;
  while ((m = trkptRe.exec(xml)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const latM = /lat="([^"]+)"/.exec(attrs);
    const lonM = /lon="([^"]+)"/.exec(attrs);
    const timeM = /<time>([^<]+)<\/time>/.exec(inner);
    const eleM = /<ele>([^<]+)<\/ele>/.exec(inner);
    if (!latM || !lonM || !timeM) continue;
    const ts = new Date(timeM[1].trim()).getTime();
    if (isNaN(ts)) continue;
    points.push({
      lat: parseFloat(latM[1]),
      lon: parseFloat(lonM[1]),
      ele: eleM ? parseFloat(eleM[1]) : null,
      time: ts,
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

// ── GPS interpolation ─────────────────────────────────────────────────────────

function interpolate(points, targetMs) {
  if (!points.length) return null;
  if (targetMs <= points[0].time) {
    return { ...points[0], gapMs: Math.abs(targetMs - points[0].time), extrapolated: true };
  }
  const last = points[points.length - 1];
  if (targetMs >= last.time) {
    return { ...last, gapMs: Math.abs(targetMs - last.time), extrapolated: true };
  }
  // Binary search for surrounding segment
  let lo = 0,
    hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time <= targetMs) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[hi];
  const ratio = (targetMs - a.time) / (b.time - a.time);
  return {
    lat: a.lat + ratio * (b.lat - a.lat),
    lon: a.lon + ratio * (b.lon - a.lon),
    ele: a.ele != null && b.ele != null ? a.ele + ratio * (b.ele - a.ele) : null,
    gapMs: 0,
    extrapolated: false,
  };
}

// ── EXIF helpers ──────────────────────────────────────────────────────────────

/** Parse EXIF DateTimeOriginal string "YYYY:MM:DD HH:MM:SS" → UTC ms
 *  The cameraOffset (hours ahead of UTC) is subtracted to produce UTC.
 */
function parseExifDate(dtStr, cameraOffsetHours) {
  if (!dtStr) return null;
  const m = dtStr.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, min, s] = m;
  // Treat as UTC first, then subtract offset
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +min, +s);
  return utcMs - cameraOffsetHours * 3600000;
}

function readPhotoTimestamp(imgPath, cameraOffset) {
  const buf = fs.readFileSync(imgPath);
  const tags = ExifReader.load(buf, { expanded: true });
  const dt =
    tags?.exif?.DateTimeOriginal?.description ||
    tags?.exif?.DateTimeDigitized?.description ||
    tags?.exif?.DateTime?.description;
  return parseExifDate(dt || '', cameraOffset);
}

/** Convert decimal degrees to piexifjs rational [[d,1],[m,1],[s*1000,1000]] */
function degToRational(deg) {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  const m = Math.floor(mFull);
  const s = Math.round((mFull - m) * 60 * 1000);
  return [
    [d, 1],
    [m, 1],
    [s, 1000],
  ];
}

function writeGpsExif(srcPath, destPath, lat, lon, ele) {
  const imgBuf = fs.readFileSync(srcPath);
  const isCr2 = srcPath.toLowerCase().endsWith('.cr2');

  // For CR2 files, pass buffer directly; for JPEG, create data URL
  let exifObj;
  try {
    if (isCr2) {
      exifObj = piexif.load(imgBuf);
    } else {
      const dataUrl = 'data:image/jpeg;base64,' + imgBuf.toString('base64');
      exifObj = piexif.load(dataUrl);
    }
  } catch {
    exifObj = { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {} };
  }

  const gpsIfd = {
    [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: degToRational(lat),
    [piexif.GPSIFD.GPSLongitudeRef]: lon >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: degToRational(lon),
  };
  if (ele !== null && !isNaN(ele)) {
    gpsIfd[piexif.GPSIFD.GPSAltitudeRef] = ele >= 0 ? 0 : 1;
    gpsIfd[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(ele) * 100), 100];
  }

  exifObj['GPS'] = gpsIfd;

  const exifBytes = piexif.dump(exifObj);

  if (isCr2) {
    // For CR2, insert EXIF directly into binary buffer
    const newBuf = piexif.insert(exifBytes, imgBuf);
    fs.writeFileSync(destPath, newBuf);
  } else {
    // For JPEG, use data URL approach
    const dataUrl = 'data:image/jpeg;base64,' + imgBuf.toString('base64');
    const newDataUrl = piexif.insert(exifBytes, dataUrl);
    const newBuf = Buffer.from(newDataUrl.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    fs.writeFileSync(destPath, newBuf);
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtGap(ms) {
  if (ms === 0) return 'interpolated';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtCoord(lat, lon) {
  return `${lat >= 0 ? 'N' : 'S'}${Math.abs(lat).toFixed(6)}, ${lon >= 0 ? 'E' : 'W'}${Math.abs(lon).toFixed(6)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.gpx) {
    console.error('Error: --gpx <file> is required.');
    printHelp();
    process.exit(1);
  }
  if (!args.images.length) {
    console.error('Error: --images <file...> is required.');
    printHelp();
    process.exit(1);
  }

  const gpxPath = path.resolve(args.gpx);
  const cameraOffset = args.offset ?? 0;
  const maxGapMs = (args.maxGap ?? 30) * 60 * 1000;
  const dryRun = !!args.dryRun;
  const outDir = args.outDir ? path.resolve(args.outDir) : null;

  if (!fs.existsSync(gpxPath)) {
    console.error(`GPX file not found: ${gpxPath}`);
    process.exit(1);
  }
  if (outDir && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('\nGPX Photo Geotagging');
  console.log(`  GPX   : ${gpxPath}`);
  console.log(`  Photos: ${args.images.length}`);
  console.log(`  Offset: ${cameraOffset >= 0 ? '+' : ''}${cameraOffset}h (camera UTC offset)`);
  console.log(`  Output: ${dryRun ? '(dry-run)' : outDir || 'overwrite originals'}`);
  console.log('');

  // Parse GPX track
  const gpxXml = fs.readFileSync(gpxPath, 'utf8');
  const track = parseGpx(gpxXml);
  if (!track.length) {
    console.error('No track points with timestamps found in GPX file.');
    process.exit(1);
  }

  const trackStart = new Date(track[0].time).toISOString();
  const trackEnd = new Date(track[track.length - 1].time).toISOString();
  console.log(`  Track : ${track.length} points  ${trackStart} → ${trackEnd}`);
  console.log('');

  // Process each image
  let matched = 0,
    warned = 0,
    failed = 0;
  const COL = { name: 32, ts: 22, gps: 36, gap: 16 };

  const hdr = [
    'Status'.padEnd(10),
    'File'.padEnd(COL.name),
    'EXIF timestamp'.padEnd(COL.ts),
    'GPS (lat, lon)'.padEnd(COL.gps),
    'Gap / Reason',
  ].join(' │ ');
  console.log(hdr);
  console.log('─'.repeat(hdr.length));

  for (const imgArg of args.images) {
    const imgPath = path.resolve(imgArg);
    const imgName = path.basename(imgPath);

    if (!fs.existsSync(imgPath)) {
      console.log(
        `  ✗ NOT FOUND ${imgName.slice(0, COL.name - 1).padEnd(COL.name)} │ ${''.padEnd(COL.ts)} │ ${''.padEnd(COL.gps)} │ File not found`
      );
      failed++;
      continue;
    }

    // Read EXIF timestamp
    let photoUtcMs;
    try {
      photoUtcMs = readPhotoTimestamp(imgPath, cameraOffset);
    } catch (e) {
      console.log(
        `  ✗ ERROR   ${imgName.slice(0, COL.name - 1).padEnd(COL.name)} │ ${''.padEnd(COL.ts)} │ ${''.padEnd(COL.gps)} │ EXIF read error: ${e.message}`
      );
      failed++;
      continue;
    }

    if (photoUtcMs == null) {
      console.log(
        `  ✗ NO TS   ${imgName.slice(0, COL.name - 1).padEnd(COL.name)} │ ${''.padEnd(COL.ts)} │ ${''.padEnd(COL.gps)} │ No EXIF timestamp found`
      );
      failed++;
      continue;
    }

    // Interpolate GPS
    const pos = interpolate(track, photoUtcMs);
    if (!pos) {
      console.log(
        `  ✗ NO GPS  ${imgName.slice(0, COL.name - 1).padEnd(COL.name)} │ ${''.padEnd(COL.ts)} │ ${''.padEnd(COL.gps)} │ No matching track point`
      );
      failed++;
      continue;
    }

    const gapMs = pos.gapMs;
    const overGap = gapMs > maxGapMs;
    const statusLabel = overGap ? '⚠ WARNING' : '✓ OK';
    const exifLocal = new Date(photoUtcMs).toISOString().replace('T', ' ').slice(0, 19);

    const row = [
      statusLabel.padEnd(10),
      imgName.slice(0, COL.name - 1).padEnd(COL.name),
      exifLocal.padEnd(COL.ts),
      fmtCoord(pos.lat, pos.lon).padEnd(COL.gps),
      overGap ? `⚠ ${fmtGap(gapMs)} (large gap)` : fmtGap(gapMs),
    ].join(' │ ');
    console.log(`  ${row}`);

    if (overGap) warned++;

    // Write GPS EXIF
    if (!dryRun) {
      const destPath = outDir ? path.join(outDir, imgName) : imgPath;
      try {
        writeGpsExif(imgPath, destPath, pos.lat, pos.lon, pos.ele);
        matched++;
      } catch (e) {
        console.log(`    ✗ Write failed: ${e.message}`);
        failed++;
      }
    } else {
      matched++;
    }
  }

  console.log('');
  console.log(`Summary: ${matched} UPDATED, ${warned} WARNINGS, ${failed} FAILED`);
  if (dryRun) console.log('(dry-run mode — no files were written)');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
