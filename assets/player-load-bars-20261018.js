import {individualMinutes} from './individual-minutes-20261015.js';
const WEEK=7*86400000;
const validScore=r=>r&&r.score!==null&&r.score!==undefined&&r.score!==''&&Number.isFinite(Number(r.score))&&Number(r.score)>=0&&Number(r.score)<=10;
const labels=['Hace 4 periodos','Hace 3 periodos','Hace 2 periodos','Periodo anterior','Últimos 7 días'];
const date=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'short'});
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
// Relative quantity only; incomplete periods never receive a reassuring or alarming color.
export function playerBarTone(week,weeks){
 if(week.incomplete||!week.sessions)return {key:'unknown',label:week.incomplete?'Periodo incompleto':'Sin entrenamientos registrados'};
 const values=weeks.filter(w=>w.sessions&&!w.incomplete).map(w=>w.load),low=Math.min(...values),high=Math.max(...values);
 if(values.length<2||low===high)return {key:'neutral',label:'Sin diferencias para comparar'};
 const share=(week.load-low)/(high-low);
 return share<=.25?{key:'green',label:'Menos carga entre tus periodos completos'}:share<=.5?{key:'yellowgreen',label:'Carga intermedia entre tus periodos completos'}:share<=.75?{key:'amber',label:'Carga intermedia entre tus periodos completos'}:{key:'red',label:'Más carga entre tus periodos completos'};
}
export function createPlayerLoadBars(React,{jsx:h,jsxs:hs}){
 return function PlayerLoadBars({model,showMessage=true}){
  const [selected,setSelected]=React.useState(4);
  if(!model?.weeks)return h('p',{className:'player-load-note',children:'Cargando tus entrenamientos…'});
  const weeks=model.weeks,max=Math.max(...weeks.map(w=>w.load),1),chosen=weeks[selected],tone=playerBarTone(chosen,weeks);
  const message=model.message==='Faltan registros'?'Faltan registros en algunos periodos':model.message==='Referencia insuficiente'?'Todavía no hay suficientes registros para comparar':model.message;
  return hs('div',{className:'player-load-chart',children:[
   hs('div',{className:'player-load-toolbar',children:[showMessage?h('p',{className:'player-load-message',children:message}):null,hs('details',{className:'player-load-help',children:[h('summary',{'aria-label':'Cómo leer las barras de carga',children:'ⓘ'}),hs('div',{className:'player-load-help-copy',children:[h('p',{children:'Cada barra resume 7 días de entrenamientos, combinando cuánto duraron y el esfuerzo que nos contaste. Toca una barra para ver el periodo y si faltan respuestas.'}),h('p',{children:'Verde significa menos carga y rojo más carga respecto a tus otros periodos con registros completos. Los colores no indican si está bien o mal ni el riesgo de lesionarte. Más carga no significa mejorar. Si aún no hay periodos para comparar, el color queda neutro.'}),h('p',{children:'Las barras grises con rayas tienen datos pendientes y pueden estar mostrando solo parte de la carga. Si no hay entrenamientos registrados no podemos confirmar que descansaste. Los partidos se muestran por separado.'})]})]})]}),
   hs('div',{className:'player-load-bars',role:'group','aria-label':'Tus últimos cinco periodos de siete días',children:weeks.map((w,index)=>{const color=playerBarTone(w,weeks);return hs('button',{type:'button',className:`player-load-bar tone-${color.key}${selected===index?' selected':''}${w.incomplete?' incomplete':''}`,'aria-pressed':selected===index,'aria-label':`${w.label}, ${w.period}. ${color.label}. ${w.registered} de ${w.performed} entrenamientos registrados.`,onClick:()=>setSelected(index),children:[h('span',{className:'player-load-bar-track',children:h('span',{className:'player-load-bar-fill',style:{height:`${w.load/max*100}%`}})}),h('small',{children:w.label}),w.incomplete?h('span',{className:'player-load-bar-pending',children:'Faltan datos'}):null]},w.label);})}),
   hs('div',{className:'player-load-legend','aria-label':'El color indica cantidad de carga, no una valoración de salud',children:[h('span',{children:'Menos carga'}),h('i',{'aria-hidden':true}),h('span',{children:'Más carga'})]}),
   hs('div',{className:'player-load-selection',role:'status','aria-live':'polite',children:[h('strong',{children:chosen.label}),h('small',{children:chosen.period}),h('span',{children:tone.label}),chosen.performed?h('span',{children:`${chosen.registered} de ${chosen.performed} entrenamientos con tu esfuerzo registrado.`}):null,chosen.pending?h('span',{className:'player-load-warning',children:`Faltan datos de ${chosen.pending} ${chosen.pending===1?'entrenamiento':'entrenamientos'}.`}):null,chosen.absences?h('span',{children:`${chosen.absences} ${chosen.absences===1?'ausencia confirmada':'ausencias confirmadas'}.`}):null,!chosen.sessions?h('span',{children:'Sin entrenamientos registrados; no permite confirmar descanso.'}):null]})
  ]});
 };
}
