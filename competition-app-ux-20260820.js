(function(){
'use strict';

const FLAG='__competitionAppUx20260820';
if(window[FLAG])return;
window[FLAG]=true;

let observer=null;
let frame=0;

function isCoach(){try{return typeof isCoachUser==='function'&&isCoachUser();}catch(_){return false;}}
function text(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim();}
function number(value){const n=Number(String(value??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));}

function ensureStyles(){
  if(document.getElementById('competition-app-ux-20260820-style'))return;
  const style=document.createElement('style');
  style.id='competition-app-ux-20260820-style';
  style.textContent=`
    #view-competition .competition-app-summary{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(105px,.72fr));gap:.65rem;margin:0 0 1rem;padding:.82rem;border:1px solid #e5eaf1;border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 6px 20px rgba(15,23,42,.035)}
    #view-competition .competition-summary-main{display:flex;align-items:center;gap:.7rem;min-width:0;padding:.2rem .25rem}
    #view-competition .competition-summary-logo{width:42px;height:42px;flex:0 0 42px;border-radius:12px;object-fit:contain;background:#fff;padding:3px;border:1px solid #e6ebf2}
    #view-competition .competition-summary-copy{min-width:0}
    #view-competition .competition-summary-copy small{display:block;font-size:.56rem;font-weight:850;letter-spacing:.055em;text-transform:uppercase;color:#94a3b8}
    #view-competition .competition-summary-copy strong{display:block;margin-top:.08rem;font-family:var(--font-heading);font-size:.98rem;line-height:1.1;color:#172033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #view-competition .competition-summary-copy span{display:block;margin-top:.12rem;font-size:.62rem;color:#7b8798}
    #view-competition .competition-summary-metric{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:.55rem .65rem;border:1px solid #edf1f5;border-radius:12px;background:#fbfcfe}
    #view-competition .competition-summary-metric small{font-size:.54rem;font-weight:800;letter-spacing:.035em;text-transform:uppercase;color:#96a1af}
    #view-competition .competition-summary-metric strong{margin-top:.1rem;font-family:var(--font-heading);font-size:1rem;line-height:1;color:#263244;font-variant-numeric:tabular-nums}
    #view-competition .competition-summary-metric span{margin-top:.12rem;font-size:.54rem;color:#8a96a6}
    #view-competition .competition-mobile-list{display:none}
    #view-competition .competition-table-host{min-width:0}

    @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
      #view-competition>.card-header{margin-bottom:.75rem!important;gap:.5rem!important;align-items:center!important}
      #view-competition>.card-header>div:first-child{min-width:0;flex:1 1 auto}
      #view-competition>.card-header h2{font-size:1.08rem!important;line-height:1.12!important;gap:.3rem!important}
      #view-competition>.card-header h2 svg,#view-competition>.card-header h2 i{display:none!important}
      #view-competition>.card-header p{font-size:.66rem!important;margin-top:.15rem!important}
      #view-competition #coach-competition-actions{flex:0 0 auto!important}
      #view-competition #btn-reset-league-table{width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border-radius:11px!important;font-size:0!important;display:grid!important;place-items:center!important}
      #view-competition #btn-reset-league-table svg{width:16px!important;height:16px!important}

      #view-competition .competition-app-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:.38rem;margin-bottom:.68rem;padding:.62rem;border-radius:15px}
      #view-competition .competition-summary-main{grid-column:1/-1;padding:.05rem .08rem .42rem;border-bottom:1px solid #f0f3f7}
      #view-competition .competition-summary-logo{width:36px;height:36px;flex-basis:36px;border-radius:10px}
      #view-competition .competition-summary-copy strong{font-size:.86rem}
      #view-competition .competition-summary-copy span{font-size:.57rem}
      #view-competition .competition-summary-metric{padding:.48rem .45rem;border-radius:10px;text-align:center;align-items:center}
      #view-competition .competition-summary-metric small{font-size:.49rem}
      #view-competition .competition-summary-metric strong{font-size:.88rem}
      #view-competition .competition-summary-metric span{font-size:.48rem}

      #view-competition .competition-table-host{display:none!important}
      #view-competition .competition-mobile-list{display:grid;grid-template-columns:1fr;gap:.38rem;margin-top:.1rem}
      #view-competition .competition-mobile-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;grid-template-areas:'rank team points' 'rank meta meta';column-gap:.5rem;row-gap:.26rem;min-width:0;padding:.62rem .66rem;border:1px solid #e7ebf0;border-radius:13px;background:rgba(255,255,255,.97);box-shadow:0 3px 12px rgba(15,23,42,.025)}
      #view-competition .competition-mobile-row.is-own{border-color:#f4cf78;background:#fffaf0;box-shadow:0 4px 14px rgba(217,119,6,.07)}
      #view-competition .competition-mobile-rank{grid-area:rank;align-self:center;display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:#f3f6f9;color:#64748b;font-family:var(--font-heading);font-size:.72rem;font-weight:850;font-variant-numeric:tabular-nums}
      #view-competition .competition-mobile-row.is-own .competition-mobile-rank{background:#fef3c7;color:#a16207}
      #view-competition .competition-mobile-team{grid-area:team;display:flex;align-items:center;gap:.48rem;min-width:0}
      #view-competition .competition-mobile-team img{width:28px;height:28px;flex:0 0 28px;border-radius:8px;object-fit:contain;background:#fff;padding:2px;border:1px solid #edf1f5}
      #view-competition .competition-mobile-team strong{min-width:0;font-family:var(--font-heading);font-size:.76rem;line-height:1.08;color:#202b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #view-competition .competition-mobile-row.is-own .competition-mobile-team strong{color:#8a5507}
      #view-competition .competition-mobile-points{grid-area:points;align-self:center;text-align:right;white-space:nowrap}
      #view-competition .competition-mobile-points strong{display:block;font-family:var(--font-heading);font-size:.87rem;line-height:1;color:#172033;font-variant-numeric:tabular-nums}
      #view-competition .competition-mobile-points small{display:block;margin-top:.1rem;font-size:.47rem;font-weight:800;text-transform:uppercase;color:#98a3b1}
      #view-competition .competition-mobile-meta{grid-area:meta;display:flex;align-items:center;gap:.28rem;min-width:0;flex-wrap:wrap}
      #view-competition .competition-mobile-chip{display:inline-flex;align-items:center;gap:.16rem;min-height:20px;padding:.18rem .32rem;border-radius:6px;background:#f6f8fa;color:#697689;font-size:.49rem;font-weight:750;font-variant-numeric:tabular-nums}
      #view-competition .competition-mobile-chip b{color:#374151;font-weight:850}
      #view-competition .competition-mobile-edit{margin-left:auto;appearance:none;border:0;background:transparent;color:#8b96a5;font-size:.5rem;font-weight:800;padding:.2rem .1rem;cursor:pointer}
      #view-competition .competition-mobile-row.is-own .competition-mobile-edit{color:#9b7a3e;cursor:default}
    }
  `;
  document.head.appendChild(style);
}

function headerMap(table){
  const map={};
  [...(table?.querySelectorAll('thead th')||[])].forEach((th,index)=>{
    const key=text(th).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ0-9]/g,'');
    map[key]=index;
  });
  const find=(...keys)=>{
    for(const key of keys){if(Number.isInteger(map[key]))return map[key];}
    return -1;
  };
  return {
    pos:find('POS','POSICIÓN','POSICION','#'),
    team:find('EQUIPO','TEAM'),
    points:find('PTS','PUNTOS','PTOS'),
    pj:find('PJ'),pg:find('PG'),pp:find('PP'),sf:find('SF'),sc:find('SC'),
    actions:find('ACCIONES','ACCIÓN','ACCION')
  };
}

