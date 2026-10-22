// Uses the session screen's opening/closing helpers, including staff re-openings.
export function pendingHomeRpe(events,attendance,rpes,overrides,playerId,opensAt,closesAt,now=Date.now()){
 const submitted=new Set(rpes.filter(r=>r.player_id===playerId&&['player','coach_for_player'].includes(r.source)).map(r=>r.event_id));
 const absent=new Set(attendance.filter(r=>r.player_id===playerId&&['justified','unjustified'].includes(r.official_status)).map(r=>r.event_id));
 const reopened=new Set(overrides.filter(r=>r.player_id===playerId&&Date.parse(r.expires_at)>now).map(r=>r.event_id));
 return events.filter(e=>e.event_type==='training'&&!/cancel|anulad|eliminad/i.test(e.status||'')&&!submitted.has(e.id)&&!absent.has(e.id)&&(reopened.has(e.id)||(Number.isFinite(opensAt(e))&&now>=opensAt(e)&&now<=closesAt(e)))).sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at))[0]||null;
}
export function createHomeRpe(React,{jsx:h,jsxs:hs},db,Link,Icon,Arrow,opensAt,closesAt){
 return function HomeRpe({playerId,teamId}){
  const [data,setData]=React.useState(null),[now,setNow]=React.useState(Date.now());
  React.useEffect(()=>{
   if(!playerId||!teamId)return;
   let active=true,busy=false,queued=false;
   async function refresh(){
    if(!active||document.visibilityState==='hidden')return;
    if(busy){queued=true;return;}busy=true;
    try{
     const current=Date.now();
     const [events,overrides]=await Promise.all([
      db.from('events').select('id,event_type,title,status,starts_at,ends_at,payload').eq('team_id',teamId).eq('event_type','training').gte('starts_at',new Date(current-35*86400000).toISOString()).lte('starts_at',new Date(current+86400000).toISOString()),
      db.from('rpe_submission_overrides').select('event_id,player_id,expires_at').eq('player_id',playerId).gt('expires_at',new Date(current).toISOString())
     ]);
     if(events.error||overrides.error)throw events.error||overrides.error;
     let all=events.data||[];const known=new Set(all.map(e=>e.id)),extra=(overrides.data||[]).map(r=>r.event_id).filter(id=>!known.has(id));
     if(extra.length){const older=await db.from('events').select('id,event_type,title,status,starts_at,ends_at,payload').eq('team_id',teamId).eq('event_type','training').in('id',extra);if(older.error)throw older.error;all=all.concat(older.data||[]);}
     const ids=all.map(e=>e.id);let attendance={data:[]},rpes={data:[]};
     if(ids.length){[attendance,rpes]=await Promise.all([
      db.from('attendance').select('event_id,player_id,official_status').eq('player_id',playerId).in('event_id',ids),
      db.from('rpe_entries').select('event_id,player_id,source').eq('player_id',playerId).in('source',['player','coach_for_player']).in('event_id',ids)
     ]);if(attendance.error||rpes.error)throw attendance.error||rpes.error;}
     if(active){setData({playerId,teamId,events:all,attendance:attendance.data||[],rpes:rpes.data||[],overrides:overrides.data||[]});setNow(Date.now());}
    }catch{if(active)setData(null);}finally{busy=false;if(active&&queued){queued=false;refresh();}}
   }
   refresh();
   const channel=db.channel(`home-rpe-${playerId}`).on('postgres_changes',{event:'*',schema:'public',table:'rpe_entries',filter:`player_id=eq.${playerId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'rpe_submission_overrides',filter:`player_id=eq.${playerId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'attendance',filter:`player_id=eq.${playerId}`},refresh).subscribe();
   const focus=()=>{setNow(Date.now());refresh();},visible=()=>{if(document.visibilityState==='visible')focus();};
   window.addEventListener('volleycoach:rpe-saved',refresh);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);
   const tick=window.setInterval(()=>{if(document.visibilityState!=='hidden')setNow(Date.now());},15000),poll=window.setInterval(refresh,60000);
   return()=>{active=false;window.clearInterval(tick);window.clearInterval(poll);window.removeEventListener('volleycoach:rpe-saved',refresh);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);db.removeChannel(channel);};
  },[playerId,teamId]);
  const event=data?.playerId===playerId&&data?.teamId===teamId?pendingHomeRpe(data.events,data.attendance,data.rpes,data.overrides,playerId,opensAt,closesAt,now):null;
  if(!event)return null;
  const date=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'numeric',month:'short'}).format(new Date(event.starts_at));
  return hs(Link,{className:'player-daily-wellness-banner player-home-rpe-banner',to:`/training?event=${encodeURIComponent(event.id)}&mode=session`,children:[h('span',{className:'player-daily-wellness-icon',children:h(Icon,{})}),hs('span',{className:'player-daily-wellness-copy',children:[h('small',{children:'Esfuerzo del entrenamiento'}),h('strong',{children:'Registrar RPE'}),h('span',{children:`${event.title||'Entrenamiento'} · ${date}`})]}),h(Arrow,{})]});
 };
}
