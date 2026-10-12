/* dashhkuns crm v7: isolated /crm-app/ service worker. No private data caching. */
const VERSION="crm-app-v7-20261012";
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