-- Staff-entered player reports; no historical RPE or minutes are backfilled.
alter table public.rpe_entries add column recorded_by uuid references public.profiles(id) on delete set null;
create table public.additional_player_loads(
 id uuid primary key,
 player_id uuid not null references public.players(id) on delete cascade,
 activity_type text not null check(activity_type in ('training','match','friendly','gym','other')),
 context text not null check(length(trim(context)) between 1 and 160),
 starts_at timestamptz not null,
 duration_minutes smallint not null check(duration_minutes between 1 and 600),
 score numeric not null check(score between 0 and 10),
 notes text not null default '' check(length(notes)<=1000),
 recorded_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 voided boolean not null default false,
 constraint additional_load_time check(starts_at+'1 minute'::interval*duration_minutes<=created_at)
);
create unique index additional_player_loads_unique_activity on public.additional_player_loads(player_id,starts_at,activity_type,lower(trim(context))) where not voided;
create index additional_player_loads_player_time on public.additional_player_loads(player_id,starts_at);
alter table public.additional_player_loads enable row level security;
revoke all on public.additional_player_loads from anon,authenticated;
grant select,insert,update on public.additional_player_loads to authenticated;
create policy additional_load_read on public.additional_player_loads for select to authenticated using(
 player_id=(select public.current_player_id()) or ((select public.is_staff()) and exists(select 1 from public.players p where p.id=player_id and p.club_id=(select public.current_club_id())))
);
create policy additional_load_insert on public.additional_player_loads for insert to authenticated with check(
 (select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.players p where p.id=player_id and p.club_id=(select public.current_club_id()))
);
create policy additional_load_update on public.additional_player_loads for update to authenticated using(
 (select public.is_staff()) and exists(select 1 from public.players p where p.id=player_id and p.club_id=(select public.current_club_id()))
) with check(
 (select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.players p where p.id=player_id and p.club_id=(select public.current_club_id()))
);
create function public.validate_additional_player_load() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_at=clock_timestamp();end if;
 if TG_OP='UPDATE' then
 if new.id<>old.id or new.player_id<>old.player_id or new.created_at<>old.created_at then raise exception 'No se puede cambiar la identidad del registro';end if;
 end if;
 if new.starts_at+interval '1 minute'*new.duration_minutes>now() then raise exception 'La actividad debe haber finalizado';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function public.validate_additional_player_load() from public,anon;
grant execute on function public.validate_additional_player_load() to authenticated;
create trigger validate_additional_load before insert or update on public.additional_player_loads for each row execute function public.validate_additional_player_load();
create function public.record_player_rpe(p_event_id uuid,p_player_id uuid,p_score numeric,p_minutes integer)
returns void language plpgsql security invoker set search_path='' as $$
declare e public.events; p public.players; r public.rpe_entries; minutes numeric; n integer;
begin
 if not public.is_staff() or auth.uid() is null then raise exception 'Solo el cuerpo técnico puede registrar RPE comunicado';end if;
 select * into e from public.events where id=p_event_id and event_type='training' and club_id=public.current_club_id();
 select * into p from public.players where id=p_player_id and club_id=public.current_club_id();
 if e.id is null or p.id is null or e.team_id is null or p.team_id is distinct from e.team_id then raise exception 'Sesión y jugadora deben pertenecer al mismo equipo';end if;
 minutes=case when e.ends_at>e.starts_at then extract(epoch from e.ends_at-e.starts_at)/60 when e.payload->>'duration' ~ '^[0-9]+$' then (e.payload->>'duration')::numeric else null end;
 if minutes is null or minutes<=0 then raise exception 'Confirma primero la duración real del entrenamiento';end if;
 if e.starts_at+minutes*interval '1 minute'>now() or e.status in ('cancelled','canceled','deleted') then raise exception 'El entrenamiento debe estar finalizado';end if;
 if p_score is null or p_score<0 or p_score>10 or p_minutes is null or p_minutes<1 or p_minutes>minutes then raise exception 'Revisa el RPE y los minutos individuales';end if;
 perform 1 from public.attendance where event_id=p_event_id and player_id=p_player_id and official_status in ('present','late') for update;
 if not found then raise exception 'Valida primero la asistencia de la jugadora';end if;
 insert into public.rpe_entries(event_id,player_id,score,source,coach_profile_id,recorded_by)
 values(p_event_id,p_player_id,p_score,'coach_for_player',null,auth.uid())
 on conflict(event_id,player_id) do update set score=excluded.score,recorded_by=auth.uid(),updated_at=now()
 where rpe_entries.source='coach_for_player';
 get diagnostics n=row_count;
 if n=0 then raise exception 'La jugadora ya ha registrado su RPE. No se sobrescribe su respuesta';end if;
 update public.attendance set effective_minutes=p_minutes,updated_at=now() where event_id=p_event_id and player_id=p_player_id;
end $$;
revoke all on function public.record_player_rpe(uuid,uuid,numeric,integer) from public,anon;
grant execute on function public.record_player_rpe(uuid,uuid,numeric,integer) to authenticated;
