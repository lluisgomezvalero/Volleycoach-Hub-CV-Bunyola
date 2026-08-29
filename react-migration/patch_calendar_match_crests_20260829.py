from pathlib import Path
import re

jsx_path = Path('react-migration/src/pages/CalendarPage.jsx')
css_path = Path('react-migration/src/pages/CalendarPage.css')
text = jsx_path.read_text()
css = css_path.read_text()

new_logo_block = r'''const LOCAL_TEAM_LOGOS = {
  cvbunyola: '../assets/club_logo.png',
  cvportol: '../assets/team-portol.png',
  cvmanacor: '../assets/team-manacor.png',
  cvsonferrer: '../assets/team-son-ferrer.png',
  cvalaro: '../assets/team-alaro.png',
  cvsoller: '../assets/team-soller.png',
  palmavoley: '../assets/team-palma.png'
};

function normalizeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/../')) return raw.replace(/^\/\.\.\//, '../');
  if (raw.startsWith('../') || raw.startsWith('./')) return raw;
  if (raw.startsWith('/')) return `..${raw}`;
  return `../${raw.replace(/^\/+/, '')}`;
}

function resolveTeamLogo(row) {
  return normalizeAssetUrl(row?.logo) || LOCAL_TEAM_LOGOS[row?.team_key] || null;
}
'''
text, count = re.subn(
    r"const LOCAL_TEAM_LOGOS = \{.*?function resolveTeamLogo\(row\) \{.*?\n\}",
    new_logo_block.rstrip(),
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'logo block replacements: {count}')

anchor = '''function TeamBadge({ src, name, compact = false }) {
  const [failed, setFailed] = useState(false);
  const url = normalizeAssetUrl(src);
  if (!url || failed) return <span className={`calendar-team-fallback${compact ? ' compact' : ''}`}>{teamInitials(name)}</span>;
  return <img className={`calendar-team-logo${compact ? ' compact' : ''}`} src={url} alt={`Escudo ${name || 'rival'}`} onError={() => setFailed(true)} />;
}
'''
helpers = r'''

function normalizeTeamText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function MatchBadge({ src, name }) {
  const [failed, setFailed] = useState(false);
  const url = normalizeAssetUrl(src);
  useEffect(() => setFailed(false), [url]);
  return (
    <span className="calendar-match-logo">
      {url && !failed ? <img src={url} alt={`Escudo ${name || 'equipo'}`} onError={() => setFailed(true)} /> : <span>{teamInitials(name)}</span>}
    </span>
  );
}

function resolveMatchup(event, leagueTeams) {
  const scoped = (leagueTeams || []).filter((row) => !event?.team_id || row.context_team_id === event.team_id);
  const rows = scoped.length ? scoped : (leagueTeams || []);
  const own = rows.find((row) => row.is_own) || (leagueTeams || []).find((row) => row.is_own) || null;
  const rivals = rows.filter((row) => !row.is_own);
  const payloadKey = String(event?.payload?.opponent_key || '').trim();
  const payloadName = String(event?.payload?.opponent || '').trim();
  const title = String(event?.title || '').trim();
  const ownName = own?.name || 'CV Bunyola';

  let rival = payloadKey ? rivals.find((row) => String(row.team_key || '') === payloadKey) : null;
  if (!rival && payloadName) {
    const target = normalizeTeamText(payloadName);
    rival = rivals.find((row) => normalizeTeamText(row.name) === target || normalizeTeamText(row.team_key) === target);
  }

  let titleOpponent = '';
  const titleParts = title.split(/\s+(?:vs\.?|contra)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (titleParts.length >= 2) {
    const ownTarget = normalizeTeamText(ownName);
    titleOpponent = titleParts.find((part) => normalizeTeamText(part) !== ownTarget) || titleParts[titleParts.length - 1];
  }

  if (!rival && titleOpponent) {
    const target = normalizeTeamText(titleOpponent);
    rival = rivals.find((row) => normalizeTeamText(row.name) === target);
  }
  if (!rival && title) {
    const normalizedTitle = normalizeTeamText(title);
    rival = rivals.find((row) => {
      const candidate = normalizeTeamText(row.name);
      return candidate && normalizedTitle.includes(candidate);
    });
  }

  return {
    ownName,
    ownLogo: resolveTeamLogo(own) || LOCAL_TEAM_LOGOS.cvbunyola,
    opponentName: payloadName || rival?.name || titleOpponent || 'Rival',
    opponentLogo: resolveTeamLogo(rival) || normalizeAssetUrl(event?.payload?.opponent_logo) || null
  };
}
'''
if anchor not in text:
    raise SystemExit('TeamBadge anchor not found')
