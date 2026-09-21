begin;

create table if not exists public.linkare_document_templates_v1(
 id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id) on delete cascade,template_key text not null,version integer not null check(version>0),name text not null,classification text not null check(classification in('administrative','clinical')),body text not null,variables jsonb not null default '[]',active boolean not null default true,created_by uuid references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,template_key,version)
);
create unique index if not exists linkare_global_template_version_v1 on public.linkare_document_templates_v1(template_key,version) where organization_id is null;
create table if not exists public.linkare_generated_documents_v1(
 id uuid primary key,organization_id uuid not null references public.organizations(id) on delete cascade,patient_id text not null,template_id uuid not null references public.linkare_document_templates_v1(id),template_version integer not null,title text not null,classification text not null check(classification in('administrative','clinical')),variables jsonb not null default '{}',content_snapshot text not null,storage_path text not null,created_by uuid references auth.users(id),created_at timestamptz not null default now()
);
create index if not exists linkare_generated_documents_patient_v1 on public.linkare_generated_documents_v1(organization_id,patient_id,created_at desc);
alter table public.linkare_document_templates_v1 enable row level security;
alter table public.linkare_generated_documents_v1 enable row level security;
create policy template_read_v1 on public.linkare_document_templates_v1 for select to authenticated using(organization_id is null or public.linkare_permission_v3(organization_id,'documentsGenerateAdministrative') or public.linkare_permission_v3(organization_id,'documentsGenerateClinical'));
create policy generated_document_read_v1 on public.linkare_generated_documents_v1 for select to authenticated using(public.linkare_permission_v3(organization_id,'documentsView') or (classification='administrative' and public.linkare_permission_v3(organization_id,'documentsGenerateAdministrative')) or (classification='clinical' and public.linkare_permission_v3(organization_id,'documentsGenerateClinical')));
revoke all on public.linkare_document_templates_v1,public.linkare_generated_documents_v1 from public,anon;
grant select on public.linkare_document_templates_v1,public.linkare_generated_documents_v1 to authenticated;

insert into public.linkare_document_templates_v1(id,organization_id,template_key,version,name,classification,body,variables) values
 ('10000000-0000-4000-9000-000000000001',null,'medical_certificate',1,'Constancia médica','administrative','Por medio de la presente se hace constar que {nombre_paciente} fue atendido(a) en esta clínica el {fecha}.\n\nSe extiende la presente a solicitud de la persona interesada.','["nombre_paciente","fecha","medico","numero_junta"]'),
 ('10000000-0000-4000-9000-000000000002',null,'medical_leave',1,'Incapacidad','administrative','Se hace constar que {nombre_paciente} requiere reposo por {dias_incapacidad} día(s), desde {fecha_inicio} hasta {fecha_final}.','["nombre_paciente","fecha","dias_incapacidad","fecha_inicio","fecha_final","medico","numero_junta"]'),
 ('10000000-0000-4000-9000-000000000003',null,'medical_letter',1,'Carta médica','clinical','A quien corresponda:\n\n{nombre_paciente} se encuentra en seguimiento médico. Diagnóstico consignado: {diagnostico}.\n\n{contenido_adicional}','["nombre_paciente","fecha","diagnostico","contenido_adicional","medico","numero_junta"]'),
 ('10000000-0000-4000-9000-000000000004',null,'configurable_form',1,'Formulario configurable','clinical','{titulo}\n\nPaciente: {nombre_paciente}\nFecha: {fecha}\n\n{contenido_adicional}','["titulo","nombre_paciente","fecha","contenido_adicional","medico","numero_junta"]')
on conflict do nothing;

