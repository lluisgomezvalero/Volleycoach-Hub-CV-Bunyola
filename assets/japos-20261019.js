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
export function japoPodium(standings){return [1,2,3].map(rank=>({rank,players:standings.filter(row=>row.rank===rank)})).filter(group=>group.players.length);}
export function japoInitials(name){return String(name||'J').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();}
export function createJapos(React,jsx,db){
 const h=jsx.jsx,hs=jsx.jsxs;
 function Trophy(){return hs('svg',{viewBox:'0 0 64 64',fill:'none','aria-hidden':true,children:[h('path',{d:'M21 12h22v14c0 10-5 17-11 17s-11-7-11-17V12ZM21 17H12v7c0 7 5 11 12 11M43 17h9v7c0 7-5 11-12 11M32 43v10M22 55h20',stroke:'currentColor',strokeWidth:3.5,strokeLinecap:'round',strokeLinejoin:'round'}),h('path',{d:'m32 19 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L32 19Z',fill:'currentColor'})]});}
 function Board({standings,own,games,identity}){
 const me=standings.find(row=>row.id===own),groups=japoPodium(standings),count=games.filter(game=>!game.voided).length;
 if(!standings.length)return hs('div',{className:'japo-empty-game',children:[h('div',{className:'japo-empty-cup',children:h(Trophy,{})}),h('span',{className:'japo-eyebrow',children:'TODO POR JUGAR'}),h('h3',{children:'El podio está por estrenar'}),h('p',{children:'El primer Japo pondrá esta liga en marcha. ¡A jugar en equipo!'}),h('small',{children:['coach','administrator'].includes(identity?.profile?.role)?'Registra el resultado dentro del entrenamiento.':'Tu entrenador registrará los resultados.'})]});
 return hs('section',{className:'japo-league',children:[hs('div',{className:'japo-league-heading',children:[hs('div',{children:[h('span',{className:'japo-eyebrow',children:'LA LIGA DEL EQUIPO'}),h('h3',{children:'Así va el Japo'})]}),h('span',{className:'japo-game-count',children:`${count} ${count===1?'Japo':'Japos'}`})]}),
 hs('div',{className:'japo-podium','aria-label':'Primeras posiciones de la temporada',children:groups.map(group=>hs('div',{className:`japo-podium-place place-${group.rank}`,children:[h('span',{className:'japo-podium-medal',children:group.rank===1?'★':String(group.rank),'aria-label':`Puesto ${group.rank}`}),...group.players.map(row=>hs('div',{className:'japo-podium-player',children:[h('span',{className:'japo-initials',children:japoInitials(row.name)}),h('strong',{children:row.name}),h('span',{className:'japo-podium-points',children:`${row.points} pts`})]},row.id)),h('span',{className:'japo-podium-step',children:group.rank===1?'1º':`${group.rank}º`})]},group.rank))}),
 me?hs('div',{className:'japo-your-score',children:[h('span',{className:'japo-initials',children:japoInitials(me.name)}),hs('div',{children:[h('small',{children:'TU JAPO'}),h('strong',{children:`${me.points} puntos · Puesto ${me.rank}`})]}),h('span',{children:`${me.played} jugados`})]}):null,
 h('div',{className:'japo-ranking',children:standings.map(row=>hs('article',{className:`japo-ranking-row${row.id===own?' is-you':''}`,children:[h('span',{className:'japo-ranking-position',children:row.rank}),h('span',{className:'japo-initials',children:japoInitials(row.name)}),hs('div',{className:'japo-ranking-name',children:[h('strong',{children:row.name+(row.id===own?' · Tú':'')}),h('small',{children:`${row.played} jugados · ${row.wins} ${row.wins===1?'victoria':'victorias'}`})]}),hs('div',{className:'japo-ranking-points',children:[h('strong',{children:row.points}),h('small',{children:'pts'})]})]},row.id))}),h('p',{className:'japo-note japo-ranking-note',children:'Mismos puntos, mismo puesto. Cada Japo se gana en equipo.'})]});
 }
 function Body({event,teamId,seasonId,identity,readOnly=false}){
 const staff=!readOnly&&['coach','administrator'].includes(identity?.profile?.role),own=identity?.player?.id;
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
 return hs('div',{className:'japo-body',children:[hs('details',{className:'japo-rules',children:[hs('summary',{children:[h('span',{'aria-hidden':true,children:'ⓘ'}),' Cómo se suman los puntos']}),h('p',{children:'Al mejor de 3 sets: los dos primeros a 10 y el desempate a 5. Un 2–0 reparte 3 y 0 puntos; un 2–1 reparte 2 y 1. Cada jugadora suma los puntos de su equipo. Quien no juega no suma partidos ni derrotas.'})]}),error?hs('div',{role:'alert',children:[h('p',{children:error}),!draft?h('button',{type:'button',onClick:load,children:'Reintentar'}):null]}):null,notice?h('p',{role:'status',children:notice}):null,
 event&&event.season_id&&staff&&!draft&&!error?h('button',{type:'button',className:'japo-primary',onClick:()=>{setNotice('');setDraft({id:crypto.randomUUID(),event_id:event.id,team_a:[],team_b:[],sets_a:2,sets_b:0});},children:'Registrar Japo'}):null,
 draft?hs('fieldset',{disabled:busy,children:[h('legend',{children:draft.updated_at?'Corregir Japo':'Nuevo Japo'}),h('p',{className:'japo-note',children:'Asigna las participantes a A o B. Quien no juega queda fuera del resultado.'}),...players.map(p=>hs('label',{className:'japo-player',children:[h('span',{children:p.name}),hs('select',{'aria-label':`Equipo de ${p.name}`,value:draft.team_a.includes(p.id)?'a':draft.team_b.includes(p.id)?'b':'',onChange:e=>assign(p.id,e.target.value),children:[h('option',{value:'',children:'No juega'}),h('option',{value:'a',children:'Equipo A'}),h('option',{value:'b',children:'Equipo B'})]})]},p.id)),hs('label',{className:'japo-player',children:[h('span',{children:`Resultado · A (${draft.team_a.length}) / B (${draft.team_b.length})`}),hs('select',{value:`${draft.sets_a}-${draft.sets_b}`,onChange:e=>{const [a,b]=e.target.value.split('-').map(Number);setDraft(d=>({...d,sets_a:a,sets_b:b}));},children:['2-0','2-1','0-2','1-2'].map(v=>h('option',{value:v,children:v.replace('-','–')},v))})]}),hs('div',{className:'japo-actions',children:[h('button',{type:'button',className:'japo-primary',onClick:()=>save(draft),children:busy?'Guardando…':'Guardar resultado'}),h('button',{type:'button',onClick:()=>{setDraft(null);setError('');},children:'Cancelar'})]})]}):null,
 current.length?hs('div',{className:'japo-day-results',children:[h('h3',{children:'En la pista · Este día'}),...current.map(g=>hs('details',{children:[hs('summary',{className:'japo-scoreline',children:[h('span',{className:'japo-team-chip team-a',children:'Equipo A'}),h('strong',{children:`${g.sets_a} – ${g.sets_b}`}),h('span',{className:'japo-team-chip team-b',children:'Equipo B'}),g.voided?h('small',{children:'Anulado'}):null]}),h('p',{children:`A: ${names(g.team_a)}`}),h('p',{children:`B: ${names(g.team_b)}`}),staff&&!draft&&!g.voided?hs('div',{className:'japo-actions',children:[h('button',{type:'button',disabled:busy,onClick:()=>{setError('');setDraft({...g});},children:'Corregir'}),h('button',{type:'button',disabled:busy,onClick:()=>{if(window.confirm('¿Anular este Japo? Dejará de sumar en la clasificación.'))save({...g,voided:true});},children:'Anular'})]}):null]},g.id))]}):null,
 event&&!event.season_id?h('p',{className:'japo-note',children:'Este entrenamiento no tiene temporada asignada. Complétala antes de registrar Japos.'}):null,error&&!games.length?null:h(Board,{standings,own,games,identity})]});
 }
 return function Japos(props){const [open,setOpen]=React.useState(false);if(!props.teamId)return null;if(props.standalone)return h(Body,props,`${props.teamId}:${props.event?.id||''}:${props.seasonId||''}`);return hs('section',{className:'japo-panel',children:[hs('button',{type:'button',className:'japo-toggle','aria-expanded':open,onClick:()=>setOpen(v=>!v),children:[h('strong',{children:'Japos'}),h('span',{children:open?'Cerrar':'Resultados y clasificación ›'})]}),open?h(Body,props,`${props.teamId}:${props.event?.id||''}:${props.seasonId||''}`):null]});};
}