text = text.replace(anchor, anchor + helpers, 1)

new_card = r'''function EventCard({ event, leagueTeams, onOpen }) {
  const type = typeForEvent(event);
  const meta = EVENT_META[type] || EVENT_META.training;
  const Icon = meta.icon;
  const time = event.isBirthday ? 'Todo el día' : formatTime(event.starts_at);
  const planItems = String(event?.payload?.plan || '').split('\n').map((item) => item.trim()).filter(Boolean);
  const isMatchLike = ['match', 'friendly'].includes(type);
  const matchup = isMatchLike ? resolveMatchup(event, leagueTeams) : null;

  const content = (
    <>
      {isMatchLike ? (
        <span className="calendar-match-visual" aria-label={`${matchup.ownName} contra ${matchup.opponentName}`}>
          <MatchBadge src={matchup.ownLogo} name={matchup.ownName} />
          <b>VS</b>
          <MatchBadge src={matchup.opponentLogo} name={matchup.opponentName} />
        </span>
      ) : <span className={`calendar-event-icon type-${type}`}><Icon size={18} /></span>}
      <span className="calendar-event-copy">
        <span className="calendar-event-topline"><small>{meta.label}</small><time>{time}</time></span>
        <strong>{event.title || meta.label}</strong>
        {event.location ? <span className="calendar-event-meta"><MapPin size={13} />{event.location}</span> : null}
        {!event.isBirthday && type === 'training' && planItems.length ? <span className="calendar-event-plan">{planItems.slice(0, 2).join(' · ')}</span> : null}
      </span>
      {!event.isBirthday ? <ChevronRight className="calendar-event-chevron" size={18} /> : null}
    </>
  );

  if (event.isBirthday) return <article className={`calendar-event-card type-${type}`}>{content}</article>;
  return <button type="button" className={`calendar-event-card type-${type}`} onClick={() => onOpen(event)}>{content}</button>;
}
'''
text, count = re.subn(
    r"function EventCard\(\{ event, onOpen \}\) \{.*?\n\}\n\nfunction EventModal",
    new_card.rstrip() + '\n\nfunction EventModal',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'EventCard replacements: {count}')

old_call = '<EventCard key={event.id} event={event} onOpen={setDetailEvent} />'
new_call = '<EventCard key={event.id} event={event} leagueTeams={leagueTeams} onOpen={setDetailEvent} />'
if old_call not in text:
    raise SystemExit('EventCard call not found')
text = text.replace(old_call, new_call, 1)

css_patch = r'''

/* Match cards mirror the current app: CV Bunyola crest · VS · opponent crest. */
.calendar-event-card.type-match,.calendar-event-card.type-friendly{grid-template-columns:112px minmax(0,1fr) auto}
.calendar-match-visual{width:112px;height:58px;box-sizing:border-box;border-radius:18px;background:#fff8e8;border:1px solid #f1dfb9;display:flex;align-items:center;justify-content:center;gap:8px;padding:6px}
.calendar-match-visual>b{flex:0 0 auto;color:#8a7c5d;font-size:10px;font-weight:900;letter-spacing:.08em}
.calendar-match-logo{width:38px;height:38px;flex:0 0 38px;border-radius:13px;background:#fff;border:1px solid #eadab9;display:grid;place-items:center;overflow:hidden;color:#9b7000;font-size:10px;font-weight:900;line-height:1}
.calendar-match-logo>img{width:82%;height:82%;object-fit:contain;display:block}
.calendar-match-logo>span{display:grid;place-items:center;width:100%;height:100%}
@media(max-width:640px){.calendar-event-card.type-match,.calendar-event-card.type-friendly{grid-template-columns:100px minmax(0,1fr) auto;gap:8px}.calendar-match-visual{width:100px;height:56px;gap:5px;padding:5px;border-radius:16px}.calendar-match-logo{width:35px;height:35px;flex-basis:35px;border-radius:11px}.calendar-match-visual>b{font-size:9px}}
'''
if 'calendar-match-visual' not in css:
    css = css.rstrip() + css_patch + '\n'
else:
    raise SystemExit('calendar match CSS already exists unexpectedly')

jsx_path.write_text(text)
css_path.write_text(css)
print('Calendar match crests patch applied')
