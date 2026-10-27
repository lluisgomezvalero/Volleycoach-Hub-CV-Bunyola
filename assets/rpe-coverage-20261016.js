import {individualMinutes} from './individual-minutes-20261015.js?v=runtime-20261027-icons';
const WEEK=7*86400000;
// Descriptive coverage only. It does not change load, reference or ACWR calculations.
export function rpeCoverage(events,attendance,rpes,playerId,duration,now=Date.now()){
 const rows=new Map(attendance.filter(row=>row.player_id===playerId).map(row=>[row.event_id,row]));
 const scores=new Set(rpes.filter(row=>row.player_id===playerId&&['player','coach_for_player'].includes(row.source)&&row.score!==null&&row.score!==undefined&&row.score!==''&&Number.isFinite(Number(row.score))&&Number(row.score)>=0&&Number(row.score)<=10).map(row=>row.event_id));
 const result={performed:0,registered:0,pending:0,absences:0,unconfirmed:0,missingMinutes:0,sessions:0,additional:0};
 const seen=new Set();
 for(const event of events){
  if(event._additionalPlayer&&event._additionalPlayer!==playerId)continue;if(seen.has(event.id))continue;seen.add(event.id);
  if(event.event_type&&event.event_type!=='training'||['cancelled','canceled','deleted'].includes(event.status))continue;
  const start=Date.parse(event.starts_at),minutes=duration(event),end=event.ends_at?Date.parse(event.ends_at):Number.isFinite(start)&&minutes>0?start+minutes*60000:NaN;
  if(!Number.isFinite(start)||now-start<0||now-start>=WEEK||!Number.isFinite(end)||end>now)continue;
  result.sessions++;if(event._additionalPlayer)result.additional++;const row=rows.get(event.id);
  if(['justified','unjustified'].includes(row?.official_status)){result.absences++;continue;}
  if(!['present','late'].includes(row?.official_status)){result.unconfirmed++;continue;}
  result.performed++;
  if(scores.has(event.id))result.registered++;else result.pending++;
  if(!(individualMinutes(row,minutes)>0))result.missingMinutes++;
 }
 return {...result,incomplete:result.pending>0||result.unconfirmed>0||result.missingMinutes>0};
}
export function coverageCopy(coverage){
 if(!coverage)return null;
 const c=coverage,details=[];
 const summary=c.performed?`${c.registered} de ${c.performed} ${c.additional?'actividades realizadas tienen':'entrenamientos realizados tienen'} RPE registrado.`:c.sessions?'Sin participación confirmada en los entrenamientos finalizados.':'No hay entrenamientos finalizados en los últimos 7 días.';
 if(c.pending)details.push(`Falta RPE en ${c.pending} entrenamiento${c.pending===1?'':'s'}.`);
 if(c.unconfirmed)details.push(`Asistencia pendiente de confirmar en ${c.unconfirmed} entrenamiento${c.unconfirmed===1?'':'s'}.`);
 if(c.missingMinutes)details.push(`Revisa los minutos individuales de ${c.missingMinutes} entrenamiento${c.missingMinutes===1?'':'s'}.`);
 if(c.absences)details.push(`${c.absences} ausencia${c.absences===1?'':'s'} confirmada${c.absences===1?'':'s'}; no cuenta${c.absences===1?'':'n'} como pendiente${c.absences===1?'':'s'}.`);
 return {summary,details:details.join(' '),warning:c.incomplete?'Carga registrada incompleta':null};
}
