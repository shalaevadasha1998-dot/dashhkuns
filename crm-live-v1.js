/* crm alerts v1: durable event feed, polling and foreground iOS notifications. */
(()=>{
 "use strict";
 const app=document.querySelector("#app");
 const topbar=document.querySelector(".crm-topbar");
 if(!app||!topbar)return;
 const css=document.createElement("style");
 css.textContent=[
 ".crm-topbar{grid-template-columns:auto 1fr auto auto auto auto auto}",
 ".crm-alert-toggle{border:1px solid #111;border-radius:999px;background:#fff;color:#111;min-height:42px;padding:9px 12px;font-size:12px;font-weight:850;white-space:nowrap;cursor:pointer}",
 ".crm-alert-toggle strong{background:#ff3fad;color:#111;border-radius:16px;min-width:20px;padding:2px 5px;margin-left:6px;text-align:center}",
 ".crm-alert-toggle strong[hidden]{display:none}",
 ".crm-alert-modal{border:1px solid #111;border-radius:23px;width:min(92vw,560px);max-height:85dvh;overflow:auto;padding:0;background:#f9f8f5;color:#111;box-shadow:7px 7px 0 #ff3fad}",
 ".crm-alert-modal::backdrop{background:rgba(0,0,0,.65)}",
 ".crm-alert-head{padding:18px 20px;background:#101010;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px}",
 ".crm-alert-head h2{font-size:24px;font-weight:900;margin:0}",
 ".crm-alert-close{border:1px solid #fff;color:#fff;background:none;border-radius:50%;font-size:21px;width:38px;height:38px}",
 ".crm-alert-sub{font-size:12px;padding:14px 18px;margin:0;line-height:1.5;color:#555}",
 ".crm-alert-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 18px 14px}",
 ".crm-alert-actions button,.crm-alert-ack{font:inherit;font-weight:800;border:1px solid #111;border-radius:30px;background:#ccff00;padding:8px 12px;font-size:12px}",
 ".crm-alert-items{padding:0 16px 18px;display:flex;flex-direction:column;gap:9px}",
 ".crm-alert-item{background:#fff;border:1px solid #111;border-radius:13px;padding:13px}",
 ".crm-alert-item.is-read{opacity:.53}",
 ".crm-alert-item h3{font-weight:850;font-size:13px;margin:0 0 5px}",
 ".crm-alert-item p{font-size:12px;margin:0 0 8px;line-height:1.45;overflow-wrap:anywhere}",
 ".crm-alert-item small{font-size:10px;color:#666}",
 ".crm-alert-ack{background:#fff;margin-top:10px}",
 ".crm-alert-empty{font-size:13px;padding:15px;color:#666}",
 "@media(max-width:820px){.crm-topbar{grid-template-columns:1fr auto auto auto}.crm-alert-toggle{font-size:0;min-width:40px;padding:6px 7px}.crm-alert-toggle strong{font-size:10px;margin-left:2px}}",
 "@media(max-width:640px){.crm-topbar>.crm-sync{display:none}.crm-topbar{grid-template-columns:1fr auto auto auto}.crm-alert-modal{max-height:92dvh}}"
 ].join("\n");
 document.head.appendChild(css);
 const toggle=document.createElement("button");
 toggle.type="button";toggle.className="crm-alert-toggle";toggle.setAttribute("aria-label","уведомления crm");
 toggle.innerHTML="🔔 алерты <strong hidden>0</strong>";
 topbar.insertBefore(toggle,document.querySelector("#logout-button"));
 const modal=document.createElement("dialog");modal.className="crm-alert-modal";
 modal.innerHTML='<div class="crm-alert-head"><h2>алерты crm</h2><button type="button" class="crm-alert-close" aria-label="закрыть">×</button></div><p class="crm-alert-sub">обновление каждые 45 секунд, пока crm открыта. фоновые push после закрытия приложения пока не настроены.</p><div class="crm-alert-actions"><button type="button" id="crm-alert-permission">уведомлять на iphone</button><button type="button" id="crm-alert-refresh">обновить сейчас</button></div><div class="crm-alert-items"></div>';
 document.body.appendChild(modal);
 toggle.addEventListener("click",()=>{if(app.hidden)return;if(!modal.open)modal.showModal();renderAlerts(window.__CRM_CURRENT_SNAPSHOT)});
 modal.querySelector(".crm-alert-close").addEventListener("click",()=>modal.close());
 modal.querySelector("#crm-alert-refresh").addEventListener("click",()=>window.__CRM_REFRESH?.());
 modal.querySelector("#crm-alert-permission").addEventListener("click",async e=>{
   if(!("Notification" in window)){e.target.textContent="уведомления в браузере недоступны";return}
   const installed=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
   if(!installed&&/iphone|ipad/i.test(navigator.userAgent)){e.target.textContent="сначала установи crm через safari на экран домой";return}
   try{const permission=await Notification.requestPermission();e.target.textContent=permission==="granted"?"уведомления разрешены":"разрешение не предоставлено"}
   catch{e.target.textContent="не удалось включить уведомления"}
 });
 let initialized=false;
 const known=new Set();
 async function notify(a){
   if(!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator))return;
   try{
     const registration=await navigator.serviceWorker.getRegistration("/crm-app/");
     if(registration)await registration.showNotification(a.title||"новое событие crm",{body:a.detail||"проверь алерты",tag:"crm-alert-"+a.id,icon:"/api/crm-icon?size=192"});
   }catch{}
 }
 function formatDate(s){try{return new Date(s).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return ""}}
 function renderAlerts(snapshot){
   if(!snapshot)return;
   const events=Array.isArray(snapshot.alerts)?snapshot.alerts:[];
   const unread=events.filter(a=>!a.read_at);
   const today=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Moscow"});
   const overdue=(snapshot.tasks||[]).filter(t=>t.due_at&&t.due_at<today&&t.status!=="done").length;
   const messages=(snapshot.messages||[]).filter(m=>m.status==="unread").length;
   const badge=toggle.querySelector("strong");
   badge.textContent=String(unread.length+overdue);
   badge.hidden=unread.length+overdue===0;
   toggle.title=unread.length+" непрочитанных событий · "+overdue+" просроченных задач · "+messages+" непрочитанных сообщений";
   const fresh=events.filter(a=>!known.has(a.id)&&!a.read_at);
   events.forEach(a=>known.add(a.id));
   if(initialized&&document.visibilityState==="visible"&&!app.hidden)fresh.slice(0,3).forEach(notify);
   initialized=true;
   const list=modal.querySelector(".crm-alert-items");list.replaceChildren();
   if(overdue){
     const el=document.createElement("article");el.className="crm-alert-item";
     const h=document.createElement("h3");h.textContent="просроченные задачи: "+overdue;
     const p=document.createElement("p");p.textContent="открой раздел задач и разбери сроки";
     el.append(h,p);list.append(el);
   }
   if(!events.length&&!overdue){
     const el=document.createElement("p");el.className="crm-alert-empty";
     el.textContent="новых событий пока нет. при поступлении новых данных в crm они появятся здесь.";
     list.append(el);
   }
   events.slice(0,60).forEach(a=>{
     const el=document.createElement("article");el.className="crm-alert-item"+(a.read_at?" is-read":"");
     const h=document.createElement("h3");h.textContent=a.title||"событие";
     const p=document.createElement("p");p.textContent=a.detail||"";
     const date=document.createElement("small");date.textContent=formatDate(a.created_at);
     el.append(h,p,date);
     if(!a.read_at){
       const ack=document.createElement("button");ack.type="button";ack.className="crm-alert-ack";ack.textContent="прочитано";
       ack.addEventListener("click",async()=>{
         ack.disabled=true;
         try{
           const token=window.__CRM_AUTH_TOKEN?.();
           if(!token)throw Error("unauthorized");
           const r=await fetch("/api/crm-connection",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action:"mark_alert_read",id:a.id}),cache:"no-store"});
           if(!r.ok)throw Error("failed");
           a.read_at=new Date().toISOString();renderAlerts(snapshot);window.__CRM_REFRESH?.();
         }catch{ack.disabled=false;ack.textContent="ошибка. повторить"}
       });
       el.append(ack);
     }
     list.append(el);
   });
 }
 window.addEventListener("crm:snapshot",e=>renderAlerts(e.detail.data));
 if(window.__CRM_CURRENT_SNAPSHOT)renderAlerts(window.__CRM_CURRENT_SNAPSHOT);
 let lastFetch=0;
 function tick(){
   if(app.hidden||document.visibilityState!=="visible"||!navigator.onLine)return;
   const now=Date.now();if(now-lastFetch<12000)return;
   lastFetch=now;window.__CRM_REFRESH?.();
 }
 setInterval(tick,45000);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")tick()});
 window.addEventListener("focus",tick);window.addEventListener("online",tick);
})();
