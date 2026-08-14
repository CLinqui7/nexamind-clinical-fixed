-- Synthetic demo seed. Do not use these records as clinical examples or treatment guidance.

insert into public.organizations (id,name,slug,timezone,is_demo) values
('10000000-0000-0000-0000-000000000001','NexaMind Demo Clinic','nexamind-demo','America/El_Salvador',true)
on conflict (id) do nothing;

insert into public.scale_definitions (id,code,name,domain,minimum_score,maximum_score,direction,response_threshold_percent,remission_threshold,version,license_notes) values
('11000000-0000-0000-0000-000000000001','PHQ-9','Patient Health Questionnaire-9','Depresión',0,27,'lower',50,5,'demo-1','Verificar condiciones de uso y gobernanza clínica.'),
('11000000-0000-0000-0000-000000000002','GAD-7','Generalized Anxiety Disorder-7','Ansiedad',0,21,'lower',50,5,'demo-1','Verificar condiciones de uso y gobernanza clínica.'),
('11000000-0000-0000-0000-000000000003','YMRS','Young Mania Rating Scale','Manía',0,60,'lower',50,null,'demo-1','Uso clínico sujeto a entrenamiento y gobernanza.'),
('11000000-0000-0000-0000-000000000004','ASRS','Adult ADHD Self-Report Scale','TDAH',0,24,'lower',50,null,'demo-1','Configuración demo.'),
('11000000-0000-0000-0000-000000000005','PANSS','Positive and Negative Syndrome Scale','Psicosis',30,210,'lower',30,null,'demo-1','Puede estar sujeto a licencia/entrenamiento.'),
('11000000-0000-0000-0000-000000000006','ISI','Insomnia Severity Index','Sueño',0,28,'lower',50,8,'demo-1','Configuración demo.'),
('11000000-0000-0000-0000-000000000007','Y-BOCS','Yale-Brown Obsessive Compulsive Scale','TOC',0,40,'lower',35,null,'demo-1','Puede estar sujeto a condiciones de uso.')
on conflict (code) do nothing;

insert into public.medication_catalog (id,generic_name,medication_class) values
('12000000-0000-0000-0000-000000000001','Sertralina','ISRS'),
('12000000-0000-0000-0000-000000000002','Litio','Estabilizador del ánimo'),
('12000000-0000-0000-0000-000000000003','Lisdexanfetamina','Estimulante'),
('12000000-0000-0000-0000-000000000004','Risperidona','Antipsicótico'),
('12000000-0000-0000-0000-000000000005','Escitalopram','ISRS'),
('12000000-0000-0000-0000-000000000006','Bupropión','NDRI'),
('12000000-0000-0000-0000-000000000007','Lamotrigina','Estabilizador del ánimo'),
('12000000-0000-0000-0000-000000000008','Clonazepam','Benzodiazepina'),
('12000000-0000-0000-0000-000000000009','Fluoxetina','ISRS')
on conflict (generic_name) do nothing;

insert into public.patients (id,organization_id,medical_record_number,first_name,last_name,date_of_birth,sex_at_birth,phone,risk_level,metadata) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','NM-0001','Valeria','Moreno','1992-04-12','F','+503 7001 2041','low','{"demo_status":"responding"}'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','NM-0002','Andrés','Castillo','1984-01-24','M','+503 7012 6610','medium','{"demo_status":"stable"}'),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','NM-0003','Camila','Rivas','1997-09-03','F','+503 7118 4502','low','{"demo_status":"responding"}'),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','NM-0004','Daniela','Flores','1988-05-17','F','+503 7280 1914','medium','{"demo_status":"review"}'),
('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','NM-0005','Roberto','Peña','1981-11-22','M','+503 7605 8341','low','{"demo_status":"partial"}'),
('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','NM-0006','Lucía','Herrera','1995-02-08','F','+503 7894 1030','medium','{"demo_status":"review"}'),
('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','NM-0007','Mateo','Aguilar','1999-07-19','M','+503 7033 9088','low','{"demo_status":"responding"}'),
('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','NM-0008','Sofía','Campos','1968-03-10','F','+503 7741 5202','medium','{"demo_status":"review"}'),
('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','NM-0009','Javier','Sol','1990-06-29','M','+503 7355 0099','low','{"demo_status":"partial"}')
on conflict (id) do nothing;

