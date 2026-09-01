(function(){
'use strict';

const FLAG='__cvBunyolaPwaMobileShell20260825';
if(window[FLAG])return;
window[FLAG]=true;

const VAPID_PUBLIC_KEY='BFfrWc3f5F4rWqqKtGWaZWXnqussOA9Pg2oAbXObcU-t3PHHYznz0lKcvMK2qVD9KrOWBJ7UGBD4xZyz4YMO0aU';
const RPE_DELAY_MS=30*60*1000;
let pushBusy=false;
let pushEnabledProfileId='';

function isStandalone(){
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );
}

function isIos(){
  const ua=navigator.userAgent||'';
  return /iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

function applyDisplayMode(){
  const standalone=isStandalone();
  document.documentElement.classList.toggle('pwa-standalone',standalone);
  document.documentElement.dataset.displayMode=standalone?'standalone':'browser';
}

function watchDisplayMode(){
  const media=window.matchMedia?.('(display-mode: standalone)');
  if(!media)return;
  if(typeof media.addEventListener==='function')media.addEventListener('change',applyDisplayMode);
  else if(typeof media.addListener==='function')media.addListener(applyDisplayMode);
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return null;
  if(location.protocol!=='https:'&&location.hostname!=='localhost')return null;
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
    document.documentElement.dataset.pwaServiceWorker='ready';
    return registration;
  }catch(error){
    document.documentElement.dataset.pwaServiceWorker='error';
    console.warn('[PWA] No se pudo registrar el service worker.',error);
    return null;
  }
}

function markIos(){
  const ios=isIos();
  document.documentElement.classList.toggle('is-ios',ios);
}

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-(base64String.length%4))%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=window.atob(base64);
  return Uint8Array.from([...rawData].map(char=>char.charCodeAt(0)));
}

function pushSupported(){
  return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}

function injectPushStyles(){
  if(document.getElementById('current-app-push-optin-style'))return;
  const style=document.createElement('style');
  style.id='current-app-push-optin-style';
  style.textContent=`
    #current-app-push-optin{display:flex;align-items:center;gap:.75rem;width:100%;box-sizing:border-box;margin:0 0 1rem;padding:.85rem .95rem;border:1px solid #fde68a;border-radius:14px;background:#fffbeb;color:#713f12;text-align:left;box-shadow:0 8px 20px rgba(15,23,42,.06)}
    #current-app-push-optin .push-current-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#fff;font-size:17px}
    #current-app-push-optin .push-current-copy{min-width:0;flex:1}
    #current-app-push-optin strong{display:block;font-size:.88rem;color:#4b3410}
    #current-app-push-optin p{margin:.15rem 0 0;font-size:.74rem;line-height:1.35;color:#78623c}
    #current-app-push-optin button{flex:none;min-height:38px;padding:0 .8rem;border:0;border-radius:10px;background:#172033;color:#fff;font-weight:800;font-size:.73rem;cursor:pointer}
    #current-app-push-optin button:disabled{opacity:.55;cursor:wait}
    @media(max-width:520px){#current-app-push-optin{align-items:flex-start;flex-wrap:wrap}#current-app-push-optin .push-current-copy{flex:1 1 calc(100% - 50px)}#current-app-push-optin button{width:100%;margin-left:0}}
  `;
  document.head.appendChild(style);
}

function removePushCard(){
  document.getElementById('current-app-push-optin')?.remove();
}

function showPushCard(mode='available'){
  injectPushStyles();
  const home=document.getElementById('home-dashboard');
  if(!home)return;
  let card=document.getElementById('current-app-push-optin');
  if(!card){
    card=document.createElement('aside');
    card.id='current-app-push-optin';
    home.prepend(card);
  }
  const iosInstall=mode==='ios-install';
  card.innerHTML=`
    <span class="push-current-icon" aria-hidden="true">🔔</span>
    <div class="push-current-copy">
      <strong>${iosInstall?'Activa las notificaciones':'Activa los avisos del equipo'}</strong>
      <p>${iosInstall?'En iPhone, añade primero VolleyCoach Hub a la pantalla de inicio y ábrela desde su icono.':'Recibirás el recordatorio de RPE y el aviso de bienestar obligatorio de los lunes.'}</p>
    </div>
    ${iosInstall?'':'<button type="button" id="current-app-push-enable">Activar</button>'}
  `;
  const button=document.getElementById('current-app-push-enable');
  if(button)button.addEventListener('click',()=>void ensurePushSubscription(true),{once:true});
}