function cell(row,index){return index>=0?row.children[index]:null;}
function rowData(row,index,map){
  const cells=[...row.children];
  const teamCell=cell(row,map.team>=0?map.team:1)||cells[1]||cells[0];
  const img=row.querySelector('img');
  const teamName=text(teamCell).replace(/Automático/gi,'').replace(/Editar/gi,'').trim()||`Equipo ${index+1}`;
  const own=row.classList.contains('league-own-team-row')||/CV\s*BUNYOLA/i.test(teamName);
  const val=(idx,fallback)=>number(text(cell(row,idx>=0?idx:fallback)));
  return {
    row,index:index+1,own,teamName,logo:img?.getAttribute('src')||'assets/default_avatar.svg',
    points:val(map.points,2),pj:val(map.pj,3),pg:val(map.pg,4),pp:val(map.pp,5),sf:val(map.sf,6),sc:val(map.sc,7),
    action:cell(row,map.actions>=0?map.actions:8)?.querySelector('button')||row.querySelector('button[onclick*="openEditTeamModal"]')
  };
}

function summary(view,rows){
  let box=view.querySelector('.competition-app-summary');
  if(!box){
    box=document.createElement('section');
    box.className='competition-app-summary';
    const header=view.querySelector(':scope > .card-header');
    header?.insertAdjacentElement('afterend',box);
  }
  const own=rows.find(item=>item.own);
  if(!own){box.hidden=true;return;}
  box.hidden=false;
  const position=own.pj>0?`${own.index}º`:'—';
  box.innerHTML=`
    <div class="competition-summary-main">
      <img class="competition-summary-logo" src="${esc(own.logo)}" alt="">
      <div class="competition-summary-copy"><small>Temporada 2026 · 2027</small><strong>${esc(own.teamName)}</strong><span>Clasificación de Liga · datos automáticos</span></div>
    </div>
    <div class="competition-summary-metric"><small>Posición</small><strong>${position}</strong><span>${own.pj>0?`de ${rows.length} equipos`:'Sin jornadas'}</span></div>
    <div class="competition-summary-metric"><small>Puntos</small><strong>${own.points}</strong><span>${own.pj} PJ</span></div>
    <div class="competition-summary-metric"><small>Balance</small><strong>${own.pg}–${own.pp}</strong><span>${own.sf}–${own.sc} sets</span></div>`;
}

