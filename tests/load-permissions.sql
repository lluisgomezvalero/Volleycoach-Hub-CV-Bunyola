-- Integration checks against live schema; all fixture writes are rolled back.
begin;
do $$
declare pid uuid;uid uuid;other_pid uuid;staff_uid uuid;eid uuid;ex public.load_exposures;external_id uuid;denied boolean;cnt int;
begin
 select p.id,p.profile_id into pid,uid from public.players p join public.profiles pr on pr.id=p.profile_id where p.active and pr.role='player' order by p.id limit 1;
 select id into other_pid from public.players where id<>pid order by id limit 1;
 select id into staff_uid from public.profiles where role in ('coach','administrator') order by id limit 1;
 select id into eid from public.events where team_id=(select team_id from public.players where id=pid) and event_type='training' and ends_at<now() order by starts_at desc limit 1;
 if pid is null or staff_uid is null or eid is null then raise exception 'Missing representative test identities';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);execute 'set local role authenticated';
 ex=public.save_load_exposure(jsonb_build_object('player_id',pid,'occurred_on',(now() at time zone 'Europe/Madrid')::date,'title','ROLLBACK TEST external','activity_kind','gym','participation','participated','validated',true,'minutes',40,'rpe',5,'rpe_origin','self'),null);
 external_id=ex.id;if not ex.validated then raise exception 'Own external confirmation failed';end if;
 denied=false;begin
  perform public.save_load_exposure(jsonb_build_object('player_id',other_pid,'occurred_on',(now() at time zone 'Europe/Madrid')::date,'title','Forbidden','activity_kind','gym','participation','pending'),null);
 exception when insufficient_privilege or raise_exception then denied=true;end;
 if not denied then raise exception 'Cross-player INSERT was not rejected';end if;
 if exists(select 1 from public.load_exposures where player_id=other_pid) then raise exception 'Cross-player read visible';end if;
 denied=false;begin
  insert into public.load_decisions(player_id,decision,reason,review_on) values(pid,'Forbidden','Player must not write staff decisions',current_date);
 exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'Player could write staff decision';end if;
 ex=public.save_load_exposure(jsonb_build_object('player_id',pid,'event_id',eid,'occurred_on',current_date,'title','ROLLBACK TEST session','activity_kind','team','participation','participated','validated',true,'minutes',45),null);
 if ex.validated then raise exception 'Player could validate team participation';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',staff_uid::text,true);execute 'set local role authenticated';
 ex=public.save_load_exposure(jsonb_build_object('validated',true,'minutes',45,'rpe',6,'rpe_origin','player_relay'),ex.id);
 if not ex.validated then raise exception 'Staff validation failed';end if;
 if not exists(select 1 from public.rpe_entries where event_id=eid and player_id=pid and score=6 and source='coach_for_player') then raise exception 'Canonical RPE not synchronized';end if;
 insert into public.load_decisions(player_id,decision,reason,review_on) values(pid,'ROLLBACK TEST review','Check latest wellness, no automatic reduction',current_date+1);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if exists(select 1 from public.load_decisions where player_id=pid) then raise exception 'Staff decision leaked to player';end if;
 ex=public.save_load_exposure(jsonb_build_object('minutes',30,'rpe',null,'rpe_origin',null),ex.id);
 if ex.validated then raise exception 'Changed individual minutes retained staff validation';end if;
 if (select count(*) from public.load_exposure_revisions where exposure_id=ex.id)<2 then raise exception 'Revision history missing';end if;
 -- Error in canonical RPE write must roll back exposure and revision atomically.
 select count(*) into cnt from public.load_exposure_revisions where exposure_id=ex.id;
 denied=false;begin
  perform public.save_load_exposure(jsonb_build_object('rpe',8,'rpe_origin','self'),ex.id);
 exception when others then denied=true;end;
 if not denied then raise exception 'Expired event RPE unexpectedly accepted';end if;
 if (select rpe from public.load_exposures where id=ex.id) is not null or (select count(*) from public.load_exposure_revisions where exposure_id=ex.id)<>cnt then raise exception 'Failed RPE was not atomic';end if;
 -- Canonical session-form RPE uses the same server deadline and override.
 execute 'reset role';perform set_config('request.jwt.claim.sub',staff_uid::text,true);execute 'set local role authenticated';
 update public.rpe_entries set source='player',coach_profile_id=null where event_id=eid and player_id=pid;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 denied=false;begin update public.rpe_entries set score=7 where event_id=eid and player_id=pid;exception when raise_exception then denied=true;end;
 if not denied then raise exception 'Canonical RPE ignored collection deadline';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',staff_uid::text,true);execute 'set local role authenticated';
 insert into public.rpe_submission_overrides(event_id,player_id,enabled_by,expires_at) values(eid,pid,staff_uid,now()+interval '1 hour') on conflict(event_id,player_id) do update set expires_at=excluded.expires_at,enabled_by=excluded.enabled_by;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 update public.rpe_entries set score=7 where event_id=eid and player_id=pid;
 if not exists(select 1 from public.rpe_entries where event_id=eid and player_id=pid and score=7) then raise exception 'RPE reopening failed';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub','',true);execute 'set local role anon';
 denied=false;begin perform 1 from public.load_exposures;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'Anon could read load exposures';end if;
 execute 'reset role';
end $$;
select 'PASS: own/cross-player, staff validation, private decisions, revisions, atomic RPE, canonical deadline/reopening, anon denied' as result;
rollback;
