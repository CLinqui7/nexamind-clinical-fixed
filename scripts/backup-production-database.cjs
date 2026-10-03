const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');

const output = process.argv[2];
if (!output) throw new Error('Usage: node backup-production-database.cjs <output.json>');

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

async function main() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('set role postgres');
  const schemas = ['public', 'linkare_private'];
  const tables = (await client.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type = $1 and table_schema = any($2::text[])
      order by 1, 2`,
    ['BASE TABLE', schemas],
  )).rows;
  const backup = {
    format: 'linkare-logical-backup-v1',
    createdAt: new Date().toISOString(),
    projectRef: 'fvucylgrqgxjqabacnlt',
    gitCommit: '263e0b881f32a8fbb46beaa49804f626313fb603',
    tables: {},
    schema: {},
  };
  for (const table of tables) {
    const key = `${table.table_schema}.${table.table_name}`;
    backup.tables[key] = (await client.query(
      `select * from ${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)}`,
    )).rows;
  }
  if (!Object.hasOwn(backup.tables, 'public.linkare_records')) {
    throw new Error('Backup validation failed: public.linkare_records is missing.');
  }
  backup.schema.columns = (await client.query(
    `select table_schema, table_name, column_name, ordinal_position, data_type,
            udt_name, is_nullable, column_default
       from information_schema.columns
      where table_schema = any($1::text[])
      order by 1, 2, 4`,
    [schemas],
  )).rows;
  backup.schema.constraints = (await client.query(
    `select n.nspname schema_name, c.relname table_name, con.conname,
            pg_get_constraintdef(con.oid, true) definition
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1::text[])
      order by 1, 2, 3`,
    [schemas],
  )).rows;
  backup.schema.indexes = (await client.query(
    `select schemaname, tablename, indexname, indexdef
       from pg_indexes
      where schemaname = any($1::text[])
      order by 1, 2, 3`,
    [schemas],
  )).rows;
  backup.schema.functions = (await client.query(
    `select n.nspname schema_name, p.proname,
            pg_get_function_identity_arguments(p.oid) arguments,
            pg_get_functiondef(p.oid) definition
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any($1::text[])
      order by 1, 2, 3`,
    [schemas],
  )).rows;
  backup.schema.triggers = (await client.query(
    `select n.nspname schema_name, c.relname table_name, t.tgname,
            pg_get_triggerdef(t.oid, true) definition
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname = any($1::text[])
      order by 1, 2, 3`,
    [schemas],
  )).rows;
  backup.schema.policies = (await client.query(
    `select * from pg_policies
      where schemaname = any($1::text[])
      order by schemaname, tablename, policyname`,
    [schemas],
  )).rows;
  await client.end();
  const serialized = JSON.stringify(backup);
  fs.writeFileSync(output, serialized);
  process.stdout.write(JSON.stringify({
    tableCounts: Object.fromEntries(
      Object.entries(backup.tables).map(([key, rows]) => [key, rows.length]),
    ),
    plainSha256: crypto.createHash('sha256').update(serialized).digest('hex'),
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
