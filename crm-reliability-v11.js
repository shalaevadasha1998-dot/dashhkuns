/* crm automation reliability / diagnostics. No phantom notification claims. */
(()=>{
 "use strict";
 const os=document.querySelector('[data-page="os"]');
 const today=document.querySelector(".crm-page-today");
 if(!os||!today)return;
 const css=document.createElement("style");
 css.textContent=[
 ".crm-reliability{border-top:2px solid #111;padding:28px 0 40px;margin-top:25px}",
 ".crm-reliability h3{font-size:clamp(27px,4vw,48px);letter-spacing:-.05em;margin:0 0 9px}",
 ".crm-reliability h4{margin:0;font-size:15px;font-weight:850}",
 ".crm-reliability p{line-height:1.5}",
 ".crm-reliability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}",
 ".crm-reliability-card{border:1px solid #111;background:white;border-radius:17px;padding:18px;min-height:133px}",
 ".crm-reliability-card small{font-size:11px;color:#626262;display:block;margin-top:12px;line-height:1.5}",
 ".crm-reliability-status{display:inline-block;font-size:11px;font-weight:850;background:#eee;border:1px solid #111;border-radius:99px;padding:5px 10px;margin:10px 0 0}",
 ".crm-reliability-status.ok{background:#ccff00}.crm-reliability-status.partial{background:#ffe09c}.crm-reliability-status.off{background:#ffd3df}",
 ".crm-reliability-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}",
 ".crm-reliability-actions button{border:1px solid #111;border-radius:99px;background:#ccff00;padding:12px 18px;font-weight:850;cursor:pointer;font-size:12px}",
 ".crm-reliability-actions button.secondary{background:#fff}",
 ".crm-reliability-note{font-size:12px;color:#555;max-width:780px}",
 ".crm-reliability-banner{background:#111;color:#fff;border-radius:17px;padding:18px 21px;margin:22px var(--gutter) 0}",
 ".crm-reliability-banner h3{font-size:18px;margin:0 0 8px}",
 ".crm-reliability-banner p{font-size:12px;margin:0 0 12px;color:#ddd}",
 ".crm-reliability-banner button{border:1px solid #ccff00;border-radius:99px;background:#ccff00;padding:10px 16px;font-size:12px;font-weight:900}",
 "@media(max-width:640px){.crm-reliability-grid{grid-template-columns:1fr}.crm-reliability-card{min-height:110px}.crm-reliability-banner{margin:15px var(--gutter) 0}}"
 ].join("\n");document.head.appendChild(css);
 const section=document.createElement("section");
 section.className="crm-reliability";section.id="crm-os-automation";
 section.innerHTML='<p class="kicker">контроль системы</p><h3>автоматизация</h3><p class="crm-reliability-note">статусы рассчитаны по реальной базе. внешний gmail, календарь и фоновые push требуют собственных подключений к серверу crm.</p><div class="crm-reliability-grid" id="crm-reliability-grid"></div><div class="crm-reliability-actions"><button type="button" data-rel-action="refresh">обновить статусы</button><button type="button" data-rel-action="scan" class="secondary">проверить дедлайны</button><button type="button" data-rel-action="notification" class="secondary">проверить уведомление на iphone</button></div><p class="crm-reliability-note" id="crm-reliability-test-result">тест отправляет уведомление только по твоему нажатию и не означает, что серверный push уже работает.</p><p class="crm-reliability-note" id="crm-reliability-update"></p>';
 os.appendChild(section);
 const banner=document.createElement("section");banner.className="crm-reliability-banner";
 banner.innerHTML='<h3>автоматизация · контроль</h3><p id="crm-rel-summary">проверяю журналы и подключения…</p><button type="button" id="crm-rel-open">открыть состояние системы ↗</button>';
 today.querySelector(".crm-dashboard-grid")?.insertAdjacentElement("afterend",banner);
 function open(){
   window.__CRM_GOTO?.("os");
   setTimeout(()=>section.scrollIntoView({behavior:"smooth",block:"start"}),75);
 }
 banner.querySelector("#crm-rel-open").addEventListener("click",open);
 const osTabs=os.querySelector(".crm-os-tabs");
 if(osTabs){const button=document.createElement("button");button.textContent="автоматизация";button.type="button";button.addEventListener("click",open);osTabs.appendChild(button)}
 const grid=section.querySelector("#crm-reliability-grid");
 let last=null;
 const node=(title,status,level,description)=>{
   const card=document.createElement("article");card.className="crm-reliability-card";
   const head=document.createElement("h4");head.textContent=title;
   const badge=document.createElement("span");badge.className="crm-reliability-status "+level;badge.textContent=status;
   const small=document.createElement("small");small.textContent=description;
   card.append(head,badge,small);return card;
 };
 const time=s=>{if(!s)return "ещё не зафиксировано";try{return new Date(s).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return "нет даты"}};
 function render(s){
   if(!s)return;
   last=s;
   const h=s.automation_health||{};
   const actions=s.operator_actions||[];
   const runs=h.reminder_runs||[];
   const due=(s.tasks||[]).filter(t=>t.due_at&&t.due_at<=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Moscow"})&&t.status!=="done").length;
   const sent=actions.filter(a=>a.action_type==="auto_replied"&&a.status==="completed").length;
   const approval=actions.filter(a=>a.status==="pending_approval").length;
   const newestRun=runs[0]?.created_at;
   const now=new Date();
   const recentRun=newestRun&&now-new Date(newestRun)<30*60*1000;
   grid.replaceChildren(
     node("задачи и база","синхронизируется","ok",(s.tasks||[]).length+" задач, "+due+" к сроку. данные обновляются при открытой crm."),
     node("почта gmail","через chatgpt · каждый час","partial",sent+" подтверждённых автоответов в журнале, "+approval+" вопросов на согласовании. прямого gmail oauth для сайта нет."),
     node("google calendar","через chatgpt","partial",(s.events||[]).length+" событий в базе crm. прямую фоновую двустороннюю синхронизацию ещё нужно подключить."),
     node("напоминания о сроках",recentRun?"выполнялись":"расписание не подтверждено",recentRun?"ok":"off","последний серверный запуск: "+time(newestRun)+". событий в журнале: "+(s.alerts||[]).length+"."),
     node("уведомления iphone","пока при открытом приложении","partial","для уведомлений при закрытой pwa нужен web push, подписка устройства и серверная доставка."),
     node("очередь dashhkuns os",(h.sync_failed||0)?"есть ошибки":"журнал доступен",(h.sync_failed||0)?"off":"partial",(h.sync_failed||0)+" ошибок среди последних операций os; "+(h.sync_recent||0)+" завершено. почтовые действия здесь не учитываются.")
   );
   const summary=sent+" автоответов подтверждено · "+approval+" решений ждут тебя · "+(h.sync_failed||0)+" ошибок синхронизации";
   banner.querySelector("#crm-rel-summary").textContent=summary.replace("ошибок синхронизации","ошибок в очереди os");
   section.querySelector("#crm-reliability-update").textContent="последняя проверка crm: "+time(h.checked_at||new Date().toISOString());
 }
 async function notificationTest(button){
   const output=section.querySelector("#crm-reliability-test-result");
   if(!("Notification" in window)||!("serviceWorker" in navigator)){
     output.textContent="этот браузер не поддерживает тест уведомления. установи pwa из safari на экран домой.";
     return;
   }
   const installed=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
   if(!installed&&/iphone|ipad/i.test(navigator.userAgent)){
     output.textContent="на iphone открой установленную pwa с домашнего экрана, а не вкладку браузера.";
     return;
   }
   button.disabled=true;
   try{
     const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
     if(permission!=="granted"){output.textContent="разрешение на уведомления не получено. проверь настройки iphone.";return}
     const reg=await navigator.serviceWorker.getRegistration("/crm-app/");
     if(!reg){output.textContent="service worker ещё не зарегистрирован. обнови crm и повтори тест.";return}
     await reg.showNotification("crm · проверка уведомлений",{body:"это проверка на твоём iphone. фоновые push ещё не подключены.",icon:"/api/crm-icon?size=192",tag:"crm-self-test"});
     output.textContent="тест отправлен на устройство. это локальный тест, не фоновая доставка.";
   }catch(e){output.textContent="не удалось показать уведомление: "+String(e?.message||"ошибка браузера").slice(0,120)}
   finally{button.disabled=false}
 }
 section.addEventListener("click",e=>{
   const button=e.target.closest("[data-rel-action]");if(!button)return;
   if(button.dataset.relAction==="notification")notificationTest(button);
   if(button.dataset.relAction==="refresh"){
      button.disabled=true;
      Promise.resolve(window.__CRM_REFRESH?.()).finally(()=>{button.disabled=false});
   }
 });
 let lastScan=0,scanBusy=false;
 async function scanReminders(userTriggered=false){
   if(scanBusy||document.visibilityState==="hidden"||!navigator.onLine)return;
   const app=document.querySelector("#app");
   if(!app||app.hidden)return;
   const now=Date.now();
   if(!userTriggered&&now-lastScan<15*60*1000)return;
   lastScan=now;scanBusy=true;
   const outcome=section.querySelector("#crm-reliability-test-result");
   try{
     const token=window.__CRM_AUTH_TOKEN?.();
     if(!token)throw Error("выполни вход в crm");
     const response=await fetch("/api/crm-connection",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action:"check_reminders"}),cache:"no-store"});
     if(!response.ok)throw Error("код "+response.status);
     const result=await response.json();
     if(userTriggered){
       const numbers=result.generated||{};
       const created=(numbers.task_reminders||0)+(numbers.event_day_reminders||0)+(numbers.event_soon_reminders||0);
       outcome.textContent="проверка завершена: "+created+" новых напоминаний. повторы не создаются.";
     }
     await window.__CRM_REFRESH?.();
   }catch(error){
     if(userTriggered)outcome.textContent="не удалось проверить сроки: "+String(error?.message||"ошибка сети");
   }finally{scanBusy=false}
 }
 section.addEventListener("click",e=>{
   if(e.target.closest('[data-rel-action="scan"]'))scanReminders(true);
 });
 window.addEventListener("crm:snapshot",e=>render(e.detail.data));
 render(window.__CRM_CURRENT_SNAPSHOT);
 // Run the reminder scanner while the CRM is open. This is not a background server scheduler.
 setTimeout(()=>scanReminders(false),8000);
 setInterval(()=>scanReminders(false),15*60*1000);
 window.addEventListener("focus",()=>scanReminders(false));
})();