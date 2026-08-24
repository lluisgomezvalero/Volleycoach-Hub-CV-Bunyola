(function(){
  'use strict';
  let channel=null;
  let wellnessBusy=false;
  function c(){return window.VolleySupabase?.getClient?.()||null;}
  function st(){return typeof appState!=='undefined'?appState:null;}
  function playerByRemote(id,legacyId){return (st()?.players||[]).find(p=>[p.supabaseId,p.supabase_id,p.id,p.legacy_id,p.legacyId].filter(Boolean).map(String).includes(String(id||''))||[p.legacy_id,p.legacyId,p.id].filter(Boolean).map(String).includes(String(legacyId||'')))||null;}
  function eventByRemote(id){return (st()?.events||[]).find(e=>String(e.id)===String(id)||String(e.legacyId||e.legacy_id||'')===String(id))||null;}

  async function syncRpe(){
    const client=c(),s=st();if(!client||!s)return;
    const {data,error}=await client.from('rpe_entries').select('id,event_id,player_id,coach_profile_id,score,source,created_at');if(error)return;
    const mapped=[];
    (s.events||[]).forEach(ev=>{if(ev&&Object.prototype.hasOwnProperty.call(ev,'coachRpe'))ev.coachRpe=null;});
    (data||[]).forEach(row=>{
      const ev=eventByRemote(row.event_id);if(!ev)return;
      if(row.source==='coach'&&!row.player_id){ev.coachRpe=Number(row.score);return;}
      const p=playerByRemote(row.player_id);if(!p)return;
      mapped.push({eventId:ev.id,playerId:p.id,rpeVal:Number(row.score),date:ev.date||row.created_at?.slice(0,10),addedByCoach:row.source==='coach_for_player',supabaseId:row.id});
    });
    s.trainingRPEs=mapped;
    try{if(typeof saveAppData==='function')saveAppData(s);}catch(_){}
  }

  async function syncWellness(){
    if(wellnessBusy)return;
    const client=c(),s=st();if(!client||!s)return;
    wellnessBusy=true;
    try{
      const {data,error}=await client.from('wellness_entries').select('id,player_id,entry_date,general_state,fatigue,soreness,stress,sleep,sleep_hours,pain_score,notes,created_at,updated_at,players(id,legacy_id,profile_id)').order('entry_date',{ascending:true}).order('created_at',{ascending:true});
      if(error)return;
      s.wellnessLogs=(data||[]).map(row=>{
        const p=playerByRemote(row.player_id,row.players?.legacy_id);
        return {id:row.id,playerId:p?.id||row.player_id,playerName:p?.name||'Jugadora',dateKey:row.entry_date,date:row.entry_date,generalState:Number(row.general_state),fatigue:Number(row.fatigue??row.general_state),soreness:row.soreness==null?null:Number(row.soreness),stress:row.stress==null?null:Number(row.stress),sleepQuality:Number(row.sleep),sleep:Number(row.sleep),sleepHours:row.sleep_hours==null?null:Number(row.sleep_hours),painScore:row.pain_score==null?null:Number(row.pain_score),notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at,supabase:true};
      });
      try{if(typeof saveAppData==='function')saveAppData(s);}catch(_){}
    }finally{wellnessBusy=false;}
  }

  async function syncFeedback(){
    const client=c(),s=st();if(!client||!s||typeof activeSessionId==='undefined'||!activeSessionId)return;
    const ev=eventByRemote(activeSessionId);if(!ev)return;
    const {data,error}=await client.from('session_feedback').select('id,event_id,player_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').eq('event_id',ev.id);if(error)return;
    s.sessionPlayerComments=[];
    (data||[]).forEach(row=>{if(row.kind==='coach_assessment'){ev.coachAssessment=row.assessment||'';ev.coachNotes=row.continuity_notes||'';ev._coachFeedbackSaved=true;return;}const p=playerByRemote(row.player_id);if(!p)return;s.sessionPlayerComments.push({id:row.id,eventId:ev.id,playerId:p.id,text:row.comment_text||'',createdAt:row.created_at,updatedAt:row.updated_at,supabase:true});});
  }

  function rerenderWellness(){
    try{
      if(document.getElementById('view-wellness')?.classList.contains('active')){
        if(typeof renderWellness==='function')renderWellness();
        if(typeof window.renderWellnessSvgChart==='function')setTimeout(()=>window.renderWellnessSvgChart(),0);
        else if(typeof renderWellnessCharts==='function')setTimeout(()=>renderWellnessCharts(),0);
      }
    }catch(_){}
  }

  function install(){
    if(window.__appCorrectionsLiveInstalled)return;
    if(typeof window.toggleTrainingHistoryDetail!=='function'){setTimeout(install,180);return;}
    window.__appCorrectionsLiveInstalled=true;
    const baseToggle=window.toggleTrainingHistoryDetail;
    window.toggleTrainingHistoryDetail=async function(eventId){await syncRpe();return baseToggle.call(this,eventId);};
    void syncRpe();
    void syncWellness().then(rerenderWellness);
    const client=c();if(client&&!channel){channel=client.channel('app-corrections-live').on('postgres_changes',{event:'*',schema:'public',table:'rpe_entries'},async()=>{await syncRpe();try{if(document.getElementById('view-training')?.classList.contains('active'))renderTraining();rerenderWellness();if(typeof activeSessionId!=='undefined'&&activeSessionId)renderSessionCenterDetail();}catch(_){}}).on('postgres_changes',{event:'*',schema:'public',table:'session_feedback'},async()=>{await syncFeedback();try{if(typeof activeSessionId!=='undefined'&&activeSessionId)renderSessionCenterDetail();}catch(_){}}).on('postgres_changes',{event:'*',schema:'public',table:'wellness_entries'},async()=>{await syncWellness();rerenderWellness();}).subscribe();}
    window.addEventListener('focus',async()=>{await Promise.all([syncRpe(),syncWellness()]);rerenderWellness();});
  }
  if(document.readyState==='complete')setTimeout(install,50);else window.addEventListener('load',()=>setTimeout(install,50),{once:true});
})();