// Applies supabase/migrations/*.sql to DATABASE_URL (Supabase or any Postgres).
// Usage: DATABASE_URL=postgres://… npm run db:migrate
// The embedded PGlite database migrates itself on first use, so this is only
// needed for a hosted database (or when DB_AUTO_MIGRATE=false).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const dir = path.join(process.cwd(), "supabase", "migrations");

try {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from _migrations`).map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (already applied)`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(path.join(dir, file), "utf8")).simple();
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
  }
} finally {
  await sql.end();
}
