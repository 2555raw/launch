import "server-only";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Minimal database access layer.
 *
 * - With DATABASE_URL set (Supabase, Railway, any Postgres) it uses the
 *   `postgres` driver over a pooled connection.
 * - Without it, it boots an embedded PGlite (Postgres compiled to WASM) under
 *   .data/pglite so the whole app runs locally with zero setup.
 *
 * Both run the exact same SQL, including the migrations in supabase/migrations.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs a multi-statement script without parameters (migrations). */
  exec(text: string): Promise<void>;
}

export interface Db extends Queryable {
  kind: "postgres" | "pglite";
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

type Global = typeof globalThis & { __trailfiDb?: Promise<Db> };
const g = globalThis as Global;

async function createPostgres(): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env.databaseUrl, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // required for Supabase's transaction pooler (port 6543)
    types: { bigint: postgres.BigInt },
    connection: { TimeZone: "UTC" }, // "today" always means the UTC day, everywhere
  });
  const run = (s: typeof sql) => ({
    async query<T>(text: string, params: unknown[] = []) {
      return (await s.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await s.unsafe(text).simple();
    },
  });
  return {
    kind: "postgres",
    ...run(sql),
    async tx(fn) {
      return (await sql.begin((t) => fn(run(t as unknown as typeof sql)))) as never;
    },
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.resolve(process.cwd(), env.pgliteDir);
  mkdirSync(path.dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  await db.exec("set timezone to 'UTC'");
  type Conn = {
    query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
    exec: (t: string) => Promise<unknown>;
  };
  const wrap = (q: Conn) => ({
    async query<T>(text: string, params: unknown[] = []) {
      return (await q.query(text, params)).rows as T[];
    },
    async exec(text: string) {
      await q.exec(text);
    },
  });
  // PGlite is single-connection: serialise transactions so they never interleave.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    kind: "pglite",
    ...wrap(db),
    tx(fn) {
      const next = chain.then(() => db.transaction((t) => fn(wrap(t))));
      chain = next.catch(() => undefined);
      return next;
    },
  };
}

async function migrate(db: Db) {
  await db.query(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await db.query<{ name: string }>("select name from _migrations")).map((r) => r.name));
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    await db.tx(async (q) => {
      await q.exec(sql);
      await q.query("insert into _migrations (name) values ($1)", [file]);
    });
    console.info(`[db] applied migration ${file}`);
  }
}

export function getDb(): Promise<Db> {
  if (!g.__trailfiDb) {
    g.__trailfiDb = (async () => {
      const db = env.databaseUrl ? await createPostgres() : await createPglite();
      if (db.kind === "pglite" || env.autoMigrate) await migrate(db);
      return db;
    })().catch((err) => {
      g.__trailfiDb = undefined;
      throw err;
    });
  }
  return g.__trailfiDb;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await getDb()).tx(fn);
}
