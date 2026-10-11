-- Reuse events and its staff RLS. Each occurrence keeps its own attendance/RPE.
create or replace function public.save_training_session(p_event_id uuid,p_form jsonb)
returns setof public.events language plpgsql security invoker set search_path='' as $$
declare old_event public.events; saved public.events; base_date date; last_date date; d date;
clock time; minutes int; team uuid; season uuid; data jsonb; series text; days jsonb;
repeating boolean; start_time timestamptz; n int;
begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Solo entrenadores y administradores pueden editar sesiones'; end if;
 if p_event_id is not null then
  select * into old_event from public.events where id=p_event_id and event_type='training' for update;
  if not found then raise exception 'Sesión no encontrada o sin permiso'; end if;
 end if;
 base_date := (p_form->>'date')::date; clock := (p_form->>'time')::time;
 minutes := (p_form->>'duration')::int;
 if base_date is null or clock is null or minutes is null or minutes<15 or minutes>300 then raise exception 'Fecha, hora o duración no válida (15–300 min)'; end if;
 team := coalesce(nullif(p_form->>'team_id','')::uuid,old_event.team_id);
 season := coalesce(old_event.season_id,nullif(p_form->>'season_id','')::uuid);
 if team is null or not exists(select 1 from public.teams where id=team and club_id=public.current_club_id()) then raise exception 'Equipo no válido'; end if;
 if old_event.payload->>'recurrence_id' is not null and team<>old_event.team_id then raise exception 'No puedes cambiar de equipo una sesión de una serie'; end if;
 repeating := coalesce((p_form->>'repeat_weekly')::boolean,false);
 data := coalesce(old_event.payload,'{}'::jsonb) || jsonb_build_object('type','Entrenamiento','time',to_char(clock,'HH24:MI'),'duration',minutes,'description',coalesce(p_form->>'description',''),'plan',coalesce(p_form->>'plan',''));
 if repeating then
  if old_event.payload->>'recurrence_id' is not null then raise exception 'Esta sesión ya pertenece a una serie. Edita solo esta sesión.'; end if;
  last_date := (p_form->>'repeat_until')::date; days := p_form->'repeat_days';
  if last_date is null or last_date<base_date or last_date>base_date+366 or days is null or jsonb_typeof(days)<>'array' or jsonb_array_length(days)=0 then raise exception 'Selecciona días y fecha de fin (máximo un año)'; end if;
  if exists(select 1 from jsonb_array_elements_text(days) x where x !~ '^[0-6]$') then raise exception 'Días de repetición no válidos'; end if;
  select count(*) into n from generate_series(base_date::timestamp,last_date::timestamp,'1 day') x where x::date=base_date or days @> to_jsonb(array[extract(dow from x)::int]);
  if n>120 then raise exception 'Máximo 120 sesiones por serie. Acorta la fecha de fin.'; end if;
  series := gen_random_uuid()::text;
  data := data || jsonb_build_object('recurrence_id',series,'recurrence_days',days,'recurrence_until',last_date,'recurrence_timezone','Europe/Madrid','recurrence_date',base_date);
 end if;
 start_time := (base_date+clock) at time zone 'Europe/Madrid';
 if p_event_id is null then
  insert into public.events(club_id,team_id,season_id,event_type,title,starts_at,ends_at,location,status,payload,created_by)
  values(public.current_club_id(),team,season,'training',coalesce(nullif(btrim(p_form->>'title'),''),'Entrenamiento'),start_time,start_time+make_interval(mins=>minutes),p_form->>'location','Próximo',data,auth.uid()) returning * into saved;
 else
  update public.events set title=coalesce(nullif(btrim(p_form->>'title'),''),'Entrenamiento'),team_id=team,starts_at=start_time,ends_at=start_time+make_interval(mins=>minutes),location=p_form->>'location',payload=data,updated_at=now() where id=p_event_id returning * into saved;
 end if;
 return next saved;
 if repeating then
  for d in select x::date from generate_series((base_date+1)::timestamp,last_date::timestamp,'1 day') x where days @> to_jsonb(array[extract(dow from x)::int]) loop
   start_time := (d+clock) at time zone 'Europe/Madrid';
   insert into public.events(club_id,team_id,season_id,event_type,title,starts_at,ends_at,location,status,payload,created_by)
   values(saved.club_id,team,season,'training',saved.title,start_time,start_time+make_interval(mins=>minutes),saved.location,'Próximo',data||jsonb_build_object('recurrence_date',d),auth.uid()) returning * into saved;
   return next saved;
  end loop;
 end if;
end $$;
revoke all on function public.save_training_session(uuid,jsonb) from public,anon;
grant execute on function public.save_training_session(uuid,jsonb) to authenticated;

create or replace function public.delete_training_sessions(p_event_id uuid,p_scope text)
returns table(id uuid) language plpgsql security invoker set search_path='' as $$
declare target public.events;
begin
 if auth.uid() is null or not public.is_staff() then raise exception 'Solo entrenadores y administradores pueden eliminar sesiones'; end if;
 if p_scope not in ('one','following') or p_scope is null then raise exception 'Alcance no válido'; end if;
 select * into target from public.events e where e.id=p_event_id and event_type='training' for update;
 if not found then raise exception 'Sesión no encontrada o sin permiso'; end if;
 if p_scope='following' and target.payload->>'recurrence_id' is null then raise exception 'Esta sesión no pertenece a una serie'; end if;
 return query delete from public.events e where e.id=target.id or
  (p_scope='following' and e.event_type='training' and e.club_id=target.club_id and e.team_id=target.team_id
   and e.payload->>'recurrence_id'=target.payload->>'recurrence_id'
   and e.payload->>'recurrence_date'>=target.payload->>'recurrence_date') returning e.id;
end $$;
revoke all on function public.delete_training_sessions(uuid,text) from public,anon;
grant execute on function public.delete_training_sessions(uuid,text) to authenticated;
