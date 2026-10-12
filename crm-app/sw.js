/* dashhkuns crm v7: isolated /crm-app/ service worker. No private data caching. */
const VERSION="crm-app-v11-20261012";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||req.mode!=="navigate")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith("/crm-app/"))return;
  event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>new Response(
    "<!doctype html><html lang='ru'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='theme-color' content='#ff3fad'><body style='font:16px system-ui;padding:28px;background:#f9f8f5;color:#111'><h1>нет сети</h1><p>для загрузки crm нужен интернет. подключись к сети и открой приложение снова.</p></body></html>",
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});
/* Browser-level web push receiver. Subscription and dispatch must be configured separately. */
self.addEventListener("push",event=>{
  let payload={};
  try{payload=event.data?.json()||{}}catch{payload={}}
  const title=typeof payload.title==="string"?payload.title.slice(0,110):"новое событие crm";
  const body=typeof payload.body==="string"?payload.body.slice(0,160):"открой crm, чтобы посмотреть уведомления";
  const tag=typeof payload.tag==="string"?payload.tag.slice(0,95):"crm-push";
  event.waitUntil(self.registration.showNotification(title,{
    body,tag,icon:"/api/crm-icon?size=192",
    data:{path:"/crm-app/index.html"},renotify:false
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const appUrl=new URL("/crm-app/index.html",self.location.origin);
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      try{
        if(new URL(client.url).origin===appUrl.origin&&new URL(client.url).pathname.startsWith("/crm-app/")){
          await client.focus();
          return;
        }
      }catch{}
    }
    await self.clients.openWindow(appUrl.href);
  })());
});
