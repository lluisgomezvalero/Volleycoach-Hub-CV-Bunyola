(function(){
'use strict';

const FLAG='__matchStatisticsPlayerPolish20260819';
if(window[FLAG])return;
window[FLAG]=true;

let currentStats=null;
let currentMatchId=null;
let polishing=false;

const ICONS={
  'Recepción perfecta (#,+)':'circle-check',
  'Recepción neutra (!)':'triangle-alert',
  'Recepción exclamativa (!)':'triangle-alert',
  'Error de recepción (-)':'circle-x',
  'Total de recepciones':'hash',
  'Efectividad de ataque':'trending-up',
  'Total de ataques':'hash',
  'Errores de ataque':'circle-x',
  'Aces':'zap',
  'Error de saque':'circle-x',
  'Total de saques':'hash',
  'Bloqueos punto':'shield-check',
  'Total de bloqueos':'hash',
  'Errores propios':'circle-x',
  'Errores del rival':'circle-check'
};

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function findMatch(id){return (state()?.events||[]).find(match=>String(match?.id)===String(id))||null;}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function prettyDate(value){
  const raw=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||'Fecha pendiente';
  const [y,m,d]=raw.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');
}
function roundLabel(match){
  if(String(match?.type||'')==='Amistoso')return'Amistoso';
  const raw=match?.round??match?.jornada??match?.matchday??match?.rawPayload?.round??match?.rawPayload?.jornada;
  const found=String(raw??'').match(/\d{1,2}/);
  return found?`Jornada ${Number(found[0])}`:'Liga';
}

function ensureStyles(){
  if(document.getElementById('match-statistics-player-polish-style'))return;
  const style=document.createElement('style');
  style.id='match-statistics-player-polish-style';
  style.textContent=`
    #modal-player-match-stats .modal-body{scrollbar-width:none!important;-ms-overflow-style:none!important}
    #modal-player-match-stats .modal-body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}

    #modal-player-match-stats .player-stats-detail-nav{display:flex;align-items:center;margin:0 0 .62rem}
    #modal-player-match-stats .player-stats-back{display:inline-flex;align-items:center;gap:.35rem;min-height:34px;padding:.4rem .62rem;border:1px solid #dbe3ec;border-radius:999px;background:#fff;color:#475569;font:inherit;font-size:.69rem;font-weight:800;line-height:1;box-shadow:0 2px 8px rgba(15,23,42,.035);cursor:pointer}
    #modal-player-match-stats .player-stats-back svg{width:15px;height:15px;stroke-width:2.2}

    #modal-player-match-stats .player-stats-hero{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:.8rem!important;align-items:center!important;overflow:hidden;border-color:#e2e8f0!important;background:linear-gradient(135deg,#fff 0%,#f8fafc 100%)!important;box-shadow:0 8px 24px rgba(15,23,42,.05)}
    #modal-player-match-stats .player-stats-hero::before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:#d97706}
    #modal-player-match-stats .player-stats-hero-main{min-width:0;padding-left:.08rem}
    #modal-player-match-stats .player-stats-hero-chips{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;margin-bottom:.38rem}
    #modal-player-match-stats .player-stats-hero .player-stats-chip{display:inline-flex!important;align-items:center!important;width:auto!important;padding:.25rem .48rem!important;border:1px solid #e2e8f0!important;border-radius:999px!important;background:#f8fafc!important;color:#475569!important;font-size:.59rem!important;font-weight:850!important;line-height:1!important;letter-spacing:0!important;text-transform:none!important}
    #modal-player-match-stats .player-stats-hero .player-stats-chip.is-friendly{background:#fff7ed!important;border-color:#fed7aa!important;color:#9a3412!important}
    #modal-player-match-stats .player-stats-hero .player-stats-chip.is-published{background:#ecfdf5!important;border-color:#a7f3d0!important;color:#047857!important}
    #modal-player-match-stats .player-stats-hero-title{margin:0!important;font-family:var(--font-heading)!important;font-size:1rem!important;line-height:1.15!important;color:#0f172a!important;overflow-wrap:normal!important;word-break:normal!important}
    #modal-player-match-stats .player-stats-hero-meta{display:grid;grid-template-columns:1fr;gap:.12rem;margin-top:.35rem}
    #modal-player-match-stats .player-stats-hero-meta span{display:block!important;color:#64748b!important;font-size:.66rem!important;font-weight:650!important;line-height:1.25!important;letter-spacing:0!important;text-transform:none!important}
    #modal-player-match-stats .player-stats-score{display:grid;justify-items:end;gap:.2rem;flex:0 0 auto}
    #modal-player-match-stats .player-stats-score span{display:block!important;color:#64748b!important;font-size:.55rem!important;font-weight:850!important;line-height:1!important;letter-spacing:.045em!important;text-transform:uppercase!important;white-space:nowrap}
    #modal-player-match-stats .player-stats-score strong{padding:.32rem .55rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:1.05rem!important;font-variant-numeric:tabular-nums;box-shadow:0 2px 8px rgba(15,23,42,.04);white-space:nowrap}

    #modal-player-match-stats .player-stat-section{margin-top:1rem!important}
    #modal-player-match-stats .player-stat-section[hidden]{display:none!important}
    #modal-player-match-stats .player-stat-section h4{margin-bottom:.5rem!important;font-size:.73rem!important;letter-spacing:.055em!important;color:#475569!important}
    #modal-player-match-stats .player-stat-section h4::before{display:none!important}

    #modal-player-match-stats .player-stat-metric{position:relative;min-height:66px;border-color:#e2e8f0!important;box-shadow:0 2px 8px rgba(15,23,42,.025);transition:none!important}
    #modal-player-match-stats .player-stat-metric[hidden]{display:none!important}
    #modal-player-match-stats .player-stat-metric .metric-icon{color:#475569;background:#f1f5f9!important}
    #modal-player-match-stats .player-stat-metric .metric-icon svg{width:16px;height:16px;stroke-width:2.1}
    #modal-player-match-stats .player-stat-metric strong{font-size:1rem!important;font-weight:850!important;letter-spacing:-.015em}
    #modal-player-match-stats .player-stat-metric small{font-weight:650}
    #modal-player-match-stats .player-stat-metric.is-positive{border-color:#d1fae5!important;background:#fcfffd!important}
    #modal-player-match-stats .player-stat-metric.is-positive .metric-icon{color:#047857!important;background:#ecfdf5!important}
    #modal-player-match-stats .player-stat-metric.is-negative{border-color:#fee2e2!important;background:#fffdfd!important}
    #modal-player-match-stats .player-stat-metric.is-negative .metric-icon{color:#b91c1c!important;background:#fef2f2!important}
    #modal-player-match-stats .player-stat-metric.is-warning{border-color:#fde68a!important;background:#fffefa!important}
    #modal-player-match-stats .player-stat-metric.is-warning .metric-icon{color:#b45309!important;background:#fffbeb!important}
    #modal-player-match-stats .player-stat-metric.is-volume{min-height:58px;background:#f8fafc!important;border-style:dashed!important;box-shadow:none!important}
    #modal-player-match-stats .player-stat-metric.is-volume strong{font-size:.88rem!important;color:#475569!important}
    #modal-player-match-stats .player-stat-metric.is-volume small{color:#64748b!important}

    @media(max-width:560px){
      #modal-player-match-stats .player-stats-detail-nav{margin-bottom:.55rem}
      #modal-player-match-stats .player-stats-hero{margin-bottom:.7rem!important;padding:.72rem .75rem!important;gap:.55rem!important}
      #modal-player-match-stats .player-stats-hero-title{font-size:.94rem!important}
      #modal-player-match-stats .player-stat-section{margin-top:.82rem!important}
      #modal-player-match-stats .player-stat-group-grid{gap:.42rem!important}
      #modal-player-match-stats .player-stat-metric{min-height:62px!important;padding:.58rem!important}
      #modal-player-match-stats .player-stat-metric.is-volume{min-height:54px!important}
      #modal-player-match-stats .player-stat-metric strong{font-size:.94rem!important}
    }
  `;
  document.head.appendChild(style);
}

function classify(label){
  const text=String(label||'').toLowerCase();
  if(text.startsWith('total de '))return'is-volume';
  if(text.includes('neutra')||text.includes('exclamativa'))return'is-warning';
  if(text.includes('error')||text.includes('errores propios'))return'is-negative';
  if(text.includes('perfecta')||text.includes('efectividad')||text==='aces'||text.includes('bloqueos punto')||text.includes('errores del rival'))return'is-positive';
  return'';
}
function positive(value){const n=Number(value);return Number.isFinite(n)&&n>0;}
function zeroTotalIsProbablyMissing(label,stats){
  if(!stats)return false;
  if(label==='Total de recepciones')return positive(stats.recPerfectPct)||positive(stats.recExclamPct)||positive(stats.recErrorPct)||positive(stats.recPerfect)||positive(stats.recError);
  if(label==='Total de ataques')return positive(stats.attackEfficiencyPct)||positive(stats.attackErrors);
  if(label==='Total de saques')return positive(stats.aces)||positive(stats.serveErrorPct)||positive(stats.serveErrors)||positive(stats.saquesError);
  if(label==='Total de bloqueos')return positive(stats.bloqueos);
  return false;
}
function closePlayerStats(){
  const modal=document.getElementById('modal-player-match-stats');
  if(!modal)return;
  const nativeClose=modal.querySelector('.modal-close');
  if(nativeClose){nativeClose.click();return;}
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden','true');
}
function ensureDetailNav(body){
  let nav=body.querySelector('.player-stats-detail-nav');
  if(nav)return false;
  nav=document.createElement('div');
  nav.className='player-stats-detail-nav';
  const button=document.createElement('button');
  button.type='button';
  button.className='player-stats-back';
  button.setAttribute('aria-label','Volver a la lista de partidos');
  button.innerHTML='<i data-lucide="arrow-left"></i><span>Volver a partidos</span>';
  button.addEventListener('click',closePlayerStats);
  nav.appendChild(button);
  body.prepend(nav);
  return true;
}
function polishHero(body,match){
  const hero=body.querySelector('.player-stats-hero');
  if(!hero||!match)return false;
  const score=String(match.result||hero.querySelector('strong')?.textContent||'Finalizado').trim();
  const signature=[match.id,match.title,match.type,match.date,match.location,score].join('|');
  if(hero.dataset.playerHeroSignature===signature)return false;
  hero.dataset.playerHeroSignature=signature;
  const type=roundLabel(match);
  const friendly=String(match.type||'')==='Amistoso';
  hero.innerHTML=`<div class="player-stats-hero-main"><div class="player-stats-hero-chips"><span class="player-stats-chip ${friendly?'is-friendly':''}">${escapeHtml(type)}</span><span class="player-stats-chip is-published">Publicado</span></div><h3 class="player-stats-hero-title">${escapeHtml(match.title||'Resumen del partido')}</h3><div class="player-stats-hero-meta"><span>${escapeHtml(prettyDate(match.date))}</span><span>📍 ${escapeHtml(match.location||'Ubicación por confirmar')}</span></div></div><div class="player-stats-score"><span>${/\b\d+\s*[-–:]\s*\d+\b/.test(score)?'Resultado final':'Estado'}</span><strong>${escapeHtml(score)}</strong></div>`;
  return false;
}

function polish(stats=currentStats){
  if(polishing)return;
  polishing=true;
  try{
    const body=document.getElementById('player-match-stats-body');
    if(!body)return;
    const match=findMatch(currentMatchId);
    let needsIcons=ensureDetailNav(body);
    const title=document.getElementById('player-match-stats-title');
    if(title&&title.textContent!=='Resumen del partido')title.textContent='Resumen del partido';
    const modal=document.getElementById('modal-player-match-stats');
    if(modal?.classList.contains('active'))modal.setAttribute('aria-hidden','false');
    polishHero(body,match);

    body.querySelectorAll('.player-stat-metric').forEach(card=>{
      const small=card.querySelector('small');
      let label=small?.textContent?.trim()||'';
      if(label==='Recepción exclamativa (!)'){
        small.textContent='Recepción neutra (!)';
        label='Recepción neutra (!)';
      }
      card.classList.remove('is-positive','is-negative','is-warning','is-volume','is-unregistered');
      const type=classify(label);if(type)card.classList.add(type);

      const value=card.querySelector('strong');
      if(type==='is-volume'&&value?.textContent?.trim()==='0'&&zeroTotalIsProbablyMissing(label,stats))value.textContent='—';
      const text=value?.textContent?.trim()||'';
      const missing=!text||text==='—'||text==='NaN'||text==='undefined'||text==='null';
      card.hidden=missing;
      if(missing)return;

      const icon=card.querySelector('.metric-icon');
      const iconName=ICONS[label]||'activity';
      if(icon&&icon.dataset.playerIcon!==iconName){
        icon.dataset.playerIcon=iconName;
        icon.innerHTML=`<i data-lucide="${iconName}"></i>`;
        needsIcons=true;
      }
    });

    body.querySelectorAll('.player-stat-section').forEach(section=>{
      section.hidden=![...section.querySelectorAll('.player-stat-metric')].some(card=>!card.hidden);
    });
    if(needsIcons){try{window.lucide?.createIcons();}catch(_){}}
  }finally{
    polishing=false;
  }
}

function install(){
  ensureStyles();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const base=window.enhancePlayerMatchStatsModal;
    if(typeof base==='function'&&!base.__playerPolishWrapped){
      clearInterval(timer);
      const wrapped=function(matchId,stats){
        currentMatchId=matchId;
        currentStats=stats||null;
        const result=base.apply(this,arguments);
        polish(currentStats);
        return result;
      };
      wrapped.__playerPolishWrapped=true;
      window.enhancePlayerMatchStatsModal=wrapped;
      const body=document.getElementById('player-match-stats-body');
      if(body)new MutationObserver(()=>window.setTimeout(()=>polish(currentStats),0)).observe(body,{childList:true,subtree:true});
    }else if(base?.__playerPolishWrapped||tries>=120){
      clearInterval(timer);
    }
  },80);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
