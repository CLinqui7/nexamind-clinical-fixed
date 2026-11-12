import React from 'react';
import htm from 'htm';
import {loadActivityReport} from './services/appState.js';

const html = htm.bind(React.createElement);
const actions = {
  access: 'Entró a Linkare',
  agenda_open: 'Abrió la hoja del día',
  agenda_download: 'Descargó el PDF',
  agenda_print: 'Envió la hoja a imprimir',
};
const roles = {owner: 'Propietario', psychiatrist: 'Médico', clinical_assistant: 'Enfermería', secretary: 'Secretaría'};
const localTime = new Intl.DateTimeFormat('es-SV', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/El_Salvador',
});
const sheetDate = new Intl.DateTimeFormat('es-SV', {dateStyle: 'medium', timeZone: 'UTC'});

export function ActivityReport({initialReport, onLogout}) {
  const [report, setReport] = React.useState(initialReport);
  const [action, setAction] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const inFlight = React.useRef(null);
  const actionId = React.useId();
  React.useEffect(() => () => inFlight.current?.abort(), []);

  const consult = async ({refresh = false, more = false, filter = action} = {}) => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    setError('');
    try {
      const page = await loadActivityReport({
        refresh,
        action: filter || null,
        before: more ? report.next : null,
        asOf: more ? report.asOf : null,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setAction(filter);
      setReport(previous => more ? {...previous, rows: [...previous.rows, ...page.rows], next: page.next} : page);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'No se pudo consultar el registro.');
    } finally {
      inFlight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return html`<main className="activity-report">
    <header className="activity-report-header">
      <div><span className="eyebrow">Linkare</span><h1>Accesos y actividad</h1></div>
      <button className="button button-secondary" type="button" onClick=${onLogout}>Cerrar sesión</button>
    </header>
    <section className="activity-report-card" aria-label="Registro de actividad">
      <div className="activity-report-toolbar">
        <div>
          <p role="status">${report.checkedAt
            ? `Última consulta ${report.checkSource === 'nightly' ? 'programada' : 'manual'} · ${localTime.format(new Date(report.checkedAt))}`
            : 'Pendiente de la primera consulta.'}</p>
          <p>Consulta programada a las 10:00 p. m., hora de El Salvador.</p>
        </div>
        <button className="button button-primary" type="button" disabled=${busy} onClick=${() => consult({refresh: true})}>Consultar</button>
      </div>
      ${error ? html`<p role="alert">${error}</p>` : null}
      <div className="activity-report-filter">
        <label htmlFor=${actionId}>Acción</label>
        <select id=${actionId} disabled=${busy} value=${action} onChange=${event => consult({filter: event.target.value})}>
          <option value="">Todas las acciones</option>
          ${Object.entries(actions).map(([key, label]) => html`<option key=${key} value=${key}>${label}</option>`)}
        </select>
      </div>
      <div className="table-wrap" aria-busy=${busy}>
        <table className="data-table">
          <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Cuenta</th><th scope="col">Consultorio</th><th scope="col">Acción</th><th scope="col">Fecha de la hoja</th></tr></thead>
          <tbody>${report.rows.length ? report.rows.map(row => html`<tr key=${row.id}>
            <td>${localTime.format(new Date(row.at))}</td>
            <td><strong>${row.actor}</strong><small>${roles[row.role] || row.role}</small></td>
            <td>${row.clinic}</td><td>${actions[row.action]}</td>
            <td>${row.agendaDate ? sheetDate.format(new Date(row.agendaDate)) : '—'}</td>
          </tr>`) : html`<tr><td colSpan="5">No hay actividad para mostrar.</td></tr>`}</tbody>
        </table>
      </div>
      ${report.next ? html`<button className="button button-secondary" type="button" disabled=${busy} onClick=${() => consult({more: true})}>Ver más</button>` : null}
      <p className="field-note">La acción de impresión registra el envío al diálogo del navegador. La entrega física depende de la impresora.</p>
    </section>
  </main>`;
}
