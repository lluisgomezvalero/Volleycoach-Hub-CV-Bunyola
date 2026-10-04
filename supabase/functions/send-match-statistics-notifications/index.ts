import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function secret(name: string) {
  const { data, error } = await admin.rpc('get_push_secret', { secret_name: name });
  if (error || !data) throw new Error(`Missing push secret: ${name}`);
  return String(data);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const [cronToken, publicKey, privateKey] = await Promise.all([
      secret('push_cron_token'),
      secret('push_vapid_public'),
      secret('push_vapid_private')
    ]);

    if (req.headers.get('x-cron-secret') !== cronToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    webpush.setVapidDetails('mailto:admin@volleycoachhub.app', publicKey, privateKey);

    const options = await req.json().catch(() => ({}));
    const now = Date.now();
    const { data: statistics, error: eventsError } = await admin
      .from('match_statistics')
      .select('event_id,team_id,published_at,events(id,title,payload)')
      .eq('status', 'published')
      .gte('published_at', '2026-10-04T09:34:36+00:00')
      .gte('published_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());
    if (eventsError) throw eventsError;
    const events = (statistics || []).map((row: any) => ({
      id: row.event_id, team_id: row.team_id,
      title: row.events?.title, opponent: row.events?.payload?.opponent
    }));

    let sent = 0;
    let skipped = 0;
    let removedSubscriptions = 0;

    for (const event of events || []) {
      const [{ data: players, error: playersError }, { data: logs, error: logsError }] = await Promise.all([
        admin.from('players').select('id,profile_id').eq('team_id', event.team_id).eq('active', true),
        admin.from('push_notification_log').select('player_id').eq('event_id', event.id).eq('kind', 'match_statistics_published')
      ]);
      if (playersError) throw playersError;
      if (logsError) throw logsError;

      const alreadySent = new Set((logs || []).map((row: any) => String(row.player_id)));
      const pendingPlayers = (players || []).filter((player: any) => player.profile_id && !alreadySent.has(String(player.id)));
      if (!pendingPlayers.length) continue;

      const profileIds = pendingPlayers.map((player: any) => player.profile_id);
      const { data: subscriptions, error: subsError } = await admin
        .from('push_subscriptions')
        .select('id,profile_id,player_id,endpoint,p256dh,auth')
        .in('profile_id', profileIds);
      if (subsError) throw subsError;

      for (const player of pendingPlayers as any[]) {
        const playerSubs = (subscriptions || []).filter((sub: any) => sub.profile_id === player.profile_id);
        if (!playerSubs.length) {
          skipped += 1;
          continue;
        }

        const payload = JSON.stringify({
          title: '🏐 Estadísticas del partido disponibles',
          body: event.opponent ? `Ya puedes consultar las estadísticas del partido contra ${event.opponent}.` : `Ya puedes consultar las estadísticas de ${event.title || 'nuestro partido'}.`,
          tag: `match-statistics-${event.id}`,
          eventId: event.id,
          url: '#/statistics'
        });

        if (options.dry_run === true) { skipped += 1; continue; }
        let delivered = false;
        for (const sub of playerSubs as any[]) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload, { TTL: 3600, urgency: 'normal' });
            delivered = true;
          } catch (error: any) {
            const status = Number(error?.statusCode || error?.status || 0);
            if (status === 404 || status === 410) {
              await admin.from('push_subscriptions').delete().eq('id', sub.id);
              removedSubscriptions += 1;
            } else {
              console.error('push-send-failed', event.id, player.id, status, error?.message || error);
            }
          }
        }

        if (delivered) {
          const { error: logError } = await admin.from('push_notification_log').upsert({
            event_id: event.id,
            player_id: player.id,
            kind: 'match_statistics_published',
            sent_at: new Date().toISOString(),
            metadata: { trigger: 'match_statistics_published' }
          }, { onConflict: 'event_id,player_id,kind' });
          if (logError) throw logError;
          sent += 1;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, removedSubscriptions }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
