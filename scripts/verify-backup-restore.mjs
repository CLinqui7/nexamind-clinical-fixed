import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const backupPath = path.resolve(value('--backup') || '');
const output = path.resolve(value('--output') || 'backup-restore-verification.json');
const organizationId = value('--organization');
const ownerId = value('--owner');
if (!fs.existsSync(backupPath)) throw new Error('BACKUP_NOT_FOUND');

const migrations = [
  'supabase/00_BASE.sql',
  'supabase/migrations/202609080001_linkare_v3.sql',
  'supabase/migrations/20260921163356_enable_free_access.sql',
  'supabase/migrations/20260921170106_free_access_and_team_permissions.sql',
  'supabase/migrations/20260921170933_secretary_prescription_corrections.sql',
  'supabase/migrations/20260921182203_archive_prescriptions.sql',
  'supabase/migrations/20260921201729_operational_clinical_lifecycles.sql',
  'supabase/migrations/20260921210315_daily_agenda_and_automation.sql',
  'supabase/migrations/20260921211201_document_templates.sql',
  'supabase/migrations/20260921213000_scoped_calendars_and_family_reminders.sql',
  'supabase/migrations/20260921214500_legacy_migration_staging.sql',
  'supabase/migrations/20260921223000_archive_medications.sql',
  'supabase/migrations/20260921230047_archive_patient_with_audit.sql',
  'supabase/migrations/20260921232000_fix_medication_identity_and_archive.sql',
  'supabase/migrations/20260921233500_hide_reviewed_medications_from_secretary.sql',
  'supabase/migrations/20260921235000_canonicalize_medication_identity.sql',
  'supabase/migrations/20260922043809_clinic_phone_numbers.sql',
  'supabase/migrations/20261002174319_secretary_multi_calendar.sql',
  'supabase/migrations/20261003010000_historical_migration_v2.sql',
  'supabase/migrations/20261003061842_patient_directory_performance.sql',
  'supabase/migrations/20261003074514_lazy_profile_assets.sql',
];

const quote = input => `"${String(input).replaceAll('"', '""')}"`;
const pgArray = values => `{${values.map(item => {
  if (item === null) return 'NULL';
  return `"${String(item).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}).join(',')}}`;

function typeCast(column) {
  if (column.data_type === 'ARRAY') return `${quote(column.udt_name.slice(1))}[]`;
  if (column.data_type === 'USER-DEFINED') return `public.${quote(column.udt_name)}`;
  const allowed = new Set([
    'uuid', 'json', 'jsonb', 'date', 'timestamp with time zone',
    'timestamp without time zone', 'time with time zone', 'time without time zone',
    'boolean', 'smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision',
    'text', 'character varying', 'bytea',
  ]);
  return allowed.has(column.data_type) ? column.data_type : quote(column.udt_name);
}

