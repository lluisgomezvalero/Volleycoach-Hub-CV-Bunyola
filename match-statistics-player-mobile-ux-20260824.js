(function(){
'use strict';

const FLAG='__matchStatisticsPlayerMobileUx20260824';
if(window[FLAG])return;
window[FLAG]=true;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function isCoach(){try{return typeof isCoachUser==='function'&&isCoachUser();}catch(_){return false;}}
function pad(n){return String(n).padStart(2,'0');}
function localKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function todayKey(){return localKey(new Date());}
function matches(){return (state()?.events||[]).filter(match=>['Partido','Amistoso'].includes(String(match?.type||''))).sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||'')));}
function prettyDate(value){const raw=String(value||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||'Fecha pendiente';const [y,m,d]=raw.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}

function ensureStyles(){
  if(document.getElementById('match-statistics-player-mobile-ux-style'))return;
  const style=document.createElement('style');
  style.id='match-statistics-player-mobile-ux-style';
  style.textContent=`
    #view-stats .player-stats-season-card{padding:1rem!important;border-radius:18px!important}
    #view-stats .player-stats-season-card>.card-header{margin-bottom:.72rem!important;align-items:flex-start!important}
    #view-stats .player-stats-season-card #stats-list-title{margin:0!important;font-family:var(--font-heading)!important;font-size:1.05rem!important;line-height:1.15!important;color:#0f172a!important}
    #view-stats .player-stats-season-card #stats-list-help{margin:.22rem 0 0!important;font-size:.73rem!important;line-height:1.3!important;color:#64748b!important}

    #view-stats #stats-matches-list{display:grid!important;grid-template-columns:1fr!important;gap:.62rem!important}
    #view-stats #stats-matches-list .player-match-stat-card{padding:.82rem!important;border:1px solid #e2e8f0!important;border-radius:14px!important;background:#fff!important;box-shadow:0 4px 14px rgba(15,23,42,.035)!important}
    #view-stats #stats-matches-list .player-match-stat-card .match-stat-header{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'type status' 'title title' 'meta meta'!important;column-gap:.55rem!important;row-gap:.32rem!important;align-items:center!important;margin-bottom:.48rem!important}
    #view-stats #stats-matches-list .player-match-stat-card .match-stat-header>div:first-child{display:contents!important}

    #view-stats #stats-matches-list .player-match-stat-card .match-round-badge{grid-area:type!important;justify-self:start!important;display:inline-flex!important;align-items:center!important;width:auto!important;padding:.25rem .5rem!important;border:1px solid #e2e8f0!important;border-radius:999px!important;background:#f1f5f9!important;color:#475569!important;font-size:.62rem!important;line-height:1!important;font-weight:850!important;white-space:nowrap!important}
    #view-stats #stats-matches-list .player-match-stat-card .match-round-badge.player-friendly-badge{background:#fff7ed!important;border-color:#fed7aa!important;color:#9a3412!important}
    #view-stats #stats-matches-list .player-match-stat-card .match-stat-title{grid-area:title!important;min-width:0!important;margin:.03rem 0 0!important;font-family:var(--font-heading)!important;font-size:.96rem!important;line-height:1.16!important;color:#0f172a!important;overflow-wrap:normal!important;word-break:normal!important}

    #view-stats #stats-matches-list .player-match-meta{grid-area:meta!important;display:grid!important;grid-template-columns:1fr!important;gap:.13rem!important;margin:0!important;font-size:.7rem!important;line-height:1.25!important;color:#64748b!important}
    #view-stats #stats-matches-list .player-match-meta .player-match-date{font-weight:750!important;color:#475569!important}
    #view-stats #stats-matches-list .player-match-meta .player-match-location{display:flex!important;align-items:flex-start!important;gap:.25rem!important;min-width:0!important;color:#64748b!important}
    #view-stats #stats-matches-list .player-match-meta .player-match-location::before{content:'📍';flex:0 0 auto;font-size:.66rem;line-height:1.2}

    #view-stats #stats-matches-list .player-status-chip{grid-area:status!important;justify-self:end!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;max-width:none!important;padding:.27rem .5rem!important;border-radius:999px!important;border:1px solid #dbe3ec!important;background:#f8fafc!important;color:#475569!important;font-size:.59rem!important;line-height:1!important;font-weight:850!important;text-align:center!important;white-space:nowrap!important}
    #view-stats #stats-matches-list .player-status-chip.is-pending{background:#fffbeb!important;border-color:#fde68a!important;color:#92400e!important}
    #view-stats #stats-matches-list .player-status-chip.is-published{background:#ecfdf5!important;border-color:#a7f3d0!important;color:#047857!important}
    #view-stats #stats-matches-list .player-status-chip.is-upcoming{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}
    #view-stats #stats-matches-list .player-status-chip.is-today{background:#fff7ed!important;border-color:#fed7aa!important;color:#9a3412!important}

    #view-stats #stats-matches-list .player-stats-pending{margin:.18rem 0 0!important;padding:.48rem .62rem!important;border:1px dashed #dbe3ec!important;border-radius:10px!important;background:#f8fafc!important;color:#64748b!important;font-size:.68rem!important;line-height:1.28!important;text-align:center!important}

    #view-stats #coach-stats-charts.player-league-overview{margin-bottom:.72rem!important}
    #view-stats .player-league-empty{padding:.65rem .75rem!important;border-radius:14px!important;font-size:.7rem!important;line-height:1.3!important}
    #view-stats .player-league-empty strong{font-size:.82rem!important;line-height:1.15!important;margin-bottom:.12rem!important}
    #view-stats .player-league-empty span{display:block!important}

    @media(max-width:420px){
      #view-stats .player-stats-season-card{padding:.85rem!important}
      #view-stats #stats-matches-list .player-match-stat-card{padding:.72rem!important}
      #view-stats #stats-matches-list .player-match-stat-card .match-stat-header{column-gap:.42rem!important;row-gap:.3rem!important}
      #view-stats #stats-matches-list .player-status-chip{font-size:.57rem!important}
      #view-stats #stats-matches-list .player-match-stat-card .match-stat-title{font-size:.94rem!important}
    }
  `;
  document.head.appendChild(style);
}

function polishLeagueEmpty(){
  const empty=document.querySelector('#coach-stats-charts.player-league-overview .player-league-empty');
  if(!empty||empty.dataset.playerCompact==='1')return;
  if(!/Todavía no hay ninguna jornada de Liga publicada/i.test(empty.textContent||''))return;
  empty.dataset.playerCompact='1';
  empty.innerHTML='<strong>Evolución de Liga</strong><span>Las gráficas aparecerán al publicarse la primera jornada.</span>';
}

function polishMeta(card,match){
  const meta=card.querySelector('.match-stat-header p');
  if(!meta)return;
  const signature=`${match?.date||''}|${match?.location||''}`;
  if(meta.dataset.playerMeta===signature)return;
  meta.dataset.playerMeta=signature;
  meta.classList.add('player-match-meta');
  meta.textContent='';
  const date=document.createElement('span');
  date.className='player-match-date';
  date.textContent=prettyDate(match?.date);
  const location=document.createElement('span');
  location.className='player-match-location';
  location.textContent=match?.location||'Ubicación por confirmar';
  meta.append(date,location);
}

function polishStatus(card,match){
  const badge=card.querySelector('.match-stat-header>.badge');
  if(!badge)return;
  badge.classList.add('player-status-chip');
  badge.classList.remove('is-pending','is-published','is-upcoming','is-today');
  const result=String(match?.result||'').trim();
  if(result){badge.textContent=result;return;}
  const key=String(match?.date||'');
  const today=todayKey();
  const published=Boolean(card.querySelector('.player-match-card-preview'));
  if(key&&key<today){
    badge.textContent=published?'Publicado':'Sin publicar';
    badge.classList.add(published?'is-published':'is-pending');
  }else if(key===today){
    badge.textContent=published?'Publicado':'Hoy';
    badge.classList.add(published?'is-published':'is-today');
  }else{
    badge.textContent=published?'Publicado':'Próximo';
    badge.classList.add(published?'is-published':'is-upcoming');
  }
  const pending=card.querySelector('.player-stats-pending');
  if(!pending)return;
  if(key&&key<today&&!published)pending.textContent='Estadísticas todavía no publicadas.';
  else if(key===today&&!published)pending.textContent='El resumen aparecerá cuando el cuerpo técnico publique las estadísticas.';
  else if(!published)pending.textContent='El resumen estará disponible después del partido.';
}

function polish(){
  if(isCoach())return;
  ensureStyles();
  const list=document.getElementById('stats-matches-list');
  if(!list)return;
  list.closest('.card')?.classList.add('player-stats-season-card');
  const title=document.getElementById('stats-list-title');
  if(title&&title.textContent!=='Partidos')title.textContent='Partidos';
  const help=document.getElementById('stats-list-help');
  const helpText='Toca un partido con estadísticas publicadas para consultar el resumen publicado.';
  if(help&&help.textContent!==helpText)help.textContent=helpText;
  const local=matches();
  [...list.querySelectorAll('.player-match-stat-card')].forEach((card,index)=>{
    const match=local[index];
    if(!match)return;
    const round=card.querySelector('.match-round-badge');
    if(round&&String(match.type)==='Amistoso')round.classList.add('player-friendly-badge');
    polishMeta(card,match);
    polishStatus(card,match);
  });
  polishLeagueEmpty();
}

function install(){
  ensureStyles();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const current=window.renderStats;
    const ready=document.documentElement.dataset.matchStatsAuthoritativeBound==='1';
    if(ready&&typeof current==='function'&&!current.__playerMobileUxWrapped){
      clearInterval(timer);
      const wrapped=function(...args){
        const result=current.apply(this,args);
        Promise.resolve(result).finally(()=>{setTimeout(polish,0);setTimeout(polish,180);setTimeout(polish,500);});
        return result;
      };
      wrapped.__playerMobileUxWrapped=true;
      window.renderStats=wrapped;
      try{renderStats=wrapped;}catch(_){}
      setTimeout(polish,0);
    }else if(tries>=150){
      clearInterval(timer);
      setTimeout(polish,0);
    }
  },80);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
