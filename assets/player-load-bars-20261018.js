import {individualMinutes} from './individual-minutes-20261015.js';
const WEEK=7*86400000;
const validScore=r=>r&&r.score!==null&&r.score!==undefined&&r.score!==''&&Number.isFinite(Number(r.score))&&Number(r.score)>=0&&Number(r.score)<=10;
const labels=['Hace 4 periodos','Hace 3 periodos','Hace 2 periodos','Periodo anterior','Últimos 7 días'];
const date=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export function playerLoadWeeks(events,attendance,rpes,playerId,duration,now=Date.now()){
 const weeks=labels.map((label,index)=>({label,start:now-(5-index)*WEEK,end:now-(4-index)*WEEK,load:0,sessions:0,performed:0,registered:0,pending:0,absences:0}));
 const attend=new Map(attendance.filter(r=>r.player_id===playerId).map(r=>[r.event_id,r]));
 const scores=new Map();
 for(const r of rpes.filter(r=>r.player_id===playerId&&['player','coach_for_player'].includes(r.source))){const old=scores.get(r.event_id);if(!old||r.source==='player'&&old.source!=='player'||r.source===old.source&&Date.parse(r.created_at||0)>Date.parse(old.created_at||0))scores.set(r.event_id,r);}
 const seen=new Set();
 for(const e of events){
  if(seen.has(e.id))continue;seen.add(e.id);
  if(e.event_type&&e.event_type!=='training'||/cancel|anulad|eliminad/i.test(e.status||''))continue;
  const start=Date.parse(e.starts_at),sessionMinutes=duration(e),end=e.ends_at?Date.parse(e.ends_at):start+sessionMinutes*60000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end>now||now-start>=5*WEEK)continue;
  const week=weeks[4-Math.floor((now-start)/WEEK)];if(!week)continue;week.sessions++;
  const row=attend.get(e.id);
  if(['justified','unjustified'].includes(row?.official_status)){week.absences++;continue;}
  if(!['present','late'].includes(row?.official_status)){week.pending++;continue;}
  week.performed++;
  const minutes=individualMinutes(row,sessionMinutes),score=scores.get(e.id);
  if(!(minutes>0)||!validScore(score)){week.pending++;continue;}
  week.registered++;week.load+=Math.round(Number(score.score)*minutes);
 }
 for(const week of weeks){week.incomplete=week.pending>0;week.period=`${date.format(new Date(week.start))} – ${date.format(new Date(week.end))}`;}
 const current=weeks[4],previous=weeks.slice(0,4);
 // Product display rule, not a scientific safety threshold: compare only four
 // previous periods with sessions accounted for and no unresolved participation.
 const reference=previous.every(w=>w.sessions>0&&!w.incomplete)?previous.reduce((sum,w)=>sum+w.load,0)/4:null;
 let message='Referencia insuficiente';
 if(current.incomplete||previous.some(w=>w.incomplete))message='Faltan registros';
 else if(!current.sessions)message='Sin entrenamientos finalizados en los últimos 7 días';
 else if(reference>0){const change=current.load/reference;message=change>1.3?'Más carga registrada que en tus semanas anteriores':change<.8?'Menos carga registrada que en tus semanas anteriores':'Similar a tus semanas anteriores';}
 return {weeks,message,reference};
}
export function createPlayerLoadBars(React,{jsx:h,jsxs:hs}){
 return function PlayerLoadBars({model,showMessage=true}){
  const [selected,setSelected]=React.useState(4);
  if(!model?.weeks)return h('p',{className:'player-load-note',children:'Cargando registros de entrenamiento…'});
  const weeks=model.weeks,max=Math.max(...weeks.map(w=>w.load),1),chosen=weeks[selected];
  return hs('div',{className:'player-load-chart',children:[showMessage?h('p',{className:'player-load-message',children:model.message}):null,hs('div',{className:'player-load-bars',role:'group','aria-label':'Carga registrada en cinco periodos de siete días',children:weeks.map((w,index)=>hs('button',{type:'button',className:`player-load-bar${selected===index?' selected':''}${w.incomplete?' incomplete':''}`,'aria-pressed':selected===index,'aria-label':`${w.label}, ${w.period}: ${w.load} UA registradas. ${w.incomplete?'Faltan registros.':!w.sessions?'Sin sesiones registradas.':'Sin datos pendientes en las sesiones registradas.'}`,onClick:()=>setSelected(index),children:[h('span',{className:'player-load-bar-track',children:h('span',{className:'player-load-bar-fill',style:{height:`${w.load/max*100}%`}})}),h('small',{children:w.label}),w.incomplete?h('span',{className:'player-load-bar-pending',children:'Pendiente'}):null]},w.label))}),hs('div',{className:'player-load-selection',role:'status','aria-live':'polite',children:[h('strong',{children:chosen.label}),h('small',{children:chosen.period}),h('span',{children:`${chosen.load} UA registradas · ${chosen.registered} de ${chosen.performed} entrenamientos realizados con carga registrada.`}),chosen.pending?h('span',{className:'player-load-warning',children:`Faltan datos de ${chosen.pending} ${chosen.pending===1?'sesión':'sesiones'} (asistencia, RPE o minutos).`}):null,chosen.absences?h('span',{children:`${chosen.absences} ${chosen.absences===1?'ausencia confirmada':'ausencias confirmadas'}; sin carga de esas sesiones.`}):null,!chosen.sessions?h('span',{children:'Sin sesiones registradas en este periodo; no permite confirmar descanso.'}):null]}),h('p',{className:'player-load-note',children:'Cada barra resume 7 días. UA = esfuerzo comunicado × minutos individuales. Una barra más alta indica más carga registrada; no significa mejorar. Los partidos se muestran por separado.'})]});
 };
}