async function saveSubscription(subscription,identity){
  const client=window.VolleySupabase?.getClient?.();
  const profileId=identity?.profile?.id;
  const playerId=identity?.player?.id;
  if(!client||!profileId||!playerId||!subscription)return false;
  const json=subscription.toJSON();
  const endpoint=json.endpoint||subscription.endpoint;
  const p256dh=json.keys?.p256dh;
  const auth=json.keys?.auth;
  if(!endpoint||!p256dh||!auth)return false;
  const {error}=await client.from('push_subscriptions').upsert({
    profile_id:profileId,
    player_id:playerId,
    endpoint,
    p256dh,
    auth,
    user_agent:navigator.userAgent||null,
    updated_at:new Date().toISOString()
  },{onConflict:'endpoint'});
  if(error)throw error;
  return true;
}

async function currentIdentity(){
  if(!window.VolleySupabase?.getIdentity)return null;
  try{
    const result=await window.VolleySupabase.getIdentity();
    if(result?.error)return null;
    return result?.data||null;
  }catch(_){
    return null;
  }
}

async function ensurePushSubscription(interactive=false){
  if(pushBusy||!pushSupported())return;
  const identity=await currentIdentity();
  if(identity?.profile?.role!=='player'||!identity?.player?.id){
    pushEnabledProfileId='';
    removePushCard();
    return;
  }
  const profileId=String(identity.profile.id||'');
  if(pushEnabledProfileId===profileId){
    removePushCard();
    return;
  }
  if(isIos()&&!isStandalone()){
    showPushCard('ios-install');
    return;
  }
  if(Notification.permission==='denied'){
    removePushCard();
    return;
  }
  if(Notification.permission==='default'&&!interactive){
    showPushCard('available');
    return;
  }

  pushBusy=true;
  const button=document.getElementById('current-app-push-enable');
  if(button){button.disabled=true;button.textContent='Activando…';}
  try{
    if(interactive&&Notification.permission!=='granted'){
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){
        if(permission==='default')showPushCard('available');
        else removePushCard();
        return;
      }
    }
    if(Notification.permission!=='granted')return;
    const registration=await registerServiceWorker()||await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await saveSubscription(subscription,identity);
    pushEnabledProfileId=profileId;
    removePushCard();
    try{window.showToast?.('Notificaciones activadas');}catch(_){}
  }catch(error){
    console.warn('[Push] No se pudieron activar los avisos.',error);
    showPushCard('available');
    try{window.showToast?.('No se pudieron activar las notificaciones.','error');}catch(_){}
  }finally{
    pushBusy=false;
  }
}

function eventEndMs(event){
  if(!event)return Number.NaN;
  const explicit=event.ends_at||event.endsAt;
  if(explicit){
    const t=new Date(explicit).getTime();
    if(Number.isFinite(t))return t;
  }
  const startRaw=event.starts_at||event.startsAt||(event.date?`${event.date}T${event.time||'00:00'}:00`:null);
  const start=startRaw?new Date(startRaw).getTime():Number.NaN;
  const duration=Number(event.durationMinutes??event.duration??event.payload?.duration??event.rawPayload?.duration);
  return Number.isFinite(start)&&Number.isFinite(duration)&&duration>0?start+duration*60000:Number.NaN;
}

function findEvent(eventId){
  let st=null;
  try{st=typeof window.appState!=='undefined'?window.appState:(typeof appState!=='undefined'?appState:null);}catch(_){}
  const id=String(eventId||'');
  return (st?.events||[]).find(event=>[event.id,event.supabaseId,event.supabase_id,event.legacy_id,event.legacyId].filter(Boolean).map(String).includes(id))||null;
}

