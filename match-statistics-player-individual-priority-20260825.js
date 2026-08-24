(function(){
'use strict';

const FLAG='__matchStatsPlayerIndividualPriority20260825';
if(window[FLAG])return;
window[FLAG]=true;

function isCoach(){
  try{return typeof isCoachUser==='function'&&isCoachUser();}
  catch(_){return false;}
}

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

function patchClient(){
  const client=window.VolleySupabase?.getClient?.();
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

function install(){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(patchClient()||tries>=200)clearInterval(timer);
  },75);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
