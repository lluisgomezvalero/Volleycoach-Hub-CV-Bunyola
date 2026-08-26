(function(){
'use strict';

const ZONE='Europe/Madrid';
let rendering=false;
let refreshTimer=null;
let lastSignature='';
let lastCardMarkup='';
let cachedPlayerId=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function isPlayer(){try{return typeof getCurrentUser==='function'&&getCurrentUser()?.role==='player'}catch(_){return false}}
function numberOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}

function zonedParts(date,timeZone=ZONE){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  return Object.fromEntries(parts.map(p=>[p.type,p.value]));
}

function zonedDateTimeToUtc(year,month,day,hour,minute,second,timeZone=ZONE){
  const target=Date.UTC(year,month-1,day,hour,minute,second);
  let guess=target;
  for(let i=0;i<3;i++){
    const p=zonedParts(new Date(guess),timeZone);
    const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    guess+=target-represented;
  }
  return new Date(guess);
}

function previousDayCutoffMadrid(now=new Date()){
  const p=zonedParts(now,ZONE);
  const localDate=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
  localDate.setUTCDate(localDate.getUTCDate()-1);
  const cutoff=zonedDateTimeToUtc(localDate.getUTCFullYear(),localDate.getUTCMonth()+1,localDate.getUTCDate(),23,59,59,ZONE);
  return new Date(cutoff.getTime()+999);
}

function madridDateKey(now=new Date(),offsetDays=0){
  const p=zonedParts(now,ZONE);
  const d=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
  d.setUTCDate(d.getUTCDate()+offsetDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function statusCopy(result){
  if(result?.status!=='ready'){
    return{
      key:'neutral',
      label:'Conociendo tu ritmo',
      message:'Estamos empezando a conocer tu ritmo habitual de entrenamiento.'
    };
  }
  const key=result?.interpretation?.key;
  if(key==='low')return{
    key:'blue',
    label:'Más baja de lo habitual',
    message:'Esta semana has entrenado menos o de forma más suave que en tu ritmo habitual.'
  };
  if(key==='similar')return{
    key:'green',
    label:'Similar a lo habitual',
    message:'Tu semana se parece bastante a tu ritmo habitual de entrenamiento.'
  };
  if(key==='considerable')return{
    key:'orange',
    label:'Más alta de lo habitual',
    message:'Esta semana ha sido algo más exigente de lo que suele ser habitual para ti.'
  };
  return{
    key:'purple',
    label:'Mucho más alta de lo habitual',
    message:'Esta semana ha sido claramente más exigente que tu ritmo habitual. Tenlo en cuenta junto con cómo te encuentras.'
  };
}

function relativeBars(values){
  const labels=['Hace 4 sem.','Hace 3 sem.','Hace 2 sem.','Semana pasada','Esta semana'];
  const data=Array.isArray(values)?values.slice(-5).map(v=>Math.max(0,Number(v)||0)):[];
  while(data.length<5)data.unshift(0);
  const max=Math.max(...data,0);
  return data.map((value,index)=>{
    const height=max>0?Math.max(8,Math.round(value/max*100)):8;
    return `<div class="player-week-bar-item"><div class="player-week-bar-track"><i style="height:${height}%"></i></div><small>${labels[index]}</small></div>`;
  }).join('');
}

async function fetchRecentWellness(playerId){
  const client=window.VolleySupabase?.getClient?.();
  if(!client||!playerId)return[];
  const start=madridDateKey(new Date(),-6);
  const end=madridDateKey(new Date(),0);
  const {data,error}=await client
    .from('wellness_entries')
    .select('entry_date,fatigue,sleep,sleep_hours')
    .eq('player_id',playerId)
    .gte('entry_date',start)
    .lte('entry_date',end)
    .order('entry_date',{ascending:true});
  if(error)throw error;
  return data||[];
}

function average(values){
  const valid=(values||[]).map(numberOrNull).filter(v=>v!=null);
  return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;
}

function wellnessSummary(rows){
  const list=Array.isArray(rows)?rows:[];
  const fatigue=average(list.map(r=>r.fatigue));
  const sleep=average(list.map(r=>r.sleep));
  const hours=average(list.map(r=>r.sleep_hours));

  let energy={key:'neutral',label:'Sin registros recientes',detail:'Completa tu bienestar para ver este resumen.'};
  if(fatigue!=null&&fatigue<=2.25)energy={key:'green',label:'Con buena energía',detail:'Tus últimos registros reflejan poca fatiga.'};
  else if(fatigue!=null&&fatigue<3.75)energy={key:'orange',label:'Algo más cansada',detail:'Tus últimos registros muestran algo más de cansancio.'};
  else if(fatigue!=null)energy={key:'purple',label:'Más cansada',detail:'Tus últimos registros reflejan más cansancio acumulado.'};

  let sleepState={key:'neutral',label:'Sin registros recientes',detail:'Completa tu bienestar para ver este resumen.'};
  if(sleep!=null&&sleep>=3.75)sleepState={key:'green',label:'Buen descanso',detail:'La calidad de tu sueño ha sido buena en tus últimos registros.'};
  else if(sleep!=null&&sleep>2.25)sleepState={key:'neutral',label:'Descanso normal',detail:'La calidad de tu sueño se mantiene en una zona intermedia.'};
  else if(sleep!=null)sleepState={key:'blue',label:'Sueño más flojo',detail:'La calidad de tu sueño ha sido más baja en tus últimos registros.'};
  else if(hours!=null)sleepState={key:'neutral',label:'Sueño registrado',detail:'Tenemos horas de sueño, pero no una valoración reciente de su calidad.'};

  if(hours!=null){
    const h=hours.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
    sleepState={...sleepState,detail:`${sleepState.detail} · ${h} h de media registradas.`};
  }

  return{count:list.length,energy,sleep:sleepState};
}

function wellnessHtml(summary){
  const s=summary||wellnessSummary([]);
  const countText=s.count?`${s.count} ${s.count===1?'registro':'registros'} en los últimos 7 días`:'Últimos 7 días';
  return `<div class="player-week-wellness">
    <div class="player-week-wellness-head"><span>Cómo te has encontrado</span><small>${esc(countText)}</small></div>
    <div class="player-week-wellness-grid">
      <div class="player-week-wellness-item wellness-${s.energy.key}">
        <span class="player-week-wellness-icon"><i data-lucide="battery-medium"></i></span>
        <div><small>Energía</small><strong>${esc(s.energy.label)}</strong><p>${esc(s.energy.detail)}</p></div>
      </div>
      <div class="player-week-wellness-item wellness-${s.sleep.key}">
        <span class="player-week-wellness-icon"><i data-lucide="moon-star"></i></span>
        <div><small>Sueño</small><strong>${esc(s.sleep.label)}</strong><p>${esc(s.sleep.detail)}</p></div>
      </div>
    </div>
  </div>`;
}

function cardHtml(result,wellness){
  const state=statusCopy(result);
  return `<article id="player-training-load-card" class="dashboard-card dashboard-card-wide player-training-load-card player-week-${state.key}">
    <div class="player-week-head">
      <div><span class="player-week-eyebrow"><i data-lucide="activity"></i> Tu entrenamiento</span><h3>Tu semana de entrenamiento</h3></div>
      <span class="player-week-pill">Seguimiento personal</span>
    </div>
    <div class="player-week-status">
      <span class="player-week-status-dot" aria-hidden="true"></span>
      <div><strong>${esc(state.label)}</strong><p>${esc(state.message)}</p></div>
    </div>
    ${wellnessHtml(wellness)}
    <div class="player-week-evolution">
      <div class="player-week-evolution-head"><span>Tu evolución reciente</span><small>Comparada con tus últimas semanas</small></div>
      <div class="player-week-bars" role="img" aria-label="Evolución relativa de tu entrenamiento durante las últimas cinco semanas">${relativeBars(result?.trendWeekLoads)}</div>
    </div>
    <p class="player-week-foot"><i data-lucide="calendar-clock"></i><span>La evolución de entrenamiento se actualiza con sesiones completadas hasta ayer.</span></p>
  </article>`;
}

function injectStyles(){
  const old=document.getElementById('training-load-player-style');
  if(old)old.remove();
  const s=document.createElement('style');s.id='training-load-player-style';s.textContent=`
.player-training-load-card{padding:1.25rem!important;margin-top:1rem!important;overflow:hidden}.player-week-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.player-week-eyebrow{display:flex;align-items:center;gap:.4rem;font-size:.74rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:#64748b}.player-week-eyebrow svg{width:16px;height:16px}.player-week-head h3{margin:.24rem 0 0;font-size:1.2rem;color:#0f172a}.player-week-pill{font-size:.7rem;font-weight:800;padding:.34rem .55rem;border-radius:999px;background:#f1f5f9;color:#475569;white-space:nowrap}.player-week-status{display:flex;align-items:flex-start;gap:.8rem;margin-top:1rem;padding:1rem;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}.player-week-status-dot{width:13px;height:13px;border-radius:50%;margin-top:.28rem;flex:0 0 auto;background:#94a3b8;box-shadow:0 0 0 5px rgba(148,163,184,.12)}.player-week-status strong{display:block;color:#0f172a;font-size:1rem}.player-week-status p{margin:.22rem 0 0;color:#64748b;font-size:.84rem;line-height:1.45}.player-week-blue .player-week-status{background:#eff6ff;border-color:#bfdbfe}.player-week-blue .player-week-status-dot{background:#3b82f6;box-shadow:0 0 0 5px rgba(59,130,246,.12)}.player-week-green .player-week-status{background:#f0fdf4;border-color:#bbf7d0}.player-week-green .player-week-status-dot{background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.12)}.player-week-orange .player-week-status{background:#fff7ed;border-color:#fed7aa}.player-week-orange .player-week-status-dot{background:#f59e0b;box-shadow:0 0 0 5px rgba(245,158,11,.12)}.player-week-purple .player-week-status{background:#faf5ff;border-color:#e9d5ff}.player-week-purple .player-week-status-dot{background:#a855f7;box-shadow:0 0 0 5px rgba(168,85,247,.12)}.player-week-wellness{margin-top:1rem;padding-top:.9rem;border-top:1px solid #e2e8f0}.player-week-wellness-head{display:flex;justify-content:space-between;align-items:center;gap:1rem}.player-week-wellness-head span{font-size:.84rem;font-weight:850;color:#334155}.player-week-wellness-head small{font-size:.72rem;color:#94a3b8}.player-week-wellness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-top:.7rem}.player-week-wellness-item{display:flex;align-items:flex-start;gap:.7rem;padding:.85rem;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.player-week-wellness-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:#e2e8f0;color:#64748b}.player-week-wellness-icon svg{width:18px;height:18px}.player-week-wellness-item small{display:block;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8}.player-week-wellness-item strong{display:block;margin-top:.08rem;font-size:.9rem;color:#0f172a}.player-week-wellness-item p{margin:.18rem 0 0;font-size:.72rem;line-height:1.35;color:#64748b}.player-week-wellness-item.wellness-green .player-week-wellness-icon{background:#dcfce7;color:#15803d}.player-week-wellness-item.wellness-orange .player-week-wellness-icon{background:#ffedd5;color:#c2410c}.player-week-wellness-item.wellness-purple .player-week-wellness-icon{background:#f3e8ff;color:#7e22ce}.player-week-wellness-item.wellness-blue .player-week-wellness-icon{background:#dbeafe;color:#1d4ed8}.player-week-evolution{margin-top:1rem;padding-top:.9rem;border-top:1px solid #e2e8f0}.player-week-evolution-head{display:flex;justify-content:space-between;align-items:center;gap:1rem}.player-week-evolution-head span{font-size:.84rem;font-weight:850;color:#334155}.player-week-evolution-head small{font-size:.72rem;color:#94a3b8}.player-week-bars{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.5rem;margin-top:.75rem;align-items:start}.player-week-bar-item{min-width:0}.player-week-bar-track{height:78px;border-radius:9px;background:#f1f5f9;display:flex;align-items:flex-end;overflow:hidden;padding:0 5px}.player-week-bar-track i{display:block;width:100%;min-height:6px;border-radius:6px 6px 2px 2px;background:#94a3b8;transition:height .25s ease}.player-week-bar-item:last-child .player-week-bar-track i{background:#475569}.player-week-bar-item small{display:block;min-height:2.3em;margin-top:.35rem;text-align:center;font-size:.62rem;line-height:1.15;color:#94a3b8}.player-week-foot{display:flex;align-items:center;gap:.4rem;margin:.72rem 0 0;color:#94a3b8;font-size:.72rem}.player-week-foot svg{width:14px;height:14px;flex:0 0 auto}@media(max-width:700px){.player-training-load-card{padding:1rem!important;margin-top:1rem!important}.player-week-head{align-items:center}.player-week-pill{display:none}.player-week-status{padding:.9rem}.player-week-wellness-head,.player-week-evolution-head{display:block}.player-week-wellness-head small,.player-week-evolution-head small{display:block;margin-top:.15rem}.player-week-wellness-grid{grid-template-columns:1fr;gap:.55rem}.player-week-wellness-item{padding:.75rem}.player-week-bars{gap:.3rem}.player-week-bar-track{height:64px;padding:0 3px}.player-week-bar-item small{font-size:.56rem;min-height:2.3em}}
  `;document.head.appendChild(s);
}

function dashboardContainer(){
  return document.getElementById('home-dashboard')||document.querySelector('#view-home-portal .dashboard-grid')||document.querySelector('#view-home-portal');
}

function mountCachedCard(){
  if(!isPlayer()||!lastCardMarkup)return;
  const root=dashboardContainer();if(!root)return;
  const existing=document.getElementById('player-training-load-card');
  if(existing)return;
  root.insertAdjacentHTML('beforeend',lastCardMarkup);
  try{if(window.lucide)window.lucide.createIcons()}catch(_){}
}

async function resolvePlayerId(){
  if(cachedPlayerId)return cachedPlayerId;
  const identity=await window.VolleySupabase?.getIdentity?.();
  cachedPlayerId=identity?.data?.player?.id||null;
  return cachedPlayerId;
}

async function render(){
  if(rendering||!isPlayer()||!window.TrainingLoadEngine)return;
  const root=dashboardContainer();if(!root)return;
  rendering=true;
  try{
    const pid=await resolvePlayerId();
    if(!pid)return;
    const cutoff=previousDayCutoffMadrid(new Date());
    const [result,wellnessRows]=await Promise.all([
      window.TrainingLoadEngine.calculatePlayer(pid,cutoff),
      fetchRecentWellness(pid)
    ]);
    const wellness=wellnessSummary(wellnessRows);
    const signature=JSON.stringify([result.status,result.interpretation?.key,result.trendWeekLoads,wellness]);
    if(signature!==lastSignature||!lastCardMarkup){
      lastSignature=signature;
      lastCardMarkup=cardHtml(result,wellness);
    }
    const existing=document.getElementById('player-training-load-card');
    if(!existing){mountCachedCard();return;}
    if(existing.outerHTML!==lastCardMarkup){existing.outerHTML=lastCardMarkup;try{if(window.lucide)window.lucide.createIcons()}catch(_){}}
  }catch(error){console.warn('[TrainingLoadPlayerDashboard]',error);}
  finally{rendering=false;}
}

function install(){
  injectStyles();
  const wait=()=>{
    if(!window.TrainingLoadEngine||!window.VolleySupabase){setTimeout(wait,180);return;}
    const base=window.renderHomeDashboard;
    if(typeof base==='function'&&!base.__trainingLoadPlayerSimple){
      const wrapped=function(){
        const r=base.apply(this,arguments);
        mountCachedCard();
        setTimeout(()=>void render(),0);
        return r;
      };
      wrapped.__trainingLoadPlayerSimple=true;
      window.renderHomeDashboard=wrapped;
    }
    void render();
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(isPlayer())void render();},60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isPlayer())void render();});
    console.info('[TrainingLoadPlayerDashboard] PLAYER-4 activo: entrenamiento simple + bienestar de 7 días.');
  };
  setTimeout(wait,1200);
}

install();
})();