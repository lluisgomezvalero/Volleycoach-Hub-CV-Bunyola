export const participationOptions=[['','Sin registrar'],['none','No participó ni calentó'],['warmup','Solo calentó'],['low','Jugó poco · baja'],['medium','Jugó aproximadamente la mitad · media'],['high','Jugó casi todo · alta']];
export function matchExposure(events,rows,playerId,now=Date.now()){
 const observations=new Map(rows.filter(r=>r.player_id===playerId).map(r=>[r.event_id,r.category]));
 const result={total:0,pending:0,none:0,warmup:0,low:0,medium:0,high:0};
 const seen=new Set();
 for(const e of events){
  if(seen.has(e.id))continue;seen.add(e.id);
  const start=Date.parse(e.starts_at),end=Date.parse(e.ends_at||e.starts_at);
  if(!['match','friendly'].includes(e.event_type)||/cancel|anulad|eliminad/i.test(e.status||'')||!Number.isFinite(start)||!Number.isFinite(end)||start>now||end>now||now-start>=7*86400000)continue;
  result.total++;const category=observations.get(e.id);
  if(participationOptions.some(([key])=>key&&key===category))result[category]++;else result.pending++;
 }
 return result;
}
export function exposureCopy(summary){
 const labels={none:'sin participación ni calentamiento',warmup:'solo calentamiento',low:'participación baja',medium:'participación media',high:'participación alta'};
 return Object.entries(labels).filter(([key])=>summary[key]).map(([key,label])=>`${summary[key]} ${summary[key]===1?'partido':'partidos'} · ${label}`).concat(summary.pending?[`${summary.pending} ${summary.pending===1?'partido pendiente':'partidos pendientes'} de registrar`]:[]).join('; ');
}
// Dependencies are injected to preserve the deployed app's single React/client runtime.
export function createMatchExposureUI(React,jsx,db,useIdentity){
 const {jsx:h,jsxs:hs}=jsx;
 function Editor({event,isStaff}){
  const {identity}=useIdentity();
  const [players,setPlayers]=React.useState([]),[saved,setSaved]=React.useState({}),[values,setValues]=React.useState({}),[loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState(''),[error,setError]=React.useState('');
  const allowed=['match','friendly'].includes(event.event_type)&&isStaff&&event.team_id;
  React.useEffect(()=>{let active=true;if(!allowed)return;setLoading(true);setError('');
   Promise.all([db.from('players').select('id,dorsal,profiles:profile_id(full_name,username)').eq('team_id',event.team_id).eq('active',true).order('dorsal'),db.from('match_participation').select('player_id,category').eq('event_id',event.id)]).then(([roster,records])=>{if(!active)return;if(roster.error||records.error)throw roster.error||records.error;const initial=Object.fromEntries((records.data||[]).map(r=>[r.player_id,r.category||'']));setPlayers(roster.data||[]);setSaved(initial);setValues(initial);}).catch(()=>{if(active)setError('No se pudo cargar la participación. Vuelve a abrir el partido.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[event.id,event.team_id,allowed]);
  if(!allowed)return null;
  const finished=Date.parse(event.ends_at||event.starts_at)<=Date.now();
  const changed=players.filter(p=>(values[p.id]||'')!==(saved[p.id]||''));
  async function save(){if(!finished||busy||!changed.length)return;setBusy(true);setError('');setMessage('');try{
   const rows=changed.map(p=>({event_id:event.id,player_id:p.id,category:values[p.id]||null,recorded_by:identity.profile.id,updated_at:new Date().toISOString()}));
   if(!rows.length)return;
   const {error}=await db.from('match_participation').upsert(rows,{onConflict:'event_id,player_id'});if(error)throw error;
   setSaved({...values});setMessage('Participación guardada.');window.dispatchEvent(new Event('match-exposure-updated'));
  }catch{setError('No se pudo guardar. Tus cambios siguen aquí; vuelve a intentarlo.');}finally{setBusy(false);}}
  return hs('section',{className:'match-exposure-editor',children:[h('h3',{children:'Participación en el partido'}),h('p',{children:'Observación del entrenador. No calcula UA ni sustituye el RPE individual.'}),h('small',{children:'Criterio práctico: baja = jugó poco; media = aproximadamente la mitad; alta = casi todo. Incluye por separado a quien solo calentó. No es una escala científica validada.'}),!finished?h('p',{children:'Podrás registrar la participación cuando termine el partido.'}):null,loading?h('p',{children:'Cargando jugadoras…'}):players.map(p=>hs('label',{className:'match-exposure-row',children:[h('span',{children:`${p.dorsal?`${p.dorsal} · `:''}${p.profiles?.full_name||p.profiles?.username||'Jugadora'}`}),h('select',{'aria-label':`Participación de ${p.profiles?.full_name||p.profiles?.username||'jugadora'}`,value:values[p.id]||'',disabled:busy||!finished||!!error&&players.length===0,onChange:e=>{setValues(v=>({...v,[p.id]:e.target.value}));setMessage('');},children:participationOptions.map(([value,label])=>h('option',{value,children:label},value))})]},p.id)),error?h('p',{role:'alert',children:error}):null,message?h('p',{role:'status',children:message}):null,h('button',{type:'button',className:'calendar-primary-action',disabled:loading||busy||!finished||!changed.length,onClick:save,children:busy?'Guardando…':`Guardar participación${changed.length?` (${changed.length})`:''}`})]});
 }
 function Summary({playerId}){
  const [state,setState]=React.useState({loading:true});
  React.useEffect(()=>{let active=true;async function refresh(){try{const now=Date.now(),from=new Date(now-7*86400000).toISOString();const player=await db.from('players').select('team_id').eq('id',playerId).single();if(player.error)throw player.error;
   const scoped=await db.from('events').select('id,event_type,starts_at,ends_at,status').eq('team_id',player.data.team_id).in('event_type',['match','friendly']).gte('starts_at',from).lte('starts_at',new Date(now).toISOString());if(scoped.error)throw scoped.error;
   const ids=(scoped.data||[]).map(e=>e.id);let rows=[];if(ids.length){const response=await db.from('match_participation').select('event_id,player_id,category').eq('player_id',playerId).in('event_id',ids);if(response.error)throw response.error;rows=response.data||[];}
   if(active)setState({summary:matchExposure(scoped.data||[],rows,playerId,now)});
  }catch{if(active)setState({error:true});}}if(playerId){setState({loading:true});refresh();}else setState({});window.addEventListener('match-exposure-updated',refresh);return()=>{active=false;window.removeEventListener('match-exposure-updated',refresh);};},[playerId]);
  if(!playerId)return null;
  return h('span',{className:'match-exposure-summary',children:state.loading?'Cargando exposición a partidos…':state.error?'Exposición a partidos no disponible.':state.summary?.total?`Partidos y amistosos · últimos 7 días: ${exposureCopy(state.summary)}. Registro del entrenador; separado de las UA.`:'Sin partidos ni amistosos finalizados en los últimos 7 días.'});
 }
 return {Editor,Summary};
}
