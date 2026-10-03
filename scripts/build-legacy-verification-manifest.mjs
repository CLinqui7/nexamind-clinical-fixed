import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readZipEntries } from './lib/zip-reader.mjs';
import { readFoxProArchive } from './lib/foxpro-reader.mjs';
import { buildLegacyPlan, stableJson } from './lib/legacy-plan.mjs';

const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const sourceZip = path.resolve(value('--source-zip') || '');
const organizationId = value('--organization');
const sourceSystem = value('--source') || 'foxpro-linkare';
const expectedBackupSha = value('--backup-sha');
const output = path.resolve(value('--output') || 'legacy-verification-manifest.private.json');
if (!fs.existsSync(sourceZip)) throw new Error('SOURCE_ZIP_NOT_FOUND');
const backupSha = crypto.createHash('sha256').update(fs.readFileSync(sourceZip)).digest('hex');
if (expectedBackupSha && expectedBackupSha.toLowerCase() !== backupSha) {
  throw new Error('BACKUP_SHA256_MISMATCH');
}

const { records, publicReport } = buildLegacyPlan({
  tables: readFoxProArchive(readZipEntries(sourceZip)),
  organizationId,
  sourceSystem,
  backupSha,
});
const publicKeys = new Set([
  'id', 'name', 'initials', 'age', 'phone', 'email', 'photo', 'insurance', 'nextVisit',
  'archived', 'archivedAt', 'archivedBy', 'archiveReason', 'createdAt', 'updatedAt',
  'notificationPreferences',
]);
const hash = valueToHash => crypto.createHash('sha256').update(stableJson(valueToHash)).digest('hex');
const patients = new Map();

for (const record of records) {
  if (record.destinationKind === 'patient_admin') {
    const publicPayload = Object.fromEntries(
      Object.entries(record.payload).filter(([key]) => publicKeys.has(key)),
    );
    publicPayload.id = record.destinationId;
    patients.set(record.destinationId, {
      id: record.destinationId,
      publicPayloadHash: hash(publicPayload),
      summaryHash: hash({
        dataQuality: 'historical',
        sourceSummary: record.payload.sourceSummary || {},
        historicalProfile: record.payload.historicalProfile || {},
      }),
      history: [],
    });
  }
}

let textMemos = 0;
for (const record of records) {
  for (const entry of record.historyEntries || []) {
    const patient = patients.get(entry.patientId);
    if (!patient) throw new Error('MANIFEST_HISTORY_PATIENT_NOT_FOUND');
    if (typeof entry.payload?.text === 'string' && entry.payload.text.length > 0) textMemos += 1;
    patient.history.push({
      id: entry.id,
      scope: entry.scope,
      occurredOn: entry.occurredOn,
      title: entry.title,
      payload: entry.payload,
      sourceTable: record.sourceTable,
      sourceKeyHash: record.sourceKeyHash,
    });
  }
}

const manifestPatients = [...patients.values()].map(patient => {
  patient.history.sort((left, right) => left.id.localeCompare(right.id));
  const administrative = patient.history.filter(entry => entry.scope === 'administrative').length;
  const clinical = patient.history.length - administrative;
  return {
    id: patient.id,
    publicPayloadHash: patient.publicPayloadHash,
    summaryHash: patient.summaryHash,
    administrativeHistory: administrative,
    clinicalHistory: clinical,
    historyHash: hash(patient.history),
  };
}).sort((left, right) => left.id.localeCompare(right.id));

const manifest = {
  format: 'linkare-legacy-verification-manifest-v1',
  organizationId,
  sourceSystem,
  backupSha,
  planSha: publicReport.planSha,
  sourceRows: publicReport.sourceRows,
  destination: publicReport.destination,
  dispositions: publicReport.dispositions,
  textMemos,
  patients: manifestPatients,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(output, `${JSON.stringify(manifest)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`LEGACY_VERIFICATION_MANIFEST_OK patients=${manifestPatients.length} history=${publicReport.destination.administrativeHistory + publicReport.destination.clinicalHistory} plan=${publicReport.planSha}`);
