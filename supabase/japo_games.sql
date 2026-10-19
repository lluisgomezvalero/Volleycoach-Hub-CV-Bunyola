-- Japos: resultados por entrenamiento, clasificación calculada sin contadores acumulados.
create table public.japo_games (
 id uuid primary key,
 event_id uuid not null references public.events(id) on delete cascade,
 team_a uuid[] not null,
 team_b uuid[] not null,
 sets_a smallint not null,
 sets_b smallint not null,
 voided boolean not null default false,
 recorded_by uuid not null default auth.uid() references public.profiles(id),
 updated_at timestamptz not null default now(),
 constraint japo_result check ((sets_a=2 and sets_b in (0,1)) or (sets_b=2 and sets_a in (0,1))),
 constraint japo_teams check (cardinality(team_a)>0 and cardinality(team_b)>0 and cardinality(team_a)<=20 and cardinality(team_b)<=20 and not(team_a && team_b) and array_position(team_a,null) is null and array_position(team_b,null) is null)
);
create index japo_games_event_idx on public.japo_games(event_id);
alter table public.japo_games enable row level security;
revoke all on public.japo_games from anon,authenticated;
grant select,insert,update on public.japo_games to authenticated;
create policy japo_read on public.japo_games for select to authenticated using (
 exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id()) and ((select public.is_staff()) or e.team_id in(select p.team_id from public.players p where p.id=(select public.current_player_id()))))
);
create policy japo_insert on public.japo_games for insert to authenticated with check (
 (select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id()) and e.event_type='training')
);
create policy japo_update on public.japo_games for update to authenticated using (
 (select public.is_staff()) and exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id()))
) with check (
 (select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id()) and e.event_type='training')
);
create function public.validate_japo_game() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.events; n integer;
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.event_id<>old.event_id) then raise exception 'No se puede trasladar un Japo a otra sesión'; end if;
 select * into e from public.events where id=new.event_id and event_type='training';
 if e.id is null or e.team_id is null then raise exception 'El Japo necesita un entrenamiento de equipo'; end if;
 if exists(select 1 from unnest(new.team_a||new.team_b) p group by p having count(*)>1) then raise exception 'Jugadoras duplicadas'; end if;
 select count(*) into n from public.players p where p.id=any(new.team_a||new.team_b) and p.club_id=e.club_id and p.team_id=e.team_id;
 if n<>cardinality(new.team_a)+cardinality(new.team_b) then raise exception 'Las jugadoras deben pertenecer al equipo de la sesión'; end if;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.validate_japo_game() from public,anon;
grant execute on function public.validate_japo_game() to authenticated;
create trigger validate_japo before insert or update on public.japo_games for each row execute function public.validate_japo_game();
