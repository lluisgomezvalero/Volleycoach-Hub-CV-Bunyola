begin;
do $$
declare
 p public.players%rowtype;
 other_player public.players%rowtype;
 coach uuid;
 match_id uuid:=gen_random_uuid();
 training_id uuid:=gen_random_uuid();
 n integer;
begin
 select * into strict p from public.players where active and profile_id is not null and team_id is not null limit 1;
 select * into strict other_player from public.players where active and profile_id is not null and team_id=p.team_id and id<>p.id limit 1;
 select id into strict coach from public.profiles where club_id=p.club_id and role in ('coach','administrator') limit 1;
 insert into public.events(id,club_id,team_id,event_type,title,starts_at,ends_at) values
 (match_id,p.club_id,p.team_id,'match','Temporary exposure permissions test',now()-interval '2 hours',now()-interval '1 hour'),
 (training_id,p.club_id,p.team_id,'training','Temporary exposure permissions test',now()-interval '2 hours',now()-interval '1 hour');
 perform set_config('request.jwt.claim.sub',coach::text,true);
 execute 'set local role authenticated';
 insert into public.match_participation(event_id,player_id,category) values(match_id,p.id,'high');
 insert into public.match_participation(event_id,player_id,category) values(match_id,p.id,'low') on conflict(event_id,player_id) do update set category=excluded.category;
 update public.match_participation set category=null where event_id=match_id and player_id=p.id;
 if not exists(select 1 from public.match_participation where event_id=match_id and category is null) then raise exception 'clear failed';end if;
 update public.match_participation set category='warmup' where event_id=match_id;
 begin
 insert into public.match_participation(event_id,player_id,category) values(training_id,p.id,'high');raise exception 'training accepted';
 exception when insufficient_privilege then null;end;
 begin
 update public.match_participation set recorded_by=p.profile_id where event_id=match_id;raise exception 'spoof accepted';
 exception when insufficient_privilege then null;end;
 begin
 update public.match_participation set category='invented' where event_id=match_id;raise exception 'invalid category accepted';
 exception when check_violation then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',p.profile_id::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.match_participation where event_id=match_id;
 if n<>1 then raise exception 'own read failed';end if;
 update public.match_participation set category='none' where event_id=match_id;
 get diagnostics n=row_count;if n<>0 then raise exception 'player updated row';end if;
 begin
 insert into public.match_participation(event_id,player_id,category) values(training_id,p.id,'high');raise exception 'player inserted row';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',other_player.profile_id::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.match_participation where event_id=match_id;
 if n<>0 then raise exception 'teammate data visible';end if;
 execute 'reset role';
 execute 'set local role anon';
 begin
 perform 1 from public.match_participation;raise exception 'anon read allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
select 'PASS: staff upsert/clear; individual privacy; no player/anon writes or reads; valid category/event/author required' as result;
rollback;
