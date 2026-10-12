/* dashhkuns CRM v6. Navigation and private data are always network-only. */
const CACHE="dashhkuns-crm-shell-v6-20261012";
const ASSETS=["/crm-manifest.webmanifest","/assets/crm-icon.svg"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(async p=>{
      try{const res=await fetch(p,{cache:"reload"});if(res.ok)await cache.put(p,res)}catch{}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const k of await caches.keys())if(k.startsWith("dashhkuns-crm-shell-")&&k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const u=new URL(request.url);
  if(u.origin!==self.location.origin)return;
  if(request.mode==="navigate"||u.pathname.startsWith("/crm")||u.pathname.startsWith("/api/")){
    event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>{
      if(request.mode==="navigate")return new Response("<html lang='ru'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='font:16px sans-serif;padding:28px'><h1>нет подключения</h1><p>crm не сохраняет личные данные на устройстве для офлайн-доступа. подключись к интернету и открой приложение снова.</p></body></html>",{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      return Response.error();
    }));
    return;
  }
  if(!ASSETS.includes(u.pathname))return;
  event.respondWith(fetch(request).then(async res=>{if(res.ok){const cache=await caches.open(CACHE);await cache.put(u.pathname,res.clone())}return res}).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(u.pathname)||Response.error()}));
});