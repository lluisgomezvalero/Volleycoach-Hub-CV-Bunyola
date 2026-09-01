const CACHE_PREFIX='cvbunyola-pwa-';
const CACHE_VERSION='20260901-v3';
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

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?event.data.json():{};}catch(_){
    try{payload={body:event.data?.text?.()||''};}catch(__){payload={};}
  }

  const title=payload.title||'VolleyCoach Hub';
  const options={
    body:payload.body||'Tienes un nuevo aviso del equipo.',
    icon:'./assets/pwa-icon-192.png',
    badge:'./assets/pwa-icon-192.png',
    tag:payload.tag||'volleycoach-notification',
    renotify:false,
    data:{url:payload.url||'./',eventId:payload.eventId||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const raw=String(event.notification?.data?.url||'./');
  const targetUrl=raw.startsWith('#')
    ? `${self.registration.scope}${raw}`
    : new URL(raw,self.registration.scope).href;

  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const clientUrl=new URL(client.url);
        const scopeUrl=new URL(self.registration.scope);
        if(clientUrl.origin===scopeUrl.origin){
          if('navigate' in client)await client.navigate(targetUrl);
          if('focus' in client)return client.focus();
        }
      }catch(_){}
    }
    if(self.clients.openWindow)return self.clients.openWindow(targetUrl);
    return null;
  })());
});
