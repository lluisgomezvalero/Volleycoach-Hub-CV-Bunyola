-- Categorical coach observations, never internal load or player RPE.
create table public.match_participation (
 event_id uuid not null references public.events(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 category text check (category in ('none','warmup','low','medium','high')),
 recorded_by uuid not null default auth.uid() references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(event_id,player_id)
);
create index match_participation_player_idx on public.match_participation(player_id);
alter table public.match_participation enable row level security;
revoke all on public.match_participation from anon;
grant select,insert,update on public.match_participation to authenticated;
create policy match_participation_read on public.match_participation for select to authenticated
using (exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id())) and ((select public.is_staff()) or player_id=(select public.current_player_id())));
create policy match_participation_insert on public.match_participation for insert to authenticated
with check ((select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.events e join public.players p on p.id=player_id where e.id=event_id and e.club_id=(select public.current_club_id()) and e.event_type in ('match','friendly') and p.club_id=e.club_id and p.team_id=e.team_id));
create policy match_participation_update on public.match_participation for update to authenticated
using ((select public.is_staff()) and exists(select 1 from public.events e where e.id=event_id and e.club_id=(select public.current_club_id())))
with check ((select public.is_staff()) and recorded_by=(select auth.uid()) and exists(select 1 from public.events e join public.players p on p.id=player_id where e.id=event_id and e.club_id=(select public.current_club_id()) and e.event_type in ('match','friendly') and p.club_id=e.club_id and p.team_id=e.team_id));
comment on table public.match_participation is 'Coach-recorded categorical exposure for matches and friendlies. Null is pending. No UA conversion; excluded from load and ACWR.';