export function createJapoPage(React,jsx,db,useIdentity,Japos){
 const h=jsx.jsx,hs=jsx.jsxs;
 return function JapoPage(){
 const {identity}=useIdentity(),teams=identity?.teams||[],fallback=teams[0]?.id||identity?.player?.team_id||'';
 const [selected,setSelected]=React.useState(''),teamId=teams.some(t=>t.id===selected)?selected:fallback;
 const [sessions,setSessions]=React.useState([]),[eventId,setEventId]=React.useState(''),[seasonId,setSeasonId]=React.useState(''),[loading,setLoading]=React.useState(true),[error,setError]=React.useState(''),[retry,setRetry]=React.useState(0);
 const staff=['coach','administrator'].includes(identity?.profile?.role);
 React.useEffect(()=>{let active=true;setLoading(true);setError('');setSessions([]);setEventId('');setSeasonId('');
 async function load(){try{if(!teamId){if(active)setLoading(false);return;}
 const team=await db.from('teams').select('season_id').eq('id',teamId).single();if(team.error)throw team.error;if(!team.data.season_id)throw Error('El equipo no tiene temporada asignada.');
 let rows=[];for(let start=0;;start+=500){const r=await db.from('events').select('id,team_id,season_id,title,starts_at,status').eq('team_id',teamId).eq('season_id',team.data.season_id).eq('event_type','training').lte('starts_at',new Date().toISOString()).order('starts_at',{ascending:false}).order('id').range(start,start+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}
 if(!active)return;rows=rows.filter(e=>!['cancelled','canceled'].includes(e.status));setSeasonId(team.data.season_id);setSessions(rows);setEventId(rows[0]?.id||'');
 }catch(e){if(active)setError(e.message||'No se pudieron cargar los Japos.');}finally{if(active)setLoading(false);}}
 load();return()=>{active=false;};},[teamId,retry]);
 const event=sessions.find(e=>e.id===eventId),date=e=>new Date(e.starts_at).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid',day:'numeric',month:'short',year:'numeric'});
 return hs('div',{className:'japo-page',children:[hs('header',{className:'japo-hero',children:[hs('div',{className:'japo-hero-copy',children:[h('span',{className:'japo-hero-tag',children:'EL RETO DEL EQUIPO'}),h('h1',{children:'Liga Japo'}),h('p',{children:'Equipos que cambian. Puntos que suman.'})]}),hs('div',{className:'japo-hero-ball','aria-hidden':true,children:[h('span',{children:'★'}),h('div',{className:'japo-volleyball'}),h('span',{children:'✦'})]})]}),teams.length>1?hs('label',{className:'japo-session-picker',children:[h('span',{children:'Equipo'}),h('select',{value:teamId,onChange:e=>setSelected(e.target.value),children:teams.map(t=>h('option',{value:t.id,children:t.name},t.id))})]}):null,
 loading?h('p',{role:'status',children:'Cargando Japos…'}):error?hs('div',{role:'alert',children:[h('p',{children:error}),h('button',{type:'button',onClick:()=>setRetry(v=>v+1),children:'Reintentar'})]}):!teamId?h('p',{children:'No tienes un equipo asignado.'}):hs(jsx.Fragment,{children:[sessions.length?hs('label',{className:'japo-session-picker',children:[h('span',{children:'En la pista'}),h('select',{value:eventId,onChange:e=>setEventId(e.target.value),children:sessions.map(e=>h('option',{value:e.id,children:`${date(e)} · ${e.title||'Entrenamiento'}`},e.id))})]}):h('p',{className:'japo-note',children:staff?'Todavía no hay sesiones de esta temporada en las que registrar un Japo.':'Todavía no hay sesiones registradas esta temporada.'}),h(Japos,{event,teamId,seasonId,identity,standalone:true,readOnly:true},`${teamId}:${eventId}`)]})]});
 };
}
