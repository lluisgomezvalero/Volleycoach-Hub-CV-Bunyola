(function(){
'use strict';
let syncing=false;

function st(){return typeof appState!=='undefined'?appState:null}
function db(){return window.VolleySupabase?.getClient?.()||null}
function user(){try{return typeof getCurrentUser==='function'?getCurrentUser():null}catch(_){return null}}

async function syncRosterFromSupabase(){
  if(syncing)return;
  const client=db(),state=st();
  if(!client||!state)return;
  syncing=true;
  try{
    const {data,error}=await client
      .from('players')
      .select('id,legacy_id,team_id,dorsal,birth_date,position,status,active,profile_id,profiles:profile_id(id,username,full_name,avatar_path,active,role,last_login_at)')
      .eq('active',true);
    if(error){console.warn('[RosterSync] Error cargando plantilla',error);return;}

    // IMPORTANTE: una jugadora NO necesita tener cuenta para pertenecer a la plantilla.
    // Conservamos la plantilla local actual y solo fusionamos la identidad Supabase
    // de las jugadoras que ya existen en public.players.
    const old=Array.isArray(state.players)?state.players:[];
    const next=[...old];

    for(const r of (data||[])){
      const uname=String(r.profiles?.username||'').toLowerCase();
      const idx=next.findIndex(p=>
        String(p.supabaseId||'')===String(r.id) ||
        (r.legacy_id && [p.id,p.legacy_id,p.legacyId].filter(Boolean).map(String).includes(String(r.legacy_id))) ||
        (uname && String(p.username||'').toLowerCase()===uname)
      );

      const remotePatch={
        supabaseId:r.id,
        legacy_id:r.legacy_id||null,
        profile_id:r.profile_id||null,
        username:r.profiles?.username||'',
        name:r.profiles?.full_name||'',
        full_name:r.profiles?.full_name||'',
        number:r.dorsal??null,
        dorsal:r.dorsal??null,
        birthDate:r.birth_date||null,
        position:r.position||'',
        status:r.status||'Disponible',
        teamId:r.team_id||null,
        avatar_path:r.profiles?.avatar_path||null,
        lastLoginAt:r.profiles?.last_login_at||null,
        last_login_at:r.profiles?.last_login_at||null,
        active:r.active!==false
      };

      if(idx>=0){
        const previous=next[idx];
        next[idx]={
          ...previous,
          supabaseId:r.id,
          legacy_id:r.legacy_id||previous.legacy_id||null,
          profile_id:r.profile_id||previous.profile_id||null,
          username:r.profiles?.username||previous.username||'',
          name:r.profiles?.full_name||previous.name||previous.full_name||r.profiles?.username||'Jugadora',
          full_name:r.profiles?.full_name||previous.full_name||previous.name||'',
          number:r.dorsal??previous.number??null,
          dorsal:r.dorsal??previous.dorsal??null,
          birthDate:r.birth_date||previous.birthDate||null,
          position:r.position||previous.position||'',
          status:r.status||previous.status||'Disponible',
          teamId:r.team_id||previous.teamId||null,
          avatar_path:r.profiles?.avatar_path||previous.avatar_path||null,
          lastLoginAt:r.profiles?.last_login_at||previous.lastLoginAt||previous.last_login_at||null,
          last_login_at:r.profiles?.last_login_at||previous.last_login_at||previous.lastLoginAt||null,
          active:r.active!==false
        };
      }else if(r.profile_id){
        // Si existe una cuenta real en Supabase pero todavía no estaba en la
        // plantilla local (ej. jriera), la añadimos. No añadimos filas anónimas
        // sin nombre porque esas deben provenir de la gestión de Plantilla.
        next.push({
          id:r.legacy_id||r.id,
          ...remotePatch,
          name:r.profiles?.full_name||r.profiles?.username||'Jugadora'
        });
      }
    }

    state.players=next;

    const u=user();
    if(u?.role==='player'){
      const uname=String(u.username||'').toLowerCase();
      const own=next.find(p=>uname&&String(p.username||'').toLowerCase()===uname);
      if(own){u.playerId=own.id;u.supabasePlayerId=own.supabaseId;}
    }

    try{saveAppData(state)}catch(_){}
    try{if(typeof invalidateViewRenderCache==='function')invalidateViewRenderCache()}catch(_){}
    requestAnimationFrame(()=>{
      try{renderHomeDashboard()}catch(_){}
      try{renderTraining()}catch(_){}
      try{renderHomePortalRSVP()}catch(_){}
      try{renderStats()}catch(_){}
      try{renderRoster()}catch(_){}
    });
    console.info('[RosterSync] Plantilla conservada; identidades Supabase fusionadas.');
  }finally{syncing=false}
}
window.syncRosterFromSupabase=syncRosterFromSupabase;

function install(){
  if(window.__supabaseRosterSyncInstalled)return;
  if(!window.VolleySupabase){setTimeout(install,120);return;}
  window.__supabaseRosterSyncInstalled=true;

  // No envolvemos loadAttendanceFromSupabase ni openVerifyAttendanceModal:
  // hacerlo generaba ciclos de refresco/reapertura del modal de Pasar lista.
  setTimeout(()=>void syncRosterFromSupabase(),500);
  window.addEventListener('focus',()=>void syncRosterFromSupabase());
  console.info('[RosterSync] Plantilla local + identidades Supabase, sin exigir cuenta a todas.');
}
install();
})();
