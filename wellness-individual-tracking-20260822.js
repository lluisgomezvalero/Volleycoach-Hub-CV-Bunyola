(function(){
'use strict';

const FLAG='__wellnessIndividualTracking20260822';
if(window[FLAG])return;
window[FLAG]=true;

const HIGH_RPE=8;
const WEEKLY_HIGH_MEAN=7.5;
let scheduled=false;
let rendering=false;
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
function num(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function fatigue(row){return num(row?.fatigue??row?.generalState??row?.general_state);}
function sleep(row){return num(row?.sleepQuality??row?.sleep);}
function pain(row){return num(row?.painScore??row?.pain_score);}
function soreness(row){return num(row?.soreness);}
function dateKey(row){return String(row?.dateKey||row?.date||row?.entry_date||row?.createdAt||row?.created_at||'').slice(0,10);}
function parseDate(key){
  const m=String(key||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12):null;
}
function shortDate(key){
  const d=parseDate(key);if(!d)return key||'—';
  return new Intl.DateTimeFormat(window.VolleyI18n?.locale?.() || 'es-ES',{day:'numeric',month:'short'}).format(d).replace(/\./g,'');
}
function longDate(key){
  const d=parseDate(key);if(!d)return key||'Fecha sin registrar';
  return new Intl.DateTimeFormat(window.VolleyI18n?.locale?.() || 'es-ES',{weekday:'short',day:'numeric',month:'short'}).format(d).replace(/\./g,'');
}
function players(){return (app()?.players||[]).filter(player=>player&&player.active!==false);}
function playerById(playerId){return players().find(player=>id(player.id)===id(playerId))||null;}
function wellnessRows(playerId){
  return (app()?.wellnessLogs||[])
    .filter(row=>id(row?.playerId??row?.player_id)===id(playerId))
    .slice()
    .sort((a,b)=>dateKey(b).localeCompare(dateKey(a)));
}
function eventTime(event){
  const raw=String(event?.date||event?.startDate||event?.starts_at||'').slice(0,10);
  const time=String(event?.time||event?.startTime||'12:00').slice(0,5)||'12:00';
  const d=new Date(`${raw}T${time}:00`);
  return Number.isFinite(d.getTime())?d.getTime():0;
}
function rpeRows(playerId){
  const events=new Map((app()?.events||[]).map(event=>[id(event.id),event]));
  const map=new Map();
  (app()?.trainingRPEs||[]).forEach((row,index)=>{
    if(id(row?.playerId??row?.player_id)!==id(playerId))return;
    const value=num(row?.rpeVal??row?.score??row?.rpe??row?.value);if(value==null)return;
    const eventId=id(row?.eventId??row?.event_id);if(!eventId)return;
    const stamp=Date.parse(row?.updated_at||row?.updatedAt||row?.created_at||row?.createdAt||row?.date||'')||index;
    const prev=map.get(eventId);
    if(!prev||stamp>=prev._stamp)map.set(eventId,{...row,eventId,rpeVal:Math.max(0,Math.min(10,value)),event:events.get(eventId)||null,_stamp:stamp});
  });
  return [...map.values()].sort((a,b)=>eventTime(b.event)-eventTime(a.event)||b._stamp-a._stamp);
}
function mean(values){const valid=values.filter(Number.isFinite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
function trendFor(rows){
  const values=rows.map(fatigue).filter(Number.isFinite);
  if(values.length<2)return{delta:null,label:'Sin tendencia',tone:'neutral'};
  let recent,previous;
  if(values.length>=4){
    recent=mean(values.slice(0,Math.min(3,values.length)));
    previous=mean(values.slice(3,Math.min(6,values.length)));
    if(previous==null){recent=values[0];previous=values[1];}
  }else{recent=values[0];previous=values[1];}
  const delta=recent-previous;
  if(Math.abs(delta)<.25)return{delta,label:'→ estable',tone:'neutral'};
  const shown=Math.abs(delta).toFixed(1).replace('.',',');
  if(delta>0)return{delta,label:`↑ ${shown} · aumentando`,tone:delta>=1?'attn':'warm'};
  return{delta,label:`↓ ${shown} · mejorando`,tone:'good'};
}
function loadAlert(playerId){
  const now=Date.now(),sevenDays=7*86400000;
  const rows=rpeRows(playerId).map(row=>({score:row.rpeVal,ts:eventTime(row.event)})).filter(row=>row.ts&&now-row.ts<=sevenDays).sort((a,b)=>a.ts-b.ts);
  if(!rows.length)return null;
  const avg=mean(rows.map(row=>row.score));
  let streak=0,maxStreak=0;
  rows.forEach(row=>{streak=row.score>=HIGH_RPE?streak+1:0;maxStreak=Math.max(maxStreak,streak);});
  if(maxStreak>=3||(rows.length>=3&&avg>=WEEKLY_HIGH_MEAN))return{mean:avg,maxStreak,count:rows.length};
  return null;
}
function discomfort(row){
  const p=pain(row);if(p!=null)return{value:p,suffix:'/10',label:'Dolor',tone:p>=6?'attn':p>=3?'warm':'good'};
  const s=soreness(row);if(s!=null)return{value:s,suffix:'/5',label:'Molestias',tone:s>=4?'attn':s>=3?'warm':'good'};
  return{value:null,suffix:'',label:'Molestias',tone:'neutral'};
}
function fatigueTone(value){return value==null?'neutral':value>=4?'attn':value>=3?'warm':'good';}
function statusFor(item){
  if(!item?.latest)return{label:'Sin datos',tone:'neutral'};
  const f=item.latestFatigue,s=item.latestSleep,d=item.discomfort;
  const attention=(f!=null&&f>=4)||(s!=null&&s<=2)||(d?.tone==='attn');
  if(attention)return{label:'Atención',tone:'attn'};
  const watch=(f!=null&&f>=3)||(s!=null&&s<=3)||(d?.tone==='warm');
  if(watch)return{label:'Vigilar',tone:'warm'};
  return{label:'Buen estado',tone:'good'};
}
function rpeTone(value){return value==null?'neutral':value>=8?'attn':value>=6?'warm':'good';}
function sleepTone(value){return value==null?'neutral':value<=2?'attn':value<=3?'warm':'good';}
function summary(player){
  const logs=wellnessRows(player.id),rpes=rpeRows(player.id),latest=logs[0]||null,lastRpe=rpes[0]?.rpeVal??null;
  return{
    player,logs,rpes,latest,lastRpe,
    latestFatigue:latest?fatigue(latest):null,
    latestSleep:latest?sleep(latest):null,
    discomfort:latest?discomfort(latest):discomfort(null),
    trend:trendFor(logs),
    alert:loadAlert(player.id),
    lastDate:latest?dateKey(latest):''
  };
}
function dataSignature(){
  const st=app();if(!st)return'';
  const p=(st.players||[]).map(x=>`${id(x.id)}:${x.name||''}`).join('|');
  const w=(st.wellnessLogs||[]).map(x=>`${id(x.playerId??x.player_id)}:${dateKey(x)}:${fatigue(x)}:${sleep(x)}:${pain(x)}:${soreness(x)}:${x.notes||''}`).join('|');
  const r=(st.trainingRPEs||[]).map(x=>`${id(x.playerId??x.player_id)}:${id(x.eventId??x.event_id)}:${x.rpeVal??x.score??''}`).join('|');
  return `${p}::${w}::${r}`;
}
function ensureStyles(){
  if(document.getElementById('wellness-individual-tracking-20260822-style'))return;
  const style=document.createElement('style');
  style.id='wellness-individual-tracking-20260822-style';
  style.textContent=`
  @media(max-width:760px), (max-width:1366px) and (any-pointer:coarse){
    #view-wellness .wellness-coach-inspector.wellness-individual-modern{padding:.86rem!important;overflow:visible!important}
    #view-wellness .wellness-individual-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.7rem}
    #view-wellness .wellness-individual-head h3{margin:0 0 .2rem!important;color:#253044!important;font-size:1rem!important;line-height:1.15!important}
    #view-wellness .wellness-individual-head p{margin:0!important;color:#7d8998!important;font-size:.64rem!important;line-height:1.4!important}
    #view-wellness .wellness-individual-count{flex:0 0 auto;padding:.28rem .48rem;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:.58rem;font-weight:850}
    #view-wellness .wellness-individual-alerts{display:grid;gap:.42rem;margin:0 0 .68rem}
    #view-wellness .wellness-individual-alerts .load-alert{margin:0!important;padding:.58rem .65rem!important;border-radius:12px!important}
    #view-wellness .wellness-individual-alerts .load-alert strong{font-size:.67rem!important}.wellness-individual-alerts .load-alert small{display:block;margin-top:.12rem;font-size:.57rem!important;line-height:1.35}
    #view-wellness .wellness-player-grid{display:grid;grid-template-columns:1fr;gap:.5rem}
    #view-wellness .wellness-player-card{width:100%;min-width:0;padding:.68rem;border:1px solid #e5e9ee;border-radius:15px;background:#fbfcfd;color:inherit;text-align:left;box-shadow:none;display:grid;gap:.55rem;cursor:pointer}
    #view-wellness .wellness-player-card:active{transform:scale(.995)}
    #view-wellness .wellness-player-card.is-alert{border-color:#fecdd3;background:#fffafb}
    #view-wellness .wellness-player-card-head{display:flex;align-items:center;justify-content:space-between;gap:.55rem}
    #view-wellness .wellness-player-id{min-width:0;display:flex;align-items:center;gap:.5rem}
    #view-wellness .wellness-player-badge{width:34px;height:34px;flex:0 0 34px;border-radius:11px;display:grid;place-items:center;background:#f1f5f9;color:#475569;font-size:.7rem;font-weight:900}
    #view-wellness .wellness-player-id strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#253044;font-size:.74rem}.wellness-player-id small{display:block;margin-top:.1rem;color:#8b96a5;font-size:.56rem}
    #view-wellness .wellness-player-arrow{width:17px;height:17px;color:#9aa5b2;flex:0 0 auto}
    #view-wellness .wellness-player-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.34rem}
    #view-wellness .wellness-player-metric{min-width:0;padding:.46rem .35rem;border:1px solid #ebeff3;border-radius:10px;background:#fff;text-align:center}
    #view-wellness .wellness-player-metric small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a0ae;font-size:.48rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em}.wellness-player-metric strong{display:block;margin-top:.15rem;color:#334155;font-size:.7rem}
    #view-wellness .wellness-player-metric.good strong{color:#047857}.wellness-player-metric.warm strong{color:#b45309}.wellness-player-metric.attn strong{color:#be123c}
    #view-wellness .wellness-player-foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem;color:#8793a2;font-size:.54rem}
    #view-wellness .wellness-trend-pill{display:inline-flex;align-items:center;gap:.25rem;padding:.24rem .38rem;border-radius:999px;background:#f1f5f9;color:#64748b;font-weight:800}.wellness-trend-pill.good{background:#ecfdf5;color:#047857}.wellness-trend-pill.warm{background:#fff7ed;color:#b45309}.wellness-trend-pill.attn{background:#fff1f2;color:#be123c}
    #view-wellness .wellness-alert-mini{display:inline-flex;align-items:center;gap:.22rem;color:#be123c;font-weight:850}
    .wellness-player-tracking-modal{z-index:120000!important}
    .wellness-player-tracking-modal .modal-content{width:min(94vw,620px)!important;max-height:min(86vh,760px)!important;overflow:hidden!important;border-radius:20px!important}
    .wellness-player-tracking-modal .modal-header{align-items:flex-start!important}.wellness-player-tracking-modal .modal-header h3{margin:0 0 .16rem!important;color:#253044!important;font-size:1.05rem!important}.wellness-player-tracking-modal .modal-header small{color:#7d8998!important;font-size:.62rem!important}
    .wellness-player-modal-meta{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}.wellness-player-status{display:inline-flex;align-items:center;padding:.2rem .38rem;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:.52rem;font-weight:850}.wellness-player-status.good{background:#ecfdf5;color:#047857}.wellness-player-status.warm{background:#fff7ed;color:#b45309}.wellness-player-status.attn{background:#fff1f2;color:#be123c}
    .wellness-player-tracking-modal .modal-body{overflow-y:auto!important;padding-bottom:1.2rem!important}
    .wellness-player-modal-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;margin-bottom:.75rem}.wellness-player-modal-metric{padding:.68rem;border:1px solid #e6eaef;border-radius:13px;background:#fbfcfd}.wellness-player-modal-metric small{display:block;color:#8b97a5;font-size:.55rem;font-weight:850;text-transform:uppercase}.wellness-player-modal-metric strong{display:block;margin-top:.18rem;color:#253044;font-size:.92rem}.wellness-player-modal-metric.good strong{color:#047857}.wellness-player-modal-metric.warm strong{color:#b45309}.wellness-player-modal-metric.attn strong{color:#be123c}
    .wellness-player-spark-wrap{margin:.2rem 0 .8rem;padding:.7rem;border:1px solid #e6eaef;border-radius:14px;background:#fbfcfd}.wellness-player-spark-head{display:flex;justify-content:space-between;gap:.5rem;align-items:center;margin-bottom:.35rem}.wellness-player-spark-head strong{font-size:.69rem;color:#334155}.wellness-player-spark-head span{font-size:.54rem;color:#8b97a5}.wellness-player-spark{display:block;width:100%;height:100px}
    .wellness-player-detail-section{margin-top:.75rem}.wellness-player-detail-section h4{margin:0 0 .42rem;color:#334155;font-size:.72rem}.wellness-player-record-list{display:grid;gap:.38rem}.wellness-player-record{padding:.56rem .62rem;border:1px solid #e8ecf0;border-radius:12px;background:#fff}.wellness-player-record-top{display:flex;align-items:center;justify-content:space-between;gap:.55rem}.wellness-player-record-top strong{color:#475569;font-size:.62rem}.wellness-player-record-values{display:flex;flex-wrap:wrap;gap:.26rem;margin-top:.32rem}.wellness-player-record-values span{padding:.21rem .34rem;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:.52rem;font-weight:750}.wellness-player-record p{margin:.38rem 0 0;color:#687587;font-size:.57rem;line-height:1.4;white-space:pre-wrap}
    .wellness-player-rpe-row{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .58rem;border-bottom:1px solid #edf0f3}.wellness-player-rpe-row:last-child{border-bottom:0}.wellness-player-rpe-row div{min-width:0}.wellness-player-rpe-row strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:.61rem}.wellness-player-rpe-row small{display:block;margin-top:.08rem;color:#94a0ae;font-size:.52rem}.wellness-player-rpe-score{font-size:.68rem!important;color:#334155!important;flex:0 0 auto}
    .wellness-player-empty{padding:.75rem;border:1px dashed #dbe2e8;border-radius:12px;color:#8b97a5;font-size:.6rem;text-align:center}
  }
  @media(min-width:761px) and (max-width:1366px) and (any-pointer:coarse){#view-wellness .wellness-player-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}
function metric(label,value,suffix,tone){
  const shown=value==null?'—':`${Number.isInteger(value)?value:value.toFixed(1)}${suffix||''}`;
  return `<span class="wellness-player-metric ${tone||'neutral'}"><small>${esc(label)}</small><strong>${shown}</strong></span>`;
}
function alertMarkup(items){
  if(!items.length)return'';
  return `<div class="wellness-individual-alerts">${items.map(item=>{
    const a=item.alert;
    const parts=[];
    if(a.maxStreak>=3)parts.push(`${a.maxStreak} sesiones seguidas con RPE ≥ ${HIGH_RPE}`);
    if(a.mean>=WEEKLY_HIGH_MEAN)parts.push(`media 7 días ${a.mean.toFixed(1)}/10`);
    return `<div class="load-alert"><strong>${esc(item.player.name)} · revisar carga</strong><small>${esc(parts.join(' · '))}</small></div>`;
  }).join('')}</div>`;
}
function renderModernInspector(){
  if(rendering||!mobileViewport()||!coach())return;
  const panel=document.getElementById('wellness-coach-inspector');if(!panel)return;
  const signature=dataSignature();
  if(panel.querySelector('.wellness-player-grid')&&panel.dataset.individualTrackingSignature===signature)return;
  rendering=true;
  try{
    ensureStyles();
    const items=players().map(summary).sort((a,b)=>{
      if(Boolean(a.alert)!==Boolean(b.alert))return a.alert?-1:1;
      const af=a.latestFatigue??-1,bf=b.latestFatigue??-1;if(af!==bf)return bf-af;
      return String(a.player.name||'').localeCompare(String(b.player.name||''),'es');
    });
    const alerts=items.filter(item=>item.alert);
    const cards=items.map(item=>{
      const p=item.player,disc=item.discomfort;
      const position=p.position||p.role||'Jugadora';
      const number=p.number??p.dorsal??'•';
      const latestLabel=item.lastDate?`Último registro ${shortDate(item.lastDate)}`:'Sin registros de bienestar';
      return `<button type="button" class="wellness-player-card ${item.alert?'is-alert':''}" data-player-id="${esc(p.id)}">
        <span class="wellness-player-card-head"><span class="wellness-player-id"><span class="wellness-player-badge">${esc(number)}</span><span><strong>${esc(p.name||'Jugadora')}</strong><small>${esc(position)}</small></span></span><i data-lucide="chevron-right" class="wellness-player-arrow"></i></span>
        <span class="wellness-player-metrics">${metric('Fatiga',item.latestFatigue,'/5',fatigueTone(item.latestFatigue))}${metric(disc.label,disc.value,disc.suffix,disc.tone)}${metric('Último RPE',item.lastRpe,'/10',rpeTone(item.lastRpe))}${metric('Registros',item.logs.length,'','neutral')}</span>
        <span class="wellness-player-foot"><span class="wellness-trend-pill ${item.trend.tone}">${esc(item.trend.label)}</span>${item.alert?'<span class="wellness-alert-mini"><i data-lucide="triangle-alert"></i>Carga alta</span>':`<span>${esc(latestLabel)}</span>`}</span>
      </button>`;
    }).join('')||'<div class="wellness-player-empty">No hay jugadoras en la plantilla.</div>';
    panel.classList.add('wellness-individual-modern');
    panel.dataset.individualTrackingSignature=signature;
    panel.innerHTML=`<div class="wellness-individual-head"><div><h3>Seguimiento individual</h3><p>Lectura rápida de bienestar, molestias y carga reciente de cada jugadora.</p></div><span class="wellness-individual-count">${items.length} jugadoras</span></div>${alertMarkup(alerts)}<div class="wellness-player-grid">${cards}</div>`;
    panel.querySelectorAll('.wellness-player-card[data-player-id]').forEach(card=>card.addEventListener('click',()=>openPlayerModal(card.dataset.playerId)));
    if(window.lucide)try{lucide.createIcons();}catch(_){}
  }finally{rendering=false;}
}
function sparkline(rows){
  const values=rows.slice(0,8).reverse().map(row=>({value:fatigue(row),date:dateKey(row)})).filter(point=>point.value!=null);
  if(values.length<2)return'<div class="wellness-player-empty">Aún no hay suficientes registros para mostrar tendencia.</div>';
  const width=320,height=100,left=10,right=10,top=8,bottom=26,plotW=width-left-right,plotH=height-top-bottom;
  const x=index=>left+(values.length===1?plotW/2:index*(plotW/(values.length-1)));
  const y=value=>top+((5-Math.max(0,Math.min(5,value)))/5)*plotH;
  const points=values.map((point,index)=>`${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const circles=values.map((point,index)=>`<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="3.2" fill="#ffffff" stroke="#64748b" stroke-width="1.6"><title>${esc(shortDate(point.date))}: ${point.value}/5</title></circle>`).join('');
  const labels=values.map((point,index)=>`<text x="${x(index).toFixed(1)}" y="${height-5}" text-anchor="middle" font-size="7.5" fill="#94a3b8">${esc(shortDate(point.date))}</text>`).join('');
  return `<svg class="wellness-player-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolución reciente de fatiga"><line x1="${left}" y1="${y(3).toFixed(1)}" x2="${width-right}" y2="${y(3).toFixed(1)}" stroke="#e8edf2" stroke-width="1" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels}</svg>`;
}
function recordMarkup(row){
  const f=fatigue(row),s=sleep(row),d=discomfort(row),note=String(row?.notes||'').trim();
  const values=[`Fatiga ${f==null?'—':`${f}/5`}`,`Sueño ${s==null?'—':`${s}/5`}`,`${d.label} ${d.value==null?'—':`${d.value}${d.suffix}`}`];
  return `<article class="wellness-player-record"><div class="wellness-player-record-top"><strong>${esc(longDate(dateKey(row)))}</strong></div><div class="wellness-player-record-values">${values.map(value=>`<span>${esc(value)}</span>`).join('')}</div>${note?`<p>${esc(note)}</p>`:''}</article>`;
}
function rpeMarkup(row){
  const event=row.event||{};
  const title=event.title||'Entrenamiento';
  const raw=String(event.date||event.startDate||event.starts_at||'').slice(0,10);
  return `<div class="wellness-player-rpe-row"><div><strong>${esc(title)}</strong><small>${esc(shortDate(raw))}</small></div><strong class="wellness-player-rpe-score">${row.rpeVal.toFixed(1)}/10</strong></div>`;
}
function openPlayerModal(playerId){
  if(!mobileViewport()||!coach())return;
  const player=playerById(playerId);if(!player)return;
  const item=summary(player),latest=item.latest,disc=item.discomfort,status=statusFor(item);
  document.querySelector('.wellness-player-tracking-modal')?.remove();
  const modal=document.createElement('div');
  modal.className='modal-backdrop active wellness-player-tracking-modal';
  const lastLabel=item.lastDate?`Último bienestar: ${longDate(item.lastDate)}`:'Sin respuestas de bienestar';
  const logList=item.logs.slice(0,8).map(recordMarkup).join('')||'<div class="wellness-player-empty">No hay registros de bienestar para esta jugadora.</div>';
  const rpeList=item.rpes.slice(0,6).map(rpeMarkup).join('')||'<div class="wellness-player-empty">No hay RPE registrados para esta jugadora.</div>';
  modal.innerHTML=`<div class="modal-content"><div class="modal-header"><div><h3>${esc(player.name||'Jugadora')}</h3><div class="wellness-player-modal-meta"><small>${esc(lastLabel)}</small><span class="wellness-player-status ${status.tone}">${esc(status.label)}</span></div></div><button type="button" class="modal-close" aria-label="Cerrar">&times;</button></div><div class="modal-body">
    <div class="wellness-player-modal-summary">
      <div class="wellness-player-modal-metric ${fatigueTone(item.latestFatigue)}"><small>Fatiga actual</small><strong>${item.latestFatigue==null?'—':`${item.latestFatigue.toFixed(1)}/5`}</strong></div>
      <div class="wellness-player-modal-metric ${sleepTone(item.latestSleep)}"><small>Sueño</small><strong>${item.latestSleep==null?'—':`${item.latestSleep.toFixed(1)}/5`}</strong></div>
      <div class="wellness-player-modal-metric ${disc.tone}"><small>${esc(disc.label)}</small><strong>${disc.value==null?'—':`${disc.value.toFixed(1)}${disc.suffix}`}</strong></div>
      <div class="wellness-player-modal-metric ${rpeTone(item.lastRpe)}"><small>Último RPE</small><strong>${item.lastRpe==null?'—':`${item.lastRpe.toFixed(1)}/10`}</strong></div>
    </div>
    <div class="wellness-player-spark-wrap"><div class="wellness-player-spark-head"><strong>Evolución reciente de fatiga</strong><span>${esc(item.trend.label)}</span></div>${sparkline(item.logs)}</div>
    <section class="wellness-player-detail-section"><h4>Últimos registros de bienestar</h4><div class="wellness-player-record-list">${logList}</div></section>
    <section class="wellness-player-detail-section"><h4>RPE reciente</h4><div>${rpeList}</div></section>
  </div></div>`;
  const close=()=>{modal.remove();document.body.classList.remove('modal-open');};
  modal.querySelector('.modal-close')?.addEventListener('click',close);
  modal.addEventListener('click',event=>{if(event.target===modal)close();});
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  if(window.lucide)try{lucide.createIcons();}catch(_){}
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;renderModernInspector();});
}
function install(attempt=0){
  ensureStyles();
  const view=document.getElementById('view-wellness');
  if(!view){if(attempt<120)setTimeout(()=>install(attempt+1),50);return;}
  if(!observer){
    observer=new MutationObserver(()=>schedule());
    observer.observe(view,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  schedule();
}
window.openWellnessPlayerTracking=openPlayerModal;
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
