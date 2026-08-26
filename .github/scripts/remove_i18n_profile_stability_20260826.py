from pathlib import Path
import re
import subprocess

BASE_PRE_LOCALE = '0f86abee67844375c61ff0c5dda0a0a66583d64a'
PRE_I18N_COMPETITION = 'afad687e589717d5c6eca39f8b7c656d6f002cf2'
VERSION = '20260826stability1'

restore_from_base = [
    'calendar-mobile-app-ux-20260820.js',
    'calendar-profile-roster-fixes-20260825.js',
    'game-plan-canonical-20260817.js',
    'match-statistics-player-mobile-ux-20260824.js',
    'match-statistics-player-polish-20260819.js',
    'performance-mobile-ux-20260823.js',
    'player-passport-priority-20260813.js',
    'team-attendance-overview-20260812.js',
    'training-load-player-dashboard-20260809.js',
    'training-load-team-dashboard-20260809.js',
    'wellness-individual-tracking-20260822.js',
    'wellness-rpe-session-detail-20260822.js',
    'wellness-svg-point-tooltip-20260823.js',
]

for path in restore_from_base:
    Path(path).write_bytes(subprocess.check_output(['git', 'show', f'{BASE_PRE_LOCALE}:{path}']))

Path('competition-app-ux-20260820.js').write_bytes(
    subprocess.check_output(['git', 'show', f'{PRE_I18N_COMPETITION}:competition-app-ux-20260820.js'])
)

for path in ('i18n-core-v2-20260826.js', 'i18n-es-ca-20260826.js'):
    p = Path(path)
    if p.exists():
        p.unlink()

# Live Supabase client: no language preference reads/writes.
p = Path('supabase-client.js')
s = p.read_text(encoding='utf-8')
s = s.replace(', last_login_at, preferred_language', ', last_login_at')
s = s.replace("    if (['es', 'ca'].includes(changes?.preferred_language)) allowed.preferred_language = changes.preferred_language;\n", '')
p.write_text(s, encoding='utf-8')

