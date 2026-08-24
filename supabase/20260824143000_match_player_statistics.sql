-- Estadísticas individuales de partido, siempre opcionales.
-- El cuerpo técnico puede guardar/publicar por jugadora y cada jugadora solo recibe sus propios datos publicados.

create table if not exists public.match_player_statistics (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  status public.publication_status not null default 'draft'::public.publication_status,
  visible_metrics jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_player_statistics_event_player_key unique (event_id, player_id)
);

create index if not exists match_player_statistics_event_idx
  on public.match_player_statistics(event_id);
create index if not exists match_player_statistics_player_idx
  on public.match_player_statistics(player_id);
create index if not exists match_player_statistics_team_idx
  on public.match_player_statistics(team_id);

alter table public.match_player_statistics enable row level security;

drop policy if exists match_player_stats_staff_write on public.match_player_statistics;
create policy match_player_stats_staff_write
on public.match_player_statistics
for all
to authenticated
using (
  club_id = public.current_club_id()
  and public.is_staff()
)
with check (
  club_id = public.current_club_id()
  and public.is_staff()
);

revoke all on table public.match_player_statistics from anon;
grant select, insert, update, delete on table public.match_player_statistics to authenticated;

create or replace function public.get_my_published_match_player_statistics()
returns table (
  id uuid,
  event_id uuid,
  player_id uuid,
  club_id uuid,
  team_id uuid,
  status public.publication_status,
  visible_metrics jsonb,
  payload jsonb,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mps.id,
    mps.event_id,
    mps.player_id,
    mps.club_id,
    mps.team_id,
    mps.status,
    mps.visible_metrics,
    coalesce(
      (
        select jsonb_object_agg(metric.key, mps.payload -> metric.key)
        from jsonb_array_elements_text(mps.visible_metrics) as metric(key)
        where mps.payload ? metric.key
      ),
      '{}'::jsonb
    ) as payload,
    mps.published_at,
    mps.created_at,
    mps.updated_at
  from public.match_player_statistics as mps
  where mps.club_id = public.current_club_id()
    and mps.player_id = public.current_player_id()
    and mps.status = 'published'::public.publication_status;
$$;

revoke all on function public.get_my_published_match_player_statistics() from public;
grant execute on function public.get_my_published_match_player_statistics() to authenticated;
