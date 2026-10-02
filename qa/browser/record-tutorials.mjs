// Reproducible, patient-free training videos. Run only against qa/browser/server.mjs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultPermissions } from '../../src/domain/permissions.js';

const base = 'http://127.0.0.1:4173';
const output = new URL('../../public/tutorials/', import.meta.url);
const browser = await chromium.launch({ channel: process.env.LINKARE_BROWSER || 'msedge', headless: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'linkare-training-'));

async function login(page, role) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo').fill(`${role}@example.invalid`);
  await page.locator('input[type=password]').fill('qa-password-123');
  await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).click();
  await page.getByRole('button', { name: 'Ayuda', exact: true }).waitFor();
}

async function shot(page, selector = null) {
  await page.waitForTimeout(260);
  // Screenshots become public media. Replace isolated login identities and QA
  // labels in the rendered DOM; the actual fixture remains confined to qa/.
  await page.evaluate(() => {
    const replacements = [
      [/QA Isolated/g, 'Consultorio de práctica'],
      [/QA Owner/g, 'Médico de ejemplo'],
      [/Secretaría QA/g, 'Secretaría de ejemplo'],
      [/owner@example\.invalid/g, 'medico@ejemplo.invalid'],
      [/secretary@example\.invalid/g, 'secretaria@ejemplo.invalid'],
      [/doctor@example\.invalid/g, 'doctora@ejemplo.invalid'],
      [/nurse@example\.invalid/g, 'enfermeria@ejemplo.invalid'],
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      let value = text.nodeValue;
      for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
      if (value !== text.nodeValue) text.nodeValue = value;
    }
  });
  const surface = selector ? page.locator(selector) : page;
  return `data:image/png;base64,${(await surface.screenshot({ animations: 'disabled' })).toString('base64')}`;
}

