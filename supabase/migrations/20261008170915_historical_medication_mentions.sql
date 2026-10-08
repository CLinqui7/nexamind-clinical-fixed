begin;

-- A source-linked clinical index, deliberately separate from current treatment.
create table linkare_private.legacy_medication_enrichment_v1 (
 batch_id uuid primary key references linkare_private.legacy_migration_batches_v2(batch_id),
 organization_id uuid not null references public.organizations(id),
 backup_sha text not null check (backup_sha ~ '^[0-9a-f]{64}$'),
 plan_sha text not null check (plan_sha ~ '^[0-9a-f]{64}$'),
 extractor_version text not null check (length(extractor_version) between 1 and 60),
 expected_mentions integer not null check (expected_mentions >= 0),
 status text not null default 'prepared' check (status in ('prepared','running','completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table linkare_private.legacy_medication_mentions_v1 (
 organization_id uuid not null references public.organizations(id),
 id uuid not null,
 batch_id uuid not null references linkare_private.legacy_migration_batches_v2(batch_id),
 patient_id text not null,
 history_id uuid not null references linkare_private.legacy_history_v1(id),
 source_text_sha text not null check (source_text_sha ~ '^[0-9a-f]{64}$'),
 source_line integer not null check (source_line > 0),
 name text not null check (length(name) between 2 and 100),
 strength_text text not null check (length(strength_text) between 2 and 60),
 instruction_text text check (length(instruction_text) <= 700),
 source_excerpt text not null check (length(source_excerpt) between 1 and 400),
 extraction_method text not null check (length(extraction_method) between 1 and 60),
 review_status text not null default 'unreviewed' check (review_status = 'unreviewed'),
 created_at timestamptz not null default now(),
 primary key (organization_id,id)
);
create index legacy_medication_mentions_patient_v1 on linkare_private.legacy_medication_mentions_v1(organization_id,patient_id,history_id,id);
create index legacy_medication_mentions_batch_v1 on linkare_private.legacy_medication_mentions_v1(batch_id);
create index legacy_medication_mentions_history_v1 on linkare_private.legacy_medication_mentions_v1(history_id);
revoke all on linkare_private.legacy_medication_enrichment_v1,linkare_private.legacy_medication_mentions_v1 from public,anon,authenticated;
grant all on linkare_private.legacy_medication_enrichment_v1,linkare_private.legacy_medication_mentions_v1 to service_role;

create function public.linkare_legacy_medication_start_v1(org uuid,p_batch_id uuid,p_backup_sha text,p_plan_sha text,p_extractor_version text,p_expected_mentions integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source_batch linkare_private.legacy_migration_batches_v2;run linkare_private.legacy_medication_enrichment_v1;
begin
 select * into source_batch from linkare_private.legacy_migration_batches_v2 where batch_id=p_batch_id and organization_id=org and status='completed';
 if not found or source_batch.backup_sha<>p_backup_sha or source_batch.plan_sha<>p_plan_sha then raise exception 'SOURCE_BATCH_MISMATCH'; end if;
 if p_extractor_version !~ '^[a-z0-9_]{3,60}$' or p_expected_mentions is null or p_expected_mentions<0 then raise exception 'INVALID_ENRICHMENT_MANIFEST'; end if;
 select * into run from linkare_private.legacy_medication_enrichment_v1 where batch_id=p_batch_id for update;
 if found then
  if run.organization_id<>org or run.backup_sha<>p_backup_sha or run.plan_sha<>p_plan_sha or run.extractor_version<>p_extractor_version or run.expected_mentions<>p_expected_mentions then raise exception 'ENRICHMENT_MANIFEST_MISMATCH'; end if;
 else
  insert into linkare_private.legacy_medication_enrichment_v1(batch_id,organization_id,backup_sha,plan_sha,extractor_version,expected_mentions) values(p_batch_id,org,p_backup_sha,p_plan_sha,p_extractor_version,p_expected_mentions);
 end if;
 return jsonb_build_object('batchId',p_batch_id,'status',coalesce(run.status,'prepared'));
end $$;

create function public.linkare_legacy_medication_apply_v1(org uuid,p_batch_id uuid,p_backup_sha text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run linkare_private.legacy_medication_enrichment_v1;item jsonb;history linkare_private.legacy_history_v1;prior linkare_private.legacy_medication_mentions_v1;accepted integer:=0;
begin
 select * into run from linkare_private.legacy_medication_enrichment_v1 where batch_id=p_batch_id and organization_id=org for update;
 if not found or run.backup_sha<>p_backup_sha or run.status='completed' then raise exception 'ENRICHMENT_NOT_WRITABLE'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 or octet_length(p_items::text)>1000000 then raise exception 'INVALID_ENRICHMENT_CHUNK'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if item->>'organizationId'<>org::text or item->>'batchId'<>p_batch_id::text or item->>'extractionMethod'<>run.extractor_version or
   (item->>'id')::uuid is null or (item->>'historyId')::uuid is null or nullif(item->>'patientId','') is null or
   (item->>'sourceLine')::integer<1 or item->>'sourceTextSha' !~ '^[0-9a-f]{64}$' or
   length(item->>'name') not between 2 and 100 or length(item->>'strengthText') not between 2 and 60 or
   length(item->>'sourceExcerpt') not between 1 and 400 or length(coalesce(item->>'instructionText',''))>700 then raise exception 'INVALID_ENRICHMENT_ITEM'; end if;
  select * into history from linkare_private.legacy_history_v1 where id=(item->>'historyId')::uuid and organization_id=org and batch_id=p_batch_id and patient_id=item->>'patientId' and scope='clinical';
  if not found or encode(sha256(convert_to(coalesce(history.payload->>'text',''),'UTF8')),'hex')<>item->>'sourceTextSha' then raise exception 'HISTORY_SOURCE_MISMATCH'; end if;
  select * into prior from linkare_private.legacy_medication_mentions_v1 where organization_id=org and id=(item->>'id')::uuid;
  if found then
   if prior.history_id<>(item->>'historyId')::uuid or prior.source_text_sha<>item->>'sourceTextSha' or prior.source_line<>(item->>'sourceLine')::integer or prior.name<>item->>'name' or prior.strength_text<>item->>'strengthText' or prior.instruction_text is distinct from nullif(item->>'instructionText','') or prior.source_excerpt<>item->>'sourceExcerpt' then raise exception 'ENRICHMENT_IDENTITY_CONFLICT'; end if;
   continue;
  end if;
  insert into linkare_private.legacy_medication_mentions_v1(organization_id,id,batch_id,patient_id,history_id,source_text_sha,source_line,name,strength_text,instruction_text,source_excerpt,extraction_method)
  values(org,(item->>'id')::uuid,p_batch_id,item->>'patientId',(item->>'historyId')::uuid,item->>'sourceTextSha',(item->>'sourceLine')::integer,item->>'name',item->>'strengthText',nullif(item->>'instructionText',''),item->>'sourceExcerpt',run.extractor_version);
  accepted:=accepted+1;
 end loop;
 update linkare_private.legacy_medication_enrichment_v1 set status='running',updated_at=now() where batch_id=p_batch_id;
 return jsonb_build_object('accepted',accepted,'batchId',p_batch_id);
end $$;

create function public.linkare_legacy_medication_verify_v1(org uuid,p_batch_id uuid,p_backup_sha text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run linkare_private.legacy_medication_enrichment_v1;actual bigint;orphans bigint;
begin
 select * into run from linkare_private.legacy_medication_enrichment_v1 where batch_id=p_batch_id and organization_id=org for update;
 if not found or run.backup_sha<>p_backup_sha then raise exception 'ENRICHMENT_NOT_FOUND'; end if;
 select count(*) into actual from linkare_private.legacy_medication_mentions_v1 where batch_id=p_batch_id and organization_id=org;
 select count(*) into orphans from linkare_private.legacy_medication_mentions_v1 mention left join linkare_private.legacy_history_v1 history on history.id=mention.history_id and history.organization_id=mention.organization_id and history.patient_id=mention.patient_id where mention.batch_id=p_batch_id and history.id is null;
 if actual=run.expected_mentions and orphans=0 then update linkare_private.legacy_medication_enrichment_v1 set status='completed',updated_at=now() where batch_id=p_batch_id; end if;
 return jsonb_build_object('ok',actual=run.expected_mentions and orphans=0,'expected',run.expected_mentions,'actual',actual,'orphans',orphans,'status',case when actual=run.expected_mentions and orphans=0 then 'completed' else run.status end);
end $$;

create function public.linkare_legacy_medication_page_v1(org uuid,p_patient_id text,p_cursor jsonb default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;has_more boolean;next_cursor jsonb;cursor_date date;cursor_id uuid;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'clinicalView') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 if p_limit not between 1 and 20 or p_patient_id is null then raise exception 'INVALID_PAGE'; end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND'; end if;
 if p_cursor is not null then cursor_date:=nullif(p_cursor->>'occurredOn','')::date;cursor_id:=(p_cursor->>'id')::uuid; end if;
 with candidates as (
  select m.*,h.occurred_on,row_number() over(order by h.occurred_on desc nulls last,m.id desc) rn
  from linkare_private.legacy_medication_mentions_v1 m join linkare_private.legacy_history_v1 h on h.id=m.history_id
  where m.organization_id=org and m.patient_id=p_patient_id and (p_cursor is null or (cursor_date is not null and (h.occurred_on<cursor_date or (h.occurred_on=cursor_date and m.id<cursor_id) or h.occurred_on is null)) or (cursor_date is null and h.occurred_on is null and m.id<cursor_id))
  order by h.occurred_on desc nulls last,m.id desc limit p_limit+1
 ),page as(select * from candidates where rn<=p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'historyId',history_id,'occurredOn',occurred_on,'name',name,'strengthText',strength_text,'instructionText',instruction_text,'sourceExcerpt',source_excerpt,'reviewStatus',review_status) order by occurred_on desc nulls last,id desc),'[]'),exists(select 1 from candidates where rn>p_limit)
 into items,has_more from page;
 if has_more then next_cursor:=jsonb_build_object('occurredOn',items->-1->>'occurredOn','id',items->-1->>'id'); end if;
 return jsonb_build_object('items',items,'hasMore',has_more,'nextCursor',next_cursor,'limit',p_limit,'semantics','historical_unverified');
end $$;

create function public.linkare_legacy_visit_summary_v1(org uuid,p_patient_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare marked bigint;latest date;stat_rows bigint;movement_rows bigint;
begin
 if auth.uid() is null or not public.linkare_permission_v3(org,'patientsView') then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 if not exists(select 1 from public.linkare_records where organization_id=org and kind='patient_admin' and id=p_patient_id and not deleted) then raise exception 'PATIENT_NOT_FOUND'; end if;
 select count(*) filter(where source_table='t_mov_diarios' and payload->>'passedConsultation'='true'),
 max(occurred_on) filter(where source_table='t_mov_diarios' and payload->>'passedConsultation'='true'),
 count(*) filter(where source_table='t_esta_cli'),count(*) filter(where source_table='t_mov_diarios')
 into marked,latest,stat_rows,movement_rows from linkare_private.legacy_history_v1 where organization_id=org and patient_id=p_patient_id and scope='administrative';
 return jsonb_build_object('markedConsultations',marked,'lastMarkedConsultationOn',latest,'statisticsRows',stat_rows,'movementRows',movement_rows,'semantics','source_flags_not_verified_visit_total');
end $$;

revoke all on function public.linkare_legacy_medication_start_v1(uuid,uuid,text,text,text,integer),public.linkare_legacy_medication_apply_v1(uuid,uuid,text,jsonb),public.linkare_legacy_medication_verify_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.linkare_legacy_medication_start_v1(uuid,uuid,text,text,text,integer),public.linkare_legacy_medication_apply_v1(uuid,uuid,text,jsonb),public.linkare_legacy_medication_verify_v1(uuid,uuid,text) to service_role;
revoke all on function public.linkare_legacy_medication_page_v1(uuid,text,jsonb,integer),public.linkare_legacy_visit_summary_v1(uuid,text) from public,anon;
grant execute on function public.linkare_legacy_medication_page_v1(uuid,text,jsonb,integer),public.linkare_legacy_visit_summary_v1(uuid,text) to authenticated,service_role;

commit;
