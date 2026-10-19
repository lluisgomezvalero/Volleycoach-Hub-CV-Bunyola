export function japoPoints(a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||!((a===2&&(b===0||b===1))||(b===2&&(a===0||a===1))))throw Error('El resultado debe ser 2–0, 2–1, 0–2 o 1–2.');
 return a===2?(b===0?[3,0]:[2,1]):(a===0?[0,3]:[1,2]);
}
export function validateJapo(game){
 japoPoints(game.sets_a,game.sets_b);
 const a=game.team_a,b=game.team_b;
 if(!Array.isArray(a)||!Array.isArray(b)||!a.length||!b.length)throw Error('Selecciona las jugadoras de ambos equipos.');
 if(new Set([...a,...b]).size!==a.length+b.length)throw Error('Una jugadora solo puede estar en un equipo.');
 return game;
}
export function japoStandings(games,players){
 const rows=new Map(players.map(p=>[p.id,{...p,points:0,played:0,wins:0}])),seen=new Set();
 for(const g of games){if(g.voided||seen.has(g.id))continue;seen.add(g.id);validateJapo(g);const points=japoPoints(g.sets_a,g.sets_b);
 for(const [i,ids] of [g.team_a,g.team_b].entries())for(const id of ids){if(!rows.has(id))rows.set(id,{id,name:'Jugadora fuera de la plantilla actual',points:0,played:0,wins:0});const r=rows.get(id);r.points+=points[i];r.played++;r.wins+=(i===0?g.sets_a:g.sets_b)===2?1:0;}}
 const sorted=[...rows.values()].filter(r=>r.played).sort((a,b)=>b.points-a.points||(a.name||'').localeCompare(b.name||'','es'));
 let rank=0;return sorted.map((r,i)=>{if(i===0||r.points!==sorted[i-1].points)rank=i+1;return {...r,rank};});
}
export async function loadJapos(db,teamId,seasonId){
 let result=[];
 for(let start=0;;start+=500){let q=db.from('japo_games').select('id,event_id,team_a,team_b,sets_a,sets_b,voided,updated_at,events!inner(team_id,season_id,starts_at,status)').eq('events.team_id',teamId).order('id').range(start,start+499);if(seasonId)q=q.eq('events.season_id',seasonId);const r=await q;if(r.error)throw r.error;result.push(...r.data);if(r.data.length<500)break;}
 return result.filter(g=>!['cancelled','canceled'].includes(g.events.status));
}
export function createJapos(React,jsx,db){
 const h=jsx.jsx,hs=jsx.jsxs;
 function Body({event,teamId,seasonId,identity}){
 const staff=['coach','administrator'].includes(identity?.profile?.role),own=identity?.player?.id;
 const [games,setGames]=React.useState([]),[players,setPlayers]=React.useState([]),[loading,setLoading]=React.useState(true),[error,setError]=React.useState(''),[draft,setDraft]=React.useState(null),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState('');
 const lock=React.useRef(false),generation=React.useRef(0);
 async function load(){const token=++generation.current;setLoading(true);setError('');try{
 let sid=seasonId;if(!sid){const t=await db.from('teams').select('season_id').eq('id',teamId).single();if(t.error)throw t.error;sid=t.data.season_id;if(!sid)throw Error('No se ha encontrado la temporada del equipo.');}
 const [g,p]=await Promise.all([loadJapos(db,teamId,sid),db.from('players').select('id,display_name,dorsal,profiles:profile_id(full_name,username)').eq('team_id',teamId).order('dorsal')]);if(p.error)throw p.error;if(token!==generation.current)return;
 setGames(g);setPlayers((p.data||[]).map(p=>({...p,name:p.display_name||p.profiles?.full_name||p.profiles?.username||`Jugadora ${p.dorsal??''}`})));
 }catch(e){if(token===generation.current)setError(e.message||'No se pudieron cargar los Japos.');}finally{if(token===generation.current)setLoading(false);}}
 React.useEffect(()=>{load();return()=>{generation.current++;};},[teamId,seasonId,event?.id]);
 async function save(candidate){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{
 validateJapo(candidate);const {id,event_id,team_a,team_b,sets_a,sets_b,voided}=candidate;
 const data={id,event_id,team_a,team_b,sets_a,sets_b,voided:!!voided,recorded_by:identity.profile.id};
 let q=candidate.updated_at?db.from('japo_games').update(data).eq('id',id).eq('updated_at',candidate.updated_at):db.from('japo_games').insert(data);
 let r=await q.select('id,event_id,team_a,team_b,sets_a,sets_b,voided,updated_at,events!inner(team_id,season_id,starts_at,status)').single();
 // A retried insert uses the same UUID, so it cannot double-count a saved game.
 if(r.error?.code==='23505'&&!candidate.updated_at){const existing=await db.from('japo_games').select('id,event_id,team_a,team_b,sets_a,sets_b,voided,updated_at,events!inner(team_id,season_id,starts_at,status)').eq('id',id).single();if(!existing.error&&JSON.stringify([existing.data.team_a,existing.data.team_b,existing.data.sets_a,existing.data.sets_b])===JSON.stringify([team_a,team_b,sets_a,sets_b]))r=existing;}
 if(r.error)throw Error(candidate.updated_at?'No se pudo guardar. Puede haberse modificado desde otro dispositivo; cierra y vuelve a abrir Japos antes de corregirlo.':r.error.message);
 setGames(old=>[...old.filter(g=>g.id!==r.data.id),r.data]);setDraft(null);setNotice(voided?'Resultado anulado.':candidate.updated_at?'Resultado corregido.':'Resultado guardado.');
 }catch(e){setError(e.message||'No se pudo guardar. El resultado sigue aquí para reintentarlo.');}finally{lock.current=false;setBusy(false);}}
 function assign(id,side){setDraft(d=>({...d,team_a:[...d.team_a.filter(x=>x!==id),...(side==='a'?[id]:[])],team_b:[...d.team_b.filter(x=>x!==id),...(side==='b'?[id]:[])]}));}
 const standings=japoStandings(games,players),names=ids=>ids.map(id=>players.find(p=>p.id===id)?.name||'Jugadora fuera de la plantilla actual').join(', '),current=event?games.filter(g=>g.event_id===event.id).sort((a,b)=>a.id.localeCompare(b.id)):[];
 if(loading)return h('p',{role:'status',children:'Cargando Japos…'});
 return hs('div',{className:'japo-body',children:[h('p',{className:'japo-note',children:'Al mejor de 3 sets: 10 · 10 · 5 puntos. 2–0: 3/0 puntos; 2–1: 2/1. Cada jugadora suma los puntos de su equipo.'}),error?hs('div',{role:'alert',children:[h('p',{children:error}),!draft?h('button',{type:'button',onClick:load,children:'Reintentar'}):null]}):null,notice?h('p',{role:'status',children:notice}):null,
 event&&event.season_id&&staff&&!draft&&!error?h('button',{type:'button',className:'japo-primary',onClick:()=>{setNotice('');setDraft({id:crypto.randomUUID(),event_id:event.id,team_a:[],team_b:[],sets_a:2,sets_b:0});},children:'Registrar Japo'}):null,
 draft?hs('fieldset',{disabled:busy,children:[h('legend',{children:draft.updated_at?'Corregir Japo':'Nuevo Japo'}),h('p',{className:'japo-note',children:'Asigna las participantes a A o B. Quien no juega queda fuera del resultado.'}),...players.map(p=>hs('label',{className:'japo-player',children:[h('span',{children:p.name}),hs('select',{'aria-label':`Equipo de ${p.name}`,value:draft.team_a.includes(p.id)?'a':draft.team_b.includes(p.id)?'b':'',onChange:e=>assign(p.id,e.target.value),children:[h('option',{value:'',children:'No juega'}),h('option',{value:'a',children:'Equipo A'}),h('option',{value:'b',children:'Equipo B'})]})]},p.id)),hs('label',{className:'japo-player',children:[h('span',{children:`Resultado · A (${draft.team_a.length}) / B (${draft.team_b.length})`}),hs('select',{value:`${draft.sets_a}-${draft.sets_b}`,onChange:e=>{const [a,b]=e.target.value.split('-').map(Number);setDraft(d=>({...d,sets_a:a,sets_b:b}));},children:['2-0','2-1','0-2','1-2'].map(v=>h('option',{value:v,children:v.replace('-','–')},v))})]}),hs('div',{className:'japo-actions',children:[h('button',{type:'button',className:'japo-primary',onClick:()=>save(draft),children:busy?'Guardando…':'Guardar resultado'}),h('button',{type:'button',onClick:()=>{setDraft(null);setError('');},children:'Cancelar'})]})]}):null,
 current.length?hs('div',{children:[h('h3',{children:'Japos de esta sesión'}),...current.map(g=>hs('details',{children:[h('summary',{children:`A ${g.sets_a}–${g.sets_b} B${g.voided?' · Anulado':''}`}),h('p',{children:`A: ${names(g.team_a)}`}),h('p',{children:`B: ${names(g.team_b)}`}),staff&&!draft&&!g.voided?hs('div',{className:'japo-actions',children:[h('button',{type:'button',disabled:busy,onClick:()=>{setError('');setDraft({...g});},children:'Corregir'}),h('button',{type:'button',disabled:busy,onClick:()=>{if(window.confirm('¿Anular este Japo? Dejará de sumar en la clasificación.'))save({...g,voided:true});},children:'Anular'})]}):null]},g.id))]}):null,
 event&&!event.season_id?h('p',{className:'japo-note',children:'Este entrenamiento no tiene temporada asignada. Complétala antes de registrar Japos.'}):null,h('h3',{children:'Clasificación de la temporada'}),error&&!games.length?null:standings.length?hs('div',{className:'japo-table-wrap',children:[hs('table',{children:[hs('thead',{children:[hs('tr',{children:['Pos.','Jugadora','Pts','Jugados','Victorias'].map(c=>h('th',{scope:'col',children:c},c))})]}),h('tbody',{children:standings.map(r=>hs('tr',{className:r.id===own?'japo-own':'',children:[h('td',{children:r.rank}),h('th',{scope:'row',children:r.name+(r.id===own?' · Tú':'')}),h('td',{children:r.points}),h('td',{children:r.played}),h('td',{children:r.wins})]},r.id))})]}),h('p',{className:'japo-note',children:'Los empates en puntos comparten posición. Las ausentes no suman partidos ni derrotas.'})]}):h('p',{children:'Todavía no hay resultados registrados en esta temporada.'})]});
 }
 return function Japos(props){const [open,setOpen]=React.useState(false);if(!props.teamId)return null;return hs('section',{className:'japo-panel',children:[hs('button',{type:'button',className:'japo-toggle','aria-expanded':open,onClick:()=>setOpen(v=>!v),children:[h('strong',{children:'Japos'}),h('span',{children:open?'Cerrar':'Resultados y clasificación ›'})]}),open?h(Body,props,`${props.teamId}:${props.event?.id||''}:${props.seasonId||''}`):null]});};
}
