(function(){
'use strict';

const FLAG='__wellnessRpeSessionDetail20260822';
if(window[FLAG])return;
window[FLAG]=true;

let baseRender=null;
let baseOpen=null;
let rendering=false;
let scheduled=false;
let observer=null;

function app(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function user(){try{return typeof getCurrentUser==='function'?getCurrentUser():null;}catch(_){return null;}}
function coach(){
  try{
    if(typeof isCoachUser==='function'&&isCoachUser())return true;
    const role=String(user()?.role||'').toLowerCase();
    return role==='coach'||role==='administrator'||role==='admin';
  }catch(_){return false;}
}
function mobileViewport(){
  try{return window.matchMedia('(max-width:760px), (max-width:1366px) and (any-pointer:coarse)').matches;}
  catch(_){return window.innerWidth<=1366;}
}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function id(value){return String(value??'');}
function rpeValue(row){
  const n=Number(row?.rpeVal??row?.score??row?.rpe??row?.value);
  return Number.isFinite(n)?Math.max(0,Math.min(10,n)):null;
}
function isTraining(event){
  try{if(typeof isTrainingEvent==='function')return isTrainingEvent(event);}catch(_){}
  const type=String(event?.type||event?.eventType||'').trim().toLowerCase();
  return type==='entrenamiento'||type==='training'||type.includes('entren');
}
function eventTime(event){
  try{if(typeof getTrainingDateTime==='function')return getTrainingDateTime(event).getTime();}catch(_){}
  const raw=String(event?.date||event?.startDate||event?.starts_at||'').slice(0,10);
  const time=String(event?.time||event?.startTime||'12:00').slice(0,5)||'12:00';
  const d=new Date(`${raw}T${time}:00`);
  return Number.isFinite(d.getTime())?d.getTime():0;
}
function isFinished(event){
  try{if(typeof isTrainingFinished==='function')return isTrainingFinished(event);}catch(_){}
  const status=String(event?.status||'').toLowerCase();
  if(['completed','finished','finalizado','done'].includes(status))return true;
  const t=eventTime(event);
  return Boolean(t&&t<Date.now());
}
function shortDate(event){
  const raw=String(event?.date||event?.startDate||event?.starts_at||'').slice(0,10);
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return raw||'Fecha pendiente';
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  return new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'}).format(d).replace(/\./g,'');
}
function longDate(event){
  const raw=String(event?.date||event?.startDate||event?.starts_at||'').slice(0,10);
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return raw||'Fecha pendiente';
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(d);
}
function players(){return (app()?.players||[]).filter(player=>player&&player.active!==false);}
function playerMap(){return new Map(players().map(player=>[id(player.id),player]));}
function recordsFor(eventId){
  const map=new Map();
  (app()?.trainingRPEs||[]).forEach((row,index)=>{
    if(id(row?.eventId??row?.event_id)!==id(eventId))return;
    const value=rpeValue(row);if(value==null)return;
    const playerId=id(row?.playerId??row?.player_id);
    if(!playerId)return;
    const stamp=Date.parse(row?.updated_at||row?.updatedAt||row?.created_at||row?.createdAt||row?.date||'')||index;
    const previous=map.get(playerId);
    if(!previous||stamp>=previous._stamp)map.set(playerId,{...row,playerId,rpeVal:value,_stamp:stamp});
  });
  return [...map.values()];
}
function attendanceFor(eventId){
  const st=app();
  const rows=[...(st?.attendanceData||[]),...(st?.attendance||[])];
  const seen=new Set();
  return rows.filter(row=>{
    if(id(row?.eventId??row?.event_id)!==id(eventId))return false;
    const key=`${id(row?.playerId??row?.player_id)}:${String(row?.status||'').toLowerCase()}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}
function expectedContext(eventId,records){
  const roster=players();
  const attendance=attendanceFor(eventId);
  const presentIds=new Set(attendance.filter(row=>['present','attended'].includes(String(row?.status||'').toLowerCase())).map(row=>id(row?.playerId??row?.player_id)).filter(Boolean));
  let expected=presentIds.size?roster.filter(player=>presentIds.has(id(player.id))):roster.slice();
  const source=presentIds.size?'attendance':'roster';
  const rosterIds=new Set(expected.map(player=>id(player.id)));
  records.forEach(row=>{
    if(rosterIds.has(row.playerId))return;
    const player=roster.find(item=>id(item.id)===row.playerId);
    if(player){expected.push(player);rosterIds.add(row.playerId);}
  });
  return{players:expected,source};
}
function descriptor(value){
  if(value==null)return{label:'Sin datos',tone:'neutral'};
  if(value<=2)return{label:'Muy suave',tone:'soft'};
  if(value<=4)return{label:'Suave',tone:'light'};
  if(value<=6)return{label:'Moderado',tone:'moderate'};
  if(value<=8)return{label:'Intenso',tone:'intense'};
  return{label:'Máximo',tone:'max'};
}
function sessionSummary(event){
  const records=recordsFor(event.id);
  const values=records.map(row=>row.rpeVal).filter(Number.isFinite);
  const average=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  const expected=expectedContext(event.id,records);
  const answered=new Set(records.map(row=>row.playerId));
  const pending=expected.players.filter(player=>!answered.has(id(player.id)));
  return{event,records,average,expected:expected.players,pending,source:expected.source};
}
function latestSessions(){
  const st=app();if(!st)return[];
  return (st.events||[])
    .filter(isTraining)
    .map(event=>({event,hasRpe:recordsFor(event.id).length>0}))
    .filter(item=>isFinished(item.event)||item.hasRpe)
    .sort((a,b)=>eventTime(b.event)-eventTime(a.event))
    .slice(0,18)
    .map(item=>item.event);
}
function sourceLabel(source){return source==='attendance'?'asistencia validada':'plantilla';}
function ensureStyles(){
  if(document.getElementById('wellness-rpe-session-detail-20260822-style'))return;
  const style=document.createElement('style');
  style.id='wellness-rpe-session-detail-20260822-style';
  style.textContent=`
  @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
    #view-wellness .wellness-rpe-session-grid{display:grid!important;grid-template-columns:1fr!important;gap:.5rem!important;margin-top:.65rem!important}
    #view-wellness .wellness-rpe-session-card{width:100%!important;min-width:0!important;padding:.72rem!important;display:block!important;text-align:left!important;border:1px solid #e4e8ed!important;border-radius:15px!important;background:#fbfcfd!important;color:#253044!important;box-shadow:none!important;cursor:pointer!important}
    #view-wellness .wellness-rpe-session-card:active{transform:scale(.995)}
    #view-wellness .wellness-rpe-session-top{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:.6rem!important}
    #view-wellness .wellness-rpe-session-title{min-width:0!important}.wellness-rpe-session-title span{display:block!important;color:#8a96a5!important;font-size:.56rem!important;font-weight:800!important;text-transform:capitalize!important}.wellness-rpe-session-title strong{display:block!important;margin:.16rem 0 0!important;color:#253044!important;font-size:.78rem!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #view-wellness .wellness-rpe-score{flex:0 0 auto!important;padding:.3rem .46rem!important;border-radius:10px!important;background:#f1f5f9!important;color:#64748b!important;font-size:.62rem!important;font-weight:900!important;white-space:nowrap!important}.wellness-rpe-score.soft{background:#ecfdf5!important;color:#047857!important}.wellness-rpe-score.light{background:#eff6ff!important;color:#2563eb!important}.wellness-rpe-score.moderate{background:#fffbeb!important;color:#a16207!important}.wellness-rpe-score.intense{background:#fff7ed!important;color:#c2410c!important}.wellness-rpe-score.max{background:#fff1f2!important;color:#be123c!important}
    #view-wellness .wellness-rpe-session-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.38rem!important;margin:.58rem 0 .5rem!important}.wellness-rpe-session-metric{min-width:0!important;padding:.48rem .45rem!important;border:1px solid #edf0f3!important;border-radius:11px!important;background:#fff!important}.wellness-rpe-session-metric small{display:block!important;color:#95a0ae!important;font-size:.5rem!important;font-weight:850!important;text-transform:uppercase!important;letter-spacing:.035em!important}.wellness-rpe-session-metric strong{display:block!important;margin-top:.12rem!important;color:#2a3547!important;font-size:.72rem!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.wellness-rpe-session-metric.pending strong{color:#b45309!important}.wellness-rpe-session-metric.complete strong{color:#047857!important}
    #view-wellness .wellness-rpe-session-foot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:.45rem!important;color:#8995a4!important;font-size:.54rem!important}.wellness-rpe-session-foot-left{min-width:0!important;display:flex!important;align-items:center!important;gap:.32rem!important;overflow:hidden!important}.wellness-rpe-status{flex:0 0 auto!important;padding:.24rem .38rem!important;border-radius:999px!important;background:#f1f5f9!important;color:#64748b!important;font-weight:850!important}.wellness-rpe-status.complete{background:#ecfdf5!important;color:#047857!important}.wellness-rpe-status.pending{background:#fff7ed!important;color:#b45309!important}.wellness-rpe-status.empty{background:#f8fafc!important;color:#94a3b8!important}.wellness-rpe-source{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.wellness-rpe-session-foot svg{width:14px!important;height:14px!important;flex:0 0 auto!important}
    #view-wellness .wellness-rpe-empty{margin:.65rem 0 0!important;padding:.8rem!important;border:1px dashed #dfe5eb!important;border-radius:13px!important;background:#fbfcfd!important;color:#8290a1!important;font-size:.65rem!important;text-align:center!important}
  }
  @media(min-width:761px) and (max-width:1366px) and (any-pointer:coarse){#view-wellness .wellness-rpe-session-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}

  .wellness-rpe-detail-modal{z-index:10050!important;padding:1rem!important;align-items:flex-end!important}.wellness-rpe-detail-modal .modal-content{width:min(100%,620px)!important;max-height:min(82vh,720px)!important;margin:0 auto!important;border-radius:22px 22px 18px 18px!important;overflow:hidden!important;background:#fff!important}.wellness-rpe-detail-modal .modal-header{padding:.9rem 1rem!important;align-items:flex-start!important}.wellness-rpe-detail-modal .modal-header h3{margin:0!important;color:#202b3d!important;font-size:1.05rem!important}.wellness-rpe-detail-modal .modal-header small{display:block!important;margin-top:.2rem!important;color:#7f8b9a!important;font-size:.62rem!important;line-height:1.35!important}.wellness-rpe-detail-modal .modal-body{padding:.9rem 1rem 1.1rem!important;overflow-y:auto!important}.wellness-rpe-modal-summary{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.45rem!important;margin-bottom:.8rem!important}.wellness-rpe-modal-kpi{padding:.62rem .55rem!important;border:1px solid #e7ebef!important;border-radius:13px!important;background:#fbfcfd!important;text-align:center!important}.wellness-rpe-modal-kpi small{display:block!important;color:#909cab!important;font-size:.52rem!important;font-weight:850!important;text-transform:uppercase!important}.wellness-rpe-modal-kpi strong{display:block!important;margin-top:.18rem!important;color:#253044!important;font-size:.88rem!important}.wellness-rpe-modal-kpi.pending strong{color:#b45309!important}.wellness-rpe-modal-section{margin-top:.8rem!important}.wellness-rpe-modal-section h4{margin:0 0 .45rem!important;color:#344054!important;font-size:.72rem!important}.wellness-rpe-answer-list{display:grid!important;gap:.35rem!important}.wellness-rpe-answer-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:.6rem!important;padding:.58rem .62rem!important;border:1px solid #edf0f3!important;border-radius:11px!important;background:#fff!important}.wellness-rpe-answer-player{min-width:0!important}.wellness-rpe-answer-player strong{display:block!important;color:#334155!important;font-size:.67rem!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.wellness-rpe-answer-player small{display:block!important;margin-top:.12rem!important;color:#94a3b8!important;font-size:.54rem!important}.wellness-rpe-answer-value{flex:0 0 auto!important;min-width:54px!important;padding:.3rem .42rem!important;border-radius:9px!important;text-align:center!important;background:#f1f5f9!important;color:#475569!important;font-size:.68rem!important;font-weight:900!important}.wellness-rpe-answer-value.soft{background:#ecfdf5!important;color:#047857!important}.wellness-rpe-answer-value.light{background:#eff6ff!important;color:#2563eb!important}.wellness-rpe-answer-value.moderate{background:#fffbeb!important;color:#a16207!important}.wellness-rpe-answer-value.intense{background:#fff7ed!important;color:#c2410c!important}.wellness-rpe-answer-value.max{background:#fff1f2!important;color:#be123c!important}.wellness-rpe-pending-list{display:flex!important;flex-wrap:wrap!important;gap:.35rem!important}.wellness-rpe-pending-chip{padding:.3rem .44rem!important;border:1px solid #fed7aa!important;border-radius:999px!important;background:#fff7ed!important;color:#9a3412!important;font-size:.56rem!important;font-weight:750!important}.wellness-rpe-complete-note{padding:.58rem .65rem!important;border:1px solid #bbf7d0!important;border-radius:11px!important;background:#f0fdf4!important;color:#166534!important;font-size:.6rem!important;font-weight:750!important}.wellness-rpe-basis{margin:.55rem 0 0!important;color:#94a3b8!important;font-size:.52rem!important;line-height:1.4!important}.wellness-rpe-no-answers{padding:.7rem!important;border:1px dashed #dfe5eb!important;border-radius:11px!important;color:#8794a4!important;font-size:.62rem!important;text-align:center!important}
  `;
  document.head.appendChild(style);
}
function updateHeading(){
  const section=document.getElementById('rpe-team-summary-section');if(!section)return;
  const copy=section.querySelector('.wellness-rpe-head p')||section.querySelector(':scope > p');
  if(copy)copy.textContent='Media, respuestas y pendientes de cada sesión. Pulsa una tarjeta para ver el detalle.';
}
function renderEnhanced(){
  if(!mobileViewport()||!coach())return false;
  const section=document.getElementById('rpe-team-summary-section');
  const grid=document.getElementById('rpe-team-summary-grid');
  if(!section||!grid)return false;
  rendering=true;
  try{
    ensureStyles();
    updateHeading();
    section.style.display='block';
    grid.classList.add('wellness-rpe-session-grid');
    const sessions=latestSessions();
    if(!sessions.length){grid.innerHTML='<div class="wellness-rpe-empty">Todavía no hay entrenamientos finalizados con RPE disponible.</div>';return true;}
    grid.innerHTML=sessions.map(event=>{
      const summary=sessionSummary(event);
      const d=descriptor(summary.average);
      const responded=summary.records.length;
      const expected=summary.expected.length;
      const pending=summary.pending.length;
      const status=!responded?['Sin respuestas','empty']:pending?[(pending===1?'1 por responder':`${pending} por responder`),'pending']:['Completo','complete'];
      return `<button type="button" class="wellness-rpe-session-card" data-rpe-event-id="${esc(event.id)}"><div class="wellness-rpe-session-top"><div class="wellness-rpe-session-title"><span>${esc(shortDate(event))}${event.time?` · ${esc(event.time)}`:''}</span><strong>${esc(event.title||'Entrenamiento')}</strong></div><span class="wellness-rpe-score ${d.tone}">${summary.average==null?'RPE —':`RPE ${summary.average.toFixed(1)}`}</span></div><div class="wellness-rpe-session-metrics"><div class="wellness-rpe-session-metric"><small>Media</small><strong>${summary.average==null?'—':`${summary.average.toFixed(1)}/10`}</strong></div><div class="wellness-rpe-session-metric"><small>Respuestas</small><strong>${responded}/${expected||responded||0}</strong></div><div class="wellness-rpe-session-metric ${pending?'pending':'complete'}"><small>Pendientes</small><strong>${pending}</strong></div></div><div class="wellness-rpe-session-foot"><div class="wellness-rpe-session-foot-left"><span class="wellness-rpe-status ${status[1]}">${status[0]}</span><span class="wellness-rpe-source">sobre ${sourceLabel(summary.source)}</span></div><i data-lucide="chevron-right"></i></div></button>`;
    }).join('');
    grid.querySelectorAll('[data-rpe-event-id]').forEach(button=>button.addEventListener('click',()=>openEnhanced(button.dataset.rpeEventId)));
    try{window.lucide?.createIcons?.();}catch(_){}
    return true;
  }finally{rendering=false;}
}
function closeModal(modal){
  if(!modal)return;
  modal.remove();
  if(!document.querySelector('.modal-backdrop.active'))document.body.classList.remove('modal-open');
}
function openEnhanced(eventId){
  if(!mobileViewport()||!coach()){if(typeof baseOpen==='function')return baseOpen(eventId);return;}
  const event=(app()?.events||[]).find(item=>id(item.id)===id(eventId));if(!event)return;
  const summary=sessionSummary(event);
  const pMap=playerMap();
  const answered=summary.records.slice().sort((a,b)=>b.rpeVal-a.rpeVal).map(row=>{
    const player=pMap.get(row.playerId);
    const d=descriptor(row.rpeVal);
    const dorsal=player?.number!=null?` · #${esc(player.number)}`:'';
    return `<div class="wellness-rpe-answer-row"><div class="wellness-rpe-answer-player"><strong>${esc(player?.name||row.playerName||'Jugadora')}</strong><small>${esc(d.label)}${dorsal}</small></div><span class="wellness-rpe-answer-value ${d.tone}">${row.rpeVal.toFixed(Number.isInteger(row.rpeVal)?0:1)}/10</span></div>`;
  }).join('')||'<div class="wellness-rpe-no-answers">Ninguna jugadora ha enviado todavía su RPE.</div>';
  const pending=summary.pending.length?`<div class="wellness-rpe-pending-list">${summary.pending.map(player=>`<span class="wellness-rpe-pending-chip">${esc(player.name||'Jugadora')}</span>`).join('')}</div>`:'<div class="wellness-rpe-complete-note">Todas las jugadoras esperadas han respondido.</div>';
  document.querySelectorAll('.wellness-rpe-detail-modal').forEach(node=>node.remove());
  const modal=document.createElement('div');
  modal.className='modal-backdrop active rpe-responses-modal wellness-rpe-detail-modal';
  modal.innerHTML=`<div class="modal-content"><div class="modal-header"><div><h3>${esc(event.title||'Entrenamiento')}</h3><small>${esc(longDate(event))}${event.time?` · ${esc(event.time)}`:''}</small></div><button class="modal-close" type="button" aria-label="Cerrar">&times;</button></div><div class="modal-body"><div class="wellness-rpe-modal-summary"><div class="wellness-rpe-modal-kpi"><small>RPE medio</small><strong>${summary.average==null?'—':summary.average.toFixed(1)}</strong></div><div class="wellness-rpe-modal-kpi"><small>Respuestas</small><strong>${summary.records.length}/${summary.expected.length||summary.records.length||0}</strong></div><div class="wellness-rpe-modal-kpi pending"><small>Pendientes</small><strong>${summary.pending.length}</strong></div></div><section class="wellness-rpe-modal-section"><h4>Respuestas individuales</h4><div class="wellness-rpe-answer-list">${answered}</div></section><section class="wellness-rpe-modal-section"><h4>${summary.pending.length?'Pendientes de responder':'Respuestas completas'}</h4>${pending}<p class="wellness-rpe-basis">Pendientes calculados sobre ${summary.source==='attendance'?'las jugadoras con asistencia validada':'la plantilla, al no haber una lista de asistencia validada para esta sesión'}.</p></section></div></div>`;
  modal.querySelector('.modal-close')?.addEventListener('click',()=>closeModal(modal));
  modal.addEventListener('click',eventClick=>{if(eventClick.target===modal)closeModal(modal);});
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
}
function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;if(!rendering&&document.getElementById('view-wellness')?.classList.contains('active'))renderEnhanced();});
}
function observe(){
  const grid=document.getElementById('rpe-team-summary-grid');if(!grid||observer)return;
  observer=new MutationObserver(()=>{
    if(rendering||!mobileViewport()||!coach())return;
    const hasEnhanced=Boolean(grid.querySelector('.wellness-rpe-session-card,.wellness-rpe-empty'));
    if(!hasEnhanced)schedule();
  });
  observer.observe(grid,{childList:true,subtree:false});
}
function install(attempt=0){
  ensureStyles();
  if(typeof window.renderTeamRpeSummary!=='function'||typeof window.openRpeResponsesModal!=='function'){
    if(attempt<120)setTimeout(()=>install(attempt+1),50);
    return;
  }
  if(!baseRender)baseRender=window.renderTeamRpeSummary;
  if(!baseOpen)baseOpen=window.openRpeResponsesModal;
  const renderWrapper=function(){if(mobileViewport()&&coach())return renderEnhanced();return baseRender.apply(this,arguments);};
  renderWrapper.__wellnessRpeSessionDetail=true;
  const openWrapper=function(eventId){if(mobileViewport()&&coach())return openEnhanced(eventId);return baseOpen.apply(this,arguments);};
  openWrapper.__wellnessRpeSessionDetail=true;
  window.renderTeamRpeSummary=renderWrapper;
  window.openRpeResponsesModal=openWrapper;
  observe();
  if(document.getElementById('view-wellness')?.classList.contains('active'))schedule();
}

window.addEventListener('resize',()=>{if(mobileViewport()&&coach())schedule();},{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
