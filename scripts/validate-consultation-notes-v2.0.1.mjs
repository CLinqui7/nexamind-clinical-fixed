import fs from 'node:fs';

const app = fs.readFileSync('src/app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

const checks = {
  signedNoteButton: app.includes("${signed ? 'Ver nota'") && app.includes('openConsultationNote(patient, note)'),
  signedReadOnly: app.includes('notebook-readonly-field') && app.includes('Nota clínica firmada y cerrada'),
  allClinicalSectionsVisible: [
    'Notas libres',
    'Motivo y temas principales',
    'Evolución desde la última visita',
    'Estado mental',
    'Riesgo y seguridad',
    'Medicamentos y tolerabilidad',
    'Intervención realizada',
    'Impresión clínica',
    'Plan',
    'Seguimiento',
  ].every(label => app.includes(label)),
  signedCannotEdit: app.includes('if (signed || current.__readOnly) return;'),
  closeDoesNotMislabelSigned: app.includes("if (!signed && !encounter.__readOnly) this.notify('La nota quedó guardada como borrador.')"),
  responsiveActions: css.includes('.consultation-note-actions') && css.includes('.notebook-readonly-value'),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('LINKARE_CONSULTATION_NOTES_QA_FAILED', failed);
  console.error(JSON.stringify(checks, null, 2));
  process.exit(1);
}

console.log('LINKARE_CONSULTATION_NOTES_QA_OK');
console.log(JSON.stringify(checks, null, 2));
