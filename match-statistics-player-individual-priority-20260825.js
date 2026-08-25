(function(){
'use strict';

const FLAG='__matchStatsPlayerIndividualPriority20260825';
if(window[FLAG])return;
window[FLAG]=true;

function isCoach(){
  try{return typeof isCoachUser==='function'&&isCoachUser();}
  catch(_){return false;}
}
function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function db(){return window.VolleySupabase?.getClient?.()||null;}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));}

function mergePublishedRows(generalRows,individualRows){
  const byEvent=new Map();
  for(const row of generalRows||[]){
    if(row?.event_id)byEvent.set(String(row.event_id),row);
  }
  for(const row of individualRows||[]){
    if(!row?.event_id)continue;
    byEvent.set(String(row.event_id),{
      ...row,
      payload:{...(row.payload||{}),individual:true,statsScope:'individual'}
    });
  }
  return [...byEvent.values()];
}

function normalizeNeutralLabels(){
  const fieldLabel=document.querySelector('label[for="stats-rec-exclam-pct"]');
  if(fieldLabel&&/exclamativa/i.test(fieldLabel.textContent||'')){
    fieldLabel.textContent=(fieldLabel.textContent||'').replace(/exclamativa/ig,'neutra');
  }
  const checkbox=document.querySelector('[data-stats-visible="recExclamPct"]');
  const checkboxLabel=checkbox?.closest('label');
  if(checkboxLabel){
    [...checkboxLabel.childNodes].forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE&&/exclamativa/i.test(node.nodeValue||'')){
        node.nodeValue=(node.nodeValue||'').replace(/exclamativa/ig,'neutra');
      }
    });
  }
}

function wrapExtendedHydration(){
  const current=window.hydrateExtendedMatchStatsForm;
  if(typeof current!=='function'||current.__neutralLabelWrapped)return false;
  const wrapped=function(...args){
    const result=current.apply(this,args);
    normalizeNeutralLabels();
    return result;
  };
  wrapped.__neutralLabelWrapped=true;
  window.hydrateExtendedMatchStatsForm=wrapped;
  return true;
}

function patchClient(){
  const client=db();
  if(!client||typeof client.rpc!=='function')return false;
  if(client.__matchStatsPlayerIndividualPriority20260825)return true;

  const originalRpc=client.rpc.bind(client);
  client.rpc=function(fn,...args){
    if(fn!=='get_published_match_statistics'||isCoach()){
      return originalRpc(fn,...args);
    }

    return Promise.all([
      Promise.resolve(originalRpc(fn,...args)),
      Promise.resolve(originalRpc('get_my_published_match_player_statistics'))
    ]).then(([general,individual])=>{
      if(general?.error)return general;
      if(individual?.error){
        console.warn('[MatchStats] No se han podido cargar las estadísticas individuales; se muestran las generales.',individual.error);
        return general;
      }
      return {
        ...general,
        data:mergePublishedRows(general?.data,individual?.data)
      };
    });
  };
  client.__matchStatsPlayerIndividualPriority20260825=true;
  document.documentElement.dataset.matchStatsPlayerIndividualPriority='1';

  try{window.invalidateViewRenderCache?.('stats');}catch(_){}
  if(document.getElementById('view-stats')?.classList.contains('active')){
    setTimeout(()=>{try{window.renderStats?.();}catch(error){console.warn('[MatchStats] refresh after individual priority',error);}},0);
  }
  return true;
}

function localMatch(matchId){
  return (state()?.events||[]).find(match=>[match?.id,match?.legacyId,match?.legacy_id,match?.supabaseId,match?.supabase_id].filter(Boolean).some(v=>String(v)===String(matchId)))||null;
}

async function remoteEventId(match){
  if(!match)return null;
  for(const value of [match.id,match.supabaseId,match.supabase_id])if(isUuid(value))return String(value);
  const legacy=match.legacyId||match.legacy_id||match.id;
  const client=db();
  if(!client||!legacy)return null;
  const {data,error}=await client.from('events').select('id').eq('legacy_id',String(legacy)).maybeSingle();
  if(error)throw error;
  return data?.id||null;
}

function statsFromIndividualRow(row){
  return {
    ...(row?.payload||{}),
    visibleToPlayers:Array.isArray(row?.visible_metrics)?row.visible_metrics.map(String):[],
    publicationStatus:'published',
    publishedAt:row?.published_at||null,
    statsScope:'individual',
    individual:true
  };
}

function activatePlayerStatsModal(matchId,stats){
  const modal=document.getElementById('modal-player-match-stats');
  const title=document.getElementById('player-match-stats-title');
  const body=document.getElementById('player-match-stats-body');
  if(!modal||!body||!stats)return false;
  if(title)title.textContent='Resumen del partido';
  if(typeof window.enhancePlayerMatchStatsModal==='function'){
    window.enhancePlayerMatchStatsModal(matchId,stats);
  }else{
    body.innerHTML='<div class="player-stats-empty">Estadísticas individuales publicadas.</div>';
  }
  modal.classList.add('active');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  try{window.lucide?.createIcons();}catch(_){}
  return true;
}

function patchPlayerOpen(){
  const current=window.openPlayerMatchStats;
  if(typeof current!=='function'||current.__individualDirectOpenWrapped)return false;
  const fallback=current;
  const wrapped=async function(matchId){
    if(isCoach())return fallback.apply(this,arguments);
    try{
      const match=localMatch(matchId);
      const eid=await remoteEventId(match);
      const client=db();
      if(client&&eid){
        const {data,error}=await client.rpc('get_my_published_match_player_statistics');
        if(error)throw error;
        const row=(data||[]).find(item=>String(item?.event_id||'')===String(eid));
        if(row){
          const stats=statsFromIndividualRow(row);
          if(activatePlayerStatsModal(matchId,stats))return;
        }
      }
    }catch(error){
      console.warn('[MatchStats] direct individual detail',error);
    }
    return fallback.apply(this,arguments);
  };
  wrapped.__individualDirectOpenWrapped=true;
  window.openPlayerMatchStats=wrapped;
  try{openPlayerMatchStats=wrapped;}catch(_){}
  return true;
}

function install(){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const clientReady=patchClient();
    const labelsReady=wrapExtendedHydration();
    const openReady=patchPlayerOpen();
    normalizeNeutralLabels();
    if((clientReady&&labelsReady&&openReady)||tries>=240)clearInterval(timer);
  },75);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
