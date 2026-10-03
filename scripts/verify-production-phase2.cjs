const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { Client, Pool } = require('pg');

const output = process.argv[2];
if (!output) throw new Error('Usage: node verify-production-phase2.cjs <report.json>');

const connection = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
};

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
};
const timing = (values) => ({
  samples: values.length,
  p50Ms: Number(percentile(values, 0.5).toFixed(2)),
  p95Ms: Number(percentile(values, 0.95).toFixed(2)),
  p99Ms: Number(percentile(values, 0.99).toFixed(2)),
  maxMs: Number(Math.max(...values, 0).toFixed(2)),
});

async function canonicalSignature(client) {
  return (await client.query(`
    select count(*)::integer count,
           coalesce(sum(revision), 0)::bigint revision_sum,
           md5(coalesce(string_agg(
             organization_id::text || '|' || kind || '|' || id || '|' || revision::text || '|' ||
             deleted::text || '|' || payload::text,
             E'\n' order by organization_id, kind, id
           ), '')) fingerprint
      from public.linkare_records
  `)).rows[0];
}

async function runBackfill(client, organizationId, phase) {
  let cursor = null;
  let calls = 0;
  let processed = 0;
  do {
    const result = (await client.query(
      'select public.linkare_projection_backfill_v1($1,$2,$3,1000) result',
      [organizationId, phase, cursor],
    )).rows[0].result;
    calls += 1;
    processed += Number(result.processed || 0);
    cursor = result.nextId || null;
    if (!result.hasMore) return { calls, processed, state: result.state };
  } while (calls < 10000);
  throw new Error(`Backfill did not terminate for phase ${phase}.`);
}

async function authenticatedChecks(client, organizationId, memberId, patientId) {
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [memberId]);
    await client.query('set local role authenticated');
    const bootstrap = (await client.query(
      'select public.linkare_bootstrap_state_v4($1) result', [organizationId],
    )).rows[0].result;
    const profileAssets = (await client.query(
      'select public.linkare_profile_assets_v1($1) result', [organizationId],
    )).rows[0].result;
    const directory = (await client.query(
      "select public.linkare_patient_directory_v1($1,'all',null,null,null,20) result",
      [organizationId],
    )).rows[0].result;
    const dashboard = (await client.query(
      'select public.linkare_dashboard_summary_v1($1,null) result', [organizationId],
    )).rows[0].result;
    const agenda = (await client.query(
      "select public.linkare_agenda_range_v1($1,now()-interval '31 days',now()+interval '31 days',null,null,200) result",
      [organizationId],
    )).rows[0].result;
    let detail = null;
    if (patientId) {
      detail = (await client.query(
        'select public.linkare_patient_detail_v1($1,$2) result',
        [organizationId, patientId],
      )).rows[0].result;
    }
    return {
      bootstrapReady: bootstrap?.projection?.ready === true,
      bootstrapBytes: Buffer.byteLength(JSON.stringify(bootstrap)),
      profileAssetsBytes: Buffer.byteLength(JSON.stringify(profileAssets)),
      profileAssetKeys: Object.keys(profileAssets?.organization || {}).sort(),
      bootstrapComponentBytes: Object.fromEntries(
        Object.entries(bootstrap?.payload || {}).map(([key, value]) => [
          key,
          Buffer.byteLength(JSON.stringify(value)),
        ]),
      ),
      bootstrapComponentKeys: Object.fromEntries(
        Object.entries(bootstrap?.payload || {}).map(([key, value]) => [
          key,
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.keys(value).sort()
            : null,
        ]),
      ),
      directoryItems: directory?.items?.length || 0,
      directoryLimit: directory?.limit,
      directoryBytes: Buffer.byteLength(JSON.stringify(directory)),
      dashboardTotal: Number(dashboard?.patients?.total || 0),
      agendaItems: agenda?.items?.length || 0,
      agendaBytes: Buffer.byteLength(JSON.stringify(agenda)),
      detailOpened: patientId ? Boolean(detail?.patient?.id) : null,
      detailClinicalIncluded: patientId ? detail?.clinicalIncluded === true : null,
    };
  } finally {
    await client.query('rollback');
  }
}