# Config: remove any translation loader and restore normal cache versions.
p = Path('supabase-config.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"window\.VOLLEY_ASSET_VERSION = '[^']+';", f"window.VOLLEY_ASSET_VERSION = '{VERSION}';", s, count=1)
s = re.sub(r"\n\s*'i18n-core-v2-20260826\.js\?v=[^']+',", '', s)
s = re.sub(r"\n\s*'i18n-es-ca-20260826\.js\?v=[^']+',", '', s)
versions = {
    'wellness-svg-point-tooltip-20260823.js': '20260823b',
    'wellness-rpe-session-detail-20260822.js': '20260822a',
    'wellness-individual-tracking-20260822.js': '20260822b',
    'training-load-player-dashboard-20260809.js': '20260811l',
    'training-load-team-dashboard-20260809.js': '20260811h',
    'team-attendance-overview-20260812.js': '20260823a',
    'performance-mobile-ux-20260823.js': '20260823a',
    'player-passport-priority-20260813.js': '20260813d',
    'calendar-mobile-app-ux-20260820.js': '20260820tablet1',
    'calendar-profile-roster-fixes-20260825.js': VERSION,
    'match-statistics-player-mobile-ux-20260824.js': '20260824c',
    'match-statistics-player-polish-20260819.js': '20260824c',
    'game-plan-canonical-20260817.js': '20260817g',
}
for filename, version in versions.items():
    s = re.sub(rf"'{re.escape(filename)}\?v=[^']+'", f"'{filename}?v={version}'", s)
p.write_text(s, encoding='utf-8')

# Profile: safe mobile viewport, no coach gamification, less boot polling.
p = Path('calendar-profile-roster-fixes-20260825.js')
s = p.read_text(encoding='utf-8')
profile_css = r'''

    /* Mobile private profile stays between fixed top/bottom navigation. */
    @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
      #modal-my-profile{
        align-items:flex-start!important;
        padding-top:calc(70px + env(safe-area-inset-top,0px))!important;
        padding-bottom:calc(82px + env(safe-area-inset-bottom,0px))!important;
        padding-left:6px!important;
        padding-right:6px!important;
        overflow:hidden!important;
      }
      #modal-my-profile .modal-content{
        width:min(520px,calc(100vw - 12px))!important;
        max-height:calc(100dvh - 152px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;
        margin:0 auto!important;
        border-radius:18px!important;
        overflow:hidden!important;
      }
      #modal-my-profile .modal-header{flex:0 0 auto!important;padding:.85rem 1rem!important}
      #modal-my-profile .modal-body{
        min-height:0!important;
        max-height:none!important;
        overflow-y:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
        padding-top:.8rem!important;
        padding-bottom:1.1rem!important;
      }
      #modal-my-profile #form-my-profile>div:last-child{
        position:sticky;
        bottom:-1.1rem;
        z-index:4;
        margin-left:-.15rem;
        margin-right:-.15rem;
        padding:.8rem .15rem calc(.2rem + env(safe-area-inset-bottom,0px));
        background:linear-gradient(180deg,rgba(255,255,255,0),#fff 24%,#fff 100%);
      }
    }
'''
style_marker = '\n  `;\n  document.head.appendChild(style);'
if style_marker not in s:
    raise RuntimeError('profile style insertion marker not found')
s = s.replace(style_marker, profile_css + style_marker, 1)

role_helper = r'''
function syncProfileRoleSections(){
  const coach=isCoach();
  ['profile-attendance-card','profile-achievements-card'].forEach(id=>{
    const section=document.getElementById(id);
    if(!section)return;
    section.hidden=coach;
    section.setAttribute('aria-hidden',coach?'true':'false');
    if(coach)section.style.setProperty('display','none','important');
    else section.style.removeProperty('display');
  });
}
'''
polish_marker = 'function polishProfile(){\n'
if polish_marker not in s:
    raise RuntimeError('polishProfile marker not found')
s = s.replace(polish_marker, role_helper + '\n' + polish_marker, 1)
s = s.replace(
    "function polishProfile(){\n  const modal=document.getElementById('modal-my-profile');\n  if(!modal)return;",
    "function polishProfile(){\n  const modal=document.getElementById('modal-my-profile');\n  if(!modal)return;\n  syncProfileRoleSections();",
    1,
)
old_poll = """  let tries=0;\n  const timer=setInterval(()=>{\n    syncAll();\n    tries+=1;\n    if(tries>=30)clearInterval(timer);\n  },180);"""
if old_poll not in s:
    raise RuntimeError('old profile polling loop not found')
s = s.replace(old_poll, "  [250,900,1800].forEach(delay=>setTimeout(syncAll,delay));", 1)
p.write_text(s, encoding='utf-8')

# CSS first paint: old photo never paints; home hero is opaque and does not animate brightness.
p = Path('styles.css')
s = p.read_text(encoding='utf-8')
stability_css = r'''

/* 2026-08-26 · first-paint stability: no legacy photo flash and no hero luminance flicker. */
html,body{background-color:#f1f5f9!important}
body{background-image:none!important;background-attachment:scroll!important}
#dashboard-hero{
  background:linear-gradient(135deg,#172033 0%,#223149 58%,#293952 100%)!important;
  background-image:linear-gradient(135deg,#172033 0%,#223149 58%,#293952 100%)!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  filter:none!important;
  transform:none!important;
  transition:none!important;
  will-change:auto!important;
}
#dashboard-hero .dashboard-hero-overlay{
  z-index:0!important;
  background:linear-gradient(115deg,rgba(7,18,37,.22) 0%,rgba(7,18,37,.10) 55%,rgba(7,18,37,.04) 100%)!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
#dashboard-hero .dashboard-hero-content{position:relative!important;z-index:2!important}
#dashboard-hero.dashboard-motion-ready,#dashboard-hero.dashboard-motion-visible{opacity:1!important;transform:none!important;filter:none!important}
'''
if 'first-paint stability' not in s:
    s += stability_css
p.write_text(s, encoding='utf-8')

# Force browsers to fetch the corrected first-paint CSS and loader config.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r"styles\.css\?v=[^\"']+", f'styles.css?v={VERSION}', s, count=1)
s = re.sub(r"supabase-config\.js\?v=[^\"']+", f'supabase-config.js?v={VERSION}', s, count=1)
p.write_text(s, encoding='utf-8')