function mobileList(view,table,rows){
  let list=view.querySelector('.competition-mobile-list');
  if(!list){
    list=document.createElement('section');
    list.className='competition-mobile-list';
    list.setAttribute('aria-label','Clasificación de Liga');
    const host=table.parentElement;
    host?.insertAdjacentElement('beforebegin',list);
  }
  list.innerHTML='';
  rows.forEach(item=>{
    const card=document.createElement('article');
    card.className=`competition-mobile-row${item.own?' is-own':''}`;
    card.innerHTML=`
      <div class="competition-mobile-rank">${item.index}</div>
      <div class="competition-mobile-team"><img src="${esc(item.logo)}" alt=""><strong>${esc(item.teamName)}</strong></div>
      <div class="competition-mobile-points"><strong>${item.points}</strong><small>pts</small></div>
      <div class="competition-mobile-meta">
        <span class="competition-mobile-chip">PJ <b>${item.pj}</b></span>
        <span class="competition-mobile-chip">PG <b>${item.pg}</b></span>
        <span class="competition-mobile-chip">PP <b>${item.pp}</b></span>
        <span class="competition-mobile-chip">SF <b>${item.sf}</b></span>
        <span class="competition-mobile-chip">SC <b>${item.sc}</b></span>
      </div>`;
    const meta=card.querySelector('.competition-mobile-meta');
    if(item.own){
      const automatic=document.createElement('span');
      automatic.className='competition-mobile-edit';
      automatic.textContent='Automático';
      meta?.appendChild(automatic);
    }else if(isCoach()&&item.action){
      const edit=document.createElement('button');
      edit.type='button';
      edit.className='competition-mobile-edit';
      edit.textContent='Editar';
      edit.addEventListener('click',()=>item.action.click());
      meta?.appendChild(edit);
    }
    list.appendChild(card);
  });
}

function polishHeader(view){
  const heading=view.querySelector(':scope > .card-header h2');
  const subtitle=view.querySelector(':scope > .card-header p');
  if(heading&&heading.dataset.competitionPolished!=='1'){
    heading.dataset.competitionPolished='1';
    heading.textContent='Clasificación de Liga';
  }
  if(subtitle)subtitle.textContent='Cadete Femenino 1ª División · 12 equipos';
  const reset=view.querySelector('#btn-reset-league-table');
  if(reset){reset.title='Reiniciar clasificación';reset.setAttribute('aria-label','Reiniciar clasificación');}
}

function enhance(){
  frame=0;
  const view=document.getElementById('view-competition');
  const tbody=document.getElementById('league-table-tbody');
  const table=tbody?.closest('table');
  if(!view||!tbody||!table)return;
  ensureStyles();
  polishHeader(view);
  table.parentElement?.classList.add('competition-table-host');
  const map=headerMap(table);
  const rows=[...tbody.querySelectorAll(':scope > tr')].map((row,index)=>rowData(row,index,map));
  if(!rows.length)return;
  summary(view,rows);
  mobileList(view,table,rows);
}

function schedule(){if(frame)return;frame=requestAnimationFrame(enhance);}

function observe(){
  const tbody=document.getElementById('league-table-tbody');
  if(!tbody||observer)return;
  observer=new MutationObserver(schedule);
  observer.observe(tbody,{childList:true,subtree:true,characterData:true});
}

function wrapRender(){
  const current=window.renderCompetition;
  if(typeof current!=='function'||current.__competitionAppUx20260820)return;
  const wrapped=function(){
    const out=current.apply(this,arguments);
    Promise.resolve(out).finally(schedule);
    return out;
  };
  wrapped.__competitionAppUx20260820=true;
  window.renderCompetition=wrapped;
  try{renderCompetition=wrapped;}catch(_){}
}

function install(){ensureStyles();observe();wrapRender();schedule();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();