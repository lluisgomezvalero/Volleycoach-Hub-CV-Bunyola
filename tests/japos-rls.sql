begin;
do $$
declare p public.players%rowtype; q public.players%rowtype; outsider public.players%rowtype; coach uuid; training uuid:=gen_random_uuid(); match_id uuid:=gen_random_uuid(); game_id uuid:=gen_random_uuid(); n integer;
begin
 select * into strict p from public.players where active and profile_id is not null and team_id is not null limit 1;
 select * into strict q from public.players where active and profile_id is not null and team_id=p.team_id and id<>p.id limit 1;
 select * into outsider from public.players where active and profile_id is not null and team_id<>p.team_id limit 1;
 select id into strict coach from public.profiles where club_id=p.club_id and role in ('coach','administrator') and active limit 1;
 insert into public.events(id,club_id,team_id,event_type,title,starts_at,ends_at) values
 (training,p.club_id,p.team_id,'training','Temporary Japo validation',now()-interval '2 hours',now()-interval '1 hour'),
 (match_id,p.club_id,p.team_id,'match','Temporary Japo validation',now()-interval '2 hours',now()-interval '1 hour');
 perform set_config('request.jwt.claim.sub',coach::text,true);execute 'set local role authenticated';
 insert into public.japo_games(id,event_id,team_a,team_b,sets_a,sets_b) values(game_id,training,array[p.id],array[q.id],2,0);
 begin insert into public.japo_games(id,event_id,team_a,team_b,sets_a,sets_b) values(game_id,training,array[p.id],array[q.id],2,0);raise exception 'duplicate accepted';exception when unique_violation then null;end;
 update public.japo_games set sets_a=1,sets_b=2 where id=game_id;
 if not exists(select 1 from public.japo_games where id=game_id and sets_a=1 and sets_b=2) then raise exception 'correction failed';end if;
 begin update public.japo_games set sets_a=2,sets_b=2 where id=game_id;raise exception 'bad result accepted';exception when check_violation then null;end;
 begin update public.japo_games set recorded_by=p.profile_id where id=game_id;raise exception 'spoof accepted';exception when insufficient_privilege then null;end;
 begin insert into public.japo_games(id,event_id,team_a,team_b,sets_a,sets_b) values(gen_random_uuid(),match_id,array[p.id],array[q.id],2,0);raise exception 'match accepted';exception when insufficient_privilege or raise_exception then if SQLERRM='match accepted' then raise;end if;end;
 begin update public.japo_games set team_a=array[p.id,p.id] where id=game_id;raise exception 'duplicates accepted';exception when raise_exception then if SQLERRM='duplicates accepted' then raise;end if;end;
 begin update public.japo_games set team_b=array[gen_random_uuid()] where id=game_id;raise exception 'outsider accepted';exception when raise_exception then if SQLERRM='outsider accepted' then raise;end if;end;
 update public.japo_games set voided=true where id=game_id;
 if not exists(select 1 from public.japo_games where id=game_id and voided) then raise exception 'annulment failed';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',p.profile_id::text,true);execute 'set local role authenticated';
 select count(*) into n from public.japo_games where id=game_id;if n<>1 then raise exception 'own team read failed';end if;
 update public.japo_games set voided=false where id=game_id;get diagnostics n=row_count;if n<>0 then raise exception 'player update allowed';end if;
 begin insert into public.japo_games(id,event_id,team_a,team_b,sets_a,sets_b) values(gen_random_uuid(),training,array[p.id],array[q.id],2,0);raise exception 'player insert allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',q.profile_id::text,true);execute 'set local role authenticated';
 select count(*) into n from public.japo_games where id=game_id;if n<>1 then raise exception 'teammate read failed';end if;
 execute 'reset role';
 if outsider.id is not null then
 perform set_config('request.jwt.claim.sub',outsider.profile_id::text,true);execute 'set local role authenticated';select count(*) into n from public.japo_games where id=game_id;if n<>0 then raise exception 'other team read allowed';end if;execute 'reset role';
 end if;
 execute 'set local role anon';begin perform 1 from public.japo_games;raise exception 'anon read allowed';exception when insufficient_privilege then null;end;execute 'reset role';
end $$;
select 'PASS Japos: staff writes/correction/annulment; valid results/rosters; unique retry; same-team read; player/anon writes blocked; other-team read blocked when fixture available' as result;
rollback;
