/* crm v4 progressive enhancement. no credentials or private data cached here. */
(()=>{
  "use strict";
  const root=document.getElementById("app");
  if(!root)return;
  const loggedIn=()=>!root.hidden;
  const q=s=>document.querySelector(s);
  const topbar=q(".crm-topbar");
  const aiTop=document.createElement("button");
  aiTop.type="button";aiTop.className="crm-operator-btn";aiTop.textContent="✦ ии-оператор";aiTop.setAttribute("aria-label","открыть ии-помощницу");
  const installTop=document.createElement("button");
  installTop.type="button";installTop.className="crm-install-btn";installTop.textContent="↓ приложение";installTop.setAttribute("aria-label","установить приложение");
  topbar.insertBefore(aiTop,q(".crm-sync"));
  topbar.insertBefore(installTop,q(".crm-sync"));
  const aiFab=document.createElement("button");
  aiFab.id="crm-ai-floating";aiFab.className="crm-ai-floating";aiFab.type="button";aiFab.textContent="✦";aiFab.setAttribute("aria-label","открыть ии-помощницу");
  root.append(aiFab);
  const aiCard=document.createElement("section");
  aiCard.className="crm-ai-today";
  aiCard.innerHTML="<div><b>✦ твоя вторая голова</b><small>задай вопрос по задачам, проектам, письмам или лидам</small></div><button type='button' id='crm-ai-today-button'>разобрать день →</button>";
  const hero=q(".crm-page-today .crm-hero");
  if(hero)hero.after(aiCard);
  const assistant=document.createElement("dialog");
  assistant.id="crm-operator-dialog";assistant.className="crm-operator-modal";
  assistant.innerHTML=`
    <div class="crm-operator-shell">
      <header class="crm-operator-head">
        <div><p class="crm-operator-title">✦ ии-оператор</p><p class="crm-operator-sub">проекты × задачи × лиды × ответы</p></div>
        <button type="button" class="crm-operator-x" id="crm-ai-close" aria-label="закрыть">×</button>
      </header>
      <section class="crm-ai-welcome">
        <div><strong>не просто чат, а помощница с контекстом crm</strong><p>анализирует текущую базу, предлагает приоритеты, составляет планы и черновики. ничего не отправляет и не изменяет без тебя.</p></div>
        <span id="crm-ai-status" class="crm-ai-status">проверка...</span>
      </section>
      <div class="crm-ai-quick">
        <button type="button" data-ai-prompt="составь реалистичный план работы на сегодня: 5 приоритетов из моей crm, конкретные следующие шаги и что можно отложить">план дня</button>
        <button type="button" data-ai-prompt="найди просроченные задачи и риски, сгруппируй по проектам, скажи с чего начать">просрочки</button>
        <button type="button" data-ai-prompt="какие лиды требуют действия в первую очередь? предложи персональные следующие шаги и черновики сообщений для трёх важных контактов">лиды</button>
        <button type="button" data-ai-prompt="разбери входящие ответы и предложи действия, кому ответить и что написать. письма не отправляй">почта</button>
      </div>
      <div class="crm-ai-log" id="crm-ai-log" role="log" aria-live="polite"></div>
      <form id="crm-ai-form" class="crm-ai-compose">
        <textarea id="crm-ai-input" rows="2" maxlength="3000" placeholder="спроси про любой проект, задачу, лид..." aria-label="вопрос ии"></textarea>
        <button type="submit" id="crm-ai-send">отправить ↗</button>
      </form>
      <div class="crm-ai-footnote">использует данные текущей crm · черновики и рекомендации, без автоматических действий</div>
    </div>`;
  document.body.append(assistant);
  const installDlg=document.createElement("dialog");
  installDlg.className="crm-install-modal";installDlg.id="crm-install-dialog";
  installDlg.innerHTML="<h2>crm как приложение</h2><p id='crm-install-instructions'>открой crm в safari, нажми «поделиться» → «на экран домой» → включи «открывать как веб-приложение» → «добавить». иконка появится на главном экране iphone.</p><button type='button' id='crm-install-close'>понятно</button>";
  document.body.append(installDlg);
  const network=document.createElement("p");
  network.className="crm-pwa-network";network.id="crm-network";network.hidden=true;network.setAttribute("role","status");network.textContent="нет сети: данные crm недоступны до подключения";
  document.body.append(network);
  const log=q("#crm-ai-log"),input=q("#crm-ai-input"),send=q("#crm-ai-send"),indicator=q("#crm-ai-status");
  const history=[];
  let busy=false,checked=false,configured=false;
  function bubble(text,role){
    const el=document.createElement("div");
    el.className="crm-ai-bubble "+role;
    el.textContent=text;
    log.append(el);
    log.scrollTop=log.scrollHeight;
    return el;
  }
  bubble("что разберём? можно попросить план на сегодня, найти зависшие задачи или подготовить ответ на письмо.","assistant");
  async function status(){
    if(checked)return;
    try{
      const r=await fetch("/api/crm-ai",{cache:"no-store"}),data=await r.json();
      configured=Boolean(data.configured);checked=true;
      indicator.textContent=configured?"ии подключена":"нужен ключ ии";
      indicator.title=configured?"серверная модель доступна":"модель готова к подключению через OPENAI_API_KEY";
    }catch{indicator.textContent="проверка недоступна"}
  }
  function openAssistant(){
    if(!loggedIn())return;
    if(!assistant.open)assistant.showModal();
    status();setTimeout(()=>input.focus(),80);
  }
  aiTop.addEventListener("click",openAssistant);
  aiFab.addEventListener("click",openAssistant);
  q("#crm-ai-today-button")?.addEventListener("click",()=>{
    openAssistant();
    input.value="составь реалистичный план работы на сегодня: пять приоритетов из моей crm, конкретные шаги и блокеры";
  });
  q("#crm-ai-close").addEventListener("click",()=>assistant.close());
  assistant.addEventListener("click",event=>{if(event.target===assistant)assistant.close()});
  q(".crm-ai-quick").addEventListener("click",event=>{
    const btn=event.target.closest("[data-ai-prompt]");
    if(!btn||busy)return;
    input.value=btn.dataset.aiPrompt;
    q("#crm-ai-form").requestSubmit();
  });
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();q("#crm-ai-form").requestSubmit()}
  });
  q("#crm-ai-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const prompt=input.value.trim();
    if(!prompt||busy)return;
    const token=typeof window.__CRM_AUTH_TOKEN==='function'?window.__CRM_AUTH_TOKEN():null;
    if(!token){bubble("для работы ии нужно войти в crm","error");return}
    if(!configured){await status();if(!configured){bubble("интерфейс ии готов, но серверный ключ OPENAI_API_KEY пока не настроен. ключ не вводи в чат или в браузер: он должен храниться в переменных окружения vercel.","error");return}}
    const previous=history.slice(-8);
    bubble(prompt,"user");input.value="";
    const loading=bubble("анализирую твою crm…","assistant loading");
    busy=true;send.disabled=true;send.textContent="думаю…";
    try{
      const response=await fetch("/api/crm-ai",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({prompt,history:previous}),
        cache:"no-store"
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===401){indicator.textContent="войти заново";throw new Error("сессия crm истекла: выйди и войди заново")}
        if(data.error==="ai_not_configured"){configured=false;indicator.textContent="нужен ключ ии";throw new Error("для ответа ии пока не задан серверный OPENAI_API_KEY")}
        throw new Error(data.error==="ai_provider_unavailable"?"проверь ключ, биллинг и модель в vercel":"ошибка соединения с ии. попробуй ещё раз");
      }
      loading.textContent=data.answer;
      loading.className="crm-ai-bubble assistant";
      history.push({role:"user",content:prompt},{role:"assistant",content:data.answer});
    }catch(e){loading.textContent=e.message||"не получилось получить ответ";loading.className="crm-ai-bubble error"}
    finally{busy=false;send.disabled=false;send.textContent="отправить ↗";input.focus();log.scrollTop=log.scrollHeight}
  });
  let deferredPrompt=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});
  function installHelp(){
    if(window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone){q("#crm-install-instructions").textContent="crm уже установлена как приложение. открывай её с главного экрана."}
    else if(!/iphone|ipad|ipod/i.test(navigator.userAgent)){q("#crm-install-instructions").textContent="для установки нажми значок установки в браузере или открой меню → «установить приложение». на iphone: safari → поделиться → на экран домой."}
    installDlg.showModal();
  }
  installTop.addEventListener("click",async()=>{
    if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;return}
    installHelp();
  });
  q("#crm-install-close").addEventListener("click",()=>installDlg.close());
  installDlg.addEventListener("click",event=>{if(event.target===installDlg)installDlg.close()});
  function connectivity(){network.hidden=navigator.onLine; if(!navigator.onLine)indicator.textContent="нет сети"}
  window.addEventListener("online",connectivity);window.addEventListener("offline",connectivity);connectivity();
  if("serviceWorker" in navigator && location.protocol==="https:"){
    window.addEventListener("load",()=>navigator.serviceWorker.register("/crm-sw.js",{scope:"/"}).catch(()=>{}));
  }
  const section=location.hash.replace("#","");
  if(["today","tasks","inbox","projects","leads"].includes(section)){
    const btn=document.querySelector('.crm-desktop-nav [data-section="'+section+'"]');
    if(btn){const attempt=()=>{if(loggedIn())btn.click()};attempt();document.addEventListener("click",event=>{if(event.target?.id==="login-button")setTimeout(attempt,900)},{once:true})}
  }
  window.addEventListener("keydown",event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openAssistant()}
  });
})();
