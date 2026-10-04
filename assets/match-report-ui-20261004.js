import {r as React,j as jsx,s as db} from './index-NTH10f-r.js';
import {deriveStats,validateReport,reportExample} from './match-report-model-20261004.js';
const h=(type,props,...children)=>jsx.jsxs(type,{...props,children:children.length===1?children[0]:children});
const pct=v=>v==null?'—':`${v.toFixed(1)}%`;
const names={reception:'Recepción',attack:'Ataque',serve:'Saque',block:'Bloqueo',defense:'Defensa',setting:'Colocación'};
const labels={positive:'Positivas',exclamative:'Exclamativas (!, -)',errors:'Errores',int:'INT · Total de acciones',points:'Puntos',aces:'Aces',total:'Total'};
function KPI({label,value}){return h('article',{className:'report-kpi'},h('small',null,label),h('strong',null,value));}
function StatsCards({stats}){
  const d=deriveStats(stats);
  return h('div',{className:'report-data-grid'},...Object.entries(names).filter(([key])=>stats[key]&&Object.values(stats[key]).some(n=>n>0)).map(([key,name])=>{
    const rows=Object.entries(stats[key]).map(([field,value])=>[labels[field],value]);
    if(key==='reception')rows.push(['Positivas / total',`${stats[key].positive} / ${d.receptionTotal}`],['% positiva',pct(d.receptionPositive)],['% error',pct(d.receptionError)]);
    if(key==='attack')rows.push(['% punto',pct(d.attackPoint)],['% error',pct(d.attackError)],['Eficacia',pct(d.attackEfficiency)],['Continuidades',d.attackContinuities]);
    if(key==='serve')rows.push(['% ace',pct(d.serveAce)],['% error',pct(d.serveError)],['Continúan',d.serveContinuities]);
    return h('section',{className:'report-data-card',key},h('h3',null,name),h('dl',null,...rows.map(([label,value])=>h('div',{key:label},h('dt',null,label),h('dd',null,value)))));
  }),stats.opponent_errors!=null?h(KPI,{label:'Errores del rival',value:stats.opponent_errors}):null);
}
function SetChart({sets}){
  const points=sets.map(set=>({label:`S${set.number}`,...deriveStats(set.stats)}));
  const x=i=>45+(points.length>1?i*240/(points.length-1):120),y=v=>125-v*.8;
  const series=[['receptionPositive','#c78c12','Recepción positiva'],['attackEfficiency','#267b81','Eficacia de ataque']];
  return h('figure',{className:'report-chart'},h('svg',{viewBox:'0 0 330 225',role:'img','aria-label':'Evolución de recepción positiva y eficacia de ataque por set'},...[100,50,0,-50,-100].map(v=>h('g',{key:v},h('line',{x1:40,x2:300,y1:y(v),y2:y(v),stroke:'#e4e8ed'}),h('text',{x:2,y:y(v)+4,fontSize:10},`${v}%`))),...series.map(([key,color,label])=>h('g',{key},h('polyline',{points:points.map((p,i)=>p[key]==null?null:`${x(i)},${y(p[key])}`).filter(Boolean).join(' '),fill:'none',stroke:color,strokeWidth:3}),...points.map((p,i)=>p[key]==null?null:h('circle',{key:i,cx:x(i),cy:y(p[key]),r:4,fill:color})))),...points.map((p,i)=>h('text',{key:i,x:x(i),y:221,textAnchor:'middle',fontSize:12},p.label))),h('figcaption',null,...series.map(([key,color,label])=>h('span',{key,style:{color}},label))),h('div',{className:'report-set-values'},...points.map(p=>h('p',{key:p.label},h('strong',null,p.label),` · Recepción ${pct(p.receptionPositive)} / Ataque ${pct(p.attackEfficiency)}`))));
}
export function MatchReportView({report,staff=false}){
  const [tab,setTab]=React.useState('Resumen'),[selected,setSelected]=React.useState('');
  const player=report.players.find(p=>(p.player_id||p.name)===selected);
  const d=deriveStats(report.totals),c=report.conclusions;
  return h('section',{className:'match-report'},h('header',{className:'report-header'},h('small',null,`Jornada ${report.match.round}`),h('h2',null,`CV Bunyola ${report.match.result.ours}-${report.match.result.theirs} ${report.match.opponent}`),h('p',null,report.headline)),h('div',{className:'report-tabs',role:'tablist','aria-label':'Análisis del partido'},...['Resumen','Por sets','Jugadoras',...(staff?['Datos completos']:[])].map(name=>h('button',{type:'button',role:'tab','aria-selected':name===tab,key:name,onClick:()=>setTab(name)},name))),h('div',{role:'tabpanel',className:'report-panel'},
    tab==='Resumen'?h(React.Fragment,null,h('div',{className:'report-kpis'},h(KPI,{label:'Recepción positiva',value:pct(d.receptionPositive)}),h(KPI,{label:'Eficacia de ataque',value:pct(d.attackEfficiency)}),h(KPI,{label:'Saque · aces / errores',value:`${report.totals.serve.aces} / ${report.totals.serve.errors}`}),h(KPI,{label:'Puntos propios',value:d.ownPoints??'—'})),h('p',{className:'report-point-split'},`Puntos propios: ${d.ownPoints??'—'} · Errores rival: ${report.totals.opponent_errors??'Sin dato'}`),h('section',{className:'report-conclusions'},h('h3',null,'Qué nos llevamos del partido'),...Object.entries({headline:'Resumen',positive:'Punto positivo',key_issue:'A mejorar',next_objective:'Próximo partido'}).filter(([key])=>c[key]).map(([key,label])=>h('p',{key},h('strong',null,`${label}: `),c[key])))):null,
    tab==='Por sets'?(report.sets.length?h(React.Fragment,null,h(SetChart,{sets:report.sets}),...report.sets.map(set=>h('details',{key:set.number,className:'report-set'},h('summary',null,`Set ${set.number}${set.score?` · ${set.score}`:''}`),h(StatsCards,{stats:set.stats})))):h('p',null,'Este informe no incluye datos por sets.')):null,
    tab==='Jugadoras'?h(React.Fragment,null,report.players.length?h('label',null,'Selecciona una jugadora',h('select',{value:selected,onChange:event=>setSelected(event.target.value)},h('option',{value:''},'Seleccionar…'),...report.players.map(p=>h('option',{key:p.player_id||p.name,value:p.player_id||p.name},p.name)))):h('p',null,'Este informe no incluye datos individuales.'),player?h(React.Fragment,null,h('h3',null,`${player.name}${player.position?` · ${player.position}`:''}`),h(StatsCards,{stats:player.stats})):null):null,
    tab==='Datos completos'&&staff?h(React.Fragment,null,h('p',null,'Valores originales del informe. Los porcentajes se calculan a partir de estos datos.'),h('details',null,h('summary',null,'Totales del partido'),h(StatsCards,{stats:report.totals}),h('pre',null,JSON.stringify(report.totals,null,2))),h('details',null,h('summary',null,'JSON completo importado'),h('pre',null,JSON.stringify(report,null,2)))):null));
}
export function LegacyMatchReportView({item,opponent,staff=false}){
  const [tab,setTab]=React.useState('Resumen'),m=item.payload.metrics;
  return h('section',{className:'match-report'},h('header',{className:'report-header'},h('small',null,item.label),h('h2',null,`CV Bunyola ${item.payload.result||'—'} ${opponent}`)),h('div',{className:'report-tabs',role:'tablist','aria-label':'Estadísticas del partido'},...['Resumen','Por sets','Jugadoras',...(staff?['Datos completos']:[])].map(name=>h('button',{type:'button',role:'tab','aria-selected':name===tab,key:name,onClick:()=>setTab(name)},name))),h('div',{className:'report-panel',role:'tabpanel'},tab==='Resumen'?h(React.Fragment,null,h('div',{className:'report-kpis'},h(KPI,{label:'Recepción positiva',value:pct(m.reception_perfect_pct)}),h(KPI,{label:'Eficacia de ataque · registro manual',value:pct(m.attack_efficiency_pct)}),h(KPI,{label:'Saque · aces / errores',value:`${m.aces??'—'} / ${m.serve_errors??'—'}`}),h(KPI,{label:'Puntos propios',value:'Sin datos brutos'})),h('p',null,`Errores rival: ${m.opponent_errors??'Sin dato'}`),h('p',null,'Registro manual anterior. El informe importado añade el resumen, los datos brutos y las conclusiones.')):null,tab==='Por sets'||tab==='Jugadoras'?h('p',null,'Este registro manual no contiene estos datos. Estarán disponibles cuando el entrenador importe un informe.'):null,tab==='Datos completos'&&staff?h('details',null,h('summary',null,'Datos originales del registro manual'),h('pre',null,JSON.stringify(item.record?.payload||{},null,2))):null));
}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bcv\b/g,'').replace(/[^a-z0-9]/g,'');
export function MatchReportImporter({items,team,profile,onClose,onSaved}){
  const [text,setText]=React.useState(''),[preview,setPreview]=React.useState(null),[errors,setErrors]=React.useState([]),[target,setTarget]=React.useState(''),[saving,setSaving]=React.useState(false),[roster,setRoster]=React.useState(null);
  React.useEffect(()=>{let active=true;db.from('players').select('id,position,profiles:profile_id(full_name,username)').eq('team_id',team.id).eq('active',true).then(({data,error})=>{if(active){if(error)setErrors([error.message]);else setRoster(data||[])}});return()=>{active=false}},[team.id]);
  function validate(){
    const result=validateReport(text),problems=[...result.errors];
    if(!roster)problems.push('Espera a que se cargue la plantilla.');
    const report=result.report;
    if(report&&roster){
      for(const p of report.players){const matches=roster.filter(r=>p.player_id?r.id===p.player_id:norm(r.profiles?.full_name||r.profiles?.username)===norm(p.name));if(matches.length!==1)problems.push(`Jugadora no identificada de forma única: ${p.name}. Usa su player_id o el nombre de la plantilla.`);else {p.player_id=matches[0].id;p.position=matches[0].position||p.position;}}
      if(new Set(report.players.map(p=>p.player_id)).size!==report.players.length)problems.push('Dos entradas corresponden a la misma jugadora.');
    }
    if(report?.match.event_id&&target&&report.match.event_id!==target)problems.push("match.event_id no coincide con el partido seleccionado.");
    const selected=items.find(item=>item.event.id===(target||report?.match.event_id));
    if(report&&!selected)problems.push('Selecciona el partido existente al que corresponde el informe.');
    if(report&&selected){
      if(norm(report.match.opponent)!==norm(selected.opponent))problems.push(`El rival no coincide con el partido seleccionado (${selected.opponent}).`);
      const round=Number(selected.label.match(/\d+/)?.[0]);if(round&&report.match.round!==round)problems.push(`La jornada no coincide con el partido seleccionado (${round}).`);
      report.match.event_id=selected.event.id;
    }
    setErrors(problems);setPreview(problems.length?null:report);
  }
  async function publish(){
    if(!preview||saving)return;
    const item=items.find(item=>item.event.id===preview.match.event_id);if(!item)return;
    setSaving(true);setErrors([]);
    try{
      const {data:current,error:readError}=await db.from('match_statistics').select('*').eq('event_id',item.event.id).maybeSingle();if(readError)throw readError;
      const row={event_id:item.event.id,club_id:profile.club_id,team_id:team.id,status:'published',visible_metrics:current?.visible_metrics||[],payload:{...current?.payload,result:`${preview.match.result.ours}-${preview.match.result.theirs}`,report:preview},created_by:current?.created_by||profile.id,published_at:current?.status==='published'&&current?.payload?.report?current.published_at:new Date().toISOString()};
      const {data,error}=await db.from('match_statistics').upsert(row,{onConflict:'event_id'}).select('*').single();if(error)throw error;onSaved(data);
    }catch(error){setErrors([error.message||'No se pudo publicar. El informe no se ha guardado.']);}finally{setSaving(false)}
  }
  return h('div',{className:'stats-modal-backdrop'},h('section',{className:'stats-modal report-importer',role:'dialog','aria-modal':true,'aria-label':'Importar informe de partido'},h('header',{className:'stats-modal-head'},h('div',null,h('h2',null,'Importar informe'),h('p',null,'Pegar JSON → Validar → Previsualizar → Publicar')),h('button',{type:'button',onClick:onClose,disabled:saving,'aria-label':'Cerrar'},'×')),h('div',{className:'stats-modal-scroll'},h('label',null,'Partido existente',h('select',{value:target,disabled:saving,onChange:event=>{setTarget(event.target.value);setPreview(null)}},h('option',{value:''},'Selecciona un partido…'),...items.map(item=>h('option',{key:item.event.id,value:item.event.id},`${item.label} · ${item.opponent}`)))),h('label',null,'Informe JSON',h('textarea',{rows:10,value:text,disabled:saving,onChange:event=>{setText(event.target.value);setPreview(null)},placeholder:'{"version":"cvbunyola_match_report_v1", ...}'})),h('details',null,h('summary',null,'Formato y ejemplo para ChatGPT'),h('p',null,'En totals y en stats de cada set/jugadora usa reception, attack, serve, block, defense y setting. INT contiene puntos/aces y errores. Omite fundamentos sin participación. sets usa {number, score, stats}; players usa {player_id o name, stats}. No incluyas porcentajes.'),h('pre',null,JSON.stringify(reportExample,null,2)),roster?h('details',null,h('summary',null,'Jugadoras e identificadores para el JSON'),h('pre',null,JSON.stringify(roster.map(p=>({player_id:p.id,name:p.profiles?.full_name||p.profiles?.username,position:p.position})),null,2))):null),errors.length?h('div',{className:'stats-error',role:'alert'},...errors.map((error,index)=>h('p',{key:index},error))):null,preview?h('section',{className:'report-preview'},h('h3',null,'Previsualización · no guardada'),h('p',null,`Rival: ${preview.match.opponent} · Jornada ${preview.match.round} · Resultado ${preview.match.result.ours}-${preview.match.result.theirs}`),h('p',null,`${preview.sets.length} sets · ${preview.players.length} jugadoras detectadas`),h('p',null,preview.players.map(p=>p.name).join(', ')),h(MatchReportView,{report:preview,staff:true})):null),h('footer',{className:'stats-modal-actions'},h('button',{type:'button',className:'stats-action-muted',onClick:validate,disabled:saving||!text.trim()},'Validar y previsualizar'),h('button',{type:'button',className:'stats-action-primary',onClick:publish,disabled:saving||!preview},saving?'Publicando…':'Publicar informe'))));
}
