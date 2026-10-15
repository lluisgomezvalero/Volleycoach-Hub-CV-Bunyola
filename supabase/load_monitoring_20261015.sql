-- Additive, no backfill or mutation of historical attendance/RPE/wellness.
begin;
alter table public.wellness_entries add column if not exists pain_location text;
alter table public.wellness_entries add column if not exists training_limitation text check (training_limitation in ('none','modified','stop','unsure'));
create table public.load_exposures (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id),
 event_id uuid references public.events(id) on delete cascade, occurred_on date not null,
 title text not null check (length(title) between 1 and 180), activity_kind text not null default 'team' check (activity_kind in ('team','other_team','selection','gym','other_sport')),
 participation text not null check (participation in ('participated','rest','pending')),
 validated boolean not null default false, minutes numeric check (minutes>0 and minutes<=1440),
 rpe numeric check (rpe between 0 and 10), rpe_origin text check (rpe_origin in ('self','player_relay','coach_estimate')),
 warmup_minutes numeric check (warmup_minutes>=0), participation_minutes numeric check (participation_minutes>=0), bench_minutes numeric check (bench_minutes>=0),
 jumps integer check (jumps>=0), strikes integer check (strikes>=0), count_kind text check (count_kind in ('counted','estimated')),
 notes text not null default '' check (length(notes)<=2000), recorded_by uuid not null default auth.uid() references public.profiles(id),
 updated_by uuid default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,player_id), check (rpe is null or rpe_origin is not null),check ((jumps is null and strikes is null) or count_kind is not null)
);
create index load_exposures_player_date on public.load_exposures(player_id,occurred_on);
create table public.load_context_periods (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.players(id),starts_on date not null,ends_on date not null,
 kind text not null check (kind in ('rest','vacation','illness','injury','return','planned_increase')),
 no_exposure_confirmed boolean not null default false,notes text not null default '' check(length(notes)<=2000),
 recorded_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),check(ends_on>=starts_on)
);
create index load_context_player_dates on public.load_context_periods(player_id,starts_on,ends_on);
create table public.load_decisions (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.players(id),
 decision text not null check(length(decision) between 1 and 2000),reason text not null check(length(reason) between 1 and 2000),
 review_on date not null,review_of uuid references public.load_decisions(id),recorded_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now()
);
create index load_decisions_player_date on public.load_decisions(player_id,created_at);
create table public.load_exposure_revisions (
 id bigint generated always as identity primary key,exposure_id uuid not null references public.load_exposures(id) on delete cascade,
 player_id uuid not null references public.players(id),previous jsonb not null,recorded_by uuid default auth.uid(),created_at timestamptz not null default now()
);
alter table public.load_exposures enable row level security;
alter table public.load_context_periods enable row level security;
alter table public.load_decisions enable row level security;
alter table public.load_exposure_revisions enable row level security;
create policy exposure_read on public.load_exposures for select to authenticated using (
 player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id())));
create policy exposure_write on public.load_exposures for insert to authenticated with check (
 player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id())));
create policy exposure_update on public.load_exposures for update to authenticated using (
 player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id()))) with check (
 player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id())));
create policy context_read on public.load_context_periods for select to authenticated using (player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id())));
create policy context_write on public.load_context_periods for insert to authenticated with check (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id()) and recorded_by=auth.uid());
create policy decision_staff_read on public.load_decisions for select to authenticated using (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id()));
create policy decision_staff_insert on public.load_decisions for insert to authenticated with check (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id()) and recorded_by=auth.uid());
create policy revision_read on public.load_exposure_revisions for select to authenticated using (player_id=public.current_player_id() or (public.is_staff() and exists(select 1 from public.players p where p.id=player_id and p.club_id=public.current_club_id())));
create policy revision_insert on public.load_exposure_revisions for insert to authenticated with check (recorded_by=auth.uid() and exists(select 1 from public.load_exposures e where e.id=exposure_id and e.player_id=load_exposure_revisions.player_id));
grant select,insert,update on public.load_exposures to authenticated;
grant select,insert on public.load_context_periods,public.load_decisions,public.load_exposure_revisions to authenticated;
grant usage,select on sequence public.load_exposure_revisions_id_seq to authenticated;
revoke all on public.load_exposures,public.load_context_periods,public.load_decisions,public.load_exposure_revisions from anon;
create function public.validate_load_exposure() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.events; p public.players; deadline timestamptz; allowed boolean;
begin
 select * into p from public.players where id=new.player_id;
 if tg_op='UPDATE' and (new.player_id is distinct from old.player_id or new.event_id is distinct from old.event_id or new.recorded_by is distinct from old.recorded_by or new.created_at is distinct from old.created_at) then raise exception 'No se puede cambiar la identidad del registro'; end if;
 if tg_op='INSERT' and new.recorded_by is distinct from auth.uid() then raise exception 'Autor no válido'; end if;
 if new.event_id is not null then
   select * into e from public.events where id=new.event_id;
   if e.team_id is distinct from p.team_id or e.club_id is distinct from p.club_id or e.event_type not in ('training','match','friendly','tournament') then raise exception 'Evento fuera del equipo'; end if;
   new.occurred_on=(e.starts_at at time zone 'Europe/Madrid')::date;
   if e.event_type in ('match','friendly','tournament') and new.minutes is not null and (new.warmup_minutes is null or new.participation_minutes is null or new.minutes<>new.warmup_minutes+new.participation_minutes) then raise exception 'Desglosa calentamiento y participación; el banquillo se registra aparte'; end if;
 end if;
 if new.occurred_on>(now() at time zone 'Europe/Madrid')::date then raise exception 'La exposición aún no se ha realizado'; end if;
 if not public.is_staff() then
  if new.player_id is distinct from public.current_player_id() or new.rpe_origin is not null and new.rpe_origin<>'self' then raise exception 'Solo puedes registrar tu esfuerzo percibido'; end if;
  if new.event_id is not null then
   if tg_op='INSERT' then new.validated=false;
   elsif new.minutes is distinct from old.minutes or new.participation is distinct from old.participation or new.warmup_minutes is distinct from old.warmup_minutes or new.participation_minutes is distinct from old.participation_minutes then new.validated=false;
   else new.validated=old.validated; end if;
   if new.rpe is not null and (tg_op='INSERT' or new.rpe is distinct from old.rpe) then
    deadline=((e.starts_at at time zone 'Europe/Madrid')::date+1)::timestamp at time zone 'Europe/Madrid';
    allowed=e.ends_at is not null and now()>=e.ends_at+interval '30 minutes' and now()<deadline;
    if not coalesce(allowed,false) and not exists(select 1 from public.rpe_entries r where r.event_id=new.event_id and r.player_id=new.player_id and r.source='player' and r.score=new.rpe) and not exists(select 1 from public.rpe_submission_overrides o where o.event_id=new.event_id and o.player_id=new.player_id and o.expires_at>now()) then raise exception 'Fuera del plazo de RPE; pide al entrenador que lo reabra'; end if;
   end if;
  end if;
 end if;
 if new.participation='rest' and (new.minutes is not null or new.rpe is not null) then raise exception 'El descanso confirmado no tiene RPE ni minutos'; end if;
 if new.participation='pending' then new.validated=false; end if;
 new.updated_at=now();new.updated_by=auth.uid();return new;
