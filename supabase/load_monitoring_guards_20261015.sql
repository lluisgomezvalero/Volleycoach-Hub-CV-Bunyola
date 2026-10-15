begin;
create or replace function public.validate_load_exposure() returns trigger language plpgsql security invoker set search_path='' as $$
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
   if tg_op='INSERT' then
    -- Reuse an existing official validation only for identical, already confirmed data.
    new.validated=exists(select 1 from public.attendance a where a.event_id=new.event_id and a.player_id=new.player_id and a.validated_at is not null and
      ((new.participation='rest' and a.official_status in ('justified','unjustified')) or
       (new.participation='participated' and a.official_status in ('present','late') and new.minutes is not null and
        (a.effective_minutes=new.minutes or (a.official_status='present' and e.event_type='training' and e.payload->>'duration_confirmed'='true' and (e.payload->>'actual_duration_minutes')::numeric=new.minutes)))));
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

-- Same collection window enforced for canonical rows and every screen, not only the UI.
create function public.validate_individual_rpe_window() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.events; deadline timestamptz;
begin
 if public.is_staff() then return new;end if;
 if tg_op='UPDATE' and new.score is not distinct from old.score then return new;end if;
 select * into e from public.events where id=new.event_id;
 deadline=((e.starts_at at time zone 'Europe/Madrid')::date+1)::timestamp at time zone 'Europe/Madrid';
 if not coalesce(e.ends_at is not null and now()>=e.ends_at+interval '30 minutes' and now()<deadline,false)
 and not exists(select 1 from public.rpe_submission_overrides o where o.event_id=new.event_id and o.player_id=new.player_id and o.expires_at>now()) then
  raise exception 'Fuera del plazo de RPE: 30 minutos después del final hasta medianoche Europe/Madrid, salvo reapertura';
 end if;
 return new;
end $$;
create trigger validate_individual_rpe_window before insert or update on public.rpe_entries for each row execute function public.validate_individual_rpe_window();
revoke execute on function public.validate_individual_rpe_window() from public,anon,authenticated;
commit;
