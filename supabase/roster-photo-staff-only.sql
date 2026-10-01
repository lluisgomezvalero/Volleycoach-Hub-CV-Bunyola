-- Applied to APP CV BUNYOLA on 2026-10-01 via roster_photos_staff_only.
-- Keep staff write policies and club read policy. The existing
-- protect_player_self_update trigger already protects players.avatar_path.
DROP POLICY IF EXISTS club_player_avatars_player_insert_own ON storage.objects;
DROP POLICY IF EXISTS club_player_avatars_player_update_own ON storage.objects;
DROP POLICY IF EXISTS club_player_avatars_player_delete_own ON storage.objects;
