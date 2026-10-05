import { normalizePracticePhones, sortPrescriptionItemsBySchedule } from './practice.js';

const NAVY = [5, 49, 110];
const MUTED = [82, 103, 125];
const BORDER = [215, 225, 235];
const SOFT = [244, 248, 251];
const PAPER = [252, 253, 246];
const DANGER = [163, 38, 38];

const clean = value => String(value ?? '').trim();

function stableDate(value) {
  const text = clean(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function longDate(value) {
  return new Intl.DateTimeFormat('es-SV', { dateStyle: 'long' }).format(stableDate(value));
}

function lines(doc, value, width) {
  const result = doc.splitTextToSize(clean(value), width);
  return Array.isArray(result) ? result : [String(result || '')];
}

function safeFilePart(value, fallback) {
  const normalized = clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return safe || fallback;
}

export function prescriptionPdfFileName(patient, prescription) {
  const number = safeFilePart(prescription?.number, 'receta');
  const patientName = safeFilePart(patient?.name, 'paciente');
  return `Receta_${number}_${patientName}.pdf`;
}

function drawImage(doc, dataUrl, x, y, width, height) {
  const match = /^data:image\/(png|jpe?g|webp);base64,/i.exec(clean(dataUrl));
  if (!match) return false;
  const format = match[1].toLowerCase() === 'jpg' ? 'JPEG' : match[1].toUpperCase();
  try {
    doc.addImage(dataUrl, format, x, y, width, height, undefined, 'FAST');
    return true;
  } catch (_) {
    return false;
  }
}

function drawTableHeader(doc, y) {
  doc.setFillColor(...NAVY);
  doc.rect(16, y, 178, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 19, y + 5.8);
  doc.text('Medicamento', 29, y + 5.8);
  doc.text('Indicación', 84, y + 5.8);
  doc.text('Cantidad', 164, y + 5.8);
  return y + 9;
}

function drawPageFooter(doc, organization, page, total) {
  doc.setDrawColor(...BORDER);
  doc.line(16, 280, 194, 280);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const footer = clean(organization.prescriptionFooter) || 'Documento para revisión y firma del profesional tratante.';
  doc.text(lines(doc, footer, 125).slice(0, 2), 16, 284);
  doc.text(`${clean(organization.name)}  |  Página ${page} de ${total}`, 194, 284, { align: 'right' });
}

export function buildPrescriptionPdfDocument(PdfConstructor, data, patient, prescription) {
  if (typeof PdfConstructor !== 'function') throw new Error('No se pudo iniciar el generador PDF.');
  if (!patient || !prescription) throw new Error('No se encontró la receta para generar el PDF.');

  const organization = data?.organization || {};
  // Privacy contract: only the patient's name is read for this document.
  const patientName = clean(patient.name) || 'Paciente';
  const items = sortPrescriptionItemsBySchedule(prescription.items || []);
  const doc = new PdfConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.setProperties({
    title: clean(prescription.number) || 'Receta',
    subject: 'Receta médica',
    author: clean(prescription.doctorName || organization.clinician),
    creator: 'Linkare',
  });

  const hasLogo = drawImage(doc, organization.clinicLogo, 16, 15, 25, 19);
  const clinicX = hasLogo ? 46 : 16;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(lines(doc, organization.name || 'Consultorio de Psiquiatría', 95).slice(0, 2), clinicX, 19);
  doc.setFontSize(9);
  doc.text(clean(organization.clinician || prescription.doctorName), clinicX, 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(clean(organization.specialty || 'Psiquiatría'), clinicX, 31.5);
  const identity = [organization.professionalLicense, organization.address].map(clean).filter(Boolean).join(' - ');
  if (identity) doc.text(lines(doc, identity, 103).slice(0, 2), clinicX, 36);
  const phoneLine = normalizePracticePhones(organization).map(item => `${item.label}: ${item.number}`).join(' - ');
  if (phoneLine) doc.text(lines(doc, phoneLine, 103).slice(0, 2), clinicX, identity ? 40 : 36);

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(clean(prescription.number) || 'Receta', 194, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(longDate(prescription.date), 194, 26, { align: 'right' });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(16, 46, 194, 46);

  let y = 52;
  const voided = prescription.status === 'voided' || Boolean(prescription.archivedAt);
  if (voided) {
    doc.setDrawColor(...DANGER);
    doc.setTextColor(...DANGER);
    doc.setLineWidth(1.2);
    doc.rect(16, y, 178, 17);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('RECETA ANULADA', 105, y + 7, { align: 'center' });
    doc.setFontSize(8);
    doc.text(lines(doc, prescription.voidReason || 'Anulada en el expediente', 160).slice(0, 2), 105, y + 12, { align: 'center' });
    y += 22;
  }

  doc.setFillColor(...PAPER);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(16, y, 178, 17, 2, 2, 'FD');
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Paciente', 21, y + 5);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(lines(doc, patientName, 165).slice(0, 2), 21, y + 11);
  y += 23;

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.text('Rx', 16, y + 5);
  y += 10;
  y = drawTableHeader(doc, y);

  const addContinuationPage = () => {
    doc.addPage();
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${clean(prescription.number) || 'Receta'} - ${patientName}`, 16, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Continuación', 194, 18, { align: 'right' });
    return drawTableHeader(doc, 25);
  };

  items.forEach((item, index) => {
    const medication = lines(doc, clean(item.medication) || 'Medicamento', 48);
    const strength = clean(item.strength) ? lines(doc, item.strength, 48) : [];
    const indication = lines(doc, item.directions, 72);
    const detail = [item.duration ? `Duración: ${clean(item.duration)}` : '', clean(item.notes)].filter(Boolean).flatMap(value => lines(doc, value, 72));
    const quantity = lines(doc, item.quantity || '-', 26);
    const lineCount = Math.max(1, medication.length + strength.length, indication.length + detail.length, quantity.length);
    const rowHeight = Math.max(13, 6 + lineCount * 4.2);
    if (y + rowHeight > 260) y = addContinuationPage();

    doc.setFillColor(index % 2 ? 255 : 250, index % 2 ? 255 : 252, index % 2 ? 255 : 254);
    doc.rect(16, y, 178, rowHeight, 'F');
    doc.setDrawColor(...BORDER);
    doc.line(16, y + rowHeight, 194, y + rowHeight);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(index + 1), 19, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(medication, 29, y + 6);
    let medY = y + 6 + medication.length * 4.2;
    if (strength.length) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(strength, 29, medY);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    doc.text(indication, 84, y + 6);
    let detailY = y + 6 + indication.length * 4.2;
    if (detail.length) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(detail, 84, detailY);
    }
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(quantity, 164, y + 6);
    y += rowHeight;
  });

  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Sin medicamentos registrados en esta receta.', 21, y + 9);
    y += 17;
  }

  const instructions = clean(prescription.generalInstructions);
  if (instructions) {
    const instructionLines = lines(doc, instructions, 160);
    const boxHeight = 12 + instructionLines.length * 4.1;
    if (y + boxHeight > 252) y = addContinuationPage();
    y += 7;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(143, 172, 203);
    doc.setLineWidth(1);
    doc.line(16, y, 16, y + boxHeight);
    doc.rect(16, y, 178, boxHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('Indicaciones generales', 21, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(instructionLines, 21, y + 11);
    y += boxHeight;
  }

  if (y + 35 > 267) {
    doc.addPage();
    y = 30;
  } else {
    y += 16;
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.25);
  doc.line(123, y + 10, 194, y + 10);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(clean(prescription.doctorName || organization.clinician), 158.5, y + 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(clean(organization.specialty), 158.5, y + 19, { align: 'center' });
  doc.text('Firma y sello', 158.5, y + 23, { align: 'center' });

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawPageFooter(doc, organization, page, total);
  }
  return doc;
}

export async function downloadPrescriptionPdf(data, patient, prescription) {
  const { jsPDF } = await import('jspdf');
  const doc = buildPrescriptionPdfDocument(jsPDF, data, patient, prescription);
  const filename = prescriptionPdfFileName(patient, prescription);
  await doc.save(filename, { returnPromise: true });
  return filename;
}