create or replace function public.linkare_permission_v3(org uuid,p text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare m public.organization_members;
begin
 if p is null or not p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','alertsView','analyticsView','exportsManage','settingsManage','usersManage','billingManage','accessManage']) then return false;end if;
 select * into m from public.organization_members where organization_id=org and user_id=auth.uid() and active limit 1;if not found then return false;end if;
 if m.role::text='owner' then return true;end if;if p=any(array['settingsManage','usersManage','billingManage','accessManage']) then return false;end if;if m.role::text not in('psychiatrist','clinical_assistant','secretary') then return false;end if;
 if m.role::text='secretary' and not p=any(array['patientsView','patientsCreate','patientsEdit','appointmentsManage','remindersManage','medicationsCapture','prescriptionsEdit','documentsGenerateAdministrative']) then return false;end if;
 if coalesce(m.permissions->p,'false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalView','clinicalEdit','medicationsManage','medicationsCapture','prescriptionsCreate','prescriptionsEdit','documentsView','documentsManage','documentsGenerateAdministrative','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView','patientsEdit']) and coalesce(m.permissions->'patientsView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p=any(array['clinicalEdit','medicationsManage','prescriptionsCreate','documentsGenerateClinical','consultationsManage','postmortemExport','analyticsView']) and coalesce(m.permissions->'clinicalView','false'::jsonb)<>'true'::jsonb then return false;end if;
 if p='documentsManage' and coalesce(m.permissions->'documentsView','false'::jsonb)<>'true'::jsonb then return false;end if;return true;
end $$;

create or replace function public.linkare_attach_generated_document_v1(org uuid,patient_id text,expected_revision bigint,generated_id uuid,template_id uuid,title text,variables jsonb,content_snapshot text,storage_path text,file_size bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rec public.linkare_records; tmpl public.linkare_document_templates_v1; admin_payload jsonb; clinical_payload jsonb; profile_payload jsonb; server_vars jsonb; variable_key text; regenerated text; prefix text; at_time timestamptz:=clock_timestamp(); next_revision bigint; doc jsonb;
begin
 select * into tmpl from public.linkare_document_templates_v1 where id=template_id and active and (organization_id is null or organization_id=org);if not found then raise exception 'TEMPLATE_NOT_FOUND';end if;
 if tmpl.classification='clinical' then if not public.linkare_permission_v3(org,'documentsGenerateClinical') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;else if not public.linkare_permission_v3(org,'documentsGenerateAdministrative') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;end if;
 if not public.linkare_entitled_v3(org) then raise exception 'SUBSCRIPTION_REQUIRED';end if;
 prefix:=org::text||'/'||patient_id||'/';if content_snapshot is null or length(content_snapshot) not between 1 and 20000 or left(storage_path,length(prefix))<>prefix or file_size not between 1 and 20971520 then raise exception 'INVALID_DOCUMENT';end if;
 select payload into admin_payload from public.linkare_records where organization_id=org and kind='patient_admin' and id=patient_id and not deleted;if admin_payload is null then raise exception 'PATIENT_NOT_FOUND';end if;
 select payload into profile_payload from public.linkare_records where organization_id=org and kind='profile' and id='clinic' and not deleted;
 if tmpl.classification='clinical' then select payload into clinical_payload from public.linkare_records where organization_id=org and kind='patient_clinical' and id=patient_id and not deleted;end if;
 server_vars:=coalesce(variables,'{}')||jsonb_build_object('nombre_paciente',left(coalesce(admin_payload->>'name',''),180),'fecha',at_time::date::text,'diagnostico',left(coalesce(clinical_payload->>'diagnosis',''),300),'medico',left(coalesce(profile_payload->>'clinician',''),180),'numero_junta',left(coalesce(profile_payload->>'professionalLicense',''),100));regenerated:=tmpl.body;
 for variable_key in select jsonb_array_elements_text(tmpl.variables) loop regenerated:=replace(regenerated,'{'||variable_key||'}',left(coalesce(server_vars->>variable_key,''),1500));end loop;
 if regenerated<>content_snapshot or regenerated~'\{[^}]+\}' then raise exception 'DOCUMENT_CONTENT_MISMATCH' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':patient_clinical:'||patient_id,303));select * into rec from public.linkare_records where organization_id=org and kind='patient_clinical' and id=patient_id and not deleted for update;if not found then raise exception 'PATIENT_NOT_FOUND';end if;
 if rec.revision<>expected_revision then raise exception 'REVISION_CONFLICT:patient_clinical:%',patient_id using errcode='40001';end if;
 doc:=jsonb_build_object('id',generated_id::text,'name',left(title,180)||'.pdf','category',tmpl.name,'description','Generado desde plantilla versionada','clinicalDate',at_time::date,'confidentiality',case when tmpl.classification='clinical' then 'Clínico' else 'Administrativo' end,'size',file_size,'mimeType','application/pdf','storagePath',storage_path,'createdAt',at_time,'createdBy',auth.uid(),'generated',true,'templateId',tmpl.id,'templateVersion',tmpl.version);
 next_revision:=rec.revision+1;update public.linkare_records set payload=jsonb_set(rec.payload,'{documents}',jsonb_build_array(doc)||coalesce(rec.payload->'documents','[]')),revision=next_revision,updated_at=at_time,updated_by=auth.uid() where organization_id=org and kind='patient_clinical' and id=patient_id;
 insert into public.linkare_generated_documents_v1(id,organization_id,patient_id,template_id,template_version,title,classification,variables,content_snapshot,storage_path,created_by) values(generated_id,org,patient_id,tmpl.id,tmpl.version,left(title,180),tmpl.classification,coalesce(variables,'{}'),content_snapshot,storage_path,auth.uid());
 insert into public.linkare_audit_v3(organization_id,actor_id,action,kind,record_id,revision,fingerprint) values(org,auth.uid(),'document.generated','generated_document',generated_id::text,next_revision,encode(sha256(convert_to(content_snapshot,'UTF8')),'hex'));
 return jsonb_build_object('id',generated_id,'revision',next_revision,'document',doc);
end $$;

revoke all on function public.linkare_attach_generated_document_v1(uuid,text,bigint,uuid,uuid,text,jsonb,text,text,bigint) from public,anon;
grant execute on function public.linkare_attach_generated_document_v1(uuid,text,bigint,uuid,uuid,text,jsonb,text,text,bigint) to authenticated;
do $$begin
 if to_regprocedure('public.linkare_set_updated_at()') is not null then
  execute $alter$alter function public.linkare_set_updated_at() set search_path=''$alter$;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