function parameterValue(valueToConvert, column) {
  if (valueToConvert === null || valueToConvert === undefined) return null;
  if (column.data_type === 'json' || column.data_type === 'jsonb') {
    return JSON.stringify(valueToConvert);
  }
  if (column.data_type === 'ARRAY' && Array.isArray(valueToConvert)) return pgArray(valueToConvert);
  if (column.data_type === 'bytea' && valueToConvert?.type === 'Buffer') {
    return new Uint8Array(valueToConvert.data);
  }
  return valueToConvert;
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
if (backup.format !== 'linkare-logical-backup-v1'
  || backup.projectRef !== 'fvucylgrqgxjqabacnlt'
  || !backup.tables?.['public.linkare_records']) {
  throw new Error('BACKUP_FORMAT_INVALID');
}

const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table storage.buckets(
      id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]
    );
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
  `);
  for (const migration of migrations) await db.exec(fs.readFileSync(migration, 'utf8'));

  const members = backup.tables['public.organization_members'] || [];
  const userIds = [...new Set(members.map(member => member.user_id).filter(Boolean))];
  for (const userId of userIds) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{}')",
      [userId, `restored-${userId}@invalid`],
    );
  }

  const columnsByTable = new Map();
  for (const column of backup.schema.columns) {
    const key = `${column.table_schema}.${column.table_name}`;
    if (!columnsByTable.has(key)) columnsByTable.set(key, new Map());
    columnsByTable.get(key).set(column.column_name, column);
  }

  for (const key of Object.keys(backup.tables)) {
    const [schema, table] = key.split('.');
    const exists = (await db.query('select to_regclass($1) value', [key])).rows[0].value;
    if (exists) continue;
    const columns = [...(columnsByTable.get(key)?.values() || [])];
    if (!columns.length) throw new Error(`BACKUP_COLUMNS_MISSING:${key}`);
    const definitions = columns.map(column => {
      const nullable = column.is_nullable === 'NO' ? ' not null' : '';
      return `${quote(column.column_name)} ${typeCast(column)}${nullable}`;
    });
    await db.exec(`create table ${quote(schema)}.${quote(table)}(${definitions.join(',')})`);
  }

  await db.exec('set session_replication_role=replica');
  const restoreTables = Object.keys(backup.tables).map(key => {
    const [schema, table] = key.split('.');
    return `${quote(schema)}.${quote(table)}`;
  });
  await db.exec(`truncate table ${restoreTables.join(',')} restart identity cascade`);
  const restoredCounts = {};
  for (const [key, rows] of Object.entries(backup.tables)) {
    const [schema, table] = key.split('.');
    const columnMetadata = columnsByTable.get(key);
    if (!columnMetadata) throw new Error(`BACKUP_COLUMNS_MISSING:${key}`);
    const identityColumns = new Set((await db.query(`
      select column_name from information_schema.columns
       where table_schema=$1 and table_name=$2 and is_identity='YES'
    `, [schema, table])).rows.map(row => row.column_name));
    for (const row of rows) {
      const names = Object.keys(row);
      const values = names.map(name => parameterValue(row[name], columnMetadata.get(name)));
      const placeholders = names.map((name, index) => {
        const metadata = columnMetadata.get(name);
        if (!metadata) throw new Error(`BACKUP_COLUMN_UNKNOWN:${key}:${name}`);
        return `$${index + 1}::${typeCast(metadata)}`;
      });
      try {
        await db.query(
          `insert into ${quote(schema)}.${quote(table)}(${names.map(quote).join(',')})${identityColumns.size ? ' overriding system value' : ''} values(${placeholders.join(',')})`,
          values,
        );
      } catch (error) {
        throw new Error(`RESTORE_INSERT_FAILED:${key}:${String(error?.message || error).slice(0, 120)}`);
      }
    }
    restoredCounts[key] = Number((await db.query(
      `select count(*)::integer count from ${quote(schema)}.${quote(table)}`,
    )).rows[0].count);
  }
  await db.exec('set session_replication_role=origin');

  const countMismatches = Object.entries(backup.tables)
    .filter(([key, rows]) => restoredCounts[key] !== rows.length)
    .map(([key, rows]) => ({ table: key, expected: rows.length, restored: restoredCounts[key] }));
  const referential = (await db.query(`
    select
      count(*) filter(where kind='patient_admin' and not deleted)::integer patients,
      count(*) filter(where kind='appointment' and not deleted)::integer appointments,
      count(*)::integer records
      from public.linkare_records where organization_id=$1
  `, [organizationId])).rows[0];
  const orphanMembers = Number((await db.query(`
    select count(*)::integer count from public.organization_members member
     where not exists(select 1 from public.organizations org where org.id=member.organization_id)
  `)).rows[0].count);

  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ownerId]);
  await db.exec('set role authenticated');
  const access = (await db.query(`
    select public.linkare_role_v3($1)::text role,
           public.linkare_permission_v3($1,'patientsView') patients_view,
           public.linkare_permission_v3($1,'clinicalView') clinical_view
  `, [organizationId])).rows[0];
  const directory = (await db.query(
    "select public.linkare_patient_directory_v1($1,'all',null,null,null,20) value",
    [organizationId],
  )).rows[0].value;
  await db.exec('reset role');

  const report = {
    status: countMismatches.length === 0 && orphanMembers === 0
      && access.patients_view && access.clinical_view ? 'BACKUP_RESTORE_VERIFIED' : 'BACKUP_RESTORE_FAILED',
    projectRef: backup.projectRef,
    backupCreatedAt: backup.createdAt,
    backupGitCommit: backup.gitCommit,
    tables: Object.keys(backup.tables).length,
    restoredRows: Object.values(restoredCounts).reduce((sum, count) => sum + count, 0),
    countMismatches,
    orphanMembers,
    target: {
      patients: Number(referential.patients),
      appointments: Number(referential.appointments),
      records: Number(referential.records),
      ownerRole: access.role,
      ownerPatientsView: access.patients_view,
      ownerClinicalView: access.clinical_view,
      directoryPageAtMost20: directory.items.length <= 20,
    },
    engine: 'PGlite isolated PostgreSQL',
    containsPatientData: false,
    verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(JSON.stringify({
    status: report.status,
    tables: report.tables,
    restoredRows: report.restoredRows,
    countMismatches: report.countMismatches.length,
  }));
  if (report.status !== 'BACKUP_RESTORE_VERIFIED') process.exitCode = 1;
} catch (error) {
  console.error(String(error?.message || error).slice(0, 300));
  process.exitCode = 1;
} finally {
  await db.close();
}
