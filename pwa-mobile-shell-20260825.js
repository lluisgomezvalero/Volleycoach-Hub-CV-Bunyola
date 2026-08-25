(function(){
'use strict';

const FLAG='__cvBunyolaPwaMobileShell20260825';
if(window[FLAG])return;
window[FLAG]=true;

function isStandalone(){
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );
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
  if(!('serviceWorker' in navigator))return;
  if(location.protocol!=='https:'&&location.hostname!=='localhost')return;
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
    // Ask for an update without forcing a page reload or disturbing an active session.
    try{await registration.update();}catch(_){}
    document.documentElement.dataset.pwaServiceWorker='ready';
  }catch(error){
    document.documentElement.dataset.pwaServiceWorker='error';
    console.warn('[PWA] No se pudo registrar el service worker.',error);
  }
}

function markIos(){
  const ua=navigator.userAgent||'';
  const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  document.documentElement.classList.toggle('is-ios',ios);
}

function boot(){
  applyDisplayMode();
  watchDisplayMode();
  markIos();
  void registerServiceWorker();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
