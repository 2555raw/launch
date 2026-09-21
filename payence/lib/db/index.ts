import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import * as schema from "./schema";
import { assertProductionConfig } from "@/lib/config";

export type Db = BetterSQLite3Database<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __payenceDb: Db | undefined;
}

function open(): Db {
  // First database use is effectively process startup; fail loudly here rather
  // than at someone's first payment.
  assertProductionConfig();
  const url = process.env.DATABASE_URL || "./data/payence.db";
  if (url !== ":memory:") mkdirSync(dirname(url), { recursive: true });
  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  return db;
}

/** One connection per process; Next's dev server reloads modules, hence the global. */
export function getDb(): Db {
  if (!globalThis.__payenceDb) globalThis.__payenceDb = open();
  return globalThis.__payenceDb;
}

export { schema };
