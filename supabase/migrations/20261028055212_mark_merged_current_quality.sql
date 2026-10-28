begin;

-- A current chart can also carry FoxPro history. Keep those meanings separate
-- so existing clinical defaults and reminder preferences stay current.
alter table linkare_private.legacy_patient_summary_v1
  drop constraint legacy_patient_summary_v1_data_quality_check;
alter table linkare_private.legacy_patient_summary_v1
  add constraint legacy_patient_summary_v1_data_quality_check
  check(data_quality in('historical','merged_current'));

create function linkare_private.set_merged_current_quality_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from linkare_private.patient_clinical_merge_log_v1
    where organization_id=new.organization_id and target_patient_id=new.patient_id) then
    new.data_quality:='merged_current';
  end if;
  return new;
end $$;
create trigger linkare_set_merged_current_quality_v1
  before insert or update on linkare_private.legacy_patient_summary_v1
  for each row execute function linkare_private.set_merged_current_quality_v1();

update linkare_private.legacy_patient_summary_v1 summary
set data_quality='merged_current'
where summary.organization_id='2ca5b8d4-d711-4ec7-833a-9d018ef067ca'
  and exists(select 1 from linkare_private.patient_clinical_merge_log_v1 merged
    where merged.organization_id=summary.organization_id
      and merged.target_patient_id=summary.patient_id);

do $$
declare row record;
begin
  for row in select organization_id,patient_id
    from linkare_private.legacy_patient_summary_v1
    where organization_id='2ca5b8d4-d711-4ec7-833a-9d018ef067ca'
      and data_quality='merged_current'
  loop
    perform linkare_private.refresh_patient_v1(row.organization_id,row.patient_id);
  end loop;
end $$;

commit;
