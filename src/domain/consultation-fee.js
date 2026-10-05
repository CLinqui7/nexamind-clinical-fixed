export const MAX_CONSULTATION_FEE_CENTS = 10_000_000;

export function parseConsultationFeeInput(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Escriba una tarifa válida con máximo dos decimales.');
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CONSULTATION_FEE_CENTS) throw new Error('La tarifa debe estar entre US$0 y US$100,000.');
  return cents;
}

export function consultationFeeInput(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '';
  return (cents / 100).toFixed(cents % 100 ? 2 : 0);
}

export function formatConsultationFee(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return 'No registrada';
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
}

// Historical staff sometimes put the fee in the patient's name. Recognize only
// an unambiguous parenthesized amount; do not mutate the database automatically.
export function embeddedConsultationFee(name) {
  const source = String(name ?? '').trim();
  const matches = [...source.matchAll(/\(\s*\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*\)/g)];
  if (matches.length !== 1) return { name: source, cents: null, inferred: false };
  let cents;
  try { cents = parseConsultationFeeInput(matches[0][1]); } catch (_) { return { name: source, cents: null, inferred: false }; }
  const cleaned = `${source.slice(0, matches[0].index)} ${source.slice(matches[0].index + matches[0][0].length)}`.replace(/\s+/g, ' ').trim();
  if (!/[\p{L}]/u.test(cleaned)) return { name: source, cents: null, inferred: false };
  return { name: cleaned, cents, inferred: true };
}

export function patientConsultationFee(patient = {}) {
  if (patient.consultationFeeCents === null || patient.consultationFeeCents === undefined || patient.consultationFeeCents === '') {
    const embedded = embeddedConsultationFee(patient.name);
    return { cents: embedded.cents, inferred: embedded.inferred };
  }
  const explicit = Number(patient.consultationFeeCents);
  if (Number.isSafeInteger(explicit) && explicit >= 0 && explicit <= MAX_CONSULTATION_FEE_CENTS) return { cents: explicit, inferred: false };
  const embedded = embeddedConsultationFee(patient.name);
  return { cents: embedded.cents, inferred: embedded.inferred };
}

export function patientDisplayName(patient = {}) {
  return embeddedConsultationFee(patient.name).name || 'Paciente sin nombre';
}