async function prepareFixture(page) {
  await login(page, 'owner');
  const setup = await page.request.post(`${base}/__qa`, { data: {
    user: '10000000-0000-4000-8000-000000000001', team: true,
    teamInput: { action: 'update', userId: '10000000-0000-4000-8000-000000000005', name: 'Secretaría QA', role: 'secretary', title: '', phone: '', permissions: defaultPermissions('secretary') },
  } });
  assert.equal((await setup.json()).error, null);
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  if (!await page.getByText('Paciente de demostración', { exact: true }).count()) {
    await page.getByRole('button', { name: 'Nuevo paciente', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre completo').fill('Paciente de demostración');
    await dialog.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('35');
    await dialog.getByLabel('Diagnóstico principal').fill('Ejemplo de capacitación');
    await dialog.getByRole('button', { name: 'Crear paciente', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByText('Paciente de demostración', { exact: true }).first().waitFor();
  }
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.calendar-choice').first().click();
  await dialog.getByLabel('Clase de evento').selectOption('appointment');
  await dialog.locator('[data-tour="appointment-form-who-when"] select').first().selectOption({ index: 1 });
  const nextDay = new Date(Date.now() + 86400000);
  await dialog.getByLabel('Fecha y hora').fill(`${nextDay.getFullYear()}-${String(nextDay.getMonth()+1).padStart(2,'0')}-${String(nextDay.getDate()).padStart(2,'0')}T09:00`);
  await dialog.getByLabel('Revisión administrativa').selectOption('pending');
  await dialog.getByRole('button', { name: 'Crear evento', exact: true }).click();
  await page.getByRole('dialog', { name: 'Detalle de la cita' }).waitFor();
  await page.keyboard.press('Escape');
}

async function captureOwner(page) {
  const images = {};
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  images.dashboard = await shot(page);
  images.dayAgenda = await shot(page, '[data-tour="dashboard-agenda"]');
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  images.patients = await shot(page);
  await page.locator('.patient-card').first().click();
  images.patient = await shot(page);
  await page.getByRole('tab', { name: 'Medicamentos', exact: true }).click();
  images.medications = await shot(page);
  await page.getByRole('button', { name: 'Agregar medicamento', exact: true }).first().click();
  images.medicationForm = await shot(page);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Consultas', exact: true }).click();
  images.consultations = await shot(page);
  await page.getByRole('tab', { name: 'Recetas', exact: true }).click();
  images.prescriptions = await shot(page);
  await page.getByRole('button', { name: 'Nueva receta', exact: true }).first().click();
  images.prescriptionForm = await shot(page);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Documentos', exact: true }).click();
  images.documents = await shot(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  images.agenda = await shot(page);
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click();
  images.event = await shot(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  images.settings = await shot(page);
  const secretary = page.locator('.team-member', { hasText: 'secretaria@ejemplo.invalid' });
  await secretary.getByRole('button', { name: 'Permisos', exact: true }).click();
  images.permissions = await shot(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.getByRole('tab', { name: 'Guía rápida' }).click();
  images.help = await shot(page);
  return images;
}

async function captureSecretary(page) {
  const images = {};
  images.dashboard = await shot(page);
  await page.getByRole('button', { name: 'Pacientes', exact: true }).click();
  images.patients = await shot(page);
  await page.getByRole('button', { name: 'Por revisar', exact: true }).click();
  assert.ok(await page.getByText('Paciente de demostración', { exact: true }).count(), 'Secretary review filter must show the marked patient');
  assert.equal(await page.getByText('Ejemplo de capacitación', { exact: true }).count(), 0, 'Secretary review must not expose the private diagnosis');
  images.review = await shot(page);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.locator('.patient-card').first().click();
  images.patient = await shot(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  images.agenda = await shot(page);
  await page.getByRole('button', { name: 'Nuevo evento', exact: true }).click();
  images.event = await shot(page);
  const dialog = page.getByRole('dialog');
  await dialog.locator('.calendar-choice').first().click();
  images.selected = await shot(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await page.getByRole('tab', { name: 'Guía rápida' }).click();
  images.help = await shot(page);
  return images;
}

const secretaryScenes = images => [
  ['01 · Bienvenida', 'Dos secretarias, dos cuentas', 'Cada secretaria entra con su propio correo y crea su contraseña desde la invitación. Nunca compartan la cuenta.', images.dashboard],
  ['02 · Inicio', 'Prioridades del día', 'El tablero administrativo muestra citas, confirmaciones y recordatorios sin abrir la historia clínica privada.', images.dashboard],
  ['03 · Pacientes', 'Buscar y registrar', 'Desde Pacientes busque por nombre, teléfono o seguro. Nuevo paciente abre solo los campos autorizados.', images.patients],
  ['04 · Por revisar', 'Pendientes administrativos', 'Por revisar muestra pacientes con una cita marcada para revisión administrativa. Sin próxima cita es un filtro distinto.', images.review],
  ['05 · Ficha', 'Datos administrativos', 'La ficha muestra contacto, seguro y citas. Los datos clínicos reservados siguen fuera del alcance de Secretaría.', images.patient],
  ['06 · Captura segura', 'Solo lo autorizado', 'Si tiene permiso, registre medicamentos informados para revisión médica y documentos administrativos. No emita nuevas recetas.', images.patient],
  ['06 · Agenda', 'Tres calendarios visibles', 'Active Doctor, Esposa y General según los permisos de su cuenta. Ocultar un filtro no borra ningún evento.', images.agenda],
  ['07 · Nuevo evento', 'Primero elija calendario', 'El formulario no preselecciona un destino. Elija el calendario antes de paciente, fecha, hora y tipo de evento.', images.event],
  ['08 · Confirmación', 'Compruebe su elección', 'El calendario seleccionado queda marcado claramente. Revise todo antes de crear la cita o el evento general.', images.selected],
  ['09 · Recordatorios', 'Consentimiento primero', 'Abra la cita para marcar confirmación y revisión administrativa. Compruebe canal, teléfono y consentimiento antes de enviar.', images.agenda],
  ['10 · Recetas', 'Corregir o anular', 'Con permiso puede corregir o anular una receta existente con motivo. Nunca la borre ni emita una nueva desde Secretaría.', images.patient],
  ['11 · Documentos', 'Plantillas administrativas', 'Nuevo documento permite generar constancias e incapacidades. Revise variables y PDF; el archivo permanece privado.', images.patient],
  ['12 · Seguridad', 'Acceso individual', 'Los permisos se asignan por persona y calendario. Si falta una acción, pida al doctor que la habilite; no comparta claves.', images.dashboard],
  ['13 · Continuidad', 'Guardado y ayuda', 'Espere “Cambios guardados”. Si hay un error, no cierre la página. Ayuda conserva el video, la guía y el recorrido interactivo.', images.help],
];

const doctorScenes = images => [
  ['01 · Bienvenida', 'La jornada del médico', 'Linkare reúne seguimiento clínico, expediente, calendario y equipo del consultorio en una sola ruta de trabajo.', images.dashboard],
  ['02 · Inicio', 'Revise prioridades', 'Las señales del tablero orientan la revisión. Abra el expediente antes de tomar decisiones clínicas.', images.dashboard],
  ['03 · Agenda del día', 'Lista clínica imprimible', 'Horario real, paciente, medicamento activo y cambio relevante. Se genera desde las citas y puede imprimirse desde Inicio.', images.dayAgenda],
  ['03 · Pacientes', 'Busque el expediente', 'Pacientes organiza la información y permite registrar una ficha nueva con datos clínicos iniciales.', images.patients],
  ['04 · Expediente', 'Evolución e historial', 'Abra la ficha para revisar medicamentos, dosis, evolución, documentos y consultas. Una nota firmada conserva su versión.', images.patient],
  ['05 · Tratamiento', 'Cambios trazables', 'Medicamentos, dosis y registros informados se revisan aquí. Una corrección mantiene el historial y no borra lo anterior.', images.medications],
  ['06 · Medicamento', 'Notas y mediodía', 'Registre dosis, frecuencia, notas y fecha. Active solo tras revisar; suspender conserva el historial y las recetas antiguas.', images.medicationForm],
  ['06 · Consulta', 'Documente y firme', 'La libreta permite tomar notas durante la atención. Compruebe el guardado antes de firmar; una nota firmada no se reemplaza.', images.consultations],
  ['07 · Recetas', 'Versiones seguras', 'Cree, corrija o anule con motivo. Las recetas anuladas permanecen visibles como parte del historial.', images.prescriptions],
  ['08 · Receta nueva', 'Tratamiento como origen', 'Elija medicamentos existentes o agregue uno manualmente. La receta guarda una instantánea; observaciones internas no se imprimen.', images.prescriptionForm],
  ['09 · Documentos', 'Plantillas médicas', 'En Documentos use Nuevo documento: constancia, incapacidad, carta o formulario. El PDF privado queda vinculado al expediente.', images.documents],
  ['08 · Calendarios', 'Visibilidad y alcance', 'Doctor, Esposa y General pueden verse juntos o filtrados. El acceso de cada usuario se define por calendario y acción.', images.agenda],
  ['09 · Citas', 'Destino explícito', 'Nuevo evento exige elegir calendario. Una cita lleva paciente y horario; Evento general sirve para reuniones o bloqueos.', images.event],
  ['10 · Equipo', 'Cuentas individuales', 'Invite a cada secretaria o enfermera por correo. Cada persona crea su contraseña; no existe una clave compartida.', images.settings],
  ['11 · Permisos', 'Conceda lo necesario', 'Revise casillas generales y permisos por calendario. Guarde y confirme el acceso con una cuenta del rol correspondiente.', images.permissions],
  ['12 · Continuidad', 'Ayuda y guardado', 'Compruebe “Cambios guardados”. La guía y el recorrido pueden abrirse de nuevo desde Ayuda.', images.help],
];

function storyboardHtml() {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:Arial,system-ui,sans-serif;color:#092f60;background:#eaf1f7}
  .canvas{position:relative;width:100%;height:100%;padding:29px;background:radial-gradient(circle at 93% 3%,#d0e7ee,transparent 35%),linear-gradient(135deg,#f4f8fb,#e7eff5)}
  header{height:65px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:800;letter-spacing:-.04em}.mark{display:grid;place-items:center;width:43px;height:43px;border-radius:14px;color:#fff;background:linear-gradient(145deg,#4396b0,#05316e);font-size:23px}.course{padding:9px 14px;border:1px solid #c8dbe8;border-radius:30px;background:#fff;color:#3c6885;font-size:14px;font-weight:700}
  main{display:grid;grid-template-columns:789px 1fr;gap:20px;height:632px;align-items:stretch}.screen{display:grid;place-items:center;overflow:hidden;border:8px solid #fff;border-radius:26px;background:#dce9f2;box-shadow:0 18px 40px #153f671c}.screen img{width:100%;height:100%;object-fit:contain;object-position:center;transition:transform .7s ease,opacity .4s ease}.text{display:flex;flex-direction:column;justify-content:center;padding:38px;border:1px solid #d5e3ed;border-radius:26px;background:#fff;box-shadow:0 18px 40px #153f6715}.kicker{color:#257da0;font-size:14px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.text h1{margin:18px 0;color:#062f62;font-size:42px;line-height:1.05;letter-spacing:-.055em}.text p{color:#4d6c82;font-size:22px;line-height:1.46}.tag{margin-top:16px;padding:13px 15px;border-radius:13px;background:#e9f5f3;color:#256061;font-size:14px;font-weight:700}
  footer{display:flex;justify-content:space-between;align-items:center;height:61px;color:#47708b;font-size:13px;font-weight:700}.dots{display:flex;gap:7px}.dots i{width:17px;height:6px;border-radius:6px;background:#bfd3e1}.dots i.active{width:39px;background:#1d779f}
  .reveal .screen img{animation:picture .85s ease both}.reveal .text{animation:card .65s ease both}@keyframes picture{from{opacity:.38;transform:scale(1.035)}to{opacity:1;transform:scale(1)}}@keyframes card{from{opacity:.5;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  </style><div class="canvas"><header><div class="brand"><span class="mark">✦</span><span>Linkare<span style="color:#4b95ad">.</span> Aprende</span></div><span class="course"></span></header><main><div class="screen"><img alt="Pantalla de Linkare"></div><div class="text"><span class="kicker"></span><h1></h1><p></p><div class="tag">Demostración con datos ficticios</div></div></main><footer><span>Capacitación visual · Pause cuando quiera</span><div class="dots"></div></footer></div>`;
}

async function recordCourse(role, scenes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: temp, size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  await page.setContent(storyboardHtml());
  for (let index = 0; index < scenes.length; index++) {
    const [kicker, title, copy, image] = scenes[index];
    await page.evaluate(({ kicker, title, copy, image, role, index, length }) => {
      const canvas = document.querySelector('.canvas');
      canvas.classList.remove('reveal');
      document.querySelector('.course').textContent = `Tutorial para ${role}`;
      document.querySelector('.screen img').src = image;
      document.querySelector('.kicker').textContent = `${String(index + 1).padStart(2, '0')} · ${kicker.replace(/^\d+\s*·\s*/, '')}`;
      document.querySelector('.text h1').textContent = title;
      document.querySelector('.text p').textContent = copy;
      document.querySelector('.dots').innerHTML = Array.from({ length }, (_, i) => `<i class="${i === index ? 'active' : ''}"></i>`).join('');
      void canvas.offsetWidth;
      canvas.classList.add('reveal');
    }, { kicker, title, copy, image, role, index, length: scenes.length });
    await page.waitForTimeout(index === 0 ? 6200 : 7200);
  }
  const recording = await page.video().path();
  await page.close();
  await context.close();
  await fs.mkdir(output, { recursive: true });
  const target = new URL(role === 'Secretaría' ? 'secretaria.webm' : 'doctor.webm', output);
  await fs.copyFile(recording, target);
  console.log(`${target.pathname} ${(await fs.stat(target)).size} bytes`);
}

try {
  const owner = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await prepareFixture(owner);
  const doctorImages = await captureOwner(owner);
  await owner.close();
  const secretary = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await login(secretary, 'secretary');
  const secretaryImages = await captureSecretary(secretary);
  await secretary.close();
  await recordCourse('Secretaría', secretaryScenes(secretaryImages));
  await recordCourse('Médico', doctorScenes(doctorImages));
  console.log('TRAINING_VIDEOS_OK: isolated QA screenshots only, no production records');
} finally {
  await browser.close();
  await fs.rm(temp, { recursive: true, force: true });
}
