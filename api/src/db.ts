import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Try multiple path strategies to find the database
const strategies = [
  // Strategy 1: From cwd (works when running from project root)
  () => path.join(process.cwd(), 'api/data/trip-tracker.db'),
  // Strategy 2: From __dirname
  () => path.resolve(__dirname, '../../api/data/trip-tracker.db'),
  // Strategy 3: Relative to source
  () => path.resolve(__dirname, '../data/trip-tracker.db'),
];

let dbPath: string | null = null;

for (const strategy of strategies) {
  try {
    const candidate = strategy();
    if (fs.existsSync(candidate)) {
      dbPath = candidate;
      break;
    }
  } catch (e) {
    // Continue to next strategy
  }
}

// If still not found, use cwd as default
if (!dbPath) {
  dbPath = path.join(process.cwd(), 'api/data/trip-tracker.db');
}

const dbDir = path.dirname(dbPath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath, {
  readonly: false,
  fileMustExist: false
});


