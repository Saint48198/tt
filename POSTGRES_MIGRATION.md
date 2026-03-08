# PostgreSQL Migration Guide

## What Changed

The entire backend has been migrated from **SQLite (better-sqlite3)** to **PostgreSQL (pg)**.

### Files Modified

| File                                | Change                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `api/src/db.ts`                     | Replaced `better-sqlite3` with async `pg` Pool wrapper                                |
| `api/data/db.ts`                    | Replaced SQLite import with pg Pool                                                   |
| `api/data/init.ts`                  | Rewrote schema DDL for PostgreSQL (SERIAL, BOOLEAN, NOW(), triggers)                  |
| `api/src/services/*.ts` (all 11)    | All methods now `async`, use `$1` params, `RETURNING id`, `ON CONFLICT`, `STRING_AGG` |
| `api/src/routes/*.ts` (all 12)      | All handlers now `async`, all service calls use `await`                               |
| `api/src/utils/verifyUser.ts`       | Uses async `db.get()` with `$1` params                                                |
| `.env` / `.env.example`             | Added `DATABASE_URL`                                                                  |
| `package.json` / `api/package.json` | Added `pg` dependency                                                                 |

### Files Created

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `api/data/migrate-sqlite-to-pg.ts` | One-time data migration script (SQLite → PostgreSQL) |
| `POSTGRES_MIGRATION.md`            | This file                                            |

### Files Removed

| File                                | Reason           |
| ----------------------------------- | ---------------- |
| `api/src/types/better-sqlite3.d.ts` | No longer needed |

---

## Setup Instructions

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Or use Docker:
docker run --name trip-tracker-pg -e POSTGRES_DB=trip_tracker -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 -d postgres:16
```

### 2. Create the Database

```bash
createdb trip_tracker
```

### 3. Set DATABASE_URL

Add to your `.env`:

```
DATABASE_URL=postgresql://localhost:5432/trip_tracker
```

### 4. Initialize Schema

```bash
npx ts-node api/data/init.ts
```

### 5. Migrate Data from SQLite (if needed)

```bash
npx ts-node api/data/migrate-sqlite-to-pg.ts
```

### 6. Install Dependencies

```bash
npm install
```

### 7. Start the Server

```bash
npm run serve:api
```

---

## Key SQL Differences

| SQLite                              | PostgreSQL                                   |
| ----------------------------------- | -------------------------------------------- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY`                         |
| `?` parameters                      | `$1, $2, $3` numbered parameters             |
| `INSERT OR IGNORE`                  | `INSERT ... ON CONFLICT DO NOTHING`          |
| `GROUP_CONCAT(col)`                 | `STRING_AGG(col, ',')`                       |
| `datetime('now')`                   | `NOW()`                                      |
| `result.lastInsertRowid`            | `RETURNING id` clause                        |
| `result.changes`                    | `result.rowCount`                            |
| `db.prepare().run()` (sync)         | `await db.run()` (async)                     |
| `db.prepare().get()` (sync)         | `await db.get()` (async)                     |
| `db.prepare().all()` (sync)         | `await db.all()` (async)                     |
| `db.transaction()`                  | `BEGIN / COMMIT / ROLLBACK` with pool client |
| Boolean as `0/1` INTEGER            | Native `BOOLEAN` type                        |

---

## Cost Considerations

PostgreSQL itself is **free and open source**. Hosting options:

- **Local/self-hosted**: Free
- **Docker**: Free
- **Supabase**: Free tier (500MB, 2 projects)
- **Neon**: Free tier (512MB)
- **Railway**: Free tier with limits
- **AWS RDS / Google Cloud SQL / Azure**: Paid (starts ~$15/mo)
- **Render**: Free tier with 90-day expiry