insert into public.patient_diagnoses (organization_id,patient_id,diagnosis_code,diagnosis_name,primary_diagnosis,diagnosed_at) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','F33.1','Trastorno depresivo mayor',true,current_date-interval '2 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','F31.2','Trastorno bipolar I',true,current_date-interval '6 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','F90.2','TDAH, presentación combinada',true,current_date-interval '1 year'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','F20.0','Esquizofrenia',true,current_date-interval '8 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','F41.1','Trastorno de ansiedad generalizada',true,current_date-interval '3 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','F32.1','Trastorno depresivo mayor',true,current_date-interval '10 months'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','F31.4','Depresión bipolar',true,current_date-interval '4 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','F51.0','Insomnio y ansiedad',true,current_date-interval '2 years'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009','F42.2','Trastorno obsesivo-compulsivo',true,current_date-interval '5 years');

insert into public.patient_medications (id,organization_id,patient_id,medication_id,display_name,indication,dose_value,dose_unit,frequency,start_date,status,metadata) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','Sertralina','Depresión',100,'mg','cada mañana',current_date-84,'active','{"adherence_percent":94}'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','12000000-0000-0000-0000-000000000002','Litio','Mantenimiento',900,'mg','dividido cada 12 h',current_date-210,'active','{"adherence_percent":91}'),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','12000000-0000-0000-0000-000000000003','Lisdexanfetamina','TDAH',40,'mg','cada mañana',current_date-70,'active','{"adherence_percent":96}'),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','12000000-0000-0000-0000-000000000004','Risperidona','Síntomas psicóticos',4,'mg','por la noche',current_date-120,'active','{"adherence_percent":89}'),
('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','12000000-0000-0000-0000-000000000005','Escitalopram','Ansiedad',20,'mg','cada mañana',current_date-98,'active','{"adherence_percent":90}'),
('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','12000000-0000-0000-0000-000000000006','Bupropión XL','Depresión',300,'mg','cada mañana',current_date-76,'active','{"adherence_percent":68}'),
('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','12000000-0000-0000-0000-000000000007','Lamotrigina','Depresión bipolar',200,'mg','cada noche',current_date-140,'active','{"adherence_percent":97}'),
('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','12000000-0000-0000-0000-000000000008','Clonazepam','Insomnio',0.5,'mg','PRN por la noche',current_date-92,'active','{"adherence_percent":100}'),
('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009','12000000-0000-0000-0000-000000000009','Fluoxetina','TOC',60,'mg','cada mañana',current_date-160,'active','{"adherence_percent":92}')
on conflict (id) do nothing;

-- Longitudinal assessments.
insert into public.patient_assessments (organization_id,patient_id,scale_id,performed_at,total_score) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',now()-interval '84 days',20),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',now()-interval '42 days',13),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',now()-interval '5 days',7),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000003',now()-interval '210 days',22),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000003',now()-interval '7 days',4),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','11000000-0000-0000-0000-000000000004',now()-interval '70 days',16),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','11000000-0000-0000-0000-000000000004',now()-interval '4 days',7),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','11000000-0000-0000-0000-000000000005',now()-interval '120 days',86),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','11000000-0000-0000-0000-000000000005',now()-interval '6 days',64),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','11000000-0000-0000-0000-000000000002',now()-interval '98 days',18),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','11000000-0000-0000-0000-000000000002',now()-interval '4 days',9),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','11000000-0000-0000-0000-000000000001',now()-interval '76 days',16),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','11000000-0000-0000-0000-000000000001',now()-interval '3 days',12),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','11000000-0000-0000-0000-000000000001',now()-interval '140 days',18),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','11000000-0000-0000-0000-000000000001',now()-interval '5 days',8),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','11000000-0000-0000-0000-000000000006',now()-interval '92 days',21),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','11000000-0000-0000-0000-000000000006',now()-interval '6 days',12),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009','11000000-0000-0000-0000-000000000007',now()-interval '160 days',28),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009','11000000-0000-0000-0000-000000000007',now()-interval '8 days',18);

insert into public.vital_signs (organization_id,patient_id,measured_at,weight_kg,height_cm,bmi,systolic_bp,diastolic_bp,heart_rate) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',now()-interval '5 days',68.8,164.5,25.4,116,74,71),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',now()-interval '20 days',84.0,174,27.8,124,78,68),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',now()-interval '4 days',59.8,164,22.3,122,76,82),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',now()-interval '6 days',76.5,165,28.1,118,72,76),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005',now()-interval '4 days',80.0,173,26.7,126,80,73),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006',now()-interval '3 days',63.9,164,23.7,132,84,86);

insert into public.lab_results (organization_id,patient_id,test_name,value_numeric,unit,flag,collected_at) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Litio sérico',0.82,'mmol/L','normal',now()-interval '20 days'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','eGFR',86,'mL/min/1.73m²','normal',now()-interval '20 days'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','TSH',4.9,'mUI/L','high',now()-interval '190 days'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Prolactina',48,'ng/mL','high',now()-interval '25 days'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','HbA1c',5.8,'%','high',now()-interval '25 days'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Triglicéridos',178,'mg/dL','high',now()-interval '25 days');

