export const playerMetrics=[
  {key:'reception',label:'Recepciones que permiten atacar bien',hint:'Cuanto más alta, mejor.',good:'Más recepciones positivas',bad:'Menos recepciones positivas',group:'reception',numerator:s=>s.reception?.positive,total:s=>s.reception? s.reception.positive+s.reception.exclamative+s.reception.errors:0},
  {key:'attack',label:'Ataques que terminan en punto',hint:'Cuanto más alta, mejor.',good:'Más ataques en punto',bad:'Menos ataques en punto',group:'attack',numerator:s=>s.attack?.points,total:s=>s.attack?.int||0},
  {key:'serve',label:'Saques que entran en juego',hint:'Cuanto más alta, mejor. Incluye los aces.',good:'Menos errores de saque',bad:'Más errores de saque',group:'serve',numerator:s=>s.serve? s.serve.int-s.serve.errors:0,total:s=>s.serve?.int||0}
];
const countMetric=(key,label,group,field)=>({key,label,group,unit:'count',hint:'Recuento por partido. El tiempo de participación también influye.',numerator:s=>s[group]?.[field],total:()=>null});
playerMetrics.push(countMetric('block','Bloqueos que terminan en punto','block','points'),countMetric('setting','Colocaciones que terminan en punto','setting','points'),countMetric('defense','Defensas positivas','defense','positive'),countMetric('aces','Aces de saque','serve','aces'));
const positionGroups={central:['block','attack'],setter:['setting','defense'],libero:['reception','defense'],receiver:['reception','defense','attack'],opposite:['attack','defense']};
export function metricsForPosition(position){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
 const roles=String(position||'').split(/[/,;+]/).map(normalize).map(part=>['central','centrales','z'].includes(part)?'central':['colocadora','colocador','collocadora','c','setter'].includes(part)?'setter':['libero','libera','l'].includes(part)?'libero':['receptora','receptor','atacantereceptora','atacantreceptora','ar'].includes(part)?'receiver':['opuesta','opuesto','oposit','op','opposite'].includes(part)?'opposite':null).filter(Boolean);
 const keys=[...new Set(roles.flatMap(role=>positionGroups[role])),'aces'];
 if(!roles.length)return playerMetrics.filter(metric=>metric.key!=='serve');
 return keys.map(key=>playerMetrics.find(metric=>metric.key===key));
}
export const playerMetricValue=(metric,point)=>metric.unit==='count'?String(point.count):`${point.value.toFixed(1)}%`;
export function playerMetricDetail(metric,point){
 if(metric.unit==='count')return `${point.count} ${metric.key==='aces'?'aces de saque':metric.key==='block'?'bloqueos de punto':metric.key==='setting'?'colocaciones que terminaron en punto':'defensas positivas'}.`;
 return metric.key==='reception'?`${point.count} de tus ${point.total} recepciones permitieron atacar bien.`:metric.key==='attack'?`${point.count} de tus ${point.total} ataques terminaron en punto.`:`${point.count} de tus ${point.total} saques entraron en juego.`;
}
export function playerSeries(items,player,metric){
  return items.filter(item=>item.record?.status==='published').slice().sort((a,b)=>new Date(a.event.starts_at)-new Date(b.event.starts_at)||String(a.event.id).localeCompare(String(b.event.id))).map(item=>{
    const entry=item.record.payload?.report?.players?.find(p=>player.player_id?p.player_id===player.player_id:!p.player_id&&p.name===player.name);
    const stats=entry?.stats||{},total=metric.total(stats),count=metric.numerator(stats);
    return (metric.unit==='count'?Number.isFinite(count)&&count>=0:total>0&&Number.isFinite(count))?{id:item.event.id,label:item.label,date:item.event.starts_at,opponent:item.event.payload?.opponent||item.record.payload.report.match?.opponent||'',total,count,value:metric.unit==='count'?count:count/total*100}:null;
  }).filter(Boolean);
}
export function playerTrend(points){
  if(points.length<2)return {tone:'neutral',label:'Necesitamos dos partidos con acciones para comparar',delta:null};
  const delta=points.at(-1).value-points.at(-2).value;
  return {tone:Math.abs(delta)<0.05?'neutral':delta>0?'improving':'declining',label:Math.abs(delta)<0.05?'Te mantienes':delta>0?'↑ Mejoras respecto al partido anterior':'↓ Baja respecto al partido anterior',delta};
}
