from pathlib import Path

path = Path('react-migration/src/pages/StatisticsPage.jsx')
text = path.read_text()
old = """      const [eventResult, statsResult] = await Promise.all([\n        supabase\n          .from('events')\n          .select('id,event_type,title,starts_at,ends_at,location,status,payload')\n          .eq('team_id', teamId)\n          .in('event_type', ['match', 'friendly', 'tournament'])\n          .order('starts_at', { ascending: false }),\n        supabase\n          .from('match_statistics')\n          .select('id,event_id,club_id,team_id,status,visible_metrics,payload,published_at,created_by,updated_at')\n          .eq('team_id', teamId)\n          .order('updated_at', { ascending: false })\n      ]);\n"""
new = """      const eventRequest = supabase\n        .from('events')\n        .select('id,event_type,title,starts_at,ends_at,location,status,payload')\n        .eq('team_id', teamId)\n        .in('event_type', ['match', 'friendly', 'tournament'])\n        .order('starts_at', { ascending: false });\n\n      const statsRequest = isStaff\n        ? supabase\n            .from('match_statistics')\n            .select('id,event_id,club_id,team_id,status,visible_metrics,payload,published_at,created_by,updated_at')\n            .eq('team_id', teamId)\n            .order('updated_at', { ascending: false })\n        : supabase.rpc('get_published_match_statistics');\n\n      const [eventResult, statsResult] = await Promise.all([eventRequest, statsRequest]);\n"""
if old not in text:
    raise SystemExit('Statistics load block not found')
text = text.replace(old, new, 1)
old_dep = "  }, [teamId]);"
new_dep = "  }, [isStaff, teamId]);"
if old_dep not in text:
    raise SystemExit('Statistics callback dependency not found')
text = text.replace(old_dep, new_dep, 1)
path.write_text(text)
print('StatisticsPage now uses filtered RPC for players')
