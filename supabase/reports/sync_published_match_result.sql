-- Published statistics share the existing event result consumed by Competition.
create or replace function public.sync_published_match_result()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare score text;
begin
  if new.status::text <> 'published' then return new; end if;
  if new.payload ? 'report' then
    score := (new.payload #>> '{report,match,result,ours}') || '-' ||
             (new.payload #>> '{report,match,result,theirs}');
  else score := new.payload->>'result'; end if;
  if score is null or score !~ '^[0-3]-[0-3]$' or split_part(score,'-',1)=split_part(score,'-',2)
    then return new; end if;
  update public.events set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object('result',score)
  where id=new.event_id and club_id=new.club_id and event_type='match'
    and (payload->>'result') is distinct from score;
  return new;
end;
$$;
revoke all on function public.sync_published_match_result() from public,anon,authenticated;
create or replace trigger sync_published_match_result
after insert or update of payload,status on public.match_statistics
for each row execute function public.sync_published_match_result();

-- Repair results already published without changing reports or publication timestamps.
update public.events e set payload=coalesce(e.payload,'{}'::jsonb) ||
 jsonb_build_object('result', s.payload #>> '{report,match,result,ours}' || '-' || (s.payload #>> '{report,match,result,theirs}'))
from public.match_statistics s
where s.event_id=e.id and s.club_id=e.club_id and s.status::text='published'
 and s.payload ? 'report' and e.event_type='match';

-- Repair the existing automatic Bunyola standings using the same scoring as the app.
with scores as (
 select e.team_id,split_part(e.payload->>'result','-',1)::int own,
 split_part(e.payload->>'result','-',2)::int rival
 from public.events e where e.event_type='match' and e.payload->>'result' ~ '^[0-3]-[0-3]$'
 and split_part(e.payload->>'result','-',1)<>split_part(e.payload->>'result','-',2)
), sums as (
 select team_id,count(*) pj,count(*) filter(where own>rival) pg,count(*) filter(where own<rival) pp,
 sum(own) sf,sum(rival) sc,
 sum(case when own>rival then case when greatest(own,rival)>=3 then case when least(own,rival)=2 then 2 else 3 end when greatest(own,rival)=2 then 2 else 1 end
 else case when least(own,rival)=2 then 1 else 0 end end) points
 from scores group by team_id
)
update public.league_standings l set pj=s.pj,pg=s.pg,pp=s.pp,sf=s.sf,sc=s.sc,points=s.points,updated_at=now()
from sums s where l.context_team_id=s.team_id and l.is_own;
