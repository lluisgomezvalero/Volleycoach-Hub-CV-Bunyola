import {deriveStats} from './match-report-model-feedback-20261004.js';
export function explainStats(stats, individual=false) {
  const d=deriveStats(stats),r=stats.reception,a=stats.attack,s=stats.serve,b=stats.block;
  const percent=n=>n==null?'sin porcentaje disponible':`${n.toFixed(1)} %`;
  const messages={};
  if(d.ownPoints!=null)messages.headline=`${individual?'Aportaste':'El equipo consiguió'} ${d.ownPoints} puntos propios: ${a.points} de ataque, ${s.aces} de saque y ${b.points} de bloqueo.`;
  else messages.headline='Esta lectura explica tus acciones registradas en el partido.';
  if(r&&d.receptionTotal>0)messages.positive=`${individual?'Conseguiste':'Conseguimos'} ${r.positive} recepciones positivas de ${d.receptionTotal} (${percent(d.receptionPositive)}). Son las acciones marcadas con # o +.`;
  else if(a?.int>0)messages.positive=`${a.points} de ${a.int} ataques acabaron en punto. ${d.attackContinuities} continuaron en juego.`;
  else if(s?.int>0)messages.positive=`${s.aces} de ${s.int} saques fueron ace; ${d.serveContinuities} continuaron en juego.`;
  else if(stats.defense?.positive>0)messages.positive=`${stats.defense.positive} acciones positivas de defensa registradas.`;
  else if(stats.setting?.positive>0)messages.positive=`${stats.setting.positive} colocaciones positivas registradas.`;
  const errors=[];
  if(r?.errors>0)errors.push(`${r.errors} errores de recepción`);
  if(a?.errors>0)errors.push(`${a.errors} errores de ataque`);
  if(s?.errors>0)errors.push(`${s.errors} errores de saque`);
  if(errors.length){messages.key_issue=`Para revisar: ${errors.join(', ')}. Son acciones registradas; su causa necesita el contexto del partido.`;messages.next_objective='Revisar con el entrenador una de estas acciones y acordar un objetivo concreto para el próximo partido.';}
  else messages.next_objective='Acordar con el entrenador qué acción mantener o mejorar en el próximo partido.';
  return messages;
}
