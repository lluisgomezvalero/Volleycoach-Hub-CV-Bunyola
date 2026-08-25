const CACHE_PREFIX='cvbunyola-pwa-';
const CACHE_VERSION='20260825-v3';
const CACHE_NAME=`${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL=['./'];

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
    // Keep normal browser caching. The PWA layer must not make online startup slower.
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

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(navigationFallback(request));
});