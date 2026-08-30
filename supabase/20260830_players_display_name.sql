-- Nombre deportivo visible dentro del club sin exponer datos privados de profiles.
alter table public.players
  add column if not exists display_name text;

update public.players p
set display_name = nullif(trim(pr.full_name), '')
from public.profiles pr
where pr.id = p.profile_id
  and p.display_name is distinct from nullif(trim(pr.full_name), '');

comment on column public.players.display_name is
  'Nombre deportivo visible para la plantilla del mismo club.';