function playerSession(){
  try{
    const user=typeof window.getCurrentUser==='function'?window.getCurrentUser():null;
    return Boolean(user?.playerId||user?.supabasePlayerId);
  }catch(_){return false;}
}

function installRpeThirtyMinuteGuard(){
  const current=window.setTrainingRPE;
  if(typeof current==='function'&&!current.__rpe30AfterEndGuard){
    const base=current;
    const wrapped=function(eventId,value,mode){
      const coachMode=mode==='coach'||!playerSession();
      if(!coachMode){
        const end=eventEndMs(findEvent(eventId));
        if(Number.isFinite(end)&&Date.now()<end+RPE_DELAY_MS){
          const remaining=Math.max(1,Math.ceil((end+RPE_DELAY_MS-Date.now())/60000));
          try{window.showToast?.(`El RPE se habilitará 30 min después de terminar la sesión. Faltan ${remaining} min.`,'info');}catch(_){}
          return;
        }
      }
      return base.apply(this,arguments);
    };
    wrapped.__rpe30AfterEndGuard=true;
    wrapped.__rpe30Base=base;
    window.setTrainingRPE=wrapped;
  }

  const openFn=window.isRpeSubmissionWindowOpen;
  if(typeof openFn==='function'&&!openFn.__rpe30AfterEndGuard){
    const baseOpen=openFn;
    const wrappedOpen=function(event){
      const end=eventEndMs(event);
      if(Number.isFinite(end)&&Date.now()<end+RPE_DELAY_MS)return false;
      return baseOpen.apply(this,arguments);
    };
    wrappedOpen.__rpe30AfterEndGuard=true;
    window.isRpeSubmissionWindowOpen=wrappedOpen;
  }
}

function syncPendingRpeNotice(){
  const card=document.getElementById('rpe-pending-authoritative');
  if(!card||typeof window.getPendingRpeEvents!=='function')return;
  let pending=[];
  try{pending=window.getPendingRpeEvents()||[];}catch(_){return;}
  const hasAvailable=pending.some(event=>{
    const end=eventEndMs(event);
    return !Number.isFinite(end)||Date.now()>=end+RPE_DELAY_MS;
  });
  card.style.display=hasAvailable?'':'none';
}

function openModuleFromPushHash(){
  const raw=String(location.hash||'');
  if(!raw)return false;
  const lower=raw.toLowerCase();
  const wellness=lower.includes('wellness');
  const training=lower.includes('training');
  if(!wellness&&!training)return false;

  const target=wellness?'wellness':'training';
  let eventId='';
  if(training){
    const query=raw.includes('?')?raw.slice(raw.indexOf('?')+1):'';
    try{eventId=new URLSearchParams(query).get('event')||'';}catch(_){}
  }

  const open=()=>{
    let opened=false;
    try{
      if(typeof window.openModule==='function'){
        window.openModule(target,{returnTarget:'home-portal'});
        opened=true;
      }
    }catch(_){}
    if(!opened){
      const button=document.querySelector(`[data-target="${target}"]`);
      if(button){button.click();opened=true;}
    }
    if(opened&&training&&eventId){
      setTimeout(()=>{try{window.openSessionCenter?.(eventId,'home-portal');}catch(_){}},350);
    }
    if(opened){
      try{history.replaceState(null,'',location.pathname+location.search);}catch(_){}
    }
    return opened;
  };

  if(open())return true;
  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(open()||tries>=20)clearInterval(timer);
  },500);
  return true;
}

function startRuntimeEnhancements(){
  let lastIdentityCheck=0;
  setInterval(()=>{
    installRpeThirtyMinuteGuard();
    syncPendingRpeNotice();
    const now=Date.now();
    if(now-lastIdentityCheck>5000){
      lastIdentityCheck=now;
      void ensurePushSubscription(false);
    }
  },1000);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      void ensurePushSubscription(false);
      setTimeout(openModuleFromPushHash,250);
    }
  });
  window.addEventListener('hashchange',()=>setTimeout(openModuleFromPushHash,100));
  setTimeout(openModuleFromPushHash,700);
}

function boot(){
  applyDisplayMode();
  watchDisplayMode();
  markIos();
  void registerServiceWorker();
  startRuntimeEnhancements();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
