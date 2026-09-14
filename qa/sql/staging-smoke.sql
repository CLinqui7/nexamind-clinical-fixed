-- STAGING ONLY. No emails or real payments are issued. Everything ends in ROLLBACK.
-- Run after the v3 migration on an isolated database. This suite was NOT executed in the delivery runtime.
begin;
-- Change NO to YES only after verifying the selected project is a disposable staging environment.
select set_config('linkare.qa_staging','NO',true);
do $$begin if current_setting('linkare.qa_staging')<>'YES' then raise exception 'STOP: staging confirmation required';end if;end$$;
do $$declare d uuid:=gen_random_uuid();s uuid:=gen_random_uuid();other uuid:=gen_random_uuid();o uuid;o2 uuid;begin
 perform set_config('linkare.qa_doctor',d::text,true);perform set_config('linkare.qa_secretary',s::text,true);perform set_config('linkare.qa_other',other::text,true);
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,aud,role,created_at,updated_at) values
 (d,'qa-'||d||'@example.invalid',now(),'{"clinic_name":"QA isolated","full_name":"QA doctor"}','authenticated','authenticated',now(),now()),
 (s,'qa-'||s||'@example.invalid',now(),'{}','authenticated','authenticated',now(),now()),
 (other,'qa-'||other||'@example.invalid',now(),'{"clinic_name":"QA other","full_name":"QA other doctor"}','authenticated','authenticated',now(),now());
 perform set_config('request.jwt.claim.sub',d::text,true);o:=public.linkare_bootstrap_v3(null);if public.linkare_bootstrap_v3(null)<>o then raise exception 'Bootstrap is not idempotent';end if;
 perform set_config('linkare.qa_org',o::text,true);
 perform set_config('request.jwt.claim.sub',other::text,true);o2:=public.linkare_bootstrap_v3(null);perform set_config('linkare.qa_org_other',o2::text,true);
 insert into public.organization_members(organization_id,user_id,role,display_name,active,permissions) values(o,s,'secretary','QA secretary',true,'{"patientsView":true,"patientsEdit":true,"patientsCreate":true,"appointmentsManage":true,"remindersManage":true,"clinicalView":true}');
 update public.linkare_subscriptions_v3 set current_period_start=now(),current_period_end=now()+interval '30 days',plan_code='monthly' where organization_id=o;
end$$;
select set_config('request.jwt.claim.sub',current_setting('linkare.qa_doctor'),true);
set local role authenticated;
select public.linkare_save_changes_v3(current_setting('linkare.qa_org')::uuid,jsonb_build_array(
 jsonb_build_object('kind','patient_admin','id','qa-patient','expectedRevision',0,'payload',jsonb_build_object('name','Patient QA')),
 jsonb_build_object('kind','patient_clinical','id','qa-patient','expectedRevision',0,'payload',jsonb_build_object('diagnosis','PRIVATE-ONLY','consultations',jsonb_build_array(jsonb_build_object('id','note1','status','signed','signedAt',now(),'signedBy',current_setting('linkare.qa_doctor'),'freeNotes','immutable'))))
));
do $$declare loaded jsonb; denied boolean:=false;begin
 loaded:=public.linkare_load_state_v3(current_setting('linkare.qa_org')::uuid);
 if loaded::text not like '%PRIVATE-ONLY%' then raise exception 'Doctor cannot read clinical record';end if;
 begin perform public.linkare_load_state_v3(current_setting('linkare.qa_org_other')::uuid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-tenant read allowed';end if;
 denied:=false;
 begin perform public.linkare_save_changes_v3(current_setting('linkare.qa_org')::uuid,'[{"kind":"patient_admin","id":"qa-patient","expectedRevision":0,"payload":{"name":"Overwrite"}}]');exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'Stale revision allowed';end if;
 denied:=false;
 begin perform public.linkare_save_changes_v3(current_setting('linkare.qa_org')::uuid,'[{"kind":"patient_clinical","id":"qa-patient","expectedRevision":1,"payload":{"consultations":[]}}]');exception when raise_exception then if sqlerrm like '%SIGNED_NOTE_IMMUTABLE%' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'Signed note deletion allowed';end if;
 if has_table_privilege('authenticated','public.linkare_plans_v3','UPDATE') then raise exception 'Client may edit catalog';end if;
 if has_function_privilege('authenticated','public.linkare_confirm_payment_v3(text,text,integer,boolean,timestamptz)','EXECUTE') then raise exception 'Client may confirm a payment';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('linkare.qa_secretary'),true);
set local role authenticated;
do $$declare loaded jsonb; n bigint;denied boolean:=false;begin
 loaded:=public.linkare_load_state_v3(current_setting('linkare.qa_org')::uuid);
 if loaded::text like '%PRIVATE-ONLY%' or loaded::text like '%immutable%' then raise exception 'Clinical data leaked to secretary';end if;
 select count(*) into n from public.linkare_records where kind='patient_clinical';if n<>0 then raise exception 'Direct RLS read leaked clinical data';end if;
 select count(*) into n from public.linkare_orders_v3;if n<>0 then raise exception 'Secretary read invoices';end if;
 if public.linkare_document_access_v3(current_setting('linkare.qa_org')||'/qa-patient/test.pdf') then raise exception 'Secretary has clinical Storage access';end if;
 begin perform public.linkare_save_changes_v3(current_setting('linkare.qa_org')::uuid,'[{"kind":"patient_clinical","id":"qa-patient","expectedRevision":1,"payload":{"consultations":[]}}]');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Secretary wrote clinical record';end if;
 perform public.linkare_save_changes_v3(current_setting('linkare.qa_org')::uuid,'[{"kind":"patient_admin","id":"qa-patient","expectedRevision":1,"payload":{"name":"Corrected administrative name","diagnosis":"MUST-BE-REMOVED"}}]');
 loaded:=public.linkare_load_state_v3(current_setting('linkare.qa_org')::uuid);if loaded::text like '%MUST-BE-REMOVED%' then raise exception 'Clinical field smuggled into administrative payload';end if;
end$$;
reset role;
do $$declare reservation jsonb;ref text;r jsonb;ends timestamptz;denied boolean:=false;begin
 reservation:=public.linkare_reserve_order_v3(current_setting('linkare.qa_org')::uuid,current_setting('linkare.qa_doctor')::uuid,'annual');ref:=reservation->'order'->>'external_reference';
 if (reservation->'order'->>'amount_cents')::integer<>40000 then raise exception 'Wrong catalog amount';end if;
 begin perform public.linkare_confirm_payment_v3(ref,'qa-transaction-12345',1,true,now());exception when raise_exception then if sqlerrm like '%AMOUNT_MISMATCH%' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'Wrong payment amount accepted';end if;
 r:=public.linkare_confirm_payment_v3(ref,'qa-transaction-12345',40000,true,now());
 select current_period_end into ends from public.linkare_subscriptions_v3 where organization_id=current_setting('linkare.qa_org')::uuid;
 r:=public.linkare_confirm_payment_v3(ref,'qa-transaction-12345',40000,true,now());
 if (r->>'duplicate')::boolean is distinct from true or ends is distinct from (select current_period_end from public.linkare_subscriptions_v3 where organization_id=current_setting('linkare.qa_org')::uuid) then raise exception 'Webhook duplicate extended coverage twice';end if;
end$$;
select 'STAGING SMOKE PASSED; no changes will be retained' as result;
rollback;
