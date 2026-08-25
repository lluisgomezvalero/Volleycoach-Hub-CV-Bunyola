const CACHE_PREFIX='cvbunyola-pwa-';
const CACHE_VERSION='20260825-v1';
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

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request);
    if(cached)return cached;
    if(request.mode==='navigate'){
      const fallback=await cache.match('./');
      if(fallback)return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached){
    // Refresh in the background, but never delay the visible asset.
    fetch(request).then(response=>{
      if(response&&response.ok)cache.put(request,response.clone());
    }).catch(()=>{});
    return cached;
  }
  const response=await fetch(request);
  if(response&&response.ok)await cache.put(request,response.clone());
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return; // Supabase/CDNs keep their normal networking/auth behavior.

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }

  const destination=request.destination;
  if(['script','style','document','worker'].includes(destination)){
    event.respondWith(networkFirst(request));
    return;
  }

  if(['image','font'].includes(destination)){
    event.respondWith(cacheFirst(request));
  }
});
