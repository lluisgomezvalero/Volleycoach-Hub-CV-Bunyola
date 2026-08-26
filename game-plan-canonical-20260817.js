(function(){
'use strict';

const FLAG='__gamePlanCanonical20260817';
if(window[FLAG])return;
window[FLAG]=true;

const MODEL_VERSION=2;
const ATTACK_ORDER=['z4a','z4b','z2','z3a','z3b'];
const ATTACK_META={
  z4a:{short:'AR1',role:'Atacante receptora 1',origin:[83,8],dirs:['line','long','medium','short','tip']},
  z4b:{short:'AR2',role:'Atacante receptora 2',origin:[83,8],dirs:['line','long','medium','short','tip']},
  z2:{short:'OP',role:'Opuesta',origin:[17,8],dirs:['line','long','medium','short','tip']},
  z3a:{short:'C1',role:'Central 1',origin:[46,8],dirs:['attack5','attack1','tip']},
  z3b:{short:'C2',role:'Central 2',origin:[54,8],dirs:['attack5','attack1','tip']}
};
const DIR_LABELS={line:'Línea',long:'Diagonal larga',medium:'Diagonal media',short:'Diagonal corta',tip:'Finta',attack5:'Ataque a Z5',attack1:'Ataque a Z1'};
const ZONES=[4,3,2,7,8,9,5,6,1];
const ZONE_POS={4:[17,20],3:[50,20],2:[83,20],7:[17,50],8:[50,50],9:[83,50],5:[17,82],6:[50,82],1:[83,82]};

const ui={
  mode:'current',
  event:null,
  eventId:null,
  remoteEventId:null,
  remotePlan:null,
  draft:null,
  dirty:false,
  activeAttack:'z4a',
  preview:false,
  busy:false,
  reads:[],
  playerMap:new Map(),
  readDetailsOpen:false,
  channel:null,
  renderSeq:0,
  historyRows:[],
  historyEventId:null
};

function db(){return window.VolleySupabase?.getClient?.()||null;}
function app(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function coach(){try{return typeof isCoachUser==='function'&&isCoachUser();}catch(_){return false;}}
function clone(v){try{return v==null?v:JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pad(n){return String(n).padStart(2,'0');}
function localKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));}
function toast(message,type){try{showToast(message,type);}catch(_){}}
function activeView(){return document.getElementById('view-tactics')?.classList.contains('active');}

function eventDateKey(evt){
  const raw=String(evt?.date||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const d=new Date(evt?.starts_at||evt?.startsAt||evt?.start||0);
  return Number.isFinite(d.getTime())?localKey(d):'';
}
function eventTime(evt){
  const key=eventDateKey(evt);
  const rawTime=String(evt?.time||'').trim();
  if(key&&/^\d{1,2}:\d{2}/.test(rawTime)){
    const d=new Date(`${key}T${rawTime.slice(0,5)}`);
    if(Number.isFinite(d.getTime()))return d.getTime();
  }
  const d=new Date(evt?.starts_at||evt?.startsAt||evt?.start||`${key}T12:00`);
  return Number.isFinite(d.getTime())?d.getTime():0;
}
function matches(){
  return (app()?.events||[]).filter(e=>['Partido','Amistoso','Amistós'].includes(String(e.type||''))).sort((a,b)=>eventTime(a)-eventTime(b));
}
function weekBounds(){
  const now=new Date();
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  start.setDate(start.getDate()-((start.getDay()+6)%7));
  const end=new Date(start);end.setDate(start.getDate()+7);
  return {start,end,today:localKey(now)};
}
function currentWeekEvent(){
  const {start,end,today}=weekBounds();
  return matches().find(e=>{
    const k=eventDateKey(e),t=eventTime(e);
    return k>=today&&t>=start.getTime()&&t<end.getTime();
  })||null;
}
function pastEvents(){
  const today=weekBounds().today;
  return matches().filter(e=>eventDateKey(e)<today).sort((a,b)=>eventTime(b)-eventTime(a));
}
function eventName(evt){
  const opp=String(evt?.opponent||evt?.opponentName||evt?.rawPayload?.opponent||'').trim();
  return opp||String(evt?.title||'Partido').trim();
}
function formatEventDate(evt){
  const k=eventDateKey(evt);if(!k)return '';
  const [y,m,d]=k.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES',{weekday:'short',day:'numeric',month:'short'}).replace('.','');
}

function defaultPlan(){
  const servePct={},serveTargets={};ZONES.forEach(z=>{servePct[`z${z}`]=0;serveTargets[`z${z}`]='none';});
  const attackers={};ATTACK_ORDER.forEach(k=>{attackers[k]={name:'',directions:[],visibleToPlayers:false,tipZone:8};});
  return {
    attackers,
    servePct,
    serveTargets,
    servePlayerTarget:'',
    hideServeObjectives:false,
    opponentReceivers:[
      {name:'',depth:'long',level:'red'},
      {name:'',depth:'long',level:'yellow'},
      {name:'',depth:'long',level:'green'},
      {name:'',depth:'long',level:'green'}
    ]
  };
}
function normalizePlan(raw){
  const d=defaultPlan(),src=raw&&typeof raw==='object'?raw:{};
  const out={...d,...clone(src)};
  out.attackers={};
  ATTACK_ORDER.forEach(k=>{
    const a=src.attackers?.[k]||{};
    out.attackers[k]={...d.attackers[k],...clone(a)};
    out.attackers[k].name=String(out.attackers[k].name||'');
    out.attackers[k].directions=Array.isArray(out.attackers[k].directions)?out.attackers[k].directions.filter(x=>ATTACK_META[k].dirs.includes(x)):[];
    out.attackers[k].visibleToPlayers=Boolean(out.attackers[k].visibleToPlayers);
    out.attackers[k].tipZone=ZONES.includes(Number(out.attackers[k].tipZone))?Number(out.attackers[k].tipZone):8;
  });
  out.servePct={};ZONES.forEach(z=>out.servePct[`z${z}`]=Math.max(0,Math.min(100,Number(src.servePct?.[`z${z}`])||0)));
  out.serveTargets={};ZONES.forEach(z=>{const v=src.serveTargets?.[`z${z}`];out.serveTargets[`z${z}`]=['primary','secondary'].includes(v)?v:'none';});
  out.servePlayerTarget=String(src.servePlayerTarget||'');
  out.hideServeObjectives=Boolean(src.hideServeObjectives);
  const rec=Array.isArray(src.opponentReceivers)?src.opponentReceivers:[];
  out.opponentReceivers=d.opponentReceivers.map((x,i)=>({...x,...clone(rec[i]||{}),name:String(rec[i]?.name||'')}));
  return out;
}
function meaningful(plan){
  const p=normalizePlan(plan);
  return ATTACK_ORDER.some(k=>p.attackers[k].name||p.attackers[k].directions.length||p.attackers[k].visibleToPlayers)
    || ZONES.some(z=>p.servePct[`z${z}`]>0||p.serveTargets[`z${z}`]!=='none')
    || Boolean(p.servePlayerTarget)
    || p.opponentReceivers.some(r=>r.name);
}
function localRecord(evt){
  const st=app();if(!st||!evt)return null;
  st.matchScouting=st.matchScouting||{};
  for(const id of [evt.id,evt.legacyId,evt.legacy_id,evt.supabaseId,evt.supabase_id].filter(Boolean)){
    if(st.matchScouting[id])return st.matchScouting[id];
  }
  return null;
}
function persistLocal(){
  const st=app();if(!st||!ui.eventId||!ui.draft)return;
  st.matchScouting=st.matchScouting||{};
  const rec=st.matchScouting[ui.eventId]||{};
  rec.draftPlan=clone(ui.draft);
  rec.publishedPlan=ui.remotePlan?.payload?.plan?normalizePlan(ui.remotePlan.payload.plan):(rec.publishedPlan||null);
  rec.status=ui.remotePlan?'published':'draft';
  rec.publishedAt=ui.remotePlan?.published_at||rec.publishedAt||null;
  rec.publicationVersion=ui.remotePlan?.payload?.publicationVersion||ui.remotePlan?.published_at||rec.publicationVersion||null;
  rec.draftDirty=Boolean(ui.dirty);
  rec.draftBasePlanId=ui.remotePlan?.id||null;
  rec.gamePlanModelVersion=MODEL_VERSION;
  st.matchScouting[ui.eventId]=rec;
  try{saveAppData(st);}catch(error){console.warn('[GamePlanCanonical] local persist',error);}
}

async function remoteEventId(evt){
  if(!evt)return null;
  const client=db();if(!client)return null;
  const ids=[evt.id,evt.supabaseId,evt.supabase_id].filter(Boolean);
  for(const id of ids){
    if(!isUuid(id))continue;
    const {data}=await client.from('events').select('id').eq('id',String(id)).maybeSingle();
    if(data?.id)return data.id;
  }
  const legacy=evt.legacyId||evt.legacy_id||(!isUuid(evt.id)?evt.id:null);
  if(legacy){
    const {data}=await client.from('events').select('id').eq('legacy_id',String(legacy)).maybeSingle();
    if(data?.id)return data.id;
  }
  return null;
}
async function fetchLatestPlan(eid){
  const client=db();if(!client||!eid)return null;
  const {data,error}=await client.from('game_plans')
    .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
    .eq('event_id',eid).eq('status','published').order('version',{ascending:false}).limit(1);
  if(error){console.warn('[GamePlanCanonical] latest plan',error);return null;}
  return data?.[0]||null;
}
async function ensurePlayerMap(){
  if(ui.playerMap.size)return ui.playerMap;
  const client=db();if(!client)return ui.playerMap;
  const {data,error}=await client.from('players').select('id,legacy_id,profile_id,profiles:profile_id(username,full_name)');
  if(error){console.warn('[GamePlanCanonical] player map',error);return ui.playerMap;}
  const local=app()?.players||[];
  for(const row of data||[]){
    const username=String(row.profiles?.username||'').toLowerCase();
    const p=local.find(x=>String(x.supabaseId||x.supabase_id||'')===String(row.id)
      || (row.legacy_id&&String(x.legacyId||x.legacy_id||x.id||'')===String(row.legacy_id))
      || (username&&String(x.username||'').toLowerCase()===username));
    if(p){p.supabaseId=row.id;ui.playerMap.set(String(row.id),p);}
  }
  return ui.playerMap;
}
async function fetchReads(){
  if(!coach()||!ui.remotePlan?.id)return;
  const client=db();if(!client)return;
  await ensurePlayerMap();
  const {data,error}=await client.from('game_plan_reads').select('player_id,read_at').eq('game_plan_id',ui.remotePlan.id).order('read_at',{ascending:true});
  if(error){console.warn('[GamePlanCanonical] reads',error);return;}
  const unique=new Map();for(const row of data||[]){if(!unique.has(String(row.player_id)))unique.set(String(row.player_id),row);}
  ui.reads=[...unique.values()];
  if(activeView()&&ui.mode==='current'&&!ui.preview)renderCoach();
}
async function markPlayerRead(){
  if(coach()||!ui.remotePlan?.id||!ui.remoteEventId)return;
  const identity=await window.VolleySupabase?.getIdentity?.();
  const pid=identity?.data?.player?.id;if(!pid)return;
  const client=db();if(!client)return;
  const {data:existing}=await client.from('game_plan_reads').select('id').eq('game_plan_id',ui.remotePlan.id).eq('player_id',pid).maybeSingle();
  if(existing?.id)return;
  const version=String(ui.remotePlan.payload?.publicationVersion||ui.remotePlan.published_at||'');
  const {error}=await client.from('game_plan_reads').insert({game_plan_id:ui.remotePlan.id,event_id:ui.remoteEventId,player_id:pid,publication_version:version,read_at:new Date().toISOString()});
  if(error&&error.code!=='23505')console.warn('[GamePlanCanonical] read insert',error);
}

function reconcileDraft(evt,remote){
  const local=localRecord(evt);
  const remotePlan=remote?.payload?.plan?normalizePlan(remote.payload.plan):null;
  if(local?.draftPlan){
    const localDraft=normalizePlan(local.draftPlan);
    const localDirty=local.draftDirty===true;
    const sameBase=local.draftBasePlanId&&remote?.id&&String(local.draftBasePlanId)===String(remote.id);
    if(localDirty)return {draft:localDraft,dirty:true};
    if(sameBase)return {draft:remotePlan||localDraft,dirty:false};
    if(remotePlan)return {draft:remotePlan,dirty:false};
    return {draft:localDraft,dirty:meaningful(localDraft)};
  }
  if(remotePlan)return {draft:remotePlan,dirty:false};
  return {draft:defaultPlan(),dirty:false};
}
async function loadEvent(evt,{history=false}={}){
  const seq=++ui.renderSeq;
  ui.event=evt||null;ui.eventId=evt?.id||null;ui.remoteEventId=null;ui.remotePlan=null;ui.reads=[];ui.preview=false;ui.historyEventId=history?evt?.id:null;
  if(!evt){ui.draft=null;render();return;}
  renderLoading();
  const eid=await remoteEventId(evt);if(seq!==ui.renderSeq)return;
  ui.remoteEventId=eid;
  const remote=await fetchLatestPlan(eid);if(seq!==ui.renderSeq)return;
  ui.remotePlan=remote;
  const rec=reconcileDraft(evt,remote);
  ui.draft=rec.draft;ui.dirty=rec.dirty;
  if(!ATTACK_ORDER.includes(ui.activeAttack))ui.activeAttack='z4a';
  persistLocal();
  render();
  if(coach()){void fetchReads();}
  else if(remote){void markPlayerRead();}
  subscribe();
}

function setDirty(){ui.dirty=true;persistLocal();}
function saveDraft(show=true){
  if(!coach()||!ui.draft)return;
  persistLocal();
  if(show)toast('Borrador guardado.');
  renderCoach();
}
async function publish(){
  if(!coach()||!ui.event||!ui.draft||ui.busy)return;
  ui.busy=true;renderCoach();
  try{
    const eid=ui.remoteEventId||await remoteEventId(ui.event);if(!eid)throw new Error('No se ha encontrado el partido en Supabase.');
    const latest=await fetchLatestPlan(eid);
    const identity=await window.VolleySupabase?.getIdentity?.();
    const profile=identity?.data?.profile;
    if(!profile?.id||!profile?.club_id)throw new Error('No se ha podido identificar al entrenador.');
    const now=new Date().toISOString();
    const payload={plan:normalizePlan(ui.draft),publicationVersion:now,modelVersion:MODEL_VERSION};
    const teamId=ui.event.teamId||ui.event.team_id||identity?.data?.teams?.[0]?.id||null;
    const client=db();
    const {data,error}=await client.from('game_plans').insert({
      event_id:eid,club_id:profile.club_id,team_id:teamId,version:(Number(latest?.version)||0)+1,status:'published',payload,published_at:now,created_by:profile.id
    }).select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at').single();
    if(error)throw error;
    ui.remoteEventId=eid;ui.remotePlan=data;ui.draft=normalizePlan(payload.plan);ui.dirty=false;ui.reads=[];
    persistLocal();
    toast(latest?'Publicación actualizada.':'Plan publicado para las jugadoras.');
    renderCoach();
    void fetchReads();
  }catch(error){console.error('[GamePlanCanonical] publish',error);toast(error?.message||'No se ha podido publicar el plan.','error');}
  finally{ui.busy=false;renderCoach();}
}

function zoneStatus(value){const n=Number(value)||0;return n>=75?'primary':n>0?'frequent':'none';}
function nextServePct(value){const s=zoneStatus(value);return s==='none'?50:s==='frequent'?100:0;}
function nextTarget(value){return value==='none'?'secondary':value==='secondary'?'primary':'none';}
function dirEnd(key,dir,tipZone){
  if(dir==='tip')return ZONE_POS[tipZone]||ZONE_POS[8];
  if(key.startsWith('z4'))return dir==='line'?ZONE_POS[1]:dir==='short'?ZONE_POS[4]:dir==='medium'?ZONE_POS[7]:ZONE_POS[5];
  if(key==='z2')return dir==='line'?ZONE_POS[5]:dir==='short'?ZONE_POS[2]:dir==='medium'?ZONE_POS[9]:ZONE_POS[1];
  if(key.startsWith('z3'))return dir==='attack5'?ZONE_POS[5]:dir==='attack1'?ZONE_POS[1]:ZONE_POS[8];
  return ZONE_POS[6];
}
function conePoints(x,y,x2,y2,width){
  const sy=y+2,dx=x2-x,dy=y2-sy,len=Math.max(1,Math.hypot(dx,dy)),px=-dy/len,py=dx/len,sw=1.1;
  const clamp=n=>Math.max(1.5,Math.min(98.5,n));
  return [[x+px*sw,sy+py*sw],[x-px*sw,sy-py*sw],[x2-px*width,y2-py*width],[x2+px*width,y2+py*width]].map(p=>p.map(clamp).map(n=>n.toFixed(2)).join(',')).join(' ');
}
function attackCourt(key,attacker,index=0){
  const meta=ATTACK_META[key],[x,y]=meta.origin,dirs=attacker?.directions||[];
  const drawings=dirs.map(dir=>{
    const [x2,y2]=dirEnd(key,dir,attacker?.tipZone||8);
    if(dir==='tip')return `<path d="M ${x} ${y+2} Q ${(x+x2)/2+5} ${(y+y2)/2-5} ${x2} ${y2}" fill="none" stroke="#dc2626" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round" marker-end="url(#gp2tip${index})"/>`;
    const width=dir==='long'?11:dir==='medium'?9:dir==='short'?7:dir==='line'?5.5:8;
    return `<polygon points="${conePoints(x,y,x2,y2,width)}" fill="#2563eb" fill-opacity=".18" stroke="#2563eb" stroke-opacity=".62" stroke-width="1.1"/><circle cx="${x2}" cy="${y2}" r="2.5" fill="#2563eb" fill-opacity=".76"/>`;
  }).join('');
  return `<div class="gp2-court"><div class="gp2-net"><span>RED</span></div><div class="gp2-3m"></div><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="gp2tip${index}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#dc2626"/></marker></defs>${drawings}</svg><span class="gp2-contact" style="left:${x}%;top:${y}%">${meta.short}</span>${dirs.length?'':'<em>Sin direcciones seleccionadas</em>'}</div>`;
}
function serveCourt(plan,interactive,kind){
  const rival=kind==='rival';
  return `<div class="gp2-zone-court ${rival?'is-rival':'is-ours'}"><div class="gp2-zone-net">RED</div><div class="gp2-zone-grid">${ZONES.map(z=>{
    const value=rival?plan.servePct[`z${z}`]:plan.serveTargets[`z${z}`];
    const status=rival?zoneStatus(value):value;
    const label=status==='primary'?'Principal':status==='frequent'?'Frecuente':status==='secondary'?'Alternativa':'Sin marcar';
    const tag=interactive?'button':'div';
    const data=interactive?(rival?`data-gp2-rival-zone="${z}"`:`data-gp2-our-zone="${z}"`):'';
    return `<${tag} ${tag==='button'?'type="button"':''} ${data} class="is-${status}"><b>Z${z}</b><span>${label}</span></${tag}>`;
  }).join('')}</div></div>`;
}
function directionsText(attacker){return (attacker?.directions||[]).map(d=>d==='tip'?`Finta Z${attacker.tipZone||8}`:(DIR_LABELS[d]||d)).join(' · ');}

function headerHtml(){
  const evt=ui.event;
  return `<div class="gp2-match-chip"><strong>${esc(eventName(evt))}</strong><small>${esc(formatEventDate(evt))}</small></div>`;
}
function statusHtml(){
  const published=Boolean(ui.remotePlan);
  return `<div class="gp2-status"><span class="${published?'is-published':'is-draft'}"></span><div><small>Estado del plan</small><strong>${published?'Publicado':'Borrador'}</strong>${ui.dirty?'<em>Cambios sin publicar</em>':''}</div></div>`;
}
function readsHtml(){
  if(!ui.remotePlan)return '';
  const roster=app()?.players||[];
  const readMap=new Map(ui.reads.map(r=>[String(r.player_id),r]));
  const seen=[];
  for(const [remoteId,row] of readMap){const p=ui.playerMap.get(remoteId);if(p)seen.push({p,row});}
  const seenIds=new Set(seen.map(x=>String(x.p.id)));
  const count=seenIds.size;
  return `<section class="gp2-reads"><button type="button" class="gp2-reads-head" data-gp2-toggle-reads><span><small>Seguimiento</small><strong>${count}/${roster.length} vistos</strong></span><i>${ui.readDetailsOpen?'−':'+'}</i></button>${ui.readDetailsOpen?`<div class="gp2-read-list">${roster.map(p=>{const item=seen.find(x=>String(x.p.id)===String(p.id));return `<div class="${item?'seen':''}"><b>${esc(p.name)}</b><small>${item?new Date(item.row.read_at).toLocaleString(window.VolleyI18n?.locale?.() || 'es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Pendiente'}</small></div>`;}).join('')}</div>`:''}</section>`;
}
function attackEditor(){
  const key=ui.activeAttack,a=ui.draft.attackers[key],meta=ATTACK_META[key];
  return `<section class="gp2-section"><div class="gp2-section-head"><span>1</span><div><h3>Tendencias de ataque rival</h3><p>Configura cada atacante por separado.</p></div></div>
    <div class="gp2-tabs">${ATTACK_ORDER.map(k=>`<button type="button" data-gp2-attack-tab="${k}" class="${k===key?'active':''} ${ui.draft.attackers[k].directions.length?'done':''}">${ATTACK_META[k].short}${ui.draft.attackers[k].directions.length?'<i>✓</i>':''}</button>`).join('')}</div>
    <article class="gp2-attack-card">
      <header><div><small>${esc(meta.role)}</small><input data-gp2-attacker-name="${key}" value="${esc(a.name)}" placeholder="Nombre o dorsal"></div><label class="gp2-visible-toggle"><input type="checkbox" data-gp2-attacker-visible="${key}" ${a.visibleToPlayers?'checked':''}><span>Visible para jugadoras</span></label></header>
      <div class="gp2-attack-body"><strong>Tendencia de ataque</strong><div class="gp2-dir-grid">${meta.dirs.map(d=>`<label><input type="checkbox" data-gp2-dir="${key}:${d}" ${a.directions.includes(d)?'checked':''}><span>${DIR_LABELS[d]}</span></label>`).join('')}</div>${a.directions.includes('tip')?`<label class="gp2-tip-zone"><span>Zona de finta</span><select data-gp2-tip-zone="${key}">${ZONES.map(z=>`<option value="${z}" ${Number(a.tipZone)===z?'selected':''}>Z${z}</option>`).join('')}</select></label>`:''}${attackCourt(key,a,ATTACK_ORDER.indexOf(key))}</div>
    </article></section>`;
}
function rivalServeEditor(){
  const selected=ZONES.filter(z=>ui.draft.servePct[`z${z}`]>0);
  return `<section class="gp2-section"><div class="gp2-section-head"><span>2</span><div><h3>Tendencia de saque rival</h3><p>Toca una zona: frecuente → principal → borrar.</p></div></div>${serveCourt(ui.draft,true,'rival')}<div class="gp2-mini-summary">${selected.length?`Marcadas: ${selected.map(z=>`Z${z}`).join(' · ')}`:'Sin tendencia marcada'}</div></section>`;
}
function ourServeEditor(){
  const target=String(ui.draft.servePlayerTarget||'');
  const ar1=ui.draft.attackers.z4a.name||'AR1',ar2=ui.draft.attackers.z4b.name||'AR2';
  const opts=[['AR1',ar1],['AR2',ar2],['Líbero','Líbero']];
  return `<section class="gp2-section"><div class="gp2-section-head"><span>3</span><div><h3>Nuestro saque</h3><p>Define a quién buscamos y las zonas objetivo.</p></div></div>
    <div class="gp2-target-tabs">${opts.map(([k,v])=>`<button type="button" data-gp2-target="${esc(v)}" class="${target===v||target===k?'active':''}">${k}</button>`).join('')}</div>
    ${serveCourt(ui.draft,true,'ours')}
    <label class="gp2-hide"><input type="checkbox" data-gp2-hide-serve ${ui.draft.hideServeObjectives?'checked':''}><span>Ocultar este objetivo a las jugadoras</span></label>
  </section>`;
}
function receiversEditor(){
  return `<section class="gp2-section gp2-receivers"><div class="gp2-section-head"><span>4</span><div><h3>Recepción rival</h3><p>Opcional: identifica receptoras y su nivel.</p></div></div><div class="gp2-receiver-grid">${ui.draft.opponentReceivers.map((r,i)=>`<div><input data-gp2-receiver-name="${i}" value="${esc(r.name)}" placeholder="Receptora ${i+1}"><select data-gp2-receiver-level="${i}"><option value="red" ${r.level==='red'?'selected':''}>Débil</option><option value="yellow" ${r.level==='yellow'?'selected':''}>Media</option><option value="green" ${r.level==='green'?'selected':''}>Fuerte</option></select></div>`).join('')}</div></section>`;
}
function coachActions(){
  return `<section class="gp2-actions">${statusHtml()}<div class="gp2-action-grid"><button type="button" data-gp2-save ${ui.busy?'disabled':''}>Guardar borrador</button><button type="button" data-gp2-preview ${ui.busy?'disabled':''}>Vista jugadora</button><button type="button" class="primary" data-gp2-publish ${ui.busy?'disabled':''}>${ui.busy?'Publicando…':ui.remotePlan?'Actualizar publicación':'Publicar'}</button></div></section>`;
}
function renderCoach(){
  if(!ui.event||!ui.draft)return;
  const root=document.getElementById('scouting-interactive-root');if(!root)return;
  root.innerHTML=`<div class="gp2 gp2-coach">${coachActions()}${readsHtml()}${attackEditor()}${rivalServeEditor()}${ourServeEditor()}${receiversEditor()}</div>`;
  decorateHeader();
}
function playerAttack(plan){
  const configured=ATTACK_ORDER.filter(k=>plan.attackers[k].visibleToPlayers&&plan.attackers[k].directions.length);
  if(!configured.length)return '';
  const active=configured.includes(ui.activeAttack)?ui.activeAttack:configured[0];ui.activeAttack=active;
  const a=plan.attackers[active],meta=ATTACK_META[active];
  return `<section class="gp2-player-section"><div class="gp2-player-title"><span>1</span><div><h3>Preferencias de ataque rival</h3><p>Patrones principales publicados por el entrenador.</p></div></div><div class="gp2-tabs gp2-player-tabs">${ATTACK_ORDER.map(k=>{const ok=plan.attackers[k].visibleToPlayers&&plan.attackers[k].directions.length;return `<button type="button" data-gp2-player-tab="${k}" class="${k===active?'active':''} ${ok?'done':''}">${ATTACK_META[k].short}${ok?'<i>✓</i>':''}</button>`;}).join('')}</div><article class="gp2-player-attack"><header><small>${meta.role}</small><strong>${esc(a.name||meta.short)}</strong></header><div class="gp2-player-tendency">${directionsText(a)}</div>${attackCourt(active,a,ATTACK_ORDER.indexOf(active))}</article></section>`;
}
function playerRivalServe(plan){
  if(!ZONES.some(z=>plan.servePct[`z${z}`]>0))return '';
  return `<section class="gp2-player-section"><div class="gp2-player-title"><span>2</span><div><h3>Saque rival</h3><p>Zonas hacia las que concentra el saque.</p></div></div>${serveCourt(plan,false,'rival')}<div class="gp2-legend"><span><i class="frequent"></i> Frecuente</span><span><i class="primary"></i> Principal</span></div></section>`;
}
function playerOurServe(plan){
  if(plan.hideServeObjectives)return '';
  const hasZones=ZONES.some(z=>plan.serveTargets[`z${z}`]!=='none');
  if(!hasZones&&!plan.servePlayerTarget)return '';
  return `<section class="gp2-player-section"><div class="gp2-player-title"><span>3</span><div><h3>Nuestro saque</h3><p>Objetivo acordado para el partido.</p></div></div>${plan.servePlayerTarget?`<div class="gp2-player-target"><small>Sacar a</small><strong>${esc(plan.servePlayerTarget)}</strong></div>`:''}${hasZones?serveCourt(plan,false,'ours'):''}<div class="gp2-legend"><span><i class="secondary"></i> Alternativa</span><span><i class="primary"></i> Principal</span></div></section>`;
}
function playerReceivers(plan){
  const rows=plan.opponentReceivers.filter(r=>r.name);if(!rows.length)return '';
  return `<section class="gp2-player-section"><div class="gp2-player-title"><span>4</span><div><h3>Recepción rival</h3><p>Referencias rápidas.</p></div></div><div class="gp2-player-receivers">${rows.map(r=>`<span class="is-${r.level}"><b>${esc(r.name)}</b><small>${r.level==='red'?'Objetivo':r.level==='yellow'?'Media':'Fuerte'}</small></span>`).join('')}</div></section>`;
}
function quickSummary(plan){
  const items=[];
  const attacks=ATTACK_ORDER.filter(k=>plan.attackers[k].visibleToPlayers&&plan.attackers[k].directions.length).slice(0,2);
  attacks.forEach(k=>items.push(`<li><b>${ATTACK_META[k].short}</b>: ${esc(directionsText(plan.attackers[k]))}</li>`));
  const serves=ZONES.filter(z=>plan.servePct[`z${z}`]>0);if(serves.length)items.push(`<li><b>Saque rival</b>: zonas ${serves.join(', ')}</li>`);
  if(plan.servePlayerTarget)items.push(`<li><b>Objetivo de saque</b>: ${esc(plan.servePlayerTarget)}</li>`);
  return items.length?`<section class="gp2-summary"><small>Resumen rápido</small><h3>Qué debemos recordar</h3><ul>${items.join('')}</ul></section>`:'';
}
function renderPlayer(plan,{preview=false}={}){
  const root=document.getElementById('scouting-interactive-root');if(!root)return;
  const p=normalizePlan(plan);
  root.innerHTML=`<div class="gp2 gp2-player">${preview?'<button type="button" class="gp2-back-edit" data-gp2-back-edit>← Volver a editar</button>':''}${quickSummary(p)}${playerAttack(p)}${playerRivalServe(p)}${playerOurServe(p)}${playerReceivers(p)}</div>`;
  decorateHeader(preview?'Vista de jugadora':null);
}
function renderHistory(){
  const root=document.getElementById('scouting-interactive-root');if(!root)return;
  root.innerHTML=`<div class="gp2 gp2-history"><button type="button" class="gp2-back-edit" data-gp2-current>← Plan actual</button><h3>Planes anteriores</h3><p>Consulta los partidos ya disputados.</p><div class="gp2-history-list">${ui.historyRows.length?ui.historyRows.map(row=>`<button type="button" data-gp2-history-id="${esc(row.event.id)}"><span><small>${esc(formatEventDate(row.event))}</small><strong>${esc(eventName(row.event))}</strong></span><em>${row.plan?'Publicado':'Sin publicación'}</em></button>`).join(''):'<div class="gp2-empty">Todavía no hay planes anteriores.</div>'}</div></div>`;
  decorateHeader('Planes anteriores');
}
function renderHistoryView(){
  if(!ui.remotePlan?.payload?.plan){
    const root=document.getElementById('scouting-interactive-root');if(root)root.innerHTML='<div class="gp2-empty">Este partido no tiene una publicación guardada.</div>';
    return;
  }
  renderPlayer(ui.remotePlan.payload.plan,{preview:true});
}
function renderLoading(){
  const root=document.getElementById('scouting-interactive-root');if(root)root.innerHTML='<div class="gp2-loading"><span></span> Cargando plan…</div>';
  decorateHeader();
}
function renderEmpty(message){
  const root=document.getElementById('scouting-interactive-root');if(root)root.innerHTML=`<div class="gp2-empty"><strong>${esc(message)}</strong>${coach()?'<button type="button" data-gp2-history>Planes anteriores</button>':''}</div>`;
  decorateHeader();
}
function render(){
  const content=document.getElementById('scouting-plan-content');const empty=document.getElementById('scouting-no-match');
  if(content)content.hidden=false;if(empty)empty.hidden=true;
  if(ui.mode==='history'){renderHistory();return;}
  if(ui.mode==='history-view'){renderHistoryView();return;}
  if(!ui.event){renderEmpty(coach()?'No hay próximo partido esta semana.':'No hay plan de juego esta semana.');return;}
  if(coach()){
    if(ui.preview){const p=ui.remotePlan?.payload?.plan||ui.draft;renderPlayer(p,{preview:true});}
    else renderCoach();
  }else{
    if(!ui.remotePlan?.payload?.plan)renderEmpty('El cuerpo técnico todavía no ha publicado el plan de esta semana.');
    else renderPlayer(ui.remotePlan.payload.plan);
  }
}
function decorateHeader(label){
  const h=document.querySelector('#view-tactics .scouting-header');if(!h)return;
  const select=document.getElementById('scouting-match-select');if(select)select.style.display='none';
  const title=h.querySelector('h3'),desc=h.querySelector('p');
  if(title)title.textContent=label?`📋 ${label}`:'📋 Plan de juego';
  if(desc)desc.textContent=ui.event?`${eventName(ui.event)} · ${formatEventDate(ui.event)}`:(ui.mode==='history'?'Consulta de planes anteriores.':'Solo se muestra el partido correspondiente a esta semana.');
  let nav=h.querySelector('.gp2-header-nav');if(!nav){nav=document.createElement('div');nav.className='gp2-header-nav';h.appendChild(nav);}
  nav.innerHTML=ui.mode==='current'?`${ui.event?headerHtml():''}${coach()?'<button type="button" data-gp2-history>Planes anteriores</button>':''}`:'<button type="button" data-gp2-current>Plan actual</button>';
}

async function loadHistory(){
  ui.mode='history';ui.preview=false;ui.historyRows=[];renderHistory();
  const rows=[];for(const evt of pastEvents()){
    const eid=await remoteEventId(evt);const plan=eid?await fetchLatestPlan(eid):null;
    if(plan||localRecord(evt))rows.push({event:evt,plan});
  }
  ui.historyRows=rows;if(ui.mode==='history')renderHistory();
}
async function openHistoryEvent(id){
  const evt=pastEvents().find(e=>String(e.id)===String(id));if(!evt)return;
  ui.mode='history-view';ui.event=evt;ui.eventId=evt.id;ui.preview=true;renderLoading();
  const eid=await remoteEventId(evt);ui.remoteEventId=eid;ui.remotePlan=eid?await fetchLatestPlan(eid):null;renderHistoryView();
}
async function openCurrent(){
  ui.mode='current';ui.historyEventId=null;ui.preview=false;ui.readDetailsOpen=false;
  const evt=currentWeekEvent();await loadEvent(evt);
}

function handleChange(target){
  if(!coach()||!ui.draft)return false;
  let m;
  if((m=target.dataset?.gp2AttackerName)){ui.draft.attackers[m].name=String(target.value||'');setDirty();return true;}
  if((m=target.dataset?.gp2AttackerVisible)){ui.draft.attackers[m].visibleToPlayers=Boolean(target.checked);setDirty();return true;}
  if((m=target.dataset?.gp2TipZone)){ui.draft.attackers[m].tipZone=Number(target.value)||8;setDirty();renderCoach();return true;}
  if((m=target.dataset?.gp2Dir)){
    const [key,dir]=m.split(':');const a=ui.draft.attackers[key];const set=new Set(a.directions);target.checked?set.add(dir):set.delete(dir);a.directions=[...set].filter(d=>ATTACK_META[key].dirs.includes(d));setDirty();renderCoach();return true;
  }
  if(target.hasAttribute('data-gp2-hide-serve')){ui.draft.hideServeObjectives=Boolean(target.checked);setDirty();return true;}
  if((m=target.dataset?.gp2ReceiverName)!=null){ui.draft.opponentReceivers[Number(m)].name=String(target.value||'');setDirty();return true;}
  if((m=target.dataset?.gp2ReceiverLevel)!=null){ui.draft.opponentReceivers[Number(m)].level=String(target.value||'yellow');setDirty();return true;}
  return false;
}
function bindEvents(){
  if(document.documentElement.dataset.gp2Bound==='1')return;document.documentElement.dataset.gp2Bound='1';
  document.addEventListener('click',event=>{
    const t=event.target;
    let el;
    if((el=t.closest?.('[data-gp2-attack-tab]'))){ui.activeAttack=el.dataset.gp2AttackTab;renderCoach();return;}
    if((el=t.closest?.('[data-gp2-player-tab]'))){const p=ui.preview?(ui.remotePlan?.payload?.plan||ui.draft):ui.remotePlan?.payload?.plan;if(!p)return;const key=el.dataset.gp2PlayerTab;if(normalizePlan(p).attackers[key].visibleToPlayers&&normalizePlan(p).attackers[key].directions.length){ui.activeAttack=key;renderPlayer(p,{preview:ui.preview});}return;}
    if((el=t.closest?.('[data-gp2-rival-zone]'))&&coach()){const z=Number(el.dataset.gp2RivalZone);ui.draft.servePct[`z${z}`]=nextServePct(ui.draft.servePct[`z${z}`]);setDirty();renderCoach();return;}
    if((el=t.closest?.('[data-gp2-our-zone]'))&&coach()){const z=Number(el.dataset.gp2OurZone),k=`z${z}`;ui.draft.serveTargets[k]=nextTarget(ui.draft.serveTargets[k]);setDirty();renderCoach();return;}
    if((el=t.closest?.('[data-gp2-target]'))&&coach()){ui.draft.servePlayerTarget=el.dataset.gp2Target;setDirty();renderCoach();return;}
    if(t.closest?.('[data-gp2-save]')){saveDraft(true);return;}
    if(t.closest?.('[data-gp2-publish]')){void publish();return;}
    if(t.closest?.('[data-gp2-preview]')){ui.preview=true;render();return;}
    if(t.closest?.('[data-gp2-back-edit]')){if(ui.mode==='history-view'){void loadHistory();}else{ui.preview=false;render();}return;}
    if(t.closest?.('[data-gp2-toggle-reads]')){ui.readDetailsOpen=!ui.readDetailsOpen;renderCoach();return;}
    if(t.closest?.('[data-gp2-history]')){void loadHistory();return;}
    if(t.closest?.('[data-gp2-current]')){void openCurrent();return;}
    if((el=t.closest?.('[data-gp2-history-id]'))){void openHistoryEvent(el.dataset.gp2HistoryId);return;}
  },true);
  document.addEventListener('input',event=>{handleChange(event.target);},true);
  document.addEventListener('change',event=>{handleChange(event.target);},true);
}
function subscribe(){
  const client=db();if(!client||ui.channel)return;
  ui.channel=client.channel('game-plan-canonical-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'game_plan_reads'},payload=>{
      if(coach()&&ui.remotePlan?.id&&String(payload.new?.game_plan_id||payload.old?.game_plan_id||'')===String(ui.remotePlan.id))void fetchReads();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'game_plans'},payload=>{
      const eid=payload.new?.event_id||payload.old?.event_id;
      if(ui.remoteEventId&&String(eid||'')===String(ui.remoteEventId)){
        void (async()=>{const latest=await fetchLatestPlan(ui.remoteEventId);if(!latest)return;if(!ui.remotePlan||String(latest.id)!==String(ui.remotePlan.id)){ui.remotePlan=latest;if(!ui.dirty)ui.draft=normalizePlan(latest.payload?.plan);persistLocal();render();if(coach())void fetchReads();}})();
      }
    }).subscribe();
}

function canonicalRender(){render();}
function installGlobals(){
  window.renderTactics=canonicalRender;try{renderTactics=canonicalRender;}catch(_){}
  window.saveScoutingData=function(show=true){saveDraft(show!==false);};try{saveScoutingData=window.saveScoutingData;}catch(_){}
  window.publishScoutingPlan=function(){return publish();};try{publishScoutingPlan=window.publishScoutingPlan;}catch(_){}
  window.toggleScoutingPreview=function(enabled){ui.preview=Boolean(enabled);render();};try{toggleScoutingPreview=window.toggleScoutingPreview;}catch(_){}
  window.selectScoutingMatch=function(){};try{selectScoutingMatch=window.selectScoutingMatch;}catch(_){}
  const base=window.openModule;
  if(typeof base==='function'&&!base.__gp2){
    const wrapped=function(moduleName,options={}){const out=base.apply(this,arguments);if(moduleName==='tactics')setTimeout(()=>void openCurrent(),0);return out;};wrapped.__gp2=true;window.openModule=wrapped;try{openModule=wrapped;}catch(_){}
  }
}
function injectStyles(){
  if(document.getElementById('game-plan-canonical-20260817-css'))return;
  const s=document.createElement('style');s.id='game-plan-canonical-20260817-css';s.textContent=`
#view-tactics .scouting-header{display:flex;align-items:flex-start;gap:.7rem;flex-wrap:wrap}#view-tactics .gp2-header-nav{margin-left:auto;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}#view-tactics .gp2-header-nav button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:.45rem .62rem;font-weight:800;color:#334155}.gp2-match-chip{display:grid;gap:.05rem;padding:.38rem .55rem;border:1px solid #dbe2ea;border-radius:10px;background:#f8fafc}.gp2-match-chip strong{font-size:.72rem}.gp2-match-chip small{font-size:.6rem;color:#64748b;text-transform:capitalize}
#view-tactics .gp2{display:grid;gap:.72rem;width:100%;box-sizing:border-box}.gp2-loading,.gp2-empty{display:grid;place-items:center;gap:.6rem;min-height:180px;padding:1rem;text-align:center;border:1px solid #e2e8f0;border-radius:16px;background:#fff;color:#64748b}.gp2-loading span{width:24px;height:24px;border:3px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;animation:gp2spin .7s linear infinite}@keyframes gp2spin{to{transform:rotate(360deg)}}
#view-tactics .gp2-actions,#view-tactics .gp2-reads,#view-tactics .gp2-section,#view-tactics .gp2-player-section,#view-tactics .gp2-summary{border:1px solid #dbe2ea;border-radius:16px;background:#fff;box-shadow:0 5px 14px rgba(15,23,42,.045);overflow:hidden}.gp2-actions{padding:.72rem}.gp2-status{display:flex;align-items:center;gap:.55rem;margin-bottom:.62rem}.gp2-status>span{width:13px;height:13px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 6px #fef3c7}.gp2-status>span.is-published{background:#22c55e;box-shadow:0 0 0 6px #dcfce7}.gp2-status>div{display:grid}.gp2-status small{font-size:.58rem;text-transform:uppercase;letter-spacing:.075em;color:#64748b;font-weight:900}.gp2-status strong{font-size:.93rem;color:#0f172a}.gp2-status em{font-size:.61rem;color:#d97706;font-style:normal;font-weight:800}.gp2-action-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}.gp2-action-grid button,.gp2-back-edit{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font-weight:850}.gp2-action-grid button.primary{border-color:#f59e0b;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827}.gp2-action-grid button:disabled{opacity:.55}
.gp2-reads{padding:.62rem}.gp2-reads-head{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;padding:0;text-align:left}.gp2-reads-head span{display:grid}.gp2-reads-head small{font-size:.58rem;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.gp2-reads-head strong{font-size:.82rem;color:#0f172a}.gp2-reads-head i{font-style:normal;font-size:1.1rem;color:#64748b}.gp2-read-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.32rem;margin-top:.55rem}.gp2-read-list>div{display:grid;padding:.42rem .48rem;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}.gp2-read-list>div.seen{background:#f0fdf4;border-color:#bbf7d0}.gp2-read-list b{font-size:.66rem}.gp2-read-list small{font-size:.56rem;color:#64748b}
.gp2-section{padding:.72rem}.gp2-section-head,.gp2-player-title{display:flex;align-items:flex-start;gap:.55rem;margin-bottom:.66rem}.gp2-section-head>span,.gp2-player-title>span{width:30px;height:30px;flex:0 0 auto;display:grid;place-items:center;border-radius:10px;background:#0f766e;color:#fff;font-weight:950;font-size:.72rem}.gp2-section-head h3,.gp2-player-title h3{margin:0;font-size:.95rem;color:#0f172a}.gp2-section-head p,.gp2-player-title p{margin:.08rem 0 0;font-size:.67rem;line-height:1.3;color:#64748b}.gp2-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.28rem;padding:.25rem;margin-bottom:.58rem;border:1px solid #dbe2ea;border-radius:12px;background:#eef2f6}.gp2-tabs button{position:relative;min-height:38px;border:1px solid transparent;border-radius:8px;background:transparent;color:#64748b;font-size:.69rem;font-weight:950}.gp2-tabs button.active{border-color:#cbd5e1;background:#fff;color:#0f172a;box-shadow:0 2px 6px rgba(15,23,42,.08)}.gp2-tabs button i{margin-left:.15rem;color:#16a34a;font-style:normal;font-size:.58rem}.gp2-attack-card{border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;background:#fff}.gp2-attack-card>header,.gp2-player-attack>header{width:100%;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;gap:.48rem;padding:.72rem;background:linear-gradient(135deg,#111827,#1e293b);border-bottom:2px solid #d97706;color:#fff}.gp2-attack-card>header>div{display:grid;gap:.2rem;min-width:0;flex:1}.gp2-attack-card>header small,.gp2-player-attack>header small{display:block;color:#fbbf24;font-size:.62rem;line-height:1.35;font-weight:900;text-transform:uppercase;letter-spacing:.055em;white-space:normal;overflow:visible}.gp2-attack-card>header input[type=text]{width:100%;min-width:0;box-sizing:border-box;padding:.4rem .45rem;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.09);color:#fff;font-size:.8rem;line-height:1.3}.gp2-attack-card>header label{display:flex;align-items:center;gap:.32rem;justify-self:start;width:max-content;max-width:100%;font-size:.6rem;font-weight:850;white-space:nowrap}.gp2-visible-toggle{padding:.28rem .42rem;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.08)}.gp2-attack-body{display:grid;gap:.55rem;padding:.65rem}.gp2-attack-body>strong{font-size:.68rem;color:#334155}.gp2-dir-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.32rem}.gp2-dir-grid input{display:none}.gp2-dir-grid span{display:flex;align-items:center;justify-content:center;min-height:34px;padding:.28rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;text-align:center;font-size:.62rem;font-weight:800}.gp2-dir-grid input:checked+span{border-color:#2563eb;background:#eff6ff;color:#1d4ed8;box-shadow:inset 0 0 0 1px #2563eb}.gp2-tip-zone{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.65rem;font-weight:800;color:#475569}.gp2-tip-zone select{padding:.35rem .45rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.gp2-court{position:relative;height:300px;border:2px solid #a16207;border-radius:12px;background:#dfb56f;overflow:hidden}.gp2-court:before,.gp2-court:after{content:'';position:absolute;left:33.33%;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.92)}.gp2-court:after{left:66.66%}.gp2-net{position:absolute;left:0;right:0;top:0;height:17px;display:grid;place-items:center;background:rgba(15,23,42,.18);border-bottom:2px solid #fff;color:#fff;font-size:.47rem;font-weight:950;letter-spacing:.1em;z-index:3}.gp2-3m{position:absolute;left:0;right:0;top:33.33%;border-top:2px solid rgba(255,255,255,.95);z-index:1}.gp2-court svg{position:absolute;inset:0;width:100%;height:100%;z-index:2}.gp2-contact{position:absolute;transform:translate(-50%,-25%);z-index:4;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;border:3px solid #fff;box-shadow:0 2px 7px rgba(15,23,42,.2);font-size:.62rem;font-weight:950}.gp2-court>em{position:absolute;inset:0;display:grid;place-items:center;color:#7c5b2b;font-style:normal;font-size:.68rem;font-weight:800}
.gp2-zone-court{position:relative;padding-top:22px;border:2px solid #a16207;border-radius:12px;background:#d8a45b;overflow:hidden}.gp2-zone-net{position:absolute;left:0;right:0;top:0;height:22px;display:grid;place-items:center;background:#0f172a;color:#fff;border-bottom:2px solid rgba(255,255,255,.95);font-size:.5rem;font-weight:950;letter-spacing:.1em}.gp2-zone-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,68px)}.gp2-zone-grid>*{position:relative;display:grid;place-items:center;align-content:center;gap:.12rem;border:0;border-right:1px solid rgba(255,255,255,.9);border-bottom:1px solid rgba(255,255,255,.9);border-radius:0;background:rgba(255,255,255,.04);color:#fff;font:inherit}.gp2-zone-grid>*:nth-child(3n){border-right:0}.gp2-zone-grid>*:nth-last-child(-n+3){border-bottom:0}.gp2-zone-grid b{font-size:.88rem}.gp2-zone-grid span{font-size:.5rem;font-weight:850;opacity:.85}.gp2-zone-grid .is-frequent{background:rgba(37,99,235,.42)}.gp2-zone-grid .is-primary{background:rgba(220,38,38,.55);box-shadow:inset 0 0 0 2px rgba(254,202,202,.75)}.gp2-zone-grid .is-secondary{background:rgba(250,204,21,.5);color:#713f12}.gp2-zone-grid .is-primary:after{content:'★';position:absolute;top:.22rem;right:.3rem;color:#fef08a;font-size:.65rem}.gp2-mini-summary{margin-top:.45rem;padding:.4rem .5rem;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;color:#64748b;font-size:.62rem;font-weight:750}.gp2-target-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3rem;margin-bottom:.4rem}.gp2-target-tabs button{min-height:38px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#334155;font-weight:850}.gp2-target-tabs button.active{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.gp2-hide{display:flex;align-items:center;gap:.4rem;margin-top:.5rem;color:#475569;font-size:.62rem;font-weight:800}.gp2-receiver-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.38rem}.gp2-receiver-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.3rem}.gp2-receiver-grid input,.gp2-receiver-grid select{min-width:0;padding:.42rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:.65rem}
.gp2-player{padding-bottom:.3rem}.gp2-summary{padding:.75rem;background:#eff6ff;border-color:#bfdbfe}.gp2-summary>small{font-size:.58rem;font-weight:950;text-transform:uppercase;letter-spacing:.08em;color:#2563eb}.gp2-summary h3{margin:.05rem 0 .45rem;color:#0f172a;font-size:1rem}.gp2-summary ul{margin:0;padding-left:1.15rem;display:grid;gap:.28rem;color:#334155;font-size:.72rem}.gp2-player-section{padding:.72rem}.gp2-player-attack{border:1px solid #cbd5e1;border-radius:14px;overflow:hidden}.gp2-player-attack>header{display:grid;justify-content:stretch}.gp2-player-attack>header strong{font-size:.95rem}.gp2-player-tendency{padding:.48rem .62rem;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:.66rem;font-weight:800}.gp2-player-target{display:grid;gap:.06rem;margin-bottom:.5rem;padding:.55rem .62rem;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff}.gp2-player-target small{font-size:.55rem;text-transform:uppercase;color:#64748b;font-weight:900}.gp2-player-target strong{color:#0f172a}.gp2-legend{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;margin-top:.42rem;color:#64748b;font-size:.58rem;font-weight:800}.gp2-legend span{display:flex;align-items:center;gap:.25rem}.gp2-legend i{width:10px;height:10px;border-radius:3px;background:#cbd5e1}.gp2-legend i.frequent{background:#3b82f6}.gp2-legend i.primary{background:#dc2626}.gp2-legend i.secondary{background:#facc15}.gp2-player-receivers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35rem}.gp2-player-receivers span{display:grid;padding:.45rem .5rem;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0}.gp2-player-receivers span.is-red{background:#fef2f2;border-color:#fecaca}.gp2-player-receivers span.is-yellow{background:#fffbeb;border-color:#fde68a}.gp2-player-receivers span.is-green{background:#f0fdf4;border-color:#bbf7d0}.gp2-player-receivers b{font-size:.67rem}.gp2-player-receivers small{font-size:.55rem;color:#64748b}.gp2-back-edit{justify-self:start;padding:.45rem .65rem}.gp2-history h3{margin:0;color:#0f172a}.gp2-history>p{margin:0;color:#64748b;font-size:.7rem}.gp2-history-list{display:grid;gap:.38rem}.gp2-history-list>button{display:flex;align-items:center;justify-content:space-between;gap:.6rem;width:100%;padding:.58rem .65rem;border:1px solid #dbe2ea;border-radius:11px;background:#fff;text-align:left}.gp2-history-list>button span{display:grid}.gp2-history-list small{font-size:.56rem;color:#64748b;text-transform:capitalize}.gp2-history-list strong{font-size:.72rem;color:#0f172a}.gp2-history-list em{font-style:normal;font-size:.58rem;color:#64748b}
@media(max-width:720px){#view-tactics .card{overflow:visible}.gp2-action-grid{grid-template-columns:1fr 1fr}.gp2-action-grid .primary{grid-column:1/-1}.gp2-read-list{grid-template-columns:1fr}.gp2-court{height:270px}.gp2-receiver-grid{grid-template-columns:1fr}.gp2-attack-card>header{align-items:flex-start}.gp2-attack-card>header small{padding-top:0;overflow:visible;max-height:none}.gp2-attack-card>header input[type=text]{line-height:1.3}.gp2-tabs button{font-size:.66rem;padding:.3rem .08rem}}
`;
  document.head.appendChild(s);
}
function boot(){
  injectStyles();bindEvents();installGlobals();subscribe();
  if(activeView())void openCurrent();
  window.addEventListener('focus',()=>{if(activeView()){if(coach())void fetchReads();else if(ui.remotePlan)void markPlayerRead();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeView()){if(coach())void fetchReads();else if(ui.remotePlan)void markPlayerRead();}});
  console.info('[GamePlanCanonical] Plan de juego canónico activo.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
