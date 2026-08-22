const defaultClinicLogo = '/assets/linkare-logo.jpg';
const runtimeEnv = import.meta.env ?? {};
const DAY = 24 * 60 * 60 * 1000;

export const SCALE_CATALOG = [
  { code: 'PHQ-9', label: 'Síntomas depresivos', min: 0, max: 27, direction: 'lower' },
  { code: 'GAD-7', label: 'Ansiedad', min: 0, max: 21, direction: 'lower' },
  { code: 'YMRS', label: 'Síntomas maníacos', min: 0, max: 60, direction: 'lower' },
  { code: 'ASRS', label: 'Síntomas de TDAH', min: 0, max: 24, direction: 'lower' },
  { code: 'PANSS', label: 'Síntomas psicóticos', min: 30, max: 210, direction: 'lower' },
  { code: 'Y-BOCS', label: 'Síntomas obsesivo-compulsivos', min: 0, max: 40, direction: 'lower' },
  { code: 'ISI', label: 'Insomnio', min: 0, max: 28, direction: 'lower' },
  { code: 'SDS', label: 'Dificultad funcional', min: 0, max: 30, direction: 'lower' },
  { code: 'CGI-S', label: 'Gravedad clínica global', min: 1, max: 7, direction: 'lower' },
];

export const MEDICATION_CLASSES = [
  'ISRS', 'IRSN', 'Antidepresivo atípico', 'Antipsicótico', 'Estabilizador del ánimo',
  'Estimulante', 'No estimulante para TDAH', 'Benzodiazepina', 'Hipnótico', 'Otro',
];

export const FREQUENCIES = [
  'cada mañana', 'cada noche', 'cada 12 horas', 'cada 8 horas', 'una vez al día',
  'dos veces al día', 'según necesidad (PRN)', 'otra',
];

export const COMMON_ADVERSE_EFFECTS = [
  'Náusea', 'Somnolencia', 'Insomnio', 'Aumento de peso', 'Pérdida de peso',
  'Disminución de apetito', 'Aumento de apetito', 'Disfunción sexual', 'Temblor',
  'Inquietud o acatisia', 'Rigidez o parkinsonismo', 'Mareo', 'Cefalea',
  'Estreñimiento', 'Boca seca', 'Palpitaciones', 'Dificultad cognitiva', 'Otro',
];


export function isoDate(offset = 0, hour = 9, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setTime(date.getTime() + offset * DAY);
  return date.toISOString();
}

export function dateOnly(offset = 0) {
  return isoDate(offset).slice(0, 10);
}

const assessment = (code, label, values, offsets, direction = 'lower') => ({
  code,
  label,
  direction,
  points: values.map((value, index) => ({ date: isoDate(offsets[index], 8), value })),
});

