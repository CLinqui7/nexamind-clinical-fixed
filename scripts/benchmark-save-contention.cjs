const { Client } = require('pg');
const { performance } = require('node:perf_hooks');

const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const organizationId = value('--organization');
const userId = value('--user');
const scenario = value('--scenario') || 'patient';
const calendarId = value('--calendar');
const concurrency = Number(value('--concurrency') || 20);
const holdMs = Number(value('--hold-ms') || 150);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID.test(String(organizationId || '')) || !UUID.test(String(userId || ''))) throw new Error('IDENTITY_REQUIRED');
if (!['patient', 'appointment', 'appointment-existing'].includes(scenario)) throw new Error('SCENARIO_INVALID');
if (scenario.startsWith('appointment') && !UUID.test(String(calendarId || ''))) throw new Error('CALENDAR_REQUIRED');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 30) throw new Error('CONCURRENCY_INVALID');
if (!Number.isFinite(holdMs) || holdMs < 0 || holdMs > 1000) throw new Error('HOLD_INVALID');

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
const stats = values => ({
  samples: values.length,
  p50Ms: Number(percentile(values, 0.5).toFixed(2)),
  p95Ms: Number(percentile(values, 0.95).toFixed(2)),
  maxMs: Number((Math.max(...values, 0)).toFixed(2)),
});

async function main() {
  const runId = `${Date.now().toString(36)}-${process.pid}`;
  const clients = Array.from({ length: concurrency }, () => new Client(connection));
  const monitor = new Client(connection);
  await Promise.all([...clients.map(client => client.connect()), monitor.connect()]);
  let existingPatientIds = [];
  if (scenario === 'appointment-existing') {
    await monitor.query('set role service_role');
    existingPatientIds = (await monitor.query(`
      select id from public.linkare_records
      where organization_id=$1 and kind='patient_admin' and not deleted
      order by id limit $2
    `, [organizationId, concurrency])).rows.map(row => row.id);
    await monitor.query('reset role');
    if (existingPatientIds.length !== concurrency) throw new Error('NOT_ENOUGH_PATIENTS');
  }
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  let monitoring = true;
  const samples = [];
  const monitorPromise = (async () => {
    while (monitoring) {
      const row = (await monitor.query(`
        select count(*) filter(where state='active')::integer active,
               count(*) filter(where wait_event_type='Lock')::integer lock_waiters,
               coalesce(max(cardinality(pg_blocking_pids(pid))),0)::integer max_blockers,
               coalesce(max(extract(epoch from clock_timestamp()-query_start)*1000),0)::numeric max_query_ms
        from pg_stat_activity
        where datname=current_database() and pid<>pg_backend_pid()
          and query ilike '%linkare_save_changes_v3%'
      `)).rows[0];
      samples.push({
        active: Number(row.active),
        lockWaiters: Number(row.lock_waiters),
        maxBlockers: Number(row.max_blockers),
        maxQueryMs: Number(row.max_query_ms),
      });
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  })();
  const tasks = clients.map((client, index) => (async () => {
    await client.query('begin');
    try {
      await client.query("set local statement_timeout='30s'");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
      await client.query('set local role authenticated');
      await barrier;
      const started = performance.now();
      const id = `incident-rollback-${runId}-${String(index).padStart(2, '0')}`;
      const changes = scenario === 'appointment-existing' ? [] : [{
        kind: 'patient_admin',
        id,
        expectedRevision: 0,
        deleted: false,
        payload: { id, name: `Synthetic rollback ${index}` },
      }];
      if (scenario.startsWith('appointment')) {
        const appointmentId = `${id}-appointment`;
        const patientId = scenario === 'appointment-existing' ? existingPatientIds[index] : id;
        changes.push({
          kind: 'appointment',
          id: appointmentId,
          expectedRevision: 0,
          deleted: false,
          payload: {
            id: appointmentId,
            calendarId,
            eventType: 'appointment',
            patientId,
            title: `Synthetic rollback ${index}`,
            start: '2030-01-15T15:00:00.000Z',
            end: '2030-01-15T15:45:00.000Z',
            type: 'Seguimiento',
            modality: 'Presencial',
            status: 'pending',
            adminReviewStatus: 'none',
            reminderLog: [],
            createdAt: '2030-01-01T00:00:00.000Z',
            updatedAt: '2030-01-01T00:00:00.000Z',
          },
        });
      }
      await client.query('select public.linkare_save_changes_v3($1,$2::jsonb)', [organizationId, JSON.stringify(changes)]);
      const saveMs = performance.now() - started;
      if (holdMs) await client.query('select pg_sleep($1)', [holdMs / 1000]);
      await client.query('rollback');
      return { ok: true, saveMs };
    } catch (error) {
      await client.query('rollback').catch(() => {});
      return { ok: false, code: error.code || 'UNKNOWN', category: error.constructor?.name || 'Error' };
    }
  })());
  release();
  const results = await Promise.all(tasks);
  monitoring = false;
  await monitorPromise;
  await monitor.query('set role service_role');
  const persistence = (await monitor.query(`
    select count(*) filter(where kind='patient_admin')::integer patients,
           count(*) filter(where kind='appointment')::integer appointments
    from public.linkare_records
    where organization_id=$1 and id like $2
  `, [organizationId, `incident-rollback-${runId}-%`])).rows[0];
  await Promise.all([...clients.map(client => client.end()), monitor.end()]);
  const successful = results.filter(result => result.ok);
  const failed = results.filter(result => !result.ok);
  const report = {
    runId,
    organizationId,
    scenario,
    concurrency,
    holdMs,
    outcome: failed.length ? 'FAILED' : 'ROLLED_BACK',
    successfulTransactions: successful.length,
    failedTransactions: failed.length,
    failures: failed,
    saveTiming: stats(successful.map(result => result.saveMs)),
    observed: {
      maxActiveSaves: Math.max(...samples.map(sample => sample.active), 0),
      maxLockWaiters: Math.max(...samples.map(sample => sample.lockWaiters), 0),
      maxBlockersPerPid: Math.max(...samples.map(sample => sample.maxBlockers), 0),
      maxQueryMs: Number(Math.max(...samples.map(sample => sample.maxQueryMs), 0).toFixed(2)),
    },
    persistedSyntheticPatients: Number(persistence.patients),
    persistedSyntheticAppointments: Number(persistence.appointments),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ error: error.message || 'BENCHMARK_FAILED' })}\n`);
  process.exitCode = 1;
});
