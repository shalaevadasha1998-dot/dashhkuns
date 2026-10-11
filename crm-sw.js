/* dashhkuns crm app shell. private CRM data and API responses are never cached. */
const CACHE="dashhkuns-crm-shell-v4-20261011";
const SHELL=["/crm","/crm3.html","/crm4.css","/crm4.js","/crm-manifest.webmanifest","/assets/crm-icon.svg","/assets/crm-icon-192.png","/assets/crm-icon-512.png"];
const ALLOW=new Set([...SHELL,"/styles-v2.css"]);
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async url=>{
      const response=await fetch(url,{cache:"reload"});
      if(response.ok) await cache.put(url,response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()) if(key.startsWith("dashhkuns-crm-shell-")&&key!==CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin)return;
  if(!ALLOW.has(u.pathname))return;
  event.respondWith((async()=>{
    try{
      const res=await fetch(req);
      if(res.ok&&res.type!=="opaque"){
        const cache=await caches.open(CACHE);
        await cache.put(u.pathname,res.clone());
      }
      return res;
    }catch{
      const cache=await caches.open(CACHE);
      return await cache.match(u.pathname)||Response.error();
    }
  })());
});