export function createSeedData() {
  const patients = [
    {
      id: 'p1', initials: 'VM', name: 'Valeria Moreno', age: 34, sex: 'F', phone: '+503 7001 2041',
      photo: '', insurance: { hasInsurance: true, provider: 'Seguro Centroamericano', plan: 'Plan Médico Ejecutivo', memberId: 'SC-204184', policyNumber: 'POL-83041', authorizationRequired: false, copay: 'US$20', notes: 'Verificar vigencia en cada trimestre.' },
      diagnosis: 'Trastorno depresivo mayor', diagnosisCode: 'F33.1', risk: 'low', status: 'responding',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-14), nextVisit: isoDate(0, 10, 30),
      medication: { id: 'm1', name: 'Sertralina', dose: '100 mg', frequency: 'cada mañana', startDate: isoDate(-84), indication: 'Depresión', class: 'ISRS' },
      assessments: [
        assessment('PHQ-9', 'Síntomas depresivos', [20, 17, 13, 9, 7], [-84, -63, -42, -21, -5]),
        assessment('GAD-7', 'Ansiedad', [13, 11, 8, 6, 5], [-84, -63, -42, -21, -5]),
        assessment('SDS', 'Discapacidad funcional', [18, 16, 11, 8, 6], [-84, -63, -42, -21, -5]),
      ],
      adherence: 94, functioningChange: 35, sleepBaseline: 5.1, sleepCurrent: 7.0,
      vitals: { baselineWeight: 68.2, weight: 68.8, bmi: 25.4, bp: '116/74', pulse: 71 },
      adverseEvents: [{ name: 'Náusea', severity: 'mild', onset: isoDate(-80), status: 'resolved', relation: 'Temporalidad compatible; mejoró sin intervención.' }],
      labs: [{ name: 'Sodio', value: '139', unit: 'mmol/L', status: 'normal', date: isoDate(-12) }],
      timeline: [
        { date: isoDate(-84), type: 'medication', title: 'Inicio de sertralina 50 mg', detail: 'Indicación: episodio depresivo.' },
        { date: isoDate(-63), type: 'assessment', title: 'PHQ-9: 17', detail: 'Reducción inicial de síntomas.' },
        { date: isoDate(-42), type: 'medication', title: 'Aumento a sertralina 100 mg', detail: 'Persistencia de síntomas residuales.' },
        { date: isoDate(-5), type: 'assessment', title: 'PHQ-9: 7', detail: 'Respuesta clínica observada durante tratamiento.' },
      ],
    },
    {
      id: 'p2', initials: 'AC', name: 'Andrés Castillo', age: 42, sex: 'M', phone: '+503 7012 6610',
      diagnosis: 'Trastorno bipolar I', diagnosisCode: 'F31.2', risk: 'medium', status: 'stable',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-28), nextVisit: isoDate(2, 14, 0),
      medication: { id: 'm2', name: 'Litio', dose: '900 mg', frequency: 'dividido cada 12 h', startDate: isoDate(-210), indication: 'Mantenimiento', class: 'Estabilizador del ánimo' },
      assessments: [assessment('YMRS', 'Síntomas maníacos', [22, 14, 8, 5, 4], [-210, -150, -90, -35, -7])],
      adherence: 91, functioningChange: 28, sleepBaseline: 4.4, sleepCurrent: 7.2,
      vitals: { baselineWeight: 82.5, weight: 84.0, bmi: 27.8, bp: '124/78', pulse: 68 },
      adverseEvents: [{ name: 'Temblor fino', severity: 'mild', onset: isoDate(-170), status: 'active', relation: 'Apareció tras titulación; requiere seguimiento clínico.' }],
      labs: [
        { name: 'Litio sérico', value: '0.82', unit: 'mmol/L', status: 'normal', date: isoDate(-20) },
        { name: 'TSH', value: '4.9', unit: 'mUI/L', status: 'high', date: isoDate(-190) },
        { name: 'eGFR', value: '86', unit: 'mL/min/1.73m²', status: 'normal', date: isoDate(-20) },
      ],
      timeline: [
        { date: isoDate(-210), type: 'medication', title: 'Inicio de litio', detail: 'Protocolo de monitorización activado.' },
        { date: isoDate(-20), type: 'lab', title: 'Litio sérico 0.82 mmol/L', detail: 'Resultado registrado como dentro del rango configurado.' },
        { date: isoDate(-3), type: 'alert', title: 'TSH pendiente de actualización', detail: 'La periodicidad debe validarse por el médico.' },
      ],
    },
    {
      id: 'p3', initials: 'CR', name: 'Camila Rivas', age: 29, sex: 'F', phone: '+503 7118 4502',
      diagnosis: 'TDAH, presentación combinada', diagnosisCode: 'F90.2', risk: 'low', status: 'responding',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-18), nextVisit: isoDate(1, 9, 0),
      medication: { id: 'm3', name: 'Lisdexanfetamina', dose: '40 mg', frequency: 'cada mañana', startDate: isoDate(-70), indication: 'TDAH', class: 'Estimulante' },
      assessments: [assessment('ASRS', 'Síntomas de TDAH', [16, 13, 10, 8, 7], [-70, -56, -35, -18, -4])],
      adherence: 96, functioningChange: 42, sleepBaseline: 6.2, sleepCurrent: 6.5,
      vitals: { baselineWeight: 61.0, weight: 59.8, bmi: 22.3, bp: '122/76', pulse: 82 },
      adverseEvents: [{ name: 'Disminución de apetito', severity: 'mild', onset: isoDate(-66), status: 'active', relation: 'Inicio posterior al tratamiento; peso estable en rango de vigilancia.' }],
      labs: [],
      timeline: [
        { date: isoDate(-70), type: 'medication', title: 'Inicio de lisdexanfetamina 30 mg', detail: 'Se registraron presión, pulso y peso basales.' },
        { date: isoDate(-35), type: 'medication', title: 'Aumento a 40 mg', detail: 'Mejoría parcial y buena tolerabilidad.' },
        { date: isoDate(-4), type: 'assessment', title: 'ASRS: 7', detail: 'Reducción de 56% respecto al basal.' },
      ],
    },
    {
      id: 'p4', initials: 'DF', name: 'Daniela Flores', age: 38, sex: 'F', phone: '+503 7280 1914',
      photo: '', insurance: { hasInsurance: true, provider: 'Salud Integral', plan: 'Cobertura Plus', memberId: 'SI-882030', policyNumber: 'P-190244', authorizationRequired: true, copay: 'US$15', notes: 'Solicitar autorización para controles prolongados.' },
      diagnosis: 'Esquizofrenia', diagnosisCode: 'F20.0', risk: 'medium', status: 'review',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-12), nextVisit: isoDate(4, 11, 30),
      medication: { id: 'm4', name: 'Risperidona', dose: '4 mg', frequency: 'por la noche', startDate: isoDate(-120), indication: 'Síntomas psicóticos', class: 'Antipsicótico' },
      assessments: [assessment('PANSS', 'Síntomas psicóticos', [86, 78, 70, 66, 64], [-120, -90, -60, -30, -6])],
      adherence: 89, functioningChange: 18, sleepBaseline: 5.6, sleepCurrent: 7.4,
      vitals: { baselineWeight: 72.0, weight: 76.5, bmi: 28.1, bp: '118/72', pulse: 76 },
      adverseEvents: [
        { name: 'Aumento de peso', severity: 'moderate', onset: isoDate(-85), status: 'active', relation: 'Ganancia de 6.3% durante exposición; existen factores concurrentes.' },
        { name: 'Hiperprolactinemia', severity: 'moderate', onset: isoDate(-25), status: 'active', relation: 'Resultado temporalmente asociado; requiere valoración.' },
      ],
      labs: [
        { name: 'Prolactina', value: '48', unit: 'ng/mL', status: 'high', date: isoDate(-25) },
        { name: 'HbA1c', value: '5.8', unit: '%', status: 'high', date: isoDate(-25) },
        { name: 'Triglicéridos', value: '178', unit: 'mg/dL', status: 'high', date: isoDate(-25) },
      ],
      timeline: [
        { date: isoDate(-120), type: 'medication', title: 'Inicio de risperidona', detail: 'PANSS basal 86.' },
        { date: isoDate(-25), type: 'lab', title: 'Prolactina elevada', detail: 'Resultado marcado para revisión clínica.' },
        { date: isoDate(-6), type: 'assessment', title: 'PANSS: 64', detail: 'Mejoría sintomática con señal metabólica concurrente.' },
      ],
    },
    {
      id: 'p5', initials: 'RP', name: 'Roberto Peña', age: 45, sex: 'M', phone: '+503 7605 8341',
      diagnosis: 'Trastorno de ansiedad generalizada', diagnosisCode: 'F41.1', risk: 'low', status: 'partial',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-15), nextVisit: isoDate(6, 16, 0),
      medication: { id: 'm5', name: 'Escitalopram', dose: '20 mg', frequency: 'cada mañana', startDate: isoDate(-98), indication: 'Ansiedad', class: 'ISRS' },
      assessments: [assessment('GAD-7', 'Ansiedad', [18, 15, 12, 10, 9], [-98, -70, -42, -21, -4])],
      adherence: 90, functioningChange: 22, sleepBaseline: 5.4, sleepCurrent: 6.8,
      vitals: { baselineWeight: 79.4, weight: 80.0, bmi: 26.7, bp: '126/80', pulse: 73 },
      adverseEvents: [{ name: 'Disfunción sexual', severity: 'moderate', onset: isoDate(-70), status: 'active', relation: 'Apareció después de inicio; sin medición basal completa.' }],
      labs: [{ name: 'Sodio', value: '137', unit: 'mmol/L', status: 'normal', date: isoDate(-30) }],
      timeline: [
        { date: isoDate(-98), type: 'medication', title: 'Inicio de escitalopram 10 mg', detail: 'GAD-7 basal 18.' },
        { date: isoDate(-70), type: 'adverse', title: 'Disfunción sexual reportada', detail: 'Se documentó impacto moderado.' },
        { date: isoDate(-4), type: 'assessment', title: 'GAD-7: 9', detail: 'Respuesta parcial observada.' },
      ],
    },
    {
      id: 'p6', initials: 'LH', name: 'Lucía Herrera', age: 31, sex: 'F', phone: '+503 7894 1030',
      diagnosis: 'Trastorno depresivo mayor', diagnosisCode: 'F32.1', risk: 'medium', status: 'review',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-20), nextVisit: isoDate(0, 15, 30),
      medication: { id: 'm6', name: 'Bupropión XL', dose: '300 mg', frequency: 'cada mañana', startDate: isoDate(-76), indication: 'Depresión', class: 'NDRI' },
      assessments: [assessment('PHQ-9', 'Síntomas depresivos', [16, 15, 14, 13, 12], [-76, -55, -34, -20, -3])],
      adherence: 68, functioningChange: 8, sleepBaseline: 6.1, sleepCurrent: 5.7,
      vitals: { baselineWeight: 64.5, weight: 63.9, bmi: 23.7, bp: '132/84', pulse: 86 },
      adverseEvents: [{ name: 'Insomnio', severity: 'moderate', onset: isoDate(-62), status: 'active', relation: 'Coincide con titulación; adherencia irregular limita interpretación.' }],
      labs: [],
      timeline: [
        { date: isoDate(-76), type: 'medication', title: 'Inicio de bupropión XL 150 mg', detail: 'PHQ-9 basal 16.' },
        { date: isoDate(-55), type: 'medication', title: 'Aumento a 300 mg', detail: 'Se reportan dosis omitidas.' },
        { date: isoDate(-3), type: 'assessment', title: 'PHQ-9: 12', detail: 'Mejoría limitada; adherencia estimada 68%.' },
      ],
    },
    {
      id: 'p7', initials: 'MA', name: 'Mateo Aguilar', age: 27, sex: 'M', phone: '+503 7033 9088',
      diagnosis: 'Depresión bipolar', diagnosisCode: 'F31.4', risk: 'low', status: 'responding',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-17), nextVisit: isoDate(8, 10, 0),
      medication: { id: 'm7', name: 'Lamotrigina', dose: '200 mg', frequency: 'cada noche', startDate: isoDate(-140), indication: 'Depresión bipolar', class: 'Estabilizador del ánimo' },
      assessments: [assessment('PHQ-9', 'Síntomas depresivos', [18, 16, 12, 9, 8], [-140, -105, -70, -35, -5])],
      adherence: 97, functioningChange: 33, sleepBaseline: 6.0, sleepCurrent: 7.3,
      vitals: { baselineWeight: 74.0, weight: 73.6, bmi: 24.8, bp: '120/76', pulse: 69 },
      adverseEvents: [], labs: [],
      timeline: [
        { date: isoDate(-140), type: 'medication', title: 'Inicio de titulación de lamotrigina', detail: 'Vigilancia de rash documentada.' },
        { date: isoDate(-70), type: 'medication', title: 'Dosis objetivo 200 mg', detail: 'Sin rash reportado.' },
        { date: isoDate(-5), type: 'assessment', title: 'PHQ-9: 8', detail: 'Reducción de 56% respecto al basal.' },
      ],
    },
    {
      id: 'p8', initials: 'SC', name: 'Sofía Campos', age: 58, sex: 'F', phone: '+503 7741 5202',
      diagnosis: 'Insomnio y ansiedad', diagnosisCode: 'F51.0', risk: 'medium', status: 'review',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-32), nextVisit: isoDate(3, 8, 30),
      medication: { id: 'm8', name: 'Clonazepam', dose: '0.5 mg PRN', frequency: 'por la noche', startDate: isoDate(-92), indication: 'Insomnio', class: 'Benzodiazepina' },
      assessments: [assessment('ISI', 'Insomnio', [21, 17, 14, 12], [-92, -60, -32, -6])],
      adherence: 100, functioningChange: 18, sleepBaseline: 4.2, sleepCurrent: 6.4,
      vitals: { baselineWeight: 70.2, weight: 70.8, bmi: 27.1, bp: '110/68', pulse: 66 },
      adverseEvents: [{ name: 'Somnolencia diurna', severity: 'moderate', onset: isoDate(-72), status: 'active', relation: 'Uso prolongado y edad son factores relevantes; revisar beneficio-riesgo.' }],
      labs: [],
      timeline: [
        { date: isoDate(-92), type: 'medication', title: 'Inicio de clonazepam PRN', detail: 'Plan inicial de uso corto documentado.' },
        { date: isoDate(-32), type: 'adverse', title: 'Somnolencia diurna', detail: 'Sin caídas, pero con dificultad matutina.' },
        { date: isoDate(-6), type: 'alert', title: 'Revisión de duración de benzodiazepina', detail: 'Alerta de apoyo a decisión, no instrucción terapéutica.' },
      ],
    },
    {
      id: 'p9', initials: 'JS', name: 'Javier Sol', age: 36, sex: 'M', phone: '+503 7355 0099',
      diagnosis: 'Trastorno obsesivo-compulsivo', diagnosisCode: 'F42.2', risk: 'low', status: 'partial',
      clinician: 'Dra. Adriana Salazar', lastVisit: isoDate(-9), nextVisit: isoDate(10, 13, 30),
      medication: { id: 'm9', name: 'Fluoxetina', dose: '60 mg', frequency: 'cada mañana', startDate: isoDate(-160), indication: 'TOC', class: 'ISRS' },
      assessments: [assessment('Y-BOCS', 'Síntomas obsesivo-compulsivos', [28, 25, 22, 20, 18], [-160, -120, -80, -40, -8])],
      adherence: 92, functioningChange: 26, sleepBaseline: 6.3, sleepCurrent: 6.8,
      vitals: { baselineWeight: 77.0, weight: 76.8, bmi: 25.9, bp: '119/75', pulse: 70 },
      adverseEvents: [{ name: 'Activación inicial', severity: 'mild', onset: isoDate(-152), status: 'resolved', relation: 'Se resolvió durante continuidad del tratamiento.' }],
      labs: [],
      timeline: [
        { date: isoDate(-160), type: 'medication', title: 'Inicio de fluoxetina', detail: 'Y-BOCS basal 28.' },
        { date: isoDate(-80), type: 'medication', title: 'Aumento a 60 mg', detail: 'Respuesta parcial.' },
        { date: isoDate(-8), type: 'assessment', title: 'Y-BOCS: 18', detail: 'Reducción de 36% respecto al basal.' },
      ],
    },
  ];

  const appointments = [
    { id: 'a1', patientId: 'p1', title: 'Valeria Moreno', start: isoDate(0, 10, 30), end: isoDate(0, 11, 15), type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Revisar respuesta PHQ-9 y tolerabilidad.' },
    { id: 'a2', patientId: 'p6', title: 'Lucía Herrera', start: isoDate(0, 15, 30), end: isoDate(0, 16, 15), type: 'Prioritaria', modality: 'Videollamada', status: 'confirmed', notes: 'Adherencia irregular e insomnio.' },
    { id: 'a3', patientId: 'p3', title: 'Camila Rivas', start: isoDate(1, 9, 0), end: isoDate(1, 9, 45), type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Control de presión, pulso, peso y apetito.' },
    { id: 'a4', patientId: 'p2', title: 'Andrés Castillo', start: isoDate(2, 14, 0), end: isoDate(2, 14, 45), type: 'Laboratorios', modality: 'Presencial', status: 'pending', notes: 'Revisar TSH y seguimiento de litio.' },
    { id: 'a5', patientId: 'p8', title: 'Sofía Campos', start: isoDate(3, 8, 30), end: isoDate(3, 9, 15), type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Revisar somnolencia y duración de benzodiazepina.' },
    { id: 'a6', patientId: 'p4', title: 'Daniela Flores', start: isoDate(4, 11, 30), end: isoDate(4, 12, 15), type: 'Seguridad', modality: 'Presencial', status: 'confirmed', notes: 'Revisar prolactina y parámetros metabólicos.' },
    { id: 'a7', patientId: 'p5', title: 'Roberto Peña', start: isoDate(6, 16, 0), end: isoDate(6, 16, 45), type: 'Seguimiento', modality: 'Videollamada', status: 'pending', notes: 'Valorar respuesta parcial y efecto sexual.' },
    { id: 'a8', patientId: 'p7', title: 'Mateo Aguilar', start: isoDate(8, 10, 0), end: isoDate(8, 10, 45), type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Seguimiento de respuesta y vigilancia de rash.' },
    { id: 'a9', patientId: 'p9', title: 'Javier Sol', start: isoDate(10, 13, 30), end: isoDate(10, 14, 15), type: 'Seguimiento', modality: 'Presencial', status: 'confirmed', notes: 'Y-BOCS y funcionalidad.' },
    { id: 'a10', patientId: 'p1', title: 'Valeria Moreno', start: isoDate(-21, 10, 30), end: isoDate(-21, 11, 15), type: 'Seguimiento', modality: 'Presencial', status: 'completed', notes: 'Ajuste y educación.' },
    { id: 'a11', patientId: 'p4', title: 'Daniela Flores', start: isoDate(-12, 11, 30), end: isoDate(-12, 12, 15), type: 'Seguimiento', modality: 'Presencial', status: 'completed', notes: 'Solicitar laboratorios.' },
  ];

  const alerts = [
    { id: 'al1', patientId: 'p4', severity: 'high', category: 'Seguridad', title: 'Prolactina elevada durante tratamiento', detail: 'Resultado de 48 ng/mL con síntomas reportados. Requiere revisión clínica.', createdAt: isoDate(-4), status: 'open' },
    { id: 'al2', patientId: 'p2', severity: 'medium', category: 'Monitoreo', title: 'TSH pendiente de actualización', detail: 'La tarea está vencida según el protocolo configurado para este entorno demo.', createdAt: isoDate(-3), status: 'open' },
    { id: 'al3', patientId: 'p6', severity: 'high', category: 'Eficacia', title: 'Mejoría limitada con adherencia baja', detail: 'PHQ-9 disminuyó 25% y la adherencia estimada es 68%.', createdAt: isoDate(-2), status: 'open' },
    { id: 'al4', patientId: 'p8', severity: 'medium', category: 'Medicamento', title: 'Revisión de uso prolongado de benzodiazepina', detail: 'Uso registrado por 13 semanas con somnolencia diurna activa.', createdAt: isoDate(-1), status: 'open' },
    { id: 'al5', patientId: 'p3', severity: 'low', category: 'Seguimiento', title: 'Peso y presión a registrar en próxima cita', detail: 'Control programado para la visita de mañana.', createdAt: isoDate(-1), status: 'open' },
  ];

  return normalizeData({
    version: 3,
    organization: {
      name: 'Linkare',
      clinician: 'Dra. Adriana Salazar',
      specialty: 'Psiquiatría',
      professionalLicense: 'JVPM 00000',
      address: 'San Salvador, El Salvador',
      phone: '+503 2200 0000',
      email: 'citas@linkare.demo',
      website: '',
      clinicLogo: defaultClinicLogo,
      doctorPhoto: '',
      prescriptionFooter: 'Documento emitido para revisión, firma y sello del profesional tratante.',
    },
    users: [
      { id: 'user_owner_1', name: 'Administración Linkare', email: 'admin@linkare.demo', password: 'Linkare2026!', phone: '+503 7000 0000', title: 'Propietario de plataforma', role: 'owner', active: true, avatar: '', permissions: {}, createdAt: new Date().toISOString() },
      { id: 'user_doctor_1', name: 'Dra. Adriana Salazar', email: 'doctora@nexamind.demo', password: 'NexaMind2026!', phone: '+503 2200 0000', title: 'Psiquiatra', role: 'doctor', active: true, avatar: '', permissions: {}, createdAt: new Date().toISOString() },
      { id: 'user_secretary_1', name: 'María Torres', email: 'secretaria@nexamind.demo', password: 'Agenda2026!', phone: '+503 7000 1111', title: 'Secretaría clínica', role: 'secretary', active: true, avatar: '', permissions: { patientsView: true, patientsCreate: true, patientsEdit: true, appointmentsManage: true, remindersManage: true, clinicalView: false, clinicalEdit: false, medicationsManage: false, prescriptionsCreate: false, alertsView: false, analyticsView: false, exportsManage: false, settingsManage: false, usersManage: false }, createdAt: new Date().toISOString() },
    ],
    patients,
    appointments,
    alerts,
    billing: {
      planName: 'Plan Profesional Linkare',
      planDescription: 'Licencia mensual de la plataforma Linkare para gestión clínica.',
      subscriptionPrice: 40,
      billingCycle: 'mensual',
      currency: 'USD',
      payerName: 'Dra. Adriana Salazar',
      payerEmail: 'doctora@nexamind.demo',
      wompiEnabled: Boolean(runtimeEnv.VITE_SUPABASE_URL && runtimeEnv.VITE_SUPABASE_ANON_KEY),
      manualCheckoutUrl: '',
      note: 'El precio lo administra Linkare. El psiquiatra recibe un enlace único de Wompi para pagar la licencia.',
    },
    payments: [
      { id: 'sub_1', description: 'Licencia mensual Linkare', amount: 40, method: 'wompi', status: 'pending', payerName: 'Dra. Adriana Salazar', payerEmail: 'doctora@nexamind.demo', billingPeriod: '2026-08', isTest: true, createdAt: isoDate(-1, 9, 0) },
      { id: 'sub_2', description: 'Licencia mensual Linkare', amount: 40, method: 'wompi', status: 'paid', payerName: 'Dra. Adriana Salazar', payerEmail: 'doctora@nexamind.demo', billingPeriod: '2026-07', isTest: true, createdAt: isoDate(-31, 9, 0), paidAt: isoDate(-30, 9, 10) },
    ],
    settings: { theme: 'light', googleConnected: false, demoMode: true, activeUserId: 'user_doctor_1', reminderHours: [24, 8], reminderChannels: ['whatsapp'], palette: { milk: '#FCFDF6', ceil: '#8FACCB', midnight: '#05316E' } },
  });
}


function getInitials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'NM';
}

function parseDose(dose = '') {
  const match = String(dose).match(/([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Zµ]+)?/);
  return {
    value: match ? Number(match[1].replace(',', '.')) : null,
    unit: match?.[2] || 'mg',
  };
}

function firstDoseFromTimeline(patient) {
  const entries = [...(patient.timeline || [])]
    .filter(item => item.type === 'medication')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const item of entries) {
    const parsed = parseDose(item.title);
    if (parsed.value !== null) return { ...parsed, date: item.date, reason: item.title };
  }
  return null;
}

function normalizeMedication(medication, patient, index = 0) {
  const parsed = parseDose(medication?.dose || `${medication?.doseValue ?? ''} ${medication?.doseUnit ?? 'mg'}`);
  const initial = firstDoseFromTimeline(patient);
  const currentDose = medication?.dose || (parsed.value !== null ? `${parsed.value} ${parsed.unit}` : 'Dosis no registrada');
  const doseHistory = Array.isArray(medication?.doseHistory) && medication.doseHistory.length
    ? medication.doseHistory
    : [
        ...(initial ? [{ id: `dh_${patient.id}_${index}_0`, date: initial.date, doseValue: initial.value, doseUnit: initial.unit, dose: `${initial.value} ${initial.unit}`, reason: initial.reason }] : []),
        { id: `dh_${patient.id}_${index}_1`, date: medication?.startDate || patient.lastVisit || new Date().toISOString(), doseValue: parsed.value, doseUnit: parsed.unit, dose: currentDose, reason: 'Dosis actual registrada' },
      ].filter((item, position, array) => position === 0 || item.dose !== array[position - 1].dose);

  return {
    id: medication?.id || `med_${patient.id}_${index}`,
    name: medication?.name || 'Medicamento sin nombre',
    class: medication?.class || 'Otro',
    dose: currentDose,
    doseValue: medication?.doseValue ?? parsed.value,
    doseUnit: medication?.doseUnit || parsed.unit,
    frequency: medication?.frequency || 'una vez al día',
    route: medication?.route || 'oral',
    indication: medication?.indication || patient.diagnosis || 'Sin indicación registrada',
    startDate: medication?.startDate || patient.lastVisit || new Date().toISOString(),
    endDate: medication?.endDate || null,
    status: medication?.status || 'active',
    isPrimary: medication?.isPrimary ?? index === 0,
    isPrn: medication?.isPrn ?? /PRN|necesidad/i.test(currentDose + ' ' + (medication?.frequency || '')),
    notes: medication?.notes || '',
    doseHistory,
  };
}

export function normalizePatient(patient = {}) {
  const sourceMedications = Array.isArray(patient.medications) && patient.medications.length
    ? patient.medications
    : patient.medication && patient.medication.name && patient.medication.name !== 'Sin medicamento'
      ? [patient.medication]
      : [];
  const medications = sourceMedications.map((medication, index) => normalizeMedication(medication, patient, index));
  const primary = medications.find(item => item.isPrimary && item.status === 'active') || medications.find(item => item.status === 'active') || null;
  medications.forEach(item => { item.isPrimary = Boolean(primary && item.id === primary.id); });

  const vitals = patient.vitals || {};
  const vitalsHistory = Array.isArray(patient.vitalsHistory) && patient.vitalsHistory.length
    ? patient.vitalsHistory
    : Object.keys(vitals).length
      ? [{ id: `vital_${patient.id || Date.now()}_0`, date: patient.lastVisit || new Date().toISOString(), ...vitals }]
      : [];

  return {
    id: patient.id || `p_${Date.now()}`,
    initials: patient.initials || getInitials(patient.name),
    name: patient.name || 'Paciente sin nombre',
    age: Number(patient.age) || 0,
    sex: patient.sex || 'No registrado',
    phone: patient.phone || '',
    email: patient.email || '',
    photo: patient.photo || '',
    insurance: {
      hasInsurance: Boolean(patient.insurance?.hasInsurance),
      provider: patient.insurance?.provider || '',
      plan: patient.insurance?.plan || '',
      memberId: patient.insurance?.memberId || '',
      policyNumber: patient.insurance?.policyNumber || '',
      authorizationRequired: Boolean(patient.insurance?.authorizationRequired),
      copay: patient.insurance?.copay || '',
      notes: patient.insurance?.notes || '',
    },
    diagnosis: patient.diagnosis || 'Diagnóstico pendiente',
    diagnosisCode: patient.diagnosisCode || 'Sin código',
    risk: patient.risk || 'low',
    status: patient.status || 'stable',
    clinician: patient.clinician || 'Dra. Adriana Salazar',
    lastVisit: patient.lastVisit || new Date().toISOString(),
    nextVisit: patient.nextVisit || null,
    medications,
    medication: primary || {
      id: `none_${patient.id || Date.now()}`,
      name: 'Sin medicamento', class: 'No asignado', dose: '—', doseValue: null, doseUnit: 'mg',
      frequency: '—', startDate: patient.lastVisit || new Date().toISOString(), indication: '—', status: 'inactive', doseHistory: [],
    },
    assessments: Array.isArray(patient.assessments) ? patient.assessments : [],
    adherence: Number.isFinite(Number(patient.adherence)) ? Number(patient.adherence) : 0,
    functioningChange: Number.isFinite(Number(patient.functioningChange)) ? Number(patient.functioningChange) : 0,
    sleepBaseline: Number.isFinite(Number(patient.sleepBaseline)) ? Number(patient.sleepBaseline) : null,
    sleepCurrent: Number.isFinite(Number(patient.sleepCurrent)) ? Number(patient.sleepCurrent) : null,
    appetite: patient.appetite || 'No registrado',
    vitals,
    vitalsHistory,
    adverseEvents: Array.isArray(patient.adverseEvents) ? patient.adverseEvents.map((item, index) => ({ id: item.id || `ae_${patient.id}_${index}`, medicationId: item.medicationId || primary?.id || null, ...item })) : [],
    labs: Array.isArray(patient.labs) ? patient.labs.map((item, index) => ({ id: item.id || `lab_${patient.id}_${index}`, ...item })) : [],
    timeline: Array.isArray(patient.timeline) ? patient.timeline : [],
    medicationEvents: Array.isArray(patient.medicationEvents) ? patient.medicationEvents : [],
    followUps: Array.isArray(patient.followUps) ? patient.followUps : [],
    archived: Boolean(patient.archived),
    notes: Array.isArray(patient.notes) ? patient.notes : [],
    prescriptions: Array.isArray(patient.prescriptions) ? patient.prescriptions.map((item, index) => ({ ...item, id: item.id || `rx_${patient.id}_${index}`, items: Array.isArray(item.items) ? item.items : [] })) : [],
    createdAt: patient.createdAt || patient.lastVisit || new Date().toISOString(),
    updatedAt: patient.updatedAt || new Date().toISOString(),
  };
}

export function normalizeData(input = {}) {
  const defaultDoctor = {
    id: 'user_doctor_1', name: input.organization?.clinician || 'Dra. Adriana Salazar',
    email: 'doctora@nexamind.demo', password: 'NexaMind2026!', phone: '', title: input.organization?.specialty || 'Psiquiatría',
    role: 'doctor', active: true, avatar: input.organization?.doctorPhoto || '', permissions: {}, createdAt: new Date().toISOString(),
  };
  const users = Array.isArray(input.users) && input.users.length
    ? input.users.map((user, index) => ({
        id: user.id || `user_${index}_${Date.now()}`,
        name: user.name || (user.role === 'doctor' ? defaultDoctor.name : 'Usuario'),
        email: user.email || '', password: user.password || (user.role === 'owner' ? 'Linkare2026!' : user.role === 'doctor' ? 'NexaMind2026!' : 'Agenda2026!'), phone: user.phone || '', title: user.title || '',
        role: user.role || 'secretary', active: user.active !== false, avatar: user.avatar || '',
        permissions: user.permissions && typeof user.permissions === 'object' ? { ...user.permissions } : {},
        createdAt: user.createdAt || new Date().toISOString(), updatedAt: user.updatedAt || null,
      }))
    : [defaultDoctor];
  const doctor = users.find(user => user.role === 'doctor') || defaultDoctor;
  return {
    version: 3,
    organization: {
      name: input.organization?.name || 'Linkare',
      clinician: input.organization?.clinician || doctor.name || 'Dra. Adriana Salazar',
      specialty: input.organization?.specialty || doctor.title || 'Psiquiatría',
      professionalLicense: input.organization?.professionalLicense || '',
      address: input.organization?.address || '',
      phone: input.organization?.phone || '',
      email: input.organization?.email || '',
      website: input.organization?.website || '',
      clinicLogo: input.organization?.clinicLogo || defaultClinicLogo,
      doctorPhoto: input.organization?.doctorPhoto || doctor.avatar || '',
      prescriptionFooter: input.organization?.prescriptionFooter || 'Documento emitido para revisión, firma y sello del profesional tratante.',
      updatedAt: input.organization?.updatedAt || null,
    },
    users,
    patients: Array.isArray(input.patients) ? input.patients.map(normalizePatient) : [],
    appointments: Array.isArray(input.appointments) ? input.appointments.map(item => ({ ...item, reminderLog: Array.isArray(item.reminderLog) ? item.reminderLog : [] })) : [],
    alerts: Array.isArray(input.alerts) ? input.alerts.map(item => ({ ...item })) : [],
    billing: {
      planName: input.billing?.planName || 'Plan Profesional Linkare',
      planDescription: input.billing?.planDescription || 'Licencia mensual de la plataforma Linkare para gestión clínica.',
      subscriptionPrice: Number(input.billing?.subscriptionPrice ?? input.billing?.consultationFee) || 40,
      billingCycle: input.billing?.billingCycle || 'mensual',
      currency: input.billing?.currency || 'USD',
      payerName: input.billing?.payerName || input.organization?.clinician || doctor.name || '',
      payerEmail: input.billing?.payerEmail || input.organization?.email || doctor.email || '',
      wompiEnabled: Boolean(input.billing?.wompiEnabled || (runtimeEnv.VITE_SUPABASE_URL && runtimeEnv.VITE_SUPABASE_ANON_KEY)),
      manualCheckoutUrl: input.billing?.manualCheckoutUrl || input.billing?.wompiCheckoutUrl || '',
      note: input.billing?.note || 'El precio lo administra Linkare. El psiquiatra recibe un enlace único de Wompi para pagar la licencia.',
    },
    payments: Array.isArray(input.payments) ? input.payments.map(item => ({ ...item })) : [],
    settings: {
      ...(input.settings || {}),
      theme: input.settings?.theme || 'light',
      googleConnected: Boolean(input.settings?.googleConnected),
      demoMode: input.settings?.demoMode ?? true,
      requireLogin: input.settings?.requireLogin ?? true,
      simpleMode: input.settings?.simpleMode ?? true,
      largeText: input.settings?.largeText ?? false,
      reducedMotion: input.settings?.reducedMotion ?? false,
      activeUserId: input.settings?.activeUserId || doctor.id,
      reminderHours: Array.isArray(input.settings?.reminderHours) && input.settings.reminderHours.length
        ? [...new Set(input.settings.reminderHours.map(Number).filter(value => Number.isFinite(value) && value > 0))]
        : [24, 8],
      reminderChannels: Array.isArray(input.settings?.reminderChannels) && input.settings.reminderChannels.length
        ? [...new Set(input.settings.reminderChannels.map(value => String(value).trim()).filter(Boolean))]
        : ['whatsapp'],
      palette: { milk: '#FCFDF6', ceil: '#8FACCB', midnight: '#05316E', ...(input.settings?.palette || {}) },
    },
  };
}
