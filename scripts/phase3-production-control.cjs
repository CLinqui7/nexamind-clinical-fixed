const fs = require('node:fs');
const crypto = require('node:crypto');
const { Client } = require('pg');

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const mode = value('--mode');
const output = value('--output');
const targetEmail = value('--email');
const organizationId = value('--organization');
const batchId = value('--batch');
const backupSha = value('--backup-sha');
const planSha = value('--plan-sha');
const baselinePath = value('--baseline');
const manifestPath = value('--manifest');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/i;

if (!['preflight', 'collisions', 'progress', 'backfill', 'verify'].includes(mode)) {
  throw new Error('MODE_INVALID');
}
if (!output) throw new Error('OUTPUT_REQUIRED');

const connection = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeReport(report) {
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function signature(client, org, negate = false) {
  const operator = negate ? '<>' : '=';
  const result = (await client.query(`
    select count(*)::bigint count,
           coalesce(sum(revision), 0)::bigint revision_sum,
           md5(coalesce(string_agg(
             organization_id::text || '|' || kind || '|' || id || '|' ||
             revision::text || '|' || deleted::text || '|' || payload::text,
             E'\\n' order by organization_id, kind, id
           ), '')) fingerprint
      from public.linkare_records
     where organization_id ${operator} $1
  `, [org])).rows[0];
  return {
    count: Number(result.count),
    revisionSum: Number(result.revision_sum),
    fingerprint: result.fingerprint,
  };
}

async function signatureExcludingBatch(client, org, excludedBatchId) {
  const result = (await client.query(`
    select count(*)::bigint count,
           coalesce(sum(revision), 0)::bigint revision_sum,
           md5(coalesce(string_agg(
             organization_id::text || '|' || kind || '|' || id || '|' ||
             revision::text || '|' || deleted::text || '|' || payload::text,
             E'\\n' order by organization_id, kind, id
           ), '')) fingerprint
      from public.linkare_records record
     where organization_id=$1
       and not (record.kind='patient_admin' and exists(
         select 1 from linkare_private.legacy_source_records_v2 source
          where source.batch_id=$2 and source.destination_kind='patient_admin'
            and source.destination_id=record.id and not source.rolled_back
       ))
  `, [org, excludedBatchId])).rows[0];
  return {
    count: Number(result.count),
    revisionSum: Number(result.revision_sum),
    fingerprint: result.fingerprint,
  };
}

async function externalEffects(client, org) {
  const row = (await client.query(`
    select
      count(*) filter(where kind='appointment')::bigint appointments,
      count(*) filter(where kind='appointment_clinical')::bigint appointment_clinical,
      count(*) filter(where kind='patient_clinical')::bigint patient_clinical,
      count(*) filter(where kind='patient_clinical' and jsonb_array_length(coalesce(payload->'medications','[]'))>0)::bigint patients_with_medications,
      coalesce(sum(case when kind='patient_clinical' then jsonb_array_length(coalesce(payload->'medications','[]')) else 0 end),0)::bigint medications,
      coalesce(sum(case when kind='patient_clinical' then jsonb_array_length(coalesce(payload->'prescriptions','[]')) else 0 end),0)::bigint prescriptions
    from public.linkare_records where organization_id=$1
  `, [org])).rows[0];
  const notifications = (await client.query(
    'select count(*)::bigint count from public.linkare_notification_deliveries where organization_id=$1',
    [org],
  )).rows[0].count;
  return Object.fromEntries(
    Object.entries({ ...row, notifications }).map(([key, item]) => [key, Number(item)]),
  );
}

async function authenticatedAccess(client, userId, org) {
  await client.query('begin');
  try {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    await client.query('set local role authenticated');
    const access = (await client.query(`
      select public.linkare_role_v3($1)::text role,
             public.linkare_permission_v3($1,'patientsView') patients_view,
             public.linkare_permission_v3($1,'clinicalView') clinical_view,
             public.linkare_permission_v3($1,'appointmentsManage') appointments_manage
    `, [org])).rows[0];
    return access;
  } finally {
    await client.query('rollback');
  }
}

async function targetContext(client, email) {
  const rows = (await client.query(`
    select u.email,u.id::text user_id,m.organization_id::text organization_id,
           o.name organization_name,m.role::text membership_role,m.active,m.permissions
      from auth.users u
      left join public.organization_members m on m.user_id=u.id
      left join public.organizations o on o.id=m.organization_id
     where lower(u.email)=lower($1)
     order by m.active desc,m.organization_id
  `, [email])).rows;
  for (const row of rows) {
    row.effectiveAccess = row.organization_id && row.active
      ? await authenticatedAccess(client, row.user_id, row.organization_id)
      : null;
  }
  return rows;
}

async function targetCounts(client, org) {
  const counts = (await client.query(`
    select
      count(*)::bigint canonical_records,
      count(*) filter(where kind='patient_admin' and not deleted)::bigint patients,
      count(*) filter(where kind='appointment' and not deleted)::bigint appointments,
      count(*) filter(where kind='patient_clinical' and not deleted)::bigint patient_clinical,
      (select count(*)::bigint from linkare_private.legacy_patient_summary_v1 where organization_id=$1) legacy_patients,
      (select count(*)::bigint from linkare_private.legacy_history_v1 where organization_id=$1) legacy_history,
      (select count(*)::bigint from linkare_private.patient_directory_v1 where organization_id=$1) projected_patients,
      (select count(*)::bigint from linkare_private.appointment_directory_v1 where organization_id=$1) projected_appointments
      from public.linkare_records where organization_id=$1
  `, [org])).rows[0];
  return Object.fromEntries(Object.entries(counts).map(([key, item]) => [key, Number(item)]));
}

async function preflight(client) {
  if (!targetEmail) throw new Error('EMAIL_REQUIRED');
  if (!SHA.test(String(backupSha || ''))) throw new Error('BACKUP_SHA_REQUIRED');
  const targets = await targetContext(client, targetEmail);
  const active = targets.filter((target) => target.active && target.organization_id);
  const report = {
    status: active.length === 1 ? 'TARGET_VERIFIED' : 'TARGET_AMBIGUOUS',
    projectRef: 'fvucylgrqgxjqabacnlt',
    targetEmail,
    targets,
    backupSha,
    generatedAt: new Date().toISOString(),
    migrations: (await client.query(`
      select version from supabase_migrations.schema_migrations
       where version=any(array['20261003010000','20261003061842','20261003074514'])
       order by version
    `)).rows.map((row) => row.version),
    databaseBytes: Number((await client.query('select pg_database_size(current_database())::bigint bytes')).rows[0].bytes),
  };
  if (active.length === 1) {
    const org = active[0].organization_id;
    report.organizationId = org;
    report.counts = await targetCounts(client, org);
    report.targetSignature = await signature(client, org);
    report.otherOrganizationsSignature = await signature(client, org, true);
    report.externalEffects = await externalEffects(client, org);
    report.projectionState = (await client.query(`
      select appointments_ready,patients_ready,listing_version,policy_version,updated_at
        from linkare_private.patient_directory_state_v1 where organization_id=$1
    `, [org])).rows[0] || null;
    report.activeMembers = (await client.query(`
      select role::text role,count(*)::integer count
        from public.organization_members where organization_id=$1 and active group by role order by role
    `, [org])).rows;
    report.calendars = (await client.query(`
      select code,is_active from public.linkare_calendars_v1 where organization_id=$1 order by code
    `, [org])).rows;
    report.matchingBatches = (await client.query(`
      select batch_id::text,source_system,backup_sha,plan_sha,approved_commit,status,
             applied_rows::bigint,imported_patients::bigint,imported_history::bigint,
             created_at,updated_at,completed_at
        from linkare_private.legacy_migration_batches_v2
       where organization_id=$1 and source_system='foxpro-linkare' and backup_sha=$2
       order by created_at
    `, [org, backupSha])).rows;
  }
  return report;
}

async function progress(client) {
  if (!UUID.test(String(organizationId || '')) || !UUID.test(String(batchId || ''))) {
    throw new Error('ORGANIZATION_AND_BATCH_REQUIRED');
  }
  const batch = (await client.query(`
    select batch_id::text,organization_id::text,source_system,backup_sha,plan_sha,
           approved_commit,status,applied_rows::bigint,imported_patients::bigint,
           imported_history::bigint,created_at,updated_at,completed_at
      from linkare_private.legacy_migration_batches_v2
     where organization_id=$1 and batch_id=$2
  `, [organizationId, batchId])).rows[0] || null;
  const ledger = (await client.query(`
    select count(*)::bigint rows,coalesce(jsonb_object_agg(disposition,total),'{}') dispositions
      from (select disposition,count(*)::bigint total
              from linkare_private.legacy_source_records_v2
             where organization_id=$1 and batch_id=$2 and not rolled_back group by disposition) grouped
  `, [organizationId, batchId])).rows[0];
  return {
    status: 'READ_ONLY_PROGRESS',
    projectRef: 'fvucylgrqgxjqabacnlt',
    batch,
    ledger: { rows: Number(ledger.rows), dispositions: ledger.dispositions },
    generatedAt: new Date().toISOString(),
  };
}

async function collisionCheck(client) {
  if (!UUID.test(String(organizationId || '')) || !manifestPath) {
    throw new Error('COLLISION_ARGUMENTS_REQUIRED');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'linkare-legacy-verification-manifest-v1'
    || manifest.organizationId !== organizationId) throw new Error('VERIFICATION_MANIFEST_MISMATCH');
  const ids = manifest.patients.map(patient => patient.id);
  const unique = new Set(ids);
  let collisions = 0;
  for (let offset = 0; offset < ids.length; offset += 1000) {
    collisions += Number((await client.query(`
      select count(*)::integer count from public.linkare_records
       where organization_id=$1 and kind='patient_admin' and id=any($2::text[])
    `, [organizationId, ids.slice(offset, offset + 1000)])).rows[0].count);
  }
  return {
    status: collisions === 0 && unique.size === ids.length
      ? 'DESTINATION_IDENTITIES_CLEAR' : 'DESTINATION_IDENTITY_CONFLICT',
    projectRef: 'fvucylgrqgxjqabacnlt',
    organizationId,
    plannedPatients: ids.length,
    duplicatePlannedIds: ids.length - unique.size,
    existingDestinationCollisions: collisions,
    mergeByNameOrPhone: false,
    generatedAt: new Date().toISOString(),
  };
}

async function runBackfill(client) {
  if (!UUID.test(String(organizationId || ''))) throw new Error('ORGANIZATION_REQUIRED');
  const phases = [];
  for (const phase of ['appointments', 'patients']) {
    let cursor = null;
    let processed = 0;
    let calls = 0;
    while (true) {
      const result = (await client.query(
        'select public.linkare_projection_backfill_v1($1,$2,$3,1000) result',
        [organizationId, phase, cursor],
      )).rows[0].result;
      calls += 1;
      processed += Number(result.processed || 0);
      cursor = result.nextId || null;
      if (!result.hasMore) {
        phases.push({ phase, calls, processed, state: result.state });
        break;
      }
      if (calls > 10000) throw new Error('BACKFILL_DID_NOT_TERMINATE');
    }
  }
  return {
    status: 'TARGET_PROJECTION_BACKFILLED',
    projectRef: 'fvucylgrqgxjqabacnlt',
    organizationId,
    phases,
    counts: await targetCounts(client, organizationId),
    generatedAt: new Date().toISOString(),
  };
}

function sameObject(left, right) {
  const normalize = input => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input).sort().map(key => [key, normalize(input[key])]));
    }
    return input;
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function stableJson(valueToSerialize) {
  if (Array.isArray(valueToSerialize)) return `[${valueToSerialize.map(stableJson).join(',')}]`;
  if (valueToSerialize && typeof valueToSerialize === 'object') {
    return `{${Object.keys(valueToSerialize).sort()
      .filter(key => valueToSerialize[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJson(valueToSerialize[key])}`).join(',')}}`;
  }
  return JSON.stringify(valueToSerialize);
}

function contentHash(valueToHash) {
  return sha256(stableJson(valueToHash));
}

async function contentReconciliation(client, manifest) {
  const expected = new Map(manifest.patients.map(patient => [patient.id, patient]));
  const observed = new Map();
  const patientRows = (await client.query(`
    select summary.patient_id,record.payload,summary.data_quality,
           summary.source_summary,summary.historical_profile
      from linkare_private.legacy_patient_summary_v1 summary
      join public.linkare_records record
        on record.organization_id=summary.organization_id and record.kind='patient_admin'
       and record.id=summary.patient_id and not record.deleted
     where summary.batch_id=$1
  `, [batchId])).rows;
  for (const row of patientRows) {
    observed.set(row.patient_id, {
      publicPayloadHash: contentHash(row.payload),
      summaryHash: contentHash({
        dataQuality: row.data_quality,
        sourceSummary: row.source_summary,
        historicalProfile: row.historical_profile,
      }),
      history: [],
    });
  }
  const historyRows = (await client.query(`
    select id::text,patient_id,scope,occurred_on::text,title,payload,
           source_table,source_key_hash
      from linkare_private.legacy_history_v1 where batch_id=$1 order by patient_id,id
  `, [batchId])).rows;
  for (const row of historyRows) {
    const patient = observed.get(row.patient_id);
    if (!patient) continue;
    patient.history.push({
      id: row.id,
      scope: row.scope,
      occurredOn: row.occurred_on,
      title: row.title,
      payload: row.payload,
      sourceTable: row.source_table,
      sourceKeyHash: row.source_key_hash,
    });
  }
  let publicPayloadMismatches = 0;
  let summaryMismatches = 0;
  let historyCountMismatches = 0;
  let historyContentMismatches = 0;
  let missingPatients = 0;
  for (const [id, expectedPatient] of expected) {
    const observedPatient = observed.get(id);
    if (!observedPatient) {
      missingPatients += 1;
      continue;
    }
    if (observedPatient.publicPayloadHash !== expectedPatient.publicPayloadHash) publicPayloadMismatches += 1;
    if (observedPatient.summaryHash !== expectedPatient.summaryHash) summaryMismatches += 1;
    const administrative = observedPatient.history.filter(entry => entry.scope === 'administrative').length;
    const clinical = observedPatient.history.length - administrative;
    if (administrative !== expectedPatient.administrativeHistory
      || clinical !== expectedPatient.clinicalHistory) historyCountMismatches += 1;
    if (contentHash(observedPatient.history) !== expectedPatient.historyHash) historyContentMismatches += 1;
  }
  const extraPatients = [...observed.keys()].filter(id => !expected.has(id)).length;
  return {
    expectedPatients: expected.size,
    observedPatients: observed.size,
    missingPatients,
    extraPatients,
    publicPayloadMismatches,
    summaryMismatches,
    historyCountMismatches,
    historyContentMismatches,
  };
}

async function verifyAuthenticatedFlows(client, org, ownerId) {
  const sample = (await client.query(`
    select summary.patient_id,
           coalesce(max(history.occurred_on),date '1900-01-01') last_on,
           count(history.id)::integer history_count
      from linkare_private.legacy_patient_summary_v1 summary
      left join linkare_private.legacy_history_v1 history
        on history.organization_id=summary.organization_id and history.patient_id=summary.patient_id
     where summary.organization_id=$1 and summary.batch_id=$2
     group by summary.patient_id
     order by last_on desc,summary.patient_id limit 1
  `, [org, batchId])).rows[0];
  const oldSample = (await client.query(`
    select summary.patient_id,
           coalesce(max(history.occurred_on),date '1900-01-01') last_on
      from linkare_private.legacy_patient_summary_v1 summary
      left join linkare_private.legacy_history_v1 history
        on history.organization_id=summary.organization_id and history.patient_id=summary.patient_id
     where summary.organization_id=$1 and summary.batch_id=$2
     group by summary.patient_id
     order by last_on,summary.patient_id limit 1
  `, [org, batchId])).rows[0];
  const missingSample = (await client.query(`
    select patient_id from linkare_private.legacy_patient_summary_v1
     where organization_id=$1 and batch_id=$2
       and coalesce((historical_profile->>'nameMissing')::boolean,false)
     order by patient_id limit 1
  `, [org, batchId])).rows[0];
  const secretary = (await client.query(`
    select user_id::text from public.organization_members
     where organization_id=$1 and active and role::text='secretary'
     order by user_id limit 1
  `, [org])).rows[0];

  async function asUser(userId, callback) {
    await client.query('begin');
    try {
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
      await client.query('set local role authenticated');
      return await callback();
    } finally {
      await client.query('rollback');
    }
  }

  const physician = await asUser(ownerId, async () => {
    const recent = (await client.query(
      "select public.linkare_patient_directory_v1($1,'recent',null,null,null,20) value",
      [org],
    )).rows[0].value;
    const allByRecentId = (await client.query(
      "select public.linkare_patient_directory_v1($1,'all',$2,null,null,20) value",
      [org, sample.patient_id],
    )).rows[0].value;
    const allByOldId = (await client.query(
      "select public.linkare_patient_directory_v1($1,'all',$2,null,null,20) value",
      [org, oldSample.patient_id],
    )).rows[0].value;
    const detail = (await client.query(
      'select public.linkare_patient_detail_v1($1,$2) value', [org, sample.patient_id],
    )).rows[0].value;
    const historyOne = (await client.query(
      "select public.linkare_legacy_patient_history_v2($1,$2,'all',null,20) value",
      [org, sample.patient_id],
    )).rows[0].value;
    let historyTwo = null;
    if (historyOne.hasMore) {
      historyTwo = (await client.query(
        "select public.linkare_legacy_patient_history_v2($1,$2,'all',$3,20) value",
        [org, sample.patient_id, historyOne.nextCursor],
      )).rows[0].value;
    }
    const missing = missingSample
      ? (await client.query('select public.linkare_patient_detail_v1($1,$2) value', [org, missingSample.patient_id])).rows[0].value
      : null;
    return {
      recentPageAtMost20: recent.items.length <= 20,
      recentHasExpectedPolicy: recent.limit === 20 && Boolean(recent.cutoffDate),
      recentSampleSearchable: allByRecentId.items.some((item) => item.id === sample.patient_id),
      oldSampleSearchable: allByOldId.items.some((item) => item.id === oldSample.patient_id),
      detailOpened: detail.patient?.id === sample.patient_id,
      clinicalIncluded: detail.clinicalIncluded === true,
      historyFirstPageItems: historyOne.items.length,
      historyHasMore: historyOne.hasMore,
      historySecondPageItems: historyTwo?.items?.length || 0,
      missingIdentityLabeled: missingSample
        ? missing?.patient?.historicalProfile?.nameMissing === true
          && missing?.patient?.name === 'Nombre no registrado (fuente histórica)'
        : null,
    };
  });

  let secretaryChecks = { available: false };
  if (secretary) {
    secretaryChecks = await asUser(secretary.user_id, async () => {
      const detail = (await client.query(
        'select public.linkare_patient_detail_v1($1,$2) value', [org, sample.patient_id],
      )).rows[0].value;
      const history = (await client.query(
        "select public.linkare_legacy_patient_history_v2($1,$2,'all',null,20) value",
        [org, sample.patient_id],
      )).rows[0].value;
      return {
        available: true,
        clinicalDetailExcluded: detail.clinicalIncluded === false,
        clinicalHistoryExcluded: history.clinicalIncluded === false
          && history.items.every((item) => item.scope === 'administrative'),
      };
    });
  }
  return { physician, secretary: secretaryChecks, sampledHistoryCount: sample.history_count };
}

async function finalVerification(client) {
  if (!UUID.test(String(organizationId || '')) || !UUID.test(String(batchId || ''))
    || !SHA.test(String(backupSha || '')) || !SHA.test(String(planSha || ''))
    || !baselinePath || !manifestPath) throw new Error('VERIFY_ARGUMENTS_REQUIRED');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'linkare-legacy-verification-manifest-v1'
    || manifest.organizationId !== organizationId || manifest.backupSha !== backupSha
    || manifest.planSha !== planSha) throw new Error('VERIFICATION_MANIFEST_MISMATCH');
  const batch = (await client.query(`
    select *,source_summary from linkare_private.legacy_migration_batches_v2
     where organization_id=$1 and batch_id=$2 and backup_sha=$3 and plan_sha=$4
  `, [organizationId, batchId, backupSha, planSha])).rows[0];
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  const dispositionRows = (await client.query(`
    select disposition,count(*)::bigint count from linkare_private.legacy_source_records_v2
     where batch_id=$1 and not rolled_back group by disposition order by disposition
  `, [batchId])).rows;
  const dispositions = Object.fromEntries(dispositionRows.map((row) => [row.disposition, Number(row.count)]));
  const history = (await client.query(`
    select count(*)::bigint total,
           count(*) filter(where scope='administrative')::bigint administrative,
           count(*) filter(where scope='clinical')::bigint clinical,
           count(*) filter(where nullif(payload->>'text','') is not null)::bigint text_memos,
           count(*) filter(where not exists(
             select 1 from public.linkare_records record
              where record.organization_id=history.organization_id and record.kind='patient_admin'
                and record.id=history.patient_id and not record.deleted
           ))::bigint orphans
      from linkare_private.legacy_history_v1 history where batch_id=$1
  `, [batchId])).rows[0];
  const patients = (await client.query(`
    select count(*)::bigint total,
           count(*) filter(where coalesce((historical_profile->>'nameMissing')::boolean,false))::bigint name_missing,
           count(*) filter(where not exists(
             select 1 from public.linkare_records record
              where record.organization_id=summary.organization_id and record.kind='patient_admin'
                and record.id=summary.patient_id and not record.deleted
           ))::bigint missing_destination
      from linkare_private.legacy_patient_summary_v1 summary where batch_id=$1
  `, [batchId])).rows[0];
  const ledgerCount = Number((await client.query(
    'select count(*)::bigint count from linkare_private.legacy_source_records_v2 where batch_id=$1 and not rolled_back',
    [batchId],
  )).rows[0].count);
  const target = baseline.targets.find((item) => item.active && item.organization_id === organizationId);
  const flow = await verifyAuthenticatedFlows(client, organizationId, target.user_id);
  const counts = await targetCounts(client, organizationId);
  const effects = await externalEffects(client, organizationId);
  const otherSignature = await signature(client, organizationId, true);
  const preservedTargetSignature = await signatureExcludingBatch(client, organizationId, batchId);
  const content = await contentReconciliation(client, manifest);
  const report = {
    status: 'INDEPENDENT_PRODUCTION_VERIFICATION',
    projectRef: 'fvucylgrqgxjqabacnlt',
    organizationId,
    batch: {
      batchId: batch.batch_id,
      status: batch.status,
      appliedRows: Number(batch.applied_rows),
      importedPatients: Number(batch.imported_patients),
      importedHistory: Number(batch.imported_history),
      approvedCommit: batch.approved_commit,
    },
    reconciliation: {
      expectedSourceRows: Number(batch.source_summary.sourceRows),
      ledgerRows: ledgerCount,
      dispositions,
      dispositionsMatchPlan: sameObject(dispositions, batch.source_summary.dispositions),
      expectedPatients: Number(batch.source_summary.destination.patients),
      patients: Number(patients.total),
      nameMissing: Number(patients.name_missing),
      patientsWithoutDestination: Number(patients.missing_destination),
      expectedAdministrativeHistory: Number(batch.source_summary.destination.administrativeHistory),
      expectedClinicalHistory: Number(batch.source_summary.destination.clinicalHistory),
      administrativeHistory: Number(history.administrative),
      clinicalHistory: Number(history.clinical),
      totalHistory: Number(history.total),
      textMemos: Number(history.text_memos),
      expectedTextMemos: Number(manifest.textMemos),
      orphanHistory: Number(history.orphans),
      content,
    },
    projections: {
      canonicalPatients: counts.patients,
      projectedPatients: counts.projected_patients,
      canonicalAppointments: counts.appointments,
      projectedAppointments: counts.projected_appointments,
      match: counts.patients === counts.projected_patients
        && counts.appointments === counts.projected_appointments,
    },
    protectedExisting: {
      preexistingPatients: baseline.counts.patients,
      targetRecordsBefore: baseline.targetSignature,
      targetRecordsAfterExcludingImport: preservedTargetSignature,
      targetRecordsUnchanged: sameObject(preservedTargetSignature, baseline.targetSignature),
      otherOrganizationsUnchanged: sameObject(otherSignature, baseline.otherOrganizationsSignature),
    },
    externalEffects: {
      before: baseline.externalEffects,
      after: effects,
      unchanged: sameObject(effects, baseline.externalEffects),
    },
    authenticatedFlows: flow,
    generatedAt: new Date().toISOString(),
  };
  report.ok = batch.status === 'completed'
    && report.reconciliation.expectedSourceRows === report.reconciliation.ledgerRows
    && report.reconciliation.dispositionsMatchPlan
    && report.reconciliation.expectedPatients === report.reconciliation.patients
    && report.reconciliation.expectedAdministrativeHistory === report.reconciliation.administrativeHistory
    && report.reconciliation.expectedClinicalHistory === report.reconciliation.clinicalHistory
    && report.reconciliation.patientsWithoutDestination === 0
    && report.reconciliation.orphanHistory === 0
    && report.reconciliation.textMemos === report.reconciliation.expectedTextMemos
    && Object.entries(content).filter(([key]) => key.endsWith('Mismatches') || key.endsWith('Patients'))
      .every(([key, item]) => ['expectedPatients', 'observedPatients'].includes(key) || item === 0)
    && content.expectedPatients === content.observedPatients
    && report.projections.match
    && report.protectedExisting.targetRecordsUnchanged
    && report.protectedExisting.otherOrganizationsUnchanged
    && report.externalEffects.unchanged
    && flow.physician.recentPageAtMost20
    && flow.physician.recentSampleSearchable
    && flow.physician.oldSampleSearchable
    && flow.physician.detailOpened
    && flow.physician.clinicalIncluded
    && (!flow.secretary.available
      || (flow.secretary.clinicalDetailExcluded && flow.secretary.clinicalHistoryExcluded));
  return report;
}

async function main() {
  const client = new Client(connection);
  await client.connect();
  try {
    await client.query('set role postgres');
    let report;
    if (mode === 'preflight') report = await preflight(client);
    else if (mode === 'collisions') report = await collisionCheck(client);
    else if (mode === 'progress') report = await progress(client);
    else if (mode === 'backfill') report = await runBackfill(client);
    else report = await finalVerification(client);
    writeReport(report);
    process.stdout.write(JSON.stringify({
      status: report.status,
      ok: report.ok,
      organizationId: report.organizationId,
      batchStatus: report.batch?.status,
      generatedAt: report.generatedAt,
    }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error).slice(0, 300));
  process.exit(1);
});
