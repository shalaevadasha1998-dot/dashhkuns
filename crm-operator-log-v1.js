/* crm mail operator audit and approvals. Read-only frontend for server action records. */
(()=>{
 "use strict";
 const today=document.querySelector(".crm-page-today");
 const os=document.querySelector('[data-page="os"]');
 if(!today||!os)return;
 const css=document.createElement("style");css.textContent=[
 ".crm-operator-report{background:#fff;border:1px solid #111;border-radius:20px;padding:17px;margin:16px var(--gutter) 10px}",
 ".crm-operator-report-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}",
 ".crm-operator-report h2{font-size:clamp(22px,3vw,32px);margin:0;letter-spacing:-.04em}",
 ".crm-operator-report p{font-size:12px;line-height:1.5;margin:7px 0 0}",
 ".crm-operator-report button,.crm-operator-log-actions a{border:1px solid #111;color:#111;text-decoration:none;border-radius:99px;padding:10px 14px;background:#ccff00;font-size:12px;font-weight:800;cursor:pointer}",
 ".crm-operator-report small{display:block;font-size:11px;color:#666;margin-top:10px}",
 ".crm-op-feed{display:flex;flex-direction:column;gap:10px}",
 ".crm-op-item{background:#fff;border:1px solid #111;border-radius:15px;padding:14px}",
 ".crm-op-item.needs-approval{background:#fff2f6;border-color:#e24d78}",
 ".crm-op-item h4{margin:0 0 5px;font-size:14px;font-weight:900}",
 ".crm-op-item p{margin:5px 0;font-size:12px;line-height:1.55}",
 ".crm-op-item small{color:#666;font-size:11px}",
 ".crm-operator-log-actions{display:flex;flex-wrap:wrap;gap:10px;margin:15px 0}",
 ".crm-op-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}",
 ".crm-op-tabs button{border:1px solid #111;border-radius:99px;background:white;padding:8px 12px;font-size:12px;font-weight:750;cursor:pointer}",
 ".crm-op-tabs button.active{background:#ccff00}",
 ".crm-op-badge{display:inline-block;background:#ff3fad;border:1px solid #111;border-radius:999px;padding:3px 7px;font-size:11px;font-weight:800}"
 ].join("\n");document.head.append(css);
 const report=document.createElement("section");report.className="crm-operator-report";
 report.innerHTML='<div class="crm-operator-report-head"><div><h2>оператор · почта <span id="crm-operator-count" class="crm-op-badge" hidden>0</span></h2><p id="crm-operator-summary">оператор проверяет новые входящие и ведёт журнал действий.</p></div><button type="button" id="crm-operator-open">журнал действий ↗</button></div><small>проверка gmail раз в час через chatgpt. отправленные письма записываются только после подтверждённой отправки. договоры и финансовые условия требуют согласования.</small>';
 today.querySelector(".crm-os-preview")?.insertAdjacentElement("afterend",report);
 const panel=document.createElement("section");panel.className="crm-os-section";panel.id="crm-os-operator";
 panel.innerHTML='<h3>оператор · журнал работы</h3><p class="crm-os-muted">реальные действия почтового оператора: что отправлено, что подготовлено, что ждёт твоего решения. история сохраняется в crm.</p><div class="crm-operator-log-actions"><a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noopener">черновики gmail ↗</a><a href="https://mail.google.com/mail/u/0/#label/crm+%2F+%D1%81%D0%BE%D0%B3%D0%BB%D0%B0%D1%81%D0%BE%D0%B2%D0%B0%D1%82%D1%8C" target="_blank" rel="noopener">письма на согласование ↗</a></div><div class="crm-op-tabs"><button type="button" data-op-view="all" class="active">все действия</button><button type="button" data-op-view="auto_replied">отправлено</button><button type="button" data-op-view="review">согласовать</button></div><div class="crm-op-feed" id="crm-op-feed"></div>';
 os.appendChild(panel);
 const osTabs=os.querySelector(".crm-os-tabs");
 const shortcut=document.createElement("button");shortcut.type="button";shortcut.dataset.osAction="operator";shortcut.textContent="почтовый оператор";osTabs.prepend(shortcut);
 function open(){
   if(typeof window.__CRM_GOTO==="function")window.__CRM_GOTO("os");
   else document.querySelector('[data-section="os"]')?.click();
   render(window.__CRM_CURRENT_SNAPSHOT);
   requestAnimationFrame(()=>panel.scrollIntoView({behavior:"smooth",block:"start"}));
 }
 shortcut.addEventListener("click",open);
 report.querySelector("#crm-operator-open").addEventListener("click",open);
 let activeView="all";
 panel.querySelector(".crm-op-tabs").addEventListener("click",e=>{
   const tab=e.target.closest("[data-op-view]");if(!tab)return;
   activeView=tab.dataset.opView;
   for(const x of panel.querySelectorAll("[data-op-view]"))x.classList.toggle("active",x===tab);
   render(window.__CRM_CURRENT_SNAPSHOT);
 });
 const formatDate=s=>{try{return new Date(s).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return ""}};
 const labelFor={
   auto_replied:"отправлен ответ",draft_created:"подготовлен черновик",
   escalated:"нужно решение",task_created:"создана задача",skipped:"пропущено",
   classified:"разобрано",failed:"ошибка",received:"входящее"
 };
 function render(snapshot){
   if(!snapshot)return;
   const actions=Array.isArray(snapshot.operator_actions)?snapshot.operator_actions:[];
   const sent=actions.filter(x=>x.action_type==="auto_replied"&&x.status==="completed").length;
   const pending=actions.filter(x=>x.status==="pending_approval").length;
   const tasks=actions.filter(x=>x.action_type==="task_created"&&x.status==="completed").length;
   const badge=report.querySelector("#crm-operator-count");
   badge.textContent=pending;badge.hidden=pending===0;
   report.querySelector("#crm-operator-summary").textContent=actions.length
     ? "отправлено: "+sent+" · задач создано: "+tasks+" · на согласовании: "+pending
     : "оператор запущен. записанных исходящих действий пока нет; первый запуск может быть позже.";
   let selected=actions;
   if(activeView==="auto_replied")selected=actions.filter(x=>x.action_type==="auto_replied"&&x.status==="completed");
   if(activeView==="review")selected=actions.filter(x=>x.status==="pending_approval");
   const container=panel.querySelector("#crm-op-feed");container.replaceChildren();
   if(!selected.length){
     const message=document.createElement("p");message.className="crm-os-muted";
     message.textContent=actions.length?"в этом разделе действий пока нет":"оператор ещё не записал выполненных действий. он проверит новые письма по расписанию.";
     container.append(message);return;
   }
   for(const x of selected.slice(0,70)){
     const item=document.createElement("article");
     item.className="crm-op-item"+(x.status==="pending_approval"?" needs-approval":"");
     const h=document.createElement("h4");h.textContent=labelFor[x.action_type]||"действие";
     const t=document.createElement("small");t.textContent=formatDate(x.created_at)+" · "+(x.counterparty||"gmail");
     const p=document.createElement("p");p.textContent=x.summary||x.subject||"";
     item.append(h,t,p);
     if(x.status==="pending_approval"){
       const mark=document.createElement("small");mark.className="crm-op-badge";
       mark.textContent="ждёт подтверждения";item.append(mark);
     }
     if(/^https:\/\/(mail\.google\.com|gmail\.com)\//.test(x.external_link||"")){
       const link=document.createElement("a");link.href=x.external_link;link.target="_blank";link.rel="noopener";
       link.textContent="открыть письмо ↗";item.append(link);
     }
     container.append(item);
   }
 }
 window.addEventListener("crm:snapshot",e=>render(e.detail.data));
 render(window.__CRM_CURRENT_SNAPSHOT);
})();