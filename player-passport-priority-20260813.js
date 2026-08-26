(function(){
'use strict';

const FLAG='__playerPassportPriority20260813';
if(window[FLAG])return;
window[FLAG]=true;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function state(){try{return typeof appState!=='undefined'?appState:null;}catch(_){return null;}}
function client(){try{return window.VolleySupabase?.getClient?.()||null;}catch(_){return null;}}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}

function injectStyles(){
  if(document.getElementById('player-passport-priority-style'))return;
  const style=document.createElement('style');
  style.id='player-passport-priority-style';
  style.textContent=`
    #modal-player-detail .passport-status-panel.passport-wellness-v2{background:#f8fafc!important;border-color:#e2e8f0!important}
    #modal-player-detail .passport-status-panel.passport-wellness-v2 .passport-panel-heading h3{color:#0f172a!important}
    .passport-wellness-v2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin-top:.7rem}
    .passport-wellness-v2-item{min-width:0;padding:.72rem .62rem;border:1px solid #e2e8f0;border-radius:13px;background:#fff;text-align:center}
    .passport-wellness-v2-item span{display:block;color:#64748b;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.045em;margin-bottom:.25rem}
    .passport-wellness-v2-item strong{display:block;color:#0f172a;font-size:.92rem;line-height:1.15;overflow-wrap:anywhere}
    .passport-wellness-v2-date{display:block;margin-top:.65rem;color:#64748b;font-size:.72rem;line-height:1.35}
    .passport-wellness-v2-empty{margin:.65rem 0 0;color:#64748b!important;font-size:.82rem;line-height:1.45}
    @media(max-width:520px){
      .passport-wellness-v2-grid{gap:.4rem}
      .passport-wellness-v2-item{padding:.62rem .38rem;border-radius:11px}
      .passport-wellness-v2-item span{font-size:.61rem}
      .passport-wellness-v2-item strong{font-size:.82rem}
    }
  `;
  document.head.appendChild(style);
}

function replaceRachaLabels(root=document){
  root.querySelectorAll('.passport-metrics-grid article span, .attendance-box-lbl').forEach(el=>{
    const text=String(el.textContent||'').trim();
    if(text==='Racha actual'||text==='🔥 Racha actual') el.textContent=text.startsWith('🔥')?'🔥 Racha de asistencia':'Racha de asistencia';
  });
}

function formatDate(value){
  if(!value)return '';
  const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES',{day:'numeric',month:'short'});
}
function sleepLabel(value){
  return ({1:'Muy mal',2:'Mal',3:'Regular',4:'Bien',5:'Muy bien'})[Number(value)]||'—';
}

function renderWellnessPanel(panel,row){
  if(!panel)return;
  panel.classList.remove('good','medium','alert','neutral');
  panel.classList.add('passport-wellness-v2');
  const heading=panel.querySelector('.passport-panel-heading');
  if(!row){
    panel.innerHTML=`
      <div class="passport-panel-heading"><div><span>Último bienestar</span><h3>Sin registro reciente</h3></div><i data-lucide="heart-pulse"></i></div>
      <p class="passport-wellness-v2-empty">Cuando haya un registro de bienestar aparecerán aquí fatiga, sueño y molestias.</p>`;
  }else{
    const fatigue=Number(row.fatigue ?? row.general_state);
    const sleep=Number(row.sleep ?? row.sleepQuality);
    const painRaw=row.pain_score ?? row.painScore ?? row.pain;
    const pain=(painRaw===null||painRaw===undefined||painRaw==='')?null:Number(painRaw);
    const date=row.entry_date||row.dateKey||row.date||row.createdAt||'';
    panel.innerHTML=`
      <div class="passport-panel-heading"><div><span>Último bienestar</span><h3>Registro reciente</h3></div><i data-lucide="heart-pulse"></i></div>
      <div class="passport-wellness-v2-grid">
        <div class="passport-wellness-v2-item"><span>Fatiga</span><strong>${Number.isFinite(fatigue)?`${fatigue}/5`:'—'}</strong></div>
        <div class="passport-wellness-v2-item"><span>Sueño</span><strong>${esc(sleepLabel(sleep))}</strong></div>
        <div class="passport-wellness-v2-item"><span>Molestias</span><strong>${Number.isFinite(pain)?`${Math.round(pain)}/10`:'—'}</strong></div>
      </div>
      ${date?`<small class="passport-wellness-v2-date">Último registro · ${esc(formatDate(date))}</small>`:''}`;
  }
  try{if(window.lucide)window.lucide.createIcons();}catch(_){}
}

function localLatest(playerId){
  const rows=(state()?.wellnessLogs||[]).filter(row=>{
    const values=[row.playerId,row.player_id].filter(Boolean).map(String);
    return values.includes(String(playerId));
  }).sort((a,b)=>new Date(b.dateKey||b.date||b.createdAt||0)-new Date(a.dateKey||a.date||a.createdAt||0));
  return rows[0]||null;
}

async function resolvePlayerUuid(playerId){
  const s=state();
  const p=(s?.players||[]).find(item=>[item.id,item.supabaseId,item.supabase_id,item.legacy_id,item.legacyId].filter(Boolean).map(String).includes(String(playerId)));
  const direct=[p?.supabaseId,p?.supabase_id,p?.id,playerId].find(value=>UUID.test(String(value||'')));
  if(direct)return String(direct);
  const db=client();
  if(!db||!playerId)return null;
  try{
    const {data}=await db.from('players').select('id').eq('legacy_id',String(playerId)).maybeSingle();
    return data?.id||null;
  }catch(_){return null;}
}

async function hydrateWellness(playerId){
  const modal=document.getElementById('modal-player-detail');
  if(!modal||String(modal.dataset.passportPlayerId||'')!==String(playerId))return;
  const panel=modal.querySelector('.passport-status-panel');
  const fallback=localLatest(playerId);
  renderWellnessPanel(panel,fallback);

  const db=client();
  if(!db)return;
  const uuid=await resolvePlayerUuid(playerId);
  if(!uuid)return;
  try{
    const {data,error}=await db.from('wellness_entries')
      .select('entry_date,fatigue,general_state,sleep,pain_score')
      .eq('player_id',uuid)
      .order('entry_date',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error)throw error;
    if(String(modal.dataset.passportPlayerId||'')!==String(playerId))return;
    renderWellnessPanel(modal.querySelector('.passport-status-panel'),data||fallback);
  }catch(error){
    console.warn('[PlayerPassport] No se pudo leer el último bienestar',error);
  }
}

function polishPassport(playerId){
  const modal=document.getElementById('modal-player-detail');
  if(!modal)return;
  modal.dataset.passportPlayerId=String(playerId||'');
  replaceRachaLabels(modal);
  const panel=modal.querySelector('.passport-status-panel');
  if(panel){
    panel.classList.remove('good','medium','alert','neutral');
    panel.classList.add('passport-wellness-v2');
    panel.innerHTML=`<div class="passport-panel-heading"><div><span>Último bienestar</span><h3>Actualizando…</h3></div><i data-lucide="heart-pulse"></i></div>`;
  }
  void hydrateWellness(playerId);
  try{if(window.lucide)window.lucide.createIcons();}catch(_){}
}

function install(){
  injectStyles();
  replaceRachaLabels(document);
  const original=window.openPlayerDetail;
  if(typeof original==='function'&&!original.__passportPriorityWrapped){
    const wrapped=function(playerId){
      const result=original.apply(this,arguments);
      polishPassport(playerId);
      return result;
    };
    wrapped.__passportPriorityWrapped=true;
    window.openPlayerDetail=wrapped;
  }

  const profile=document.getElementById('modal-my-profile');
  if(profile){
    new MutationObserver(()=>{if(profile.classList.contains('active'))replaceRachaLabels(profile);})
      .observe(profile,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
