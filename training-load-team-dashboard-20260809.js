(function(){
'use strict';

let currentSort='acwr';
let busy=false;
let lastTableMarkup='';

function isCoach(){
  try{return typeof isCoachUser==='function'&&isCoachUser();}catch(_){return false;}
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

function tone(metric){
  const key=metric?.interpretation?.key||'insufficient';
  return key;
}

function sortRows(rows){
  const copy=[...(rows||[])];
  const num=v=>Number.isFinite(Number(v))?Number(v):-Infinity;
  if(currentSort==='change') return copy.sort((a,b)=>num(b.changePct)-num(a.changePct));
  if(currentSort==='acute') return copy.sort((a,b)=>num(b.acuteLoad)-num(a.acuteLoad));
  if(currentSort==='name') return copy.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  return copy.sort((a,b)=>num(b.acwr)-num(a.acwr));
}

function ensureStyles(){
  if(document.getElementById('team-load-dashboard-css'))return;
  const s=document.createElement('style');s.id='team-load-dashboard-css';
  s.textContent=`
  .team-load-card{margin-top:1rem}.team-load-head{display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap}.team-load-head h3{margin:.18rem 0 0}.team-load-head p{margin:.28rem 0 0;color:#64748b;font-size:.78rem}.team-load-controls{display:flex;gap:.5rem;align-items:center}.team-load-controls select{min-width:190px}.team-load-table-wrap{overflow:auto;margin-top:1rem;min-height:94px}.team-load-table{width:100%;border-collapse:collapse;min-width:1120px}.team-load-table th,.team-load-table td{padding:.8rem .65rem;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:middle}.team-load-table th{font-size:.74rem;color:#64748b;background:#f8fafc;position:sticky;top:0;white-space:nowrap}.team-load-table td{font-size:.83rem;color:#334155}.team-load-player{display:flex;align-items:baseline;gap:.45rem;min-width:145px}.team-load-player strong{color:#0f172a}.team-load-player small{color:#94a3b8;font-weight:800}.team-load-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .55rem;border-radius:999px;font-size:.72rem;font-weight:800;white-space:nowrap}.team-load-badge.insufficient{background:#f1f5f9;color:#475569}.team-load-badge.low{background:#dbeafe;color:#1d4ed8}.team-load-badge.similar{background:#dcfce7;color:#15803d}.team-load-badge.considerable{background:#ffedd5;color:#c2410c}.team-load-badge.high{background:#f3e8ff;color:#7e22ce}.team-load-foot{margin-top:.8rem;font-size:.78rem;color:#64748b;display:flex;align-items:flex-start;gap:.45rem}.team-load-foot i{width:16px;height:16px;flex:0 0 auto;margin-top:.05rem}.team-load-empty{padding:1rem;color:#64748b}.team-load-insufficient{display:inline-block;max-width:150px;color:#64748b;font-size:.72rem;line-height:1.25}.team-load-rpe,.team-load-sessions{font-weight:800;color:#0f172a}.team-load-trend{display:flex;align-items:center;gap:.5rem;min-width:142px}.team-load-trend-bars{height:28px;display:flex;align-items:flex-end;gap:3px;width:58px}.team-load-trend-bars i{display:block;flex:1;min-height:3px;border-radius:3px 3px 1px 1px;background:#94a3b8}.team-load-trend-bars i:last-child{background:#334155}.team-load-trend-label{display:flex;align-items:center;gap:.2rem;font-size:.72rem;font-weight:800;white-space:nowrap}.team-load-trend-label.up{color:#c2410c}.team-load-trend-label.down{color:#2563eb}.team-load-trend-label.stable{color:#15803d}.team-load-trend-label.insufficient{color:#64748b}.team-load-trend-label i{width:14px;height:14px}.team-load-metric-main{font-weight:800;color:#0f172a;white-space:nowrap}.team-load-metric-sub{display:block;margin-top:.12rem;font-size:.68rem;color:#94a3b8;white-space:nowrap}
  @media(max-width:700px){.team-load-head{align-items:flex-start}.team-load-controls{width:100%;display:grid;grid-template-columns:auto 1fr}.team-load-controls select{min-width:0;width:100%}.team-load-table-wrap{margin-left:-.25rem;margin-right:-.25rem;padding:0 .25rem}.team-load-foot{font-size:.73rem}}
  `;document.head.appendChild(s);
}

function findCoachDashboardContainer(){
  const candidates=[
    document.getElementById('home-dashboard'),
    document.querySelector('#view-home-portal .dashboard-grid'),
    document.querySelector('#view-home-portal'),
    document.querySelector('.app-home-dashboard')
  ].filter(Boolean);
  return candidates[0]||null;
}

function renderShell(){
  if(!isCoach())return null;
  ensureStyles();
  const host=findCoachDashboardContainer();if(!host)return null;
  let card=document.getElementById('team-load-card');
  if(!card){
    card=document.createElement('article');card.id='team-load-card';card.className='dashboard-card dashboard-card-wide team-load-card';
    card.innerHTML=`<div class="team-load-head"><div><span class="dashboard-eyebrow"><i data-lucide="activity"></i> Carga del equipo</span><h3>Seguimiento individual de carga</h3><p>Ventanas móviles de 7 días y carga habitual previa. Solo cuentan sesiones con asistencia oficial y RPE.</p></div><div class="team-load-controls"><label for="team-load-sort" style="font-size:.78rem;color:#64748b">Ordenar por</label><select id="team-load-sort" class="form-control"><option value="acwr">Mayor ACWR</option><option value="change">Mayor incremento</option><option value="acute">Mayor carga 7 días</option><option value="name">Nombre</option></select></div></div><div class="team-load-table-wrap">${lastTableMarkup||'<div class="team-load-empty">Cargando datos de carga…</div>'}</div><div class="team-load-foot"><i data-lucide="info"></i><span>Los rangos de ACWR se utilizan únicamente como descriptores del cambio de carga respecto al historial. No son predictores de lesión.</span></div>`;
    host.appendChild(card);
    const select=card.querySelector('#team-load-sort');
    if(select){
      select.value=currentSort;
      select.addEventListener('change',e=>{currentSort=e.target.value;void refresh();});
    }
  }
  if(window.lucide)try{window.lucide.createIcons();}catch(_){}
  return card;
}

function fmtNum(v){return Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString(window.VolleyI18n?.locale?.() || 'es-ES'):'—';}
function fmtAcwr(v){return Number.isFinite(Number(v))?Number(v).toFixed(2).replace('.',','):'Datos insuficientes';}
function fmtChange(v){if(!Number.isFinite(Number(v)))return '—';const n=Math.round(Number(v));return `${n>0?'+':''}${n} %`;}
function fmtRpe(v){return Number.isFinite(Number(v))?Number(v).toFixed(1).replace('.',','):'—';}

function trendInfo(direction){
  if(direction==='up')return{label:'En aumento',icon:'trending-up',key:'up'};
  if(direction==='down')return{label:'En descenso',icon:'trending-down',key:'down'};
  if(direction==='stable')return{label:'Estable',icon:'minus',key:'stable'};
  return{label:'Sin tendencia',icon:'minus',key:'insufficient'};
}

function trendBars(values){
  const data=Array.isArray(values)?values.slice(-5).map(v=>Math.max(0,Number(v)||0)):[];
  while(data.length<5)data.unshift(0);
  const max=Math.max(...data,0);
  return data.map(value=>{
    const height=max>0?Math.max(10,Math.round(value/max*100)):10;
    return `<i style="height:${height}%" title="${fmtNum(value)} UA"></i>`;
  }).join('');
}

function renderTrend(row){
  const info=trendInfo(row?.trendDirection);
  return `<div class="team-load-trend"><span class="team-load-trend-bars" aria-label="Evolución de carga de las últimas cinco ventanas de 7 días">${trendBars(row?.trendWeekLoads)}</span><span class="team-load-trend-label ${info.key}"><i data-lucide="${info.icon}"></i>${info.label}</span></div>`;
}

function habitualCell(row){
  if(row?.status==='ready')return `<span class="team-load-metric-main">${fmtNum(row.chronicLoad)} UA</span><small class="team-load-metric-sub">media semanal días 8–35</small>`;
  return '<span class="team-load-insufficient">Datos insuficientes para calcular carga habitual</span>';
}

function buildTableMarkup(rows){
  if(!rows.length)return '<div class="team-load-empty">No hay jugadoras con datos disponibles.</div>';
  return `<table class="team-load-table"><thead><tr><th>Jugadora</th><th>Carga 7 días</th><th>Carga habitual</th><th>ACWR</th><th>Cambio</th><th>RPE medio</th><th>Sesiones</th><th>Tendencia</th><th>Interpretación</th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="team-load-player"><strong>${esc(r.name)}</strong>${r.dorsal!=null?`<small>#${esc(r.dorsal)}</small>`:''}</div></td><td><span class="team-load-metric-main">${fmtNum(r.acuteLoad)} UA</span><small class="team-load-metric-sub">últimos 7 días</small></td><td>${habitualCell(r)}</td><td><strong>${fmtAcwr(r.acwr)}</strong></td><td>${fmtChange(r.changePct)}</td><td><span class="team-load-rpe">${fmtRpe(r.recentRpeMean)}</span></td><td><span class="team-load-sessions">${Number(r.recentSessions)||0}</span></td><td>${renderTrend(r)}</td><td><span class="team-load-badge ${tone(r)}">${esc(r.interpretation?.label||'Datos insuficientes')}</span></td></tr>`).join('')}</tbody></table>`;
}

async function refresh(){
  if(!isCoach()||busy||!window.TrainingLoadEngine)return;
  const card=renderShell();if(!card)return;
  busy=true;
  try{
    const rows=sortRows(await window.TrainingLoadEngine.calculateTeam(new Date()));
    lastTableMarkup=buildTableMarkup(rows);
    const currentCard=document.getElementById('team-load-card')||renderShell();
    const wrap=currentCard?.querySelector('.team-load-table-wrap');
    if(wrap)wrap.innerHTML=lastTableMarkup;
    if(window.lucide)try{window.lucide.createIcons();}catch(_){}
  }catch(error){
    console.warn('[TeamLoadDashboard]',error);
    const currentCard=document.getElementById('team-load-card')||renderShell();
    const wrap=currentCard?.querySelector('.team-load-table-wrap');
    if(wrap&&!lastTableMarkup)wrap.innerHTML='<div class="team-load-empty">No se pudieron cargar los datos de carga del equipo.</div>';
  }finally{busy=false;}
}

function install(){
  const wait=()=>{
    if(!window.TrainingLoadEngine||typeof window.renderHomeDashboard!=='function'){setTimeout(wait,200);return;}
    const base=window.renderHomeDashboard;
    if(!base.__teamLoadWrapped){
      const wrapped=function(){const r=base.apply(this,arguments);if(isCoach())setTimeout(()=>{renderShell();void refresh();},0);return r;};
      wrapped.__teamLoadWrapped=true;window.renderHomeDashboard=wrapped;
    }
    if(isCoach()){renderShell();void refresh();}
    setInterval(()=>{if(isCoach())void refresh();},15000);
    console.info('[TeamLoadDashboard] ACWR-5 estable: conserva el último resultado durante refrescos.');
  };
  wait();
}

install();
})();
