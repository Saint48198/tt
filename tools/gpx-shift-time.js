#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * GPX Time Shifter
 *
 * Shifts all <time> elements in a GPX file by a given number of hours.
 * Positive values shift forward, negative values shift backward.
 *
 * Usage:
 *   node tools/gpx-shift-time.js --input track.gpx --hours -12
 *   node tools/gpx-shift-time.js --input track.gpx --hours 5.5 --output fixed.gpx
 *   node tools/gpx-shift-time.js --input track.gpx --hours -12 --dry-run
 *
 * Options:
 *   --input  <file>    Path to input GPX file (required)
 *   --hours  <n>       Number of hours to shift (required, can be decimal e.g. -1.5)
 *   --output <file>    Path to output GPX file (default: overwrites input)
 *   --dry-run          Preview changes without writing
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--input' || a === '-i') && args[i + 1]) {
      out.input = args[++i];
    } else if ((a === '--hours' || a === '-h') && args[i + 1]) {
      out.hours = parseFloat(args[++i]);
    } else if ((a === '--output' || a === '-o') && args[i + 1]) {
      out.output = args[++i];
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--help') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
GPX Time Shifter — shift timestamps in a GPX file by N hours.

Usage:
  node tools/gpx-shift-time.js --input <file> --hours <n> [options]

Options:
  --input,  -i <file>   Path to the input GPX file (required)
  --hours,  -h <n>      Hours to shift; negative shifts back, positive shifts forward (required)
  --output, -o <file>   Output path (default: overwrites --input file)
  --dry-run             Print what would change without writing any file
  --help                Show this help message

Examples:
  node tools/gpx-shift-time.js --input track.gpx --hours -12
  node tools/gpx-shift-time.js --input track.gpx --hours 5.5 --output fixed.gpx
  node tools/gpx-shift-time.js --input track.gpx --hours -1 --dry-run
`);
}

/**
 * Shift an ISO-8601 timestamp string by `hours` hours.
 * Returns the new ISO-8601 string (UTC, with Z suffix).
 */
function shiftTimestamp(isoString, hours) {
  const ms = hours * 60 * 60 * 1000;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    throw new Error(`Cannot parse timestamp: "${isoString}"`);
  }
  return new Date(d.getTime() + ms).toISOString();
}

/**
 * Replace every <time>...</time> value in the GPX XML string.
 * Returns { updated: string, count: number }.
 */
function shiftGpxTimes(xml, hours) {
  let count = 0;
  // Match <time>2024-01-15T08:30:00Z</time> or with fractional seconds / offsets
  const updated = xml.replace(/<time>([^<]+)<\/time>/g, (match, isoStr) => {
    const trimmed = isoStr.trim();
    try {
      const newTs = shiftTimestamp(trimmed, hours);
      count++;
      return `<time>${newTs}</time>`;
    } catch (e) {
      console.warn(`  ⚠ Skipped unparseable timestamp: ${trimmed}`);
      return match;
    }
  });
  return { updated, count };
}

function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.input) {
    console.error('Error: --input <file> is required.');
    printHelp();
    process.exit(1);
  }

  if (args.hours === undefined || isNaN(args.hours)) {
    console.error('Error: --hours <n> is required and must be a number.');
    printHelp();
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  const outputPath = args.output ? path.resolve(args.output) : inputPath;
  const hours = args.hours;
  const dryRun = !!args.dryRun;

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`\nGPX Time Shifter`);
  console.log(`  Input : ${inputPath}`);
  console.log(`  Shift : ${hours >= 0 ? '+' : ''}${hours} hour(s)`);
  console.log(`  Output: ${dryRun ? '(dry-run, no file written)' : outputPath}`);
  console.log('');

  const xml = fs.readFileSync(inputPath, 'utf8');
  const { updated, count } = shiftGpxTimes(xml, hours);

  if (count === 0) {
    console.log('No <time> elements found in the file. Nothing to do.');
    process.exit(0);
  }

  // Show a preview of the first few changed timestamps
  const origTimes = [...xml.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => m[1].trim());
  const newTimes = [...updated.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => m[1].trim());
  const previewCount = Math.min(3, origTimes.length);

  console.log(`Found ${count} timestamp(s). Preview (first ${previewCount}):`);
  for (let i = 0; i < previewCount; i++) {
    console.log(`  Before: ${origTimes[i]}`);
    console.log(`  After : ${newTimes[i]}`);
    if (i < previewCount - 1) console.log('');
  }
  console.log('');

  if (dryRun) {
    console.log('Dry-run mode — no file written.');
  } else {
    fs.writeFileSync(outputPath, updated, 'utf8');
    console.log(`✓ Written ${count} updated timestamp(s) to: ${outputPath}`);
  }
}

main();