end $$;
create trigger validate_load_exposure before insert or update on public.load_exposures for each row execute function public.validate_load_exposure();
create function public.log_load_exposure_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.load_exposure_revisions(exposure_id,player_id,previous) values(old.id,old.player_id,to_jsonb(old));return new;
end $$;
create trigger log_load_exposure_revision after update on public.load_exposures for each row execute function public.log_load_exposure_revision();
revoke execute on function public.validate_load_exposure(),public.log_load_exposure_revision() from public,anon,authenticated;
comment on column public.attendance.effective_minutes is 'Minutos individuales realizados, incluidas pausas habituales; aplicables a present y late. No se rellenan automáticamente los históricos.';

-- Atomic save: reuse canonical RPE rows so reminders/session detail stay consistent.
create function public.save_load_exposure(p_record jsonb,p_id uuid default null) returns public.load_exposures
language plpgsql security invoker set search_path='' as $$
declare result public.load_exposures; value public.load_exposures; score_source text;
begin
 if p_id is not null then
  select * into result from public.load_exposures where id=p_id;
  if result.id is null then raise exception 'Registro no accesible';end if;
  value=jsonb_populate_record(result,p_record - array['id','event_id','player_id','recorded_by','created_at']);
  update public.load_exposures set occurred_on=value.occurred_on,title=value.title,activity_kind=value.activity_kind,participation=value.participation,validated=value.validated,minutes=value.minutes,rpe=value.rpe,rpe_origin=value.rpe_origin,warmup_minutes=value.warmup_minutes,participation_minutes=value.participation_minutes,bench_minutes=value.bench_minutes,jumps=value.jumps,strikes=value.strikes,count_kind=value.count_kind,notes=value.notes where id=p_id returning * into result;
 else
  value=jsonb_populate_record(null::public.load_exposures,p_record);
  insert into public.load_exposures(player_id,event_id,occurred_on,title,activity_kind,participation,validated,minutes,rpe,rpe_origin,warmup_minutes,participation_minutes,bench_minutes,jumps,strikes,count_kind,notes)
  values(value.player_id,value.event_id,value.occurred_on,value.title,value.activity_kind,value.participation,coalesce(value.validated,false),value.minutes,value.rpe,value.rpe_origin,value.warmup_minutes,value.participation_minutes,value.bench_minutes,value.jumps,value.strikes,value.count_kind,coalesce(value.notes,'')) returning * into result;
 end if;
 if result.event_id is not null and result.rpe is not null and result.rpe_origin in ('self','player_relay') and not exists(select 1 from public.rpe_entries r where r.event_id=result.event_id and r.player_id=result.player_id and r.source='player' and r.score=result.rpe) then
  score_source=case when public.is_staff() then 'coach_for_player' else 'player' end;
  insert into public.rpe_entries(event_id,player_id,score,source,coach_profile_id) values(result.event_id,result.player_id,result.rpe,score_source,case when public.is_staff() then auth.uid() else null end)
  on conflict(event_id,player_id) do update set score=excluded.score,source=excluded.source,coach_profile_id=excluded.coach_profile_id,updated_at=now();
 end if;
 return result;
end $$;
revoke execute on function public.save_load_exposure(jsonb,uuid) from public,anon;
grant execute on function public.save_load_exposure(jsonb,uuid) to authenticated;

commit;
