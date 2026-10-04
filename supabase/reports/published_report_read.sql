CREATE OR REPLACE FUNCTION public.get_published_match_statistics()
RETURNS TABLE(id uuid,event_id uuid,club_id uuid,team_id uuid,status public.publication_status,visible_metrics jsonb,payload jsonb,published_at timestamptz,created_at timestamptz,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
select ms.id,ms.event_id,ms.club_id,ms.team_id,ms.status,ms.visible_metrics,
(case when ms.payload ? 'result' then jsonb_build_object('result',ms.payload->'result') else '{}'::jsonb end
|| coalesce((select jsonb_object_agg(metric.key,ms.payload->metric.key) from jsonb_array_elements_text(ms.visible_metrics) as metric(key) where ms.payload ? metric.key),'{}'::jsonb)
|| case when ms.payload ? 'report' then jsonb_build_object('report',ms.payload->'report') else '{}'::jsonb end),
ms.published_at,ms.created_at,ms.updated_at
from public.match_statistics ms
where ms.club_id=public.current_club_id()
and ms.status='published'::public.publication_status
and (public.is_staff() or (public.current_player_id() is not null and (ms.team_id is null or ms.team_id=(select p.team_id from public.players p where p.id=public.current_player_id()))));
$function$;
