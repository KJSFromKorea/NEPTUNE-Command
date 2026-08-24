import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb, closeDb } from "./client.js";

const dir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "migrations");

async function ensureTable() {
  await getDb().query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
}

async function checksum(sql: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(sql).digest("hex");
}

async function main() {
  await ensureTable();
  const files = (await readdir(dir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  for (const file of files) {
    const version = file.split("-")[0].split(".")[0];
    const sql = await readFile(join(dir, file), "utf8");
    const sum = await checksum(sql);
    const existing = await getDb().query<{ checksum: string }>("SELECT checksum FROM schema_migrations WHERE version=$1", [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== sum) throw new Error(`Migration checksum mismatch: ${file}`);
      continue;
    }
    const client = await getDb().connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version, checksum) VALUES($1,$2)", [version, sum]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeDb);
