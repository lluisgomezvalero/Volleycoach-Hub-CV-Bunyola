(function(){
'use strict';

const FLAG='__wellnessAuthoritativeClean20260824';
if(window[FLAG])return;
window[FLAG]=true;
let busy=false;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function db(){return window.VolleySupabase?.getClient?.()||null;}

function localPlayer(row,st){
  const values=[row?.player_id,row?.players?.id,row?.players?.legacy_id].filter(Boolean).map(String);
  return (st?.players||[]).find(p=>[p.id,p.supabaseId,p.supabase_id,p.legacy_id,p.legacyId].filter(Boolean).map(String).some(v=>values.includes(v)))||null;
}

async function refresh(){
  if(busy)return;
  const client=db(),st=state();
  if(!client||!st)return;
  busy=true;
  try{
    const {data,error}=await client.from('wellness_entries')
      .select('id,player_id,entry_date,general_state,fatigue,soreness,stress,sleep,sleep_hours,pain_score,notes,created_at,updated_at,players(id,legacy_id,profile_id)')
      .order('entry_date',{ascending:true})
      .order('created_at',{ascending:true});
    if(error){console.warn('[WellnessAuthoritative] fetch',error);return;}

    st.wellnessLogs=(data||[]).map(row=>{
      const p=localPlayer(row,st);
      const localId=p?.id||row.player_id;
      return {
        id:row.id,
        playerId:localId,
        playerName:p?.name||'Jugadora',
        dateKey:row.entry_date,
        date:row.entry_date,
        generalState:Number(row.general_state),
        fatigue:Number(row.fatigue??row.general_state),
        soreness:row.soreness==null?null:Number(row.soreness),
        stress:row.stress==null?null:Number(row.stress),
        sleepQuality:Number(row.sleep),
        sleep:Number(row.sleep),
        sleepHours:row.sleep_hours==null?null:Number(row.sleep_hours),
        painScore:row.pain_score==null?null:Number(row.pain_score),
        notes:row.notes||'',
        createdAt:row.created_at,
        updatedAt:row.updated_at,
        supabase:true
      };
    });

    try{if(typeof saveAppData==='function')saveAppData(st);}catch(_){}
    try{if(typeof invalidateViewRenderCache==='function')invalidateViewRenderCache();}catch(_){}
    try{
      const view=document.getElementById('view-wellness');
      if(view?.classList.contains('active')){
        if(typeof renderWellness==='function')renderWellness();
        if(typeof window.renderWellnessSvgChart==='function')setTimeout(()=>window.renderWellnessSvgChart(),0);
        else if(typeof renderWellnessCharts==='function')setTimeout(()=>renderWellnessCharts(),0);
      }
    }catch(_){}
    window.dispatchEvent(new CustomEvent('volley:wellness-authoritative-refreshed',{detail:{count:st.wellnessLogs.length}}));
  }finally{busy=false;}
}

window.refreshWellnessAuthoritative=refresh;
window.addEventListener('volley:wellness-v2-saved',()=>setTimeout(()=>void refresh(),120));
window.addEventListener('focus',()=>void refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});

setTimeout(()=>void refresh(),650);
setTimeout(()=>void refresh(),1800);
setTimeout(()=>void refresh(),3500);
})();
