drop policy if exists "player_own_avatar_insert" on storage.objects;
create policy "player_own_avatar_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (public.current_club_id())::text
  and exists (
    select 1
    from public.players p
    where p.profile_id = auth.uid()
      and p.club_id = public.current_club_id()
      and p.id::text = (storage.foldername(name))[2]
      and p.active = true
  )
);

drop policy if exists "player_own_avatar_update" on storage.objects;
create policy "player_own_avatar_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (public.current_club_id())::text
  and exists (
    select 1
    from public.players p
    where p.profile_id = auth.uid()
      and p.club_id = public.current_club_id()
      and p.id::text = (storage.foldername(name))[2]
      and p.active = true
  )
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (public.current_club_id())::text
  and exists (
    select 1
    from public.players p
    where p.profile_id = auth.uid()
      and p.club_id = public.current_club_id()
      and p.id::text = (storage.foldername(name))[2]
      and p.active = true
  )
);

drop policy if exists "player_own_avatar_delete" on storage.objects;
create policy "player_own_avatar_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (public.current_club_id())::text
  and exists (
    select 1
    from public.players p
    where p.profile_id = auth.uid()
      and p.club_id = public.current_club_id()
      and p.id::text = (storage.foldername(name))[2]
      and p.active = true
  )
);