insert into public.adverse_events (organization_id,patient_id,patient_medication_id,event_name,onset_at,severity,status,temporal_relationship,clinician_assessment) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Náusea',now()-interval '80 days','mild','resolved','Apareció después del inicio y se resolvió durante continuidad.','Asociación temporal posible; no causalidad automática.'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Temblor fino',now()-interval '170 days','mild','active','Apareció tras titulación.','Requiere contextualización clínica.'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Aumento de peso',now()-interval '85 days','moderate','active','Ganancia durante exposición con factores concurrentes.','Revisar balance beneficio-riesgo.'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000005','Disfunción sexual',now()-interval '70 days','moderate','active','Inicio posterior al tratamiento, sin baseline completo.','Atribución incierta.'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000006','Insomnio',now()-interval '62 days','moderate','active','Coincide con titulación; adherencia irregular.','Interpretación limitada.'),
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000008','Somnolencia diurna',now()-interval '72 days','moderate','active','Uso prolongado y edad son factores relevantes.','Revisar clínicamente.');

insert into public.appointments (id,organization_id,patient_id,title,appointment_type,modality,status,starts_at,ends_at,notes) values
('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Valeria Moreno','Seguimiento','Presencial','confirmed',date_trunc('day',now())+interval '10 hours 30 minutes',date_trunc('day',now())+interval '11 hours 15 minutes','Revisar respuesta PHQ-9 y tolerabilidad.'),
('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','Lucía Herrera','Prioritaria','Videollamada','confirmed',date_trunc('day',now())+interval '15 hours 30 minutes',date_trunc('day',now())+interval '16 hours 15 minutes','Adherencia irregular e insomnio.'),
('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Camila Rivas','Seguimiento','Presencial','confirmed',date_trunc('day',now())+interval '1 day 9 hours',date_trunc('day',now())+interval '1 day 9 hours 45 minutes','Control de presión, pulso, peso y apetito.'),
('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Andrés Castillo','Laboratorios','Presencial','pending',date_trunc('day',now())+interval '2 days 14 hours',date_trunc('day',now())+interval '2 days 14 hours 45 minutes','Revisar TSH y seguimiento de litio.'),
('50000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','Sofía Campos','Seguimiento','Presencial','confirmed',date_trunc('day',now())+interval '3 days 8 hours 30 minutes',date_trunc('day',now())+interval '3 days 9 hours 15 minutes','Revisar somnolencia y duración de benzodiazepina.'),
('50000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Daniela Flores','Seguridad','Presencial','confirmed',date_trunc('day',now())+interval '4 days 11 hours 30 minutes',date_trunc('day',now())+interval '4 days 12 hours 15 minutes','Revisar prolactina y parámetros metabólicos.');

insert into public.clinical_alerts (id,organization_id,patient_id,severity,category,title,description,rule_code,rule_version,status,generated_at) values
('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','high','Seguridad','Prolactina elevada durante tratamiento','Resultado de 48 ng/mL con síntomas reportados. Requiere revisión clínica.','DEMO_PROLACTIN','demo-1','open',now()-interval '4 days'),
('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','medium','Monitoreo','TSH pendiente de actualización','Tarea vencida según el protocolo configurado para el entorno demo.','DEMO_LITHIUM_TSH','demo-1','open',now()-interval '3 days'),
('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006','high','Eficacia','Mejoría limitada con adherencia baja','PHQ-9 disminuyó 25% y la adherencia estimada es 68%.','DEMO_LOW_RESPONSE','demo-1','open',now()-interval '2 days'),
('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000008','medium','Medicamento','Revisión de uso prolongado de benzodiazepina','Uso registrado por 13 semanas con somnolencia diurna activa.','DEMO_BENZO_REVIEW','demo-1','open',now()-interval '1 day');

insert into public.monitoring_protocols (id,code,name,version,source_reference,active) values
('70000000-0000-0000-0000-000000000001','LITHIUM_DEMO','Monitorización de litio','demo-1','Validar contra guía adoptada por la clínica',true),
('70000000-0000-0000-0000-000000000002','ANTIPSYCHOTIC_DEMO','Monitorización antipsicótica','demo-1','Validar contra guía adoptada por la clínica',true),
('70000000-0000-0000-0000-000000000003','STIMULANT_DEMO','Monitorización de estimulantes','demo-1','Validar contra guía adoptada por la clínica',true),
('70000000-0000-0000-0000-000000000004','BENZO_DEMO','Revisión de benzodiazepinas','demo-1','Validar contra guía adoptada por la clínica',true)
on conflict (code) do nothing;
