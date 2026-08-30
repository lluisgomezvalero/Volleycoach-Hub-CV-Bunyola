-- Nombre deportivo visible para la plantilla sin exponer los perfiles privados de otras jugadoras.
alter table public.players add column if not exists display_name text;

update public.players p
set display_name = pr.full_name
from public.profiles pr
where pr.id = p.profile_id
  and (p.display_name is null or btrim(p.display_name) = '')
  and pr.full_name is not null
  and btrim(pr.full_name) <> '';

comment on column public.players.display_name is
  'Nombre deportivo visible para la plantilla del club; evita exponer otros campos de profiles a jugadoras.';
