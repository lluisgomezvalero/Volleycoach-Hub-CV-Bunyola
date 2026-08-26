(function(){
'use strict';

const FLAG='__teamAttendanceOverview20260812';
let installed=false;
let attendanceMode='summary';
let attendanceSort='attendance';
let loadingAttendance=false;

function isCoach(){
  try{return typeof window.isCoachUser==='function'&&window.isCoachUser();}catch(_){return false;}
}
function st(){return typeof appState!=='undefined'?appState:null;}
function esc(value){
  if(typeof window.escapeSessionText==='function') return window.escapeSessionText(String(value??''));
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function ids(value,keys){return keys.map(key=>value?.[key]).filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(String);}
function sharesId(a,b){return a.some(id=>b.includes(id));}
function matchesEvent(row,event){
  return sharesId(ids(row,['eventId','eventIdLegacy','supabaseEventId','event_id']),ids(event,['id','legacy_id','legacyId','supabaseId','supabase_id']));
}
function matchesPlayer(row,player){
  return sharesId(ids(row,['playerId','playerIdLegacy','supabasePlayerId','player_id']),ids(player,['id','legacy_id','legacyId','supabaseId','supabase_id','profile_id','authId']));
}
function eventStart(event){
  try{if(typeof window.getTrainingDateTime==='function') return window.getTrainingDateTime(event);}catch(_){}
  const date=String(event?.date||'');
  const time=String(event?.time||'00:00').split('-')[0].trim()||'00:00';
  const parsed=new Date(`${date}T${time.length===5?time+':00':time}`);
  return Number.isNaN(parsed.getTime())?new Date(0):parsed;
}
function isEligibleSession(event){
  return event&&event.type==='Entrenamiento'&&eventStart(event).getTime()<=Date.now();
}
function normalizeStatus(status){
  const value=String(status||'').toLowerCase();
  if(['present','attended'].includes(value)) return 'present';
  if(value==='late') return 'late';
  if(value==='justified') return 'justified';
  if(['unjustified','absent','missed'].includes(value)) return 'unjustified';
  return null;
}
function statusMeta(status){
  return {
    present:{label:'Presente',short:'P',icon:'check',tone:'present'},
    late:{label:'Tarde',short:'T',icon:'clock-3',tone:'late'},
    justified:{label:'Justificada',short:'J',icon:'minus',tone:'justified'},
    unjustified:{label:'No justificada',short:'X',icon:'x',tone:'unjustified'}
  }[status]||{label:'Sin validar',short:'—',icon:'minus',tone:'empty'};
}
function getOfficialRecord(event,player,rows){
  const candidates=rows.filter(row=>matchesEvent(row,event)&&matchesPlayer(row,player)&&normalizeStatus(row.status));
  if(!candidates.length) return null;
  candidates.sort((a,b)=>new Date(b.validatedAt||b.updatedAt||b.timestamp||0)-new Date(a.validatedAt||a.updatedAt||a.timestamp||0));
  return candidates[0];
}
function buildAttendanceModel(){
  const state=st();
  const players=(state?.players||[]).filter(player=>player.active!==false);
  const rows=(state?.attendanceData||[]).filter(row=>normalizeStatus(row.status));
  const sessions=(state?.events||[]).filter(isEligibleSession).filter(event=>players.some(player=>getOfficialRecord(event,player,rows))).sort((a,b)=>eventStart(a)-eventStart(b));
  const totals={present:0,late:0,justified:0,unjustified:0};
  const playerRows=players.map(player=>{
    const counts={present:0,late:0,justified:0,unjustified:0};
    const bySession=new Map();
    sessions.forEach(event=>{
      const row=getOfficialRecord(event,player,rows);
      const status=normalizeStatus(row?.status);
      if(status){counts[status]++;bySession.set(event.id,status);}else bySession.set(event.id,null);
    });
    Object.keys(totals).forEach(key=>{totals[key]+=counts[key];});
    const total=counts.present+counts.late+counts.justified+counts.unjustified;
    const attended=counts.present+counts.late;
    const pct=total?Math.round(attended*100/total):null;
    return {player,counts,total,attended,pct,bySession};
  });
  const totalRecords=totals.present+totals.late+totals.justified+totals.unjustified;
  const teamPct=totalRecords?Math.round((totals.present+totals.late)*100/totalRecords):null;
  return {players:playerRows,sessions,totals,totalRecords,teamPct};
}
function sortPlayerRows(rows){
  const copy=[...rows];
  if(attendanceSort==='name') return copy.sort((a,b)=>String(a.player.name||'').localeCompare(String(b.player.name||''),'es'));
  if(attendanceSort==='absences') return copy.sort((a,b)=>(b.counts.justified+b.counts.unjustified)-(a.counts.justified+a.counts.unjustified)||String(a.player.name||'').localeCompare(String(b.player.name||''),'es'));
  if(attendanceSort==='late') return copy.sort((a,b)=>b.counts.late-a.counts.late||String(a.player.name||'').localeCompare(String(b.player.name||''),'es'));
  return copy.sort((a,b)=>(b.pct??-1)-(a.pct??-1)||String(a.player.name||'').localeCompare(String(b.player.name||''),'es'));
}
function pctTone(pct){
  if(pct===null) return 'empty';
  if(pct>=90) return 'high';
  if(pct>=80) return 'medium';
  return 'low';
}
function ring(pct,size='large'){
  const safe=pct===null?0:Math.max(0,Math.min(100,pct));
  return `<div class="team-attendance-ring ${size} tone-${pctTone(pct)}" style="--attendance-pct:${safe}" aria-label="${pct===null?'Sin datos':pct+'% de asistencia'}"><div><strong>${pct===null?'—':pct+'%'}</strong>${size==='large'?'<small>asistencia</small>':''}</div></div>`;
}
function legend(){
  return `<div class="team-attendance-legend"><span class="tone-present"><i data-lucide="check"></i> Presente</span><span class="tone-late"><i data-lucide="clock-3"></i> Tarde</span><span class="tone-justified"><i data-lucide="minus"></i> Justificada</span><span class="tone-unjustified"><i data-lucide="x"></i> No justificada</span></div>`;
}
function renderSummary(model){
  const rows=sortPlayerRows(model.players);
  const playerList=rows.length?rows.map(item=>{
    const p=item.player;
    return `<button type="button" class="team-attendance-player-row" onclick="openPlayerDetail('${esc(p.id)}')">
      <span class="team-attendance-player-main"><span class="team-attendance-avatar">${p.avatar?`<img src="${esc(p.avatar)}" alt="">`:`<b>${esc(String(p.name||'?').trim().charAt(0).toUpperCase())}</b>`}</span><span><strong>${esc(p.name||'Jugadora')}</strong><small>#${esc(p.number??p.dorsal??'—')} · ${esc(p.position||'')}</small></span></span>
      <span class="team-attendance-breakdown"><span class="tone-present"><b>${item.counts.present}</b><small>presentes</small></span><span class="tone-late"><b>${item.counts.late}</b><small>tarde</small></span><span class="tone-justified"><b>${item.counts.justified}</b><small>justif.</small></span><span class="tone-unjustified"><b>${item.counts.unjustified}</b><small>no justif.</small></span></span>
      ${ring(item.pct,'small')}
      <i data-lucide="chevron-right" class="team-attendance-row-arrow"></i>
    </button>`;
  }).join(''):`<div class="team-attendance-empty"><i data-lucide="users"></i><p>No hay jugadoras en la plantilla.</p></div>`;
  return `<div class="team-attendance-summary-grid">
      <article class="team-attendance-overall-card">${ring(model.teamPct)}<div class="team-attendance-overall-copy"><span>Asistencia del equipo</span><strong>${model.sessions.length} sesión${model.sessions.length===1?'':'es'} con lista oficial</strong><p>Presentes y llegadas tarde computan como asistencia. Solo se usan listas oficiales de sesiones ya iniciadas.</p></div></article>
      <article class="team-attendance-status-card"><div class="team-attendance-status-item tone-present"><i data-lucide="check-circle-2"></i><span><strong>${model.totals.present}</strong><small>Presentes</small></span></div><div class="team-attendance-status-item tone-late"><i data-lucide="clock-3"></i><span><strong>${model.totals.late}</strong><small>Retrasos</small></span></div><div class="team-attendance-status-item tone-justified"><i data-lucide="circle-minus"></i><span><strong>${model.totals.justified}</strong><small>Justificadas</small></span></div><div class="team-attendance-status-item tone-unjustified"><i data-lucide="circle-x"></i><span><strong>${model.totals.unjustified}</strong><small>No justificadas</small></span></div></article>
    </div>
    <div class="team-attendance-list-head"><div><span>Jugadoras</span><strong>Asistencia acumulada</strong></div><label>Ordenar <select onchange="setTeamAttendanceSort(this.value)"><option value="attendance" ${attendanceSort==='attendance'?'selected':''}>Asistencia</option><option value="name" ${attendanceSort==='name'?'selected':''}>Nombre</option><option value="absences" ${attendanceSort==='absences'?'selected':''}>Más ausencias</option><option value="late" ${attendanceSort==='late'?'selected':''}>Más retrasos</option></select></label></div>
    <div class="team-attendance-player-list">${playerList}</div>`;
}
function formatSessionHead(event){
  const start=eventStart(event);
  if(Number.isNaN(start.getTime())) return {day:'—',date:esc(event.date||'')};
  return {day:start.toLocaleDateString('es-ES',{weekday:'short'}).replace('.','').toUpperCase(),date:start.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'})};
}
function renderMatrix(model){
  if(!model.sessions.length) return `<div class="team-attendance-empty large"><i data-lucide="clipboard-x"></i><h3>Aún no hay listas oficiales</h3><p>Cuando valides la asistencia de una sesión, aparecerá aquí.</p></div>`;
  const rows=sortPlayerRows(model.players);
  const heads=model.sessions.map(event=>{const d=formatSessionHead(event);return `<th title="${esc(event.title||'Entrenamiento')}"><span>${d.day}</span><strong>${d.date}</strong></th>`;}).join('');
  const body=rows.map(item=>`<tr><th><button type="button" onclick="openPlayerDetail('${esc(item.player.id)}')"><strong>${esc(item.player.name||'Jugadora')}</strong><small>${item.pct===null?'Sin datos':item.pct+'%'}</small></button></th>${model.sessions.map(event=>{const status=item.bySession.get(event.id);const meta=statusMeta(status);return `<td><span class="attendance-matrix-status tone-${meta.tone}" title="${meta.label}">${meta.short}</span></td>`;}).join('')}</tr>`).join('');
  return `${legend()}<div class="team-attendance-matrix-scroll"><table class="team-attendance-matrix"><thead><tr><th>Jugadora</th>${heads}</tr></thead><tbody>${body}</tbody></table></div><p class="team-attendance-matrix-note">Desliza horizontalmente para consultar todas las sesiones. “—” indica que esa jugadora no tiene un estado oficial registrado en esa sesión.</p>`;
}
function renderTeamAttendance(){
  const container=document.getElementById('training-list-container');
  if(!container) return;
  if(!isCoach()){
    if(typeof currentTrainingView!=='undefined') currentTrainingView='next';
    return baseRenderTraining?.();
  }
  const model=buildAttendanceModel();
  container.hidden=false;
  const perf=document.getElementById('training-performance-panel');if(perf&&perf.closest('#view-training')) perf.hidden=true;
  const newBtn=document.getElementById('btn-add-training-session');if(newBtn) newBtn.style.visibility='hidden';
  container.innerHTML=`<section class="team-attendance-overview"><div class="team-attendance-header"><div><span class="team-attendance-kicker"><i data-lucide="users-round"></i> Seguimiento del equipo</span><h2>Asistencia</h2><p>Histórico basado únicamente en asistencia oficial validada.</p></div><div class="team-attendance-view-toggle"><button type="button" class="${attendanceMode==='summary'?'active':''}" onclick="setTeamAttendanceMode('summary')"><i data-lucide="list"></i> Resumen</button><button type="button" class="${attendanceMode==='sessions'?'active':''}" onclick="setTeamAttendanceMode('sessions')"><i data-lucide="table-2"></i> Por sesiones</button></div></div>${attendanceMode==='sessions'?renderMatrix(model):renderSummary(model)}</section>`;
  try{window.lucide?.createIcons?.();}catch(_){}
}
function restoreTrainingButton(){const btn=document.getElementById('btn-add-training-session');if(btn)btn.style.removeProperty('visibility');}
function ensureTab(){
  const tabs=document.querySelector('#view-training .training-tabs');
  if(!tabs) return;
  let button=tabs.querySelector('[data-training-tab="attendance"]');
  if(!isCoach()){
    button?.remove();
    if(typeof currentTrainingView!=='undefined'&&currentTrainingView==='attendance') currentTrainingView='next';
    return;
  }
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='training-tab team-attendance-tab';
    button.dataset.trainingTab='attendance';
    button.innerHTML='<i data-lucide="users-round"></i> Asistencia del equipo';
    button.onclick=()=>window.setTrainingView('attendance');
    tabs.appendChild(button);
    try{window.lucide?.createIcons?.();}catch(_){}
  }
}
function injectCss(){
  if(document.getElementById('team-attendance-overview-css')) return;
  const style=document.createElement('style');
  style.id='team-attendance-overview-css';
  style.textContent=`
.team-attendance-overview{display:flex;flex-direction:column;gap:1rem}.team-attendance-header{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap}.team-attendance-header h2{margin:.2rem 0 0;font-size:1.55rem;color:#0f172a}.team-attendance-header p{margin:.25rem 0 0;color:#64748b;font-size:.86rem}.team-attendance-kicker{display:inline-flex;align-items:center;gap:.4rem;color:#9a3412;font-size:.72rem;font-weight:850;text-transform:uppercase;letter-spacing:.055em}.team-attendance-kicker svg{width:16px;height:16px}.team-attendance-view-toggle{display:flex;padding:.25rem;border-radius:13px;background:#e2e8f0;gap:.2rem}.team-attendance-view-toggle button{border:0;background:transparent;color:#64748b;border-radius:10px;padding:.55rem .75rem;display:flex;align-items:center;gap:.35rem;font-size:.78rem;font-weight:800;cursor:pointer}.team-attendance-view-toggle button svg{width:16px;height:16px}.team-attendance-view-toggle button.active{background:#fff;color:#9a3412;box-shadow:0 2px 8px rgba(15,23,42,.08)}
.team-attendance-summary-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:1rem}.team-attendance-overall-card,.team-attendance-status-card{background:rgba(255,255,255,.95);border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 10px 28px rgba(15,23,42,.06)}.team-attendance-overall-card{padding:1.15rem;display:flex;align-items:center;gap:1.15rem}.team-attendance-overall-copy{display:flex;flex-direction:column;gap:.25rem}.team-attendance-overall-copy>span{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;font-weight:850;color:#64748b}.team-attendance-overall-copy>strong{font-size:1rem;color:#0f172a}.team-attendance-overall-copy p{margin:0;color:#64748b;font-size:.78rem;line-height:1.45}.team-attendance-status-card{padding:.85rem;display:grid;grid-template-columns:repeat(2,1fr);gap:.55rem}.team-attendance-status-item{border-radius:14px;padding:.65rem .7rem;display:flex;align-items:center;gap:.55rem}.team-attendance-status-item>svg{width:19px;height:19px;flex:0 0 auto}.team-attendance-status-item span{display:flex;flex-direction:column}.team-attendance-status-item strong{font-size:1.05rem;line-height:1}.team-attendance-status-item small{font-size:.68rem;font-weight:750;margin-top:.18rem}.tone-present{color:#047857}.team-attendance-status-item.tone-present{background:#ecfdf5}.tone-late{color:#b45309}.team-attendance-status-item.tone-late{background:#fffbeb}.tone-justified{color:#64748b}.team-attendance-status-item.tone-justified{background:#f1f5f9}.tone-unjustified{color:#b91c1c}.team-attendance-status-item.tone-unjustified{background:#fef2f2}
.team-attendance-ring{--ring-color:#10b981;position:relative;border-radius:50%;background:conic-gradient(var(--ring-color) calc(var(--attendance-pct)*1%),#e2e8f0 0);display:grid;place-items:center;flex:0 0 auto}.team-attendance-ring::before{content:"";position:absolute;border-radius:50%;background:#fff}.team-attendance-ring>div{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}.team-attendance-ring.large{width:108px;height:108px}.team-attendance-ring.large::before{inset:10px}.team-attendance-ring.large strong{font-size:1.35rem;color:#0f172a}.team-attendance-ring.large small{font-size:.62rem;color:#64748b;font-weight:750}.team-attendance-ring.small{width:54px;height:54px}.team-attendance-ring.small::before{inset:6px}.team-attendance-ring.small strong{font-size:.78rem;color:#0f172a}.team-attendance-ring.tone-high{--ring-color:#10b981}.team-attendance-ring.tone-medium{--ring-color:#f59e0b}.team-attendance-ring.tone-low{--ring-color:#ef4444}.team-attendance-ring.tone-empty{--ring-color:#cbd5e1}
.team-attendance-list-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-top:.25rem}.team-attendance-list-head>div{display:flex;flex-direction:column}.team-attendance-list-head>div span{font-size:.7rem;color:#64748b;text-transform:uppercase;font-weight:800}.team-attendance-list-head>div strong{font-size:1rem;color:#0f172a}.team-attendance-list-head label{display:flex;align-items:center;gap:.4rem;color:#64748b;font-size:.72rem;font-weight:750}.team-attendance-list-head select{border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:.38rem .55rem;color:#334155;font-size:.75rem;font-weight:700}.team-attendance-player-list{display:flex;flex-direction:column;gap:.55rem}.team-attendance-player-row{width:100%;border:1px solid #e2e8f0;background:rgba(255,255,255,.96);border-radius:16px;padding:.7rem .8rem;display:grid;grid-template-columns:minmax(190px,1.35fr) minmax(250px,1fr) 54px 18px;align-items:center;gap:.8rem;text-align:left;color:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(15,23,42,.035)}.team-attendance-player-row:hover{border-color:#fdba74;box-shadow:0 7px 20px rgba(15,23,42,.07)}.team-attendance-player-main{display:flex;align-items:center;gap:.65rem;min-width:0}.team-attendance-player-main>span:last-child{display:flex;flex-direction:column;min-width:0}.team-attendance-player-main strong{color:#0f172a;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.team-attendance-player-main small{color:#64748b;font-size:.7rem;margin-top:.1rem}.team-attendance-avatar{width:38px;height:38px;border-radius:12px;background:#fff7ed;color:#9a3412;display:grid;place-items:center;overflow:hidden;flex:0 0 auto}.team-attendance-avatar img{width:100%;height:100%;object-fit:cover}.team-attendance-breakdown{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem}.team-attendance-breakdown>span{border-radius:10px;padding:.38rem .28rem;text-align:center;background:#f8fafc;display:flex;flex-direction:column}.team-attendance-breakdown b{font-size:.82rem}.team-attendance-breakdown small{font-size:.58rem;font-weight:750}.team-attendance-row-arrow{width:16px;height:16px;color:#94a3b8}.team-attendance-empty{padding:2rem;text-align:center;border:1px dashed #cbd5e1;border-radius:16px;background:rgba(248,250,252,.85);color:#64748b}.team-attendance-empty.large{padding:3rem 1rem}.team-attendance-empty svg{width:28px;height:28px}.team-attendance-empty h3{color:#334155;margin:.5rem 0 .2rem}.team-attendance-empty p{margin:.25rem 0}
.team-attendance-legend{display:flex;gap:.5rem;flex-wrap:wrap}.team-attendance-legend span{display:inline-flex;align-items:center;gap:.3rem;padding:.38rem .55rem;border:1px solid #e2e8f0;background:#fff;border-radius:999px;font-size:.68rem;font-weight:750}.team-attendance-legend svg{width:14px;height:14px}.team-attendance-matrix-scroll{overflow:auto;border:1px solid #e2e8f0;border-radius:16px;background:#fff;max-width:100%;box-shadow:0 6px 20px rgba(15,23,42,.04)}.team-attendance-matrix{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:.74rem}.team-attendance-matrix th,.team-attendance-matrix td{padding:.55rem;border-bottom:1px solid #f1f5f9;text-align:center;min-width:62px}.team-attendance-matrix thead th{position:sticky;top:0;background:#f8fafc;z-index:2;color:#64748b}.team-attendance-matrix thead th>span,.team-attendance-matrix thead th>strong{display:block}.team-attendance-matrix thead th>span{font-size:.58rem}.team-attendance-matrix thead th>strong{font-size:.68rem;color:#334155}.team-attendance-matrix th:first-child{position:sticky;left:0;z-index:3;min-width:150px;text-align:left;background:#fff}.team-attendance-matrix thead th:first-child{background:#f8fafc;z-index:4}.team-attendance-matrix tbody th button{border:0;background:transparent;text-align:left;padding:0;width:100%;cursor:pointer}.team-attendance-matrix tbody th strong,.team-attendance-matrix tbody th small{display:block}.team-attendance-matrix tbody th strong{font-size:.75rem;color:#0f172a}.team-attendance-matrix tbody th small{font-size:.6rem;color:#64748b}.attendance-matrix-status{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;margin:auto;font-weight:900}.attendance-matrix-status.tone-present{background:#dcfce7;color:#047857}.attendance-matrix-status.tone-late{background:#fef3c7;color:#b45309}.attendance-matrix-status.tone-justified{background:#e2e8f0;color:#64748b}.attendance-matrix-status.tone-unjustified{background:#fee2e2;color:#b91c1c}.attendance-matrix-status.tone-empty{background:#f8fafc;color:#cbd5e1}.team-attendance-matrix-note{font-size:.7rem;color:#64748b;margin:.1rem 0 0}
@media(max-width:760px){.training-tabs{overflow-x:auto;scrollbar-width:none}.training-tabs::-webkit-scrollbar{display:none}.training-tab{white-space:nowrap}.team-attendance-summary-grid{grid-template-columns:1fr}.team-attendance-overall-card{align-items:flex-start}.team-attendance-status-card{grid-template-columns:repeat(2,1fr)}.team-attendance-player-row{grid-template-columns:minmax(0,1fr) 50px 14px;gap:.55rem}.team-attendance-breakdown{grid-column:1/-1;grid-row:2;order:3}.team-attendance-player-row>.team-attendance-ring{grid-column:2;grid-row:1}.team-attendance-row-arrow{grid-column:3;grid-row:1}.team-attendance-list-head{align-items:flex-start;flex-direction:column}.team-attendance-list-head label{width:100%;justify-content:space-between}.team-attendance-list-head select{flex:1;max-width:180px}.team-attendance-header{align-items:flex-start}.team-attendance-view-toggle{width:100%}.team-attendance-view-toggle button{flex:1;justify-content:center}}
`;
  document.head.appendChild(style);
}

let baseRenderTraining=null;
let baseSetTrainingView=null;

function install(){
  if(installed||window[FLAG]) return;
  if(typeof window.renderTraining!=='function'||typeof window.setTrainingView!=='function'||typeof currentTrainingView==='undefined'){
    setTimeout(install,120);return;
  }
  installed=true;window[FLAG]=true;
  baseRenderTraining=window.renderTraining;
  baseSetTrainingView=window.setTrainingView;
  injectCss();
  window.setTrainingView=function(view){
    ensureTab();
    if(view==='attendance'){
      if(!isCoach()) return baseSetTrainingView('next');
      currentTrainingView='attendance';
      document.querySelectorAll('[data-training-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.trainingTab==='attendance'));
      renderTeamAttendance();
      if(!loadingAttendance&&typeof window.loadAttendanceFromSupabase==='function'){
        loadingAttendance=true;
        Promise.resolve(window.loadAttendanceFromSupabase({silent:true})).catch(()=>{}).finally(()=>{loadingAttendance=false;if(currentTrainingView==='attendance')renderTeamAttendance();});
      }
      return;
    }
    restoreTrainingButton();
    return baseSetTrainingView(view);
  };
  window.renderTraining=function(){
    ensureTab();
    if(!isCoach()&&currentTrainingView==='attendance') currentTrainingView='next';
    if(currentTrainingView==='attendance'&&isCoach()) return renderTeamAttendance();
    restoreTrainingButton();
    return baseRenderTraining.apply(this,arguments);
  };
  window.setTeamAttendanceMode=function(mode){attendanceMode=mode==='sessions'?'sessions':'summary';if(currentTrainingView==='attendance')renderTeamAttendance();};
  window.setTeamAttendanceSort=function(sort){attendanceSort=['attendance','name','absences','late'].includes(sort)?sort:'attendance';if(currentTrainingView==='attendance')renderTeamAttendance();};
  ensureTab();
  const trainingView=document.getElementById('view-training');
  if(trainingView){new MutationObserver(()=>ensureTab()).observe(trainingView,{childList:true,subtree:true});}
  console.info('[TeamAttendanceOverview] Asistencia global del equipo integrada en Entrenos.');
}

setTimeout(install,0);
})();
