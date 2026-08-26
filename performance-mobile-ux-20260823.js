(function(){
'use strict';

const FLAG='__performanceMobileUx20260823';
if(window[FLAG])return;
window[FLAG]=true;

function isMobilePerformanceViewport(){
  try{return window.matchMedia('(max-width:760px), (max-width:1366px) and (any-pointer:coarse)').matches;}
  catch(_){return window.innerWidth<=1366;}
}
function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function currentTest(){
  try{if(typeof currentPerformanceTest!=='undefined'&&currentPerformanceTest)return currentPerformanceTest;}catch(_){}
  return document.querySelector('#view-fitness [data-performance-test].active')?.dataset.performanceTest||'CMJ';
}
function records(){
  const st=state();
  return Array.isArray(st?.performanceData?.jumpTests)?st.performanceData.jumpTests:[];
}
function players(){
  const st=state();
  return Array.isArray(st?.players)?st.players:[];
}
function formatDate(value){
  if(!value)return 'Sin test';
  const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES',{day:'2-digit',month:'short'}).replace('.','');
}
function formatFullDate(value){
  if(!value)return 'Sin registros';
  const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES',{day:'numeric',month:'long',year:'numeric'});
}
function unitMeta(test){return test==='Drop Jump'?{unit:'RSI',decimals:2}:{unit:'cm',decimals:1};}
function validResult(record){const n=Number(record?.result);return Number.isFinite(n)&&n>=0?n:null;}
function playerName(playerId){return players().find(p=>String(p.id)===String(playerId))?.name||'Jugadora';}
function selectedRecords(test=currentTest()){
  return records().filter(r=>r?.test===test&&validResult(r)!==null);
}
function latestByPlayer(test=currentTest()){
  const map=new Map();
  selectedRecords(test).forEach(record=>{
    const key=String(record.playerId||record.playerName||'');
    if(!key)return;
    const current=map.get(key);
    if(!current||new Date(record.date||0)>new Date(current.date||0))map.set(key,record);
  });
  return [...map.values()];
}
function metric(value,unit,decimals){return value===null||!Number.isFinite(value)?'—':`${value.toFixed(decimals)} <small>${unit}</small>`;}
function summaryMarkup(test){
  if(test==='Histórico'){
    const all=records().filter(r=>validResult(r)!==null);
    const evaluated=new Set(all.map(r=>String(r.playerId||''))).size;
    const last=all.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];
    return `<section id="performance-mobile-summary" class="performance-mobile-summary history-summary">
      <div class="performance-mobile-summary-head"><span>Histórico</span><strong>Visión global</strong></div>
      <div class="performance-mobile-kpis">
        <article><small>Registros</small><strong>${all.length}</strong></article>
        <article><small>Jugadoras</small><strong>${evaluated}/${players().length}</strong></article>
        <article class="wide"><small>Último test</small><strong>${last?formatDate(last.date):'—'}</strong></article>
      </div>
    </section>`;
  }
  const data=selectedRecords(test);
  const latest=latestByPlayer(test);
  const {unit,decimals}=unitMeta(test);
  const values=latest.map(validResult).filter(v=>v!==null);
  const average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const bestRecord=data.slice().sort((a,b)=>(validResult(b)??-Infinity)-(validResult(a)??-Infinity))[0]||null;
  const lastRecord=data.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0]||null;
  return `<section id="performance-mobile-summary" class="performance-mobile-summary">
    <div class="performance-mobile-summary-head"><span>Resumen ${esc(test)}</span><strong>Lectura rápida del equipo</strong></div>
    <div class="performance-mobile-kpis">
      <article><small>Media actual</small><strong>${metric(average,unit,decimals)}</strong><em>última marca por jugadora</em></article>
      <article><small>Mejor marca</small><strong>${bestRecord?metric(validResult(bestRecord),unit,decimals):'—'}</strong><em>${bestRecord?esc(playerName(bestRecord.playerId)):'Sin datos'}</em></article>
      <article><small>Evaluadas</small><strong>${latest.length}/${players().length}</strong><em>jugadoras con registro</em></article>
      <article><small>Último test</small><strong>${lastRecord?formatDate(lastRecord.date):'—'}</strong><em>${lastRecord?esc(playerName(lastRecord.playerId)):'Sin registros'}</em></article>
    </div>
  </section>`;
}
function ensureSummary(){
  const view=document.getElementById('view-fitness');
  const tabs=view?.querySelector('.performance-test-tabs');
  const current=view?.querySelector('#performance-current-view');
  if(!view||!tabs||!current)return;
  let summary=view.querySelector('#performance-mobile-summary');
  const html=summaryMarkup(currentTest());
  if(summary)summary.outerHTML=html;
  else tabs.insertAdjacentHTML('afterend',html);
}
function resolvePlayerFromCard(card,index){
  const name=card.querySelector('.performance-result-player strong')?.textContent?.trim();
  const byName=players().find(p=>String(p.name||'').trim()===name);
  return byName||players()[index]||null;
}
function bindCards(){
  document.querySelectorAll('#view-fitness .performance-result-card').forEach((card,index)=>{
    const player=resolvePlayerFromCard(card,index);
    if(!player)return;
    card.classList.add('performance-mobile-player-card');
    card.dataset.playerId=String(player.id);
    card.tabIndex=0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label',`Ver evolución de ${player.name}`);
    card.onclick=()=>openPlayerPerformanceDetail(player.id,currentTest());
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPlayerPerformanceDetail(player.id,currentTest());}};
    if(!card.querySelector('.performance-card-chevron'))card.insertAdjacentHTML('beforeend','<span class="performance-card-chevron" aria-hidden="true">›</span>');
  });
}
function trendSvg(data,test){
  const clean=data.filter(r=>validResult(r)!==null).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  if(!clean.length)return `<div class="performance-detail-empty">Aún no hay registros para este test.</div>`;
  const shown=clean.slice(-8);
  const vals=shown.map(validResult);
  let min=Math.min(...vals),max=Math.max(...vals);
  if(min===max){min=Math.max(0,min-1);max=max+1;}
  const width=320,height=138,padX=18,padTop=14,padBottom=28;
  const x=i=>shown.length===1?width/2:padX+i*((width-padX*2)/(shown.length-1));
  const y=v=>padTop+(max-v)/(max-min)*(height-padTop-padBottom);
  const points=shown.map((r,i)=>`${x(i).toFixed(1)},${y(validResult(r)).toFixed(1)}`).join(' ');
  const {unit,decimals}=unitMeta(test);
  const circles=shown.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(validResult(r)).toFixed(1)}" r="4.5"><title>${formatFullDate(r.date)} · ${validResult(r).toFixed(decimals)} ${unit}</title></circle>`).join('');
  return `<svg class="performance-detail-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución de ${esc(test)}">
    <line x1="${padX}" y1="${height-padBottom}" x2="${width-padX}" y2="${height-padBottom}" class="axis"/>
    <polyline points="${points}" class="trend-line"/>${circles}
    <text x="${padX}" y="${height-8}" text-anchor="start">${esc(formatDate(shown[0].date))}</text>
    <text x="${width-padX}" y="${height-8}" text-anchor="end">${esc(formatDate(shown[shown.length-1].date))}</text>
  </svg>`;
}
function closePlayerPerformanceDetail(){
  document.getElementById('performance-player-detail-modal')?.remove();
  document.body.classList.remove('performance-detail-open');
}
function openPlayerPerformanceDetail(playerId,test=currentTest()){
  if(test==='Histórico')return;
  closePlayerPerformanceDetail();
  const player=players().find(p=>String(p.id)===String(playerId));
  if(!player)return;
  const data=selectedRecords(test).filter(r=>String(r.playerId)===String(playerId)).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  const {unit,decimals}=unitMeta(test);
  const first=data[0]||null,latest=data[data.length-1]||null;
  const values=data.map(validResult).filter(v=>v!==null);
  const best=values.length?Math.max(...values):null;
  const delta=first&&latest&&data.length>1?validResult(latest)-validResult(first):null;
  const deltaLabel=delta===null?'—':`${delta>0?'+':''}${delta.toFixed(decimals)} ${unit}`;
  const recent=data.slice().reverse().slice(0,6).map(r=>`<div class="performance-detail-log-row"><span>${formatFullDate(r.date)}</span><strong>${validResult(r).toFixed(decimals)} ${unit}</strong></div>`).join('');
  const avatar=player.avatar||((typeof DEFAULT_AVATAR!=='undefined')?DEFAULT_AVATAR:'');
  const modal=document.createElement('div');
  modal.id='performance-player-detail-modal';
  modal.className='performance-player-detail-modal';
  modal.innerHTML=`<div class="performance-player-detail-sheet" role="dialog" aria-modal="true" aria-label="Rendimiento de ${esc(player.name)}">
    <header><div class="performance-detail-person">${avatar?`<img src="${esc(avatar)}" alt="">`:''}<span><strong>${esc(player.name)}</strong><small>#${esc(player.number??'—')} · ${esc(test)}</small></span></div><button type="button" class="performance-detail-close" aria-label="Cerrar">×</button></header>
    <div class="performance-detail-body">
      <section class="performance-detail-kpis">
        <article><small>Último</small><strong>${latest?`${validResult(latest).toFixed(decimals)} <em>${unit}</em>`:'—'}</strong></article>
        <article><small>Mejor</small><strong>${best!==null?`${best.toFixed(decimals)} <em>${unit}</em>`:'—'}</strong></article>
        <article><small>Cambio</small><strong>${deltaLabel}</strong></article>
        <article><small>Tests</small><strong>${data.length}</strong></article>
      </section>
      <section class="performance-detail-chart"><div><strong>Evolución</strong><small>${data.length?`${formatDate(data[0].date)} → ${formatDate(data[data.length-1].date)}`:'Sin registros'}</small></div>${trendSvg(data,test)}</section>
      <section class="performance-detail-log"><h4>Últimos registros</h4>${recent||'<div class="performance-detail-empty">No hay registros todavía.</div>'}</section>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.body.classList.add('performance-detail-open');
  modal.querySelector('.performance-detail-close').onclick=closePlayerPerformanceDetail;
  modal.addEventListener('click',e=>{if(e.target===modal)closePlayerPerformanceDetail();});
}
window.openPlayerPerformanceDetail=openPlayerPerformanceDetail;
window.closePlayerPerformanceDetail=closePlayerPerformanceDetail;

function ensureStyles(){
  if(document.getElementById('performance-mobile-ux-20260823-style'))return;
  const style=document.createElement('style');
  style.id='performance-mobile-ux-20260823-style';
  style.textContent=`
@media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
  #view-fitness .performance-panel{gap:.8rem}
  #view-fitness .performance-test-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;overflow:visible!important;padding:.1rem 0!important}
  #view-fitness .performance-test-tab{min-width:0!important;padding:.65rem .35rem!important;font-size:.76rem!important;text-align:center!important;overflow:hidden;text-overflow:ellipsis}
  #view-fitness .performance-test-tab[data-performance-test="Histórico"]{grid-column:1/-1;background:#fff7ed;border-color:#fed7aa;color:#9a3412}
  #view-fitness .performance-test-tab[data-performance-test="Histórico"].active{background:#9a3412;color:#fff;border-color:#9a3412}
  #view-fitness .performance-mobile-summary{background:rgba(255,255,255,.95);border:1px solid #e5e7eb;border-radius:20px;padding:.9rem;box-shadow:0 8px 22px rgba(15,23,42,.05)}
  #view-fitness .performance-mobile-summary-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem;margin-bottom:.7rem}
  #view-fitness .performance-mobile-summary-head span{font-size:.68rem;font-weight:850;text-transform:uppercase;letter-spacing:.07em;color:#0f766e}
  #view-fitness .performance-mobile-summary-head strong{font-size:.78rem;color:#475569;text-align:right}
  #view-fitness .performance-mobile-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
  #view-fitness .performance-mobile-kpis article{display:flex;flex-direction:column;gap:.08rem;min-width:0;background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;padding:.68rem .72rem}
  #view-fitness .performance-mobile-kpis small{font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.035em;color:#94a3b8}
  #view-fitness .performance-mobile-kpis strong{font-size:1.05rem;color:#0f172a;line-height:1.15}
  #view-fitness .performance-mobile-kpis strong small{font-size:.7rem;color:#64748b;text-transform:none;letter-spacing:0}
  #view-fitness .performance-mobile-kpis em{font-size:.65rem;font-style:normal;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #view-fitness .performance-results-grid{display:grid!important;grid-template-columns:1fr!important;gap:.55rem!important;margin-top:.75rem!important}
  #view-fitness .performance-result-card.performance-mobile-player-card{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"player metrics" "date metrics"!important;align-items:center!important;gap:.35rem .7rem!important;padding:.72rem .78rem!important;min-height:0!important;cursor:pointer;border-radius:16px!important}
  #view-fitness .performance-result-card.performance-mobile-player-card:active{transform:scale(.992)}
  #view-fitness .performance-result-player{grid-area:player;min-width:0;gap:.55rem!important}
  #view-fitness .performance-result-player img{width:42px!important;height:42px!important;min-width:42px!important}
  #view-fitness .performance-result-player strong{font-size:.92rem!important;line-height:1.1}
  #view-fitness .performance-result-player small{font-size:.7rem!important}
  #view-fitness .performance-result-metrics{grid-area:metrics;display:grid!important;grid-template-columns:repeat(2,minmax(58px,1fr))!important;gap:.35rem!important;margin:0 1rem 0 0!important}
  #view-fitness .performance-result-metrics>div{min-width:58px!important;padding:.46rem .5rem!important;border-radius:11px!important}
  #view-fitness .performance-result-metrics span{font-size:.61rem!important}
  #view-fitness .performance-result-metrics strong{font-size:.9rem!important;white-space:nowrap}
  #view-fitness .performance-result-metrics strong small{font-size:.58rem!important}
  #view-fitness .performance-result-date{grid-area:date!important;margin:0 0 0 47px!important;font-size:.67rem!important;gap:.28rem!important}
  #view-fitness .performance-result-date svg{width:12px!important;height:12px!important}
  #view-fitness .performance-card-chevron{position:absolute;right:.55rem;top:50%;transform:translateY(-50%);font-size:1.5rem;line-height:1;color:#94a3b8}
  #view-fitness .performance-table-card{padding:.8rem!important}
  #view-fitness .performance-table-card>.performance-section-heading p{font-size:.76rem!important}
  #view-fitness .performance-count{font-size:.66rem!important;padding:.22rem .48rem!important}
  #view-fitness .performance-history-grid{gap:.7rem!important}
  #view-fitness .performance-chart-card,#view-fitness .performance-log-card{padding:.85rem!important}
  body.performance-detail-open{overflow:hidden!important}
  body.performance-detail-open #mobile-bottom-nav{visibility:hidden!important;pointer-events:none!important}
  .performance-player-detail-modal{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.58);display:flex;align-items:flex-end;justify-content:center;padding:0}
  .performance-player-detail-sheet{width:100%;max-height:88dvh;overflow:hidden;background:#f8fafc;border-radius:24px 24px 0 0;box-shadow:0 -20px 50px rgba(15,23,42,.18);display:flex;flex-direction:column}
  .performance-player-detail-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.05rem .85rem;background:#fff;border-bottom:1px solid #e5e7eb}
  .performance-detail-person{display:flex;align-items:center;gap:.65rem;min-width:0}
  .performance-detail-person img{width:46px;height:46px;border-radius:50%;object-fit:cover}
  .performance-detail-person span{display:grid;min-width:0}.performance-detail-person strong{font-size:1rem;color:#0f172a}.performance-detail-person small{font-size:.72rem;color:#64748b}
  .performance-detail-close{width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;color:#475569;font-size:1.45rem;line-height:1;cursor:pointer}
  .performance-detail-body{overflow:auto;padding:.9rem 1rem 1.35rem;display:flex;flex-direction:column;gap:.75rem}
  .performance-detail-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
  .performance-detail-kpis article{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:.72rem}.performance-detail-kpis small{display:block;font-size:.65rem;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:.12rem}.performance-detail-kpis strong{font-size:1.05rem;color:#0f172a}.performance-detail-kpis em{font-size:.68rem;font-style:normal;color:#64748b}
  .performance-detail-chart,.performance-detail-log{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:.78rem}.performance-detail-chart>div{display:flex;align-items:center;justify-content:space-between;gap:.6rem}.performance-detail-chart>div strong,.performance-detail-log h4{font-size:.88rem;color:#0f172a;margin:0}.performance-detail-chart>div small{font-size:.66rem;color:#94a3b8}
  .performance-detail-svg{display:block;width:100%;height:145px;margin-top:.4rem;overflow:visible}.performance-detail-svg .axis{stroke:#e2e8f0;stroke-width:1}.performance-detail-svg .trend-line{fill:none;stroke:#64748b;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.performance-detail-svg circle{fill:#fff;stroke:#64748b;stroke-width:2.4}.performance-detail-svg text{font-size:9px;fill:#94a3b8;font-family:Inter,system-ui,sans-serif}
  .performance-detail-log-row{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-bottom:1px solid #f1f5f9;font-size:.76rem}.performance-detail-log-row:last-child{border-bottom:0}.performance-detail-log-row span{color:#64748b}.performance-detail-log-row strong{color:#0f172a}.performance-detail-empty{padding:1.1rem .5rem;text-align:center;color:#94a3b8;font-size:.76rem}
}
@media(max-width:420px){
  #view-fitness .performance-test-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}
  #view-fitness .performance-test-tab[data-performance-test="Histórico"]{grid-column:1/-1}
  #view-fitness .performance-result-card.performance-mobile-player-card{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:"player" "metrics" "date"!important}
  #view-fitness .performance-result-metrics{margin:0!important;grid-template-columns:1fr 1fr!important}
  #view-fitness .performance-result-date{margin-left:0!important}
}
`;
  document.head.appendChild(style);
}
function decorate(){
  if(!isMobilePerformanceViewport())return;
  const view=document.getElementById('view-fitness');
  if(!view)return;
  ensureStyles();
  ensureSummary();
  if(currentTest()!=='Histórico')bindCards();
}
function install(attempt=0){
  if(typeof window.renderPerformanceModule!=='function'){
    if(attempt<160)setTimeout(()=>install(attempt+1),50);
    return;
  }
  ensureStyles();
  if(!window.renderPerformanceModule.__mobilePerformanceDecorated){
    const base=window.renderPerformanceModule;
    const wrapped=function(){const result=base.apply(this,arguments);requestAnimationFrame(decorate);return result;};
    wrapped.__mobilePerformanceDecorated=true;
    wrapped.__baseRenderPerformanceModule=base;
    window.renderPerformanceModule=wrapped;
  }
  const root=document.getElementById('performance-current-view');
  if(root&&root.dataset.performanceMobileObserved!=='1'){
    root.dataset.performanceMobileObserved='1';
    new MutationObserver(()=>requestAnimationFrame(decorate)).observe(root,{childList:true});
  }
  requestAnimationFrame(decorate);
}
window.addEventListener('resize',()=>{if(isMobilePerformanceViewport())requestAnimationFrame(decorate);},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePlayerPerformanceDetail();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
