const CACHE_PREFIX='cvbunyola-pwa-';
const CACHE_VERSION='20260825-v2';
const CACHE_NAME=`${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_SHELL=['./','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{await cache.addAll(OFFLINE_SHELL);}catch(_){}
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

/*
 * No interceptamos JS, CSS, imágenes, Supabase ni CDNs.
 * Así Chrome/Safari usan su caché HTTP normal y evitamos pasar decenas de
 * recursos por el service worker en cada arranque. Solo protegemos navegación.
 */
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.mode!=='navigate')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    try{
      return await fetch(request);
    }catch(error){
      const cache=await caches.open(CACHE_NAME);
      const fallback=await cache.match('./');
      if(fallback)return fallback;
      throw error;
    }
  })());
});