async function main() {
  const client = new Client(connection);
  await client.connect();
  await client.query('set role postgres');
  const before = await canonicalSignature(client);
  const organizations = (await client.query(`
    select organization.id,
           (select member.user_id from public.organization_members member
             where member.organization_id=organization.id and member.active
             order by case member.role::text when 'owner' then 0 when 'psychiatrist' then 1 else 2 end
             limit 1) member_id,
           (select member.user_id from public.organization_members member
             where member.organization_id=organization.id and member.active and member.role::text='secretary'
             order by member.user_id limit 1) secretary_id
      from public.organizations organization
     order by organization.id
  `)).rows;
  const report = {
    status: 'PRODUCTION_VERIFICATION',
    projectRef: 'fvucylgrqgxjqabacnlt',
    region: 'us-east-1',
    commit: '263e0b881f32a8fbb46beaa49804f626313fb603',
    generatedAt: new Date().toISOString(),
    canonicalRecords: Number(before.count),
    organizations: [],
    privateTablesDirectAuthenticatedSelect: null,
    performance: {},
  };

  for (let index = 0; index < organizations.length; index += 1) {
    const organization = organizations[index];
    const appointments = await runBackfill(client, organization.id, 'appointments');
    const patients = await runBackfill(client, organization.id, 'patients');
    const counts = (await client.query(`
      select
        count(*) filter(where kind='patient_admin' and not deleted)::integer canonical_patients,
        count(*) filter(where kind='appointment' and not deleted)::integer canonical_appointments,
        (select count(*)::integer from linkare_private.patient_directory_v1 where organization_id=$1) projected_patients,
        (select count(*)::integer from linkare_private.appointment_directory_v1 where organization_id=$1) projected_appointments
      from public.linkare_records where organization_id=$1
    `, [organization.id])).rows[0];
    const firstPatient = (await client.query(
      "select id from public.linkare_records where organization_id=$1 and kind='patient_admin' and not deleted order by id limit 1",
      [organization.id],
    )).rows[0]?.id || null;
    const state = (await client.query(
      'select appointments_ready,patients_ready,listing_version,policy_version from linkare_private.patient_directory_state_v1 where organization_id=$1',
      [organization.id],
    )).rows[0];
    const appChecks = organization.member_id
      ? await authenticatedChecks(client, organization.id, organization.member_id, firstPatient)
      : { skipped: 'NO_ACTIVE_MEMBER' };
    let secretaryClinicalExcluded = null;
    if (organization.secretary_id && firstPatient) {
      const secretary = await authenticatedChecks(
        client, organization.id, organization.secretary_id, firstPatient,
      );
      secretaryClinicalExcluded = secretary.detailClinicalIncluded === false;
    }
    report.organizations.push({
      label: `org-${index + 1}`,
      canonicalPatients: Number(counts.canonical_patients),
      projectedPatients: Number(counts.projected_patients),
      canonicalAppointments: Number(counts.canonical_appointments),
      projectedAppointments: Number(counts.projected_appointments),
      projectionCountsMatch:
        Number(counts.canonical_patients) === Number(counts.projected_patients)
        && Number(counts.canonical_appointments) === Number(counts.projected_appointments),
      state,
      backfill: { appointments, patients },
      authenticated: appChecks,
      secretaryClinicalExcluded,
    });
  }

  const after = await canonicalSignature(client);
  report.canonicalUnchanged = before.count === after.count
    && before.revision_sum === after.revision_sum
    && before.fingerprint === after.fingerprint;
  report.privateTablesDirectAuthenticatedSelect = (await client.query(
    "select has_table_privilege('authenticated','linkare_private.patient_directory_v1','select') allowed",
  )).rows[0].allowed;

  const target = (await client.query(`
    select organization_id, count(*) count
      from linkare_private.patient_directory_v1
     group by organization_id order by count(*) desc limit 1
  `)).rows[0];
  if (target) {
    const listSql = `select patient_id,name,last_activity_on,last_activity_at,next_appointment_at
      from linkare_private.patient_directory_v1
     where organization_id=$1 and not archived
     order by last_activity_on desc nulls last,patient_id desc limit 21`;
    const explain = (await client.query(
      `explain (analyze,buffers,format json) ${listSql}`, [target.organization_id],
    )).rows[0]['QUERY PLAN'][0];
    const sampleRows = (await client.query(listSql, [target.organization_id])).rows;
    report.performance.explain = {
      planningMs: Number(explain['Planning Time'].toFixed(3)),
      executionMs: Number(explain['Execution Time'].toFixed(3)),
      rootNode: explain.Plan['Node Type'],
      actualRows: explain.Plan['Actual Rows'],
      sharedHitBlocks: explain.Plan['Shared Hit Blocks'],
      sharedReadBlocks: explain.Plan['Shared Read Blocks'],
    };
    report.performance.pageBytes = Buffer.byteLength(JSON.stringify(sampleRows));
    report.performance.pageRows = sampleRows.length;
    const pool = new Pool({ ...connection, max: 20 });
    const warm = await Promise.all(Array.from({ length: 20 }, async () => {
      const session = await pool.connect();
      await session.query('set role postgres');
      return session;
    }));
    warm.forEach((session) => session.release());
    for (const concurrency of [1, 5, 20]) {
      const durations = [];
      let errors = 0;
      for (let round = 0; round < 10; round += 1) {
        await Promise.all(Array.from({ length: concurrency }, async () => {
          const started = performance.now();
          try {
            await pool.query(listSql, [target.organization_id]);
          } catch {
            errors += 1;
          } finally {
            durations.push(performance.now() - started);
          }
        }));
      }
      report.performance[`concurrentReads${concurrency}`] = { ...timing(durations), errors };
    }
    await pool.end();
  }
  await client.end();
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(JSON.stringify({
    status: report.status,
    canonicalRecords: report.canonicalRecords,
    canonicalUnchanged: report.canonicalUnchanged,
    organizations: report.organizations.map((organization) => ({
      label: organization.label,
      projectionCountsMatch: organization.projectionCountsMatch,
      ready: organization.state?.appointments_ready && organization.state?.patients_ready,
      authenticated: organization.authenticated?.bootstrapReady === true,
      secretaryClinicalExcluded: organization.secretaryClinicalExcluded,
    })),
    privateTablesDirectAuthenticatedSelect: report.privateTablesDirectAuthenticatedSelect,
    performance: report.performance,
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
