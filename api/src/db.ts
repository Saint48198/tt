import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Path to the SQLite DB relative to the compiled output
const dbPath = path.resolve(process.cwd(), 'api', 'data', 'trip-tracker.db');
const dbDir = path.dirname(dbPath);

// Ensure the directory exists so better-sqlite3 can open/create the DB file
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath, {
  readonly: false,
  fileMustExist: true
});
