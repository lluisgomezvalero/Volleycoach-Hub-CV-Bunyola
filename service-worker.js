const CACHE_PREFIX='cvbunyola-pwa-';
const CACHE_VERSION='20260825-v2';
const CACHE_NAME=`${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL=['./','./manifest.webmanifest','./assets/club_logo.png'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigationFallback(request){
  try{
    // Do not bypass the browser HTTP cache. The previous no-store strategy forced
    // a full network request for every app launch and made installed PWAs slower.
    const response=await fetch(request);
    if(response&&response.ok){
      const cache=await caches.open(CACHE_NAME);
      await cache.put('./',response.clone());
    }
    return response;
  }catch(error){
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match('./');
    if(cached)return cached;
    throw error;
  }
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&response.ok)await cache.put(request,response.clone());
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return; // Supabase/CDNs keep normal networking/auth behavior.

  if(request.mode==='navigate'){
    event.respondWith(navigationFallback(request));
    return;
  }

  // Scripts and styles deliberately use the browser's native HTTP cache. Most app
  // assets already carry versioned query strings, so intercepting them here only
  // added service-worker/network overhead and could delay first paint.
  if(['script','style','document','worker'].includes(request.destination))return;

  if(['image','font'].includes(request.destination)){
    event.respondWith(cacheFirst(request));
  }
});