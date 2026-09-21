import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/** Each test file gets its own throwaway SQLite file, migrated from scratch. */
export function useTempDb() {
  const dir = mkdtempSync(join(tmpdir(), "payence-test-"));
  process.env.DATABASE_URL = join(dir, "test.db");
  delete (globalThis as { __payenceDb?: unknown }).__payenceDb;
}
