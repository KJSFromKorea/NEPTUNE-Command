import { getDb } from "./client.js";

/** Runtime-safe DB shape generator for the current PostgreSQL schema. It emits interfaces from information_schema. */
async function main() {
  const db = getDb();
  const { rows } = await db.query<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string }>(`
    SELECT table_name,column_name,data_type,udt_name,is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' ORDER BY table_name,ordinal_position
  `);
  const map = new Map<string, typeof rows>();
  for (const r of rows) map.set(r.table_name, [...(map.get(r.table_name) ?? []), r]);
  const ts = (r: (typeof rows)[number]) => {
    if (r.data_type === 'boolean') return 'boolean';
    if (/int|numeric|real|double|decimal/.test(r.data_type)) return 'number';
    if (r.data_type === 'json' || r.data_type === 'jsonb') return 'unknown';
    if (r.data_type === 'ARRAY') return 'unknown[]';
    return 'string';
  };
  let out = `// GENERATED FILE. Do not edit. Generated ${new Date().toISOString()}\n\n`;
  for (const [table, cols] of map) {
    out += `export interface ${table.replace(/[^a-zA-Z0-9]/g,'_')}Row {\n`;
    for (const c of cols) out += `  ${JSON.stringify(c.column_name)}${c.is_nullable === 'YES' ? '?' : ''}: ${ts(c)}${c.is_nullable === 'YES' ? ' | null' : ''};\n`;
    out += `}\n\n`;
  }
  process.stdout.write(out);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
