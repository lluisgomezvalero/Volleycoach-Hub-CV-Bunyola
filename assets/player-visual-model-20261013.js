export const playerMetrics=[
  {key:'reception',label:'Recepciones que permiten atacar bien',hint:'Cuanto más alta, mejor.',good:'Más recepciones positivas',bad:'Menos recepciones positivas',group:'reception',numerator:s=>s.reception?.positive,total:s=>s.reception? s.reception.positive+s.reception.exclamative+s.reception.errors:0},
  {key:'attack',label:'Ataques que terminan en punto',hint:'Cuanto más alta, mejor.',good:'Más ataques en punto',bad:'Menos ataques en punto',group:'attack',numerator:s=>s.attack?.points,total:s=>s.attack?.int||0},
  {key:'serve',label:'Saques que entran en juego',hint:'Cuanto más alta, mejor. Incluye los aces.',good:'Menos errores de saque',bad:'Más errores de saque',group:'serve',numerator:s=>s.serve? s.serve.int-s.serve.errors:0,total:s=>s.serve?.int||0}
];
export function playerSeries(items,player,metric){
  return items.filter(item=>item.record?.status==='published').slice().sort((a,b)=>new Date(a.event.starts_at)-new Date(b.event.starts_at)||String(a.event.id).localeCompare(String(b.event.id))).map(item=>{
    const entry=item.record.payload?.report?.players?.find(p=>player.player_id?p.player_id===player.player_id:!p.player_id&&p.name===player.name);
    const stats=entry?.stats||{},total=metric.total(stats),count=metric.numerator(stats);
    return total>0&&Number.isFinite(count)?{id:item.event.id,label:item.label,date:item.event.starts_at,opponent:item.event.payload?.opponent||item.record.payload.report.match?.opponent||'',total,count,value:count/total*100}:null;
  }).filter(Boolean);
}
export function playerTrend(points){
  if(points.length<2)return {tone:'neutral',label:'Necesitamos dos partidos con acciones para comparar',delta:null};
  const delta=points.at(-1).value-points.at(-2).value;
  return {tone:Math.abs(delta)<0.05?'neutral':delta>0?'improving':'declining',label:Math.abs(delta)<0.05?'Te mantienes':delta>0?'↑ Mejoras respecto al partido anterior':'↓ Baja respecto al partido anterior',delta};
}
