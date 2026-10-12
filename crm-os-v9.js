/* dashhkuns crm os: working hub for website, calendar, apartment and task archive. */
(()=>{
  "use strict";
  const app=document.querySelector("#app");
  const today=document.querySelector(".crm-page-today");
  const mobile=document.querySelector("#mobile-nav");
  const desktop=document.querySelector(".crm-desktop-nav");
  if(!app||!today||!mobile||!desktop)return;

  const css=document.createElement("style");css.textContent=[
  ".crm-stat-link{font:inherit;color:inherit;text-align:left;cursor:pointer;width:100%;appearance:none;transition:transform .16s,box-shadow .16s}",
  ".crm-stat-link:hover,.crm-stat-link:focus-visible{transform:translateY(-3px);box-shadow:3px 3px 0 #ff3fad}",
  ".crm-stat-link span{line-height:1.5}",
  ".crm-os-preview{padding:20px var(--gutter);background:#f9f8f5;border-bottom:1px solid #111}",
  ".crm-os-preview h2{font-size:clamp(22px,3vw,37px);margin:0 0 14px;letter-spacing:-.04em}",
  ".crm-os-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
  ".crm-os-tile{border:1px solid #111;background:#fff;border-radius:17px;text-align:left;padding:16px;min-height:104px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;color:#111;cursor:pointer}",
  ".crm-os-tile strong{font-size:clamp(20px,3vw,33px);letter-spacing:-.04em;line-height:1}",
  ".crm-os-tile span{font-size:12px;line-height:1.3}",
  ".crm-os-tile.green{background:#ccff00}.crm-os-tile.pink{background:#ffb1cd}",
  ".crm-os-tile:hover{box-shadow:4px 4px 0 #111}",
  ".crm-os-pane{padding:28px var(--gutter) 54px}",
  ".crm-os-pane h2{font-size:clamp(38px,6vw,68px);line-height:.97;letter-spacing:-.065em;margin:0 0 8px}",
  ".crm-os-pane p{line-height:1.5}",
  ".crm-os-tabs{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0 28px}",
  ".crm-os-tabs button{border:1px solid #111;border-radius:40px;background:white;padding:11px 17px;font-weight:800;cursor:pointer}",
  ".crm-os-section{padding:22px 0 32px;border-top:1px solid #111}",
  ".crm-os-section h3{font-size:clamp(24px,4vw,38px);margin:0 0 12px;letter-spacing:-.04em}",
  ".crm-os-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
  ".crm-os-stat{border:1px solid #111;border-radius:16px;padding:14px;background:#fff;min-height:95px}",
  ".crm-os-stat strong{display:block;font-size:clamp(25px,4vw,48px);line-height:1.05}",
  ".crm-os-stat span{font-size:11px;line-height:1.4;color:#444}",
  ".crm-os-card{border:1px solid #111;border-radius:17px;padding:16px;background:#fff;margin-bottom:10px}",
  ".crm-os-card strong{display:block;font-size:15px;margin-bottom:5px}",
  ".crm-os-card span,.crm-os-muted{font-size:12px;color:#666}",
  ".crm-os-bars{display:flex;flex-direction:column;gap:10px}",
  ".crm-os-bar{display:grid;grid-template-columns:145px 1fr 40px;gap:10px;align-items:center;font-size:12px}",
  ".crm-os-bar .track{height:11px;background:#eee;border-radius:12px;overflow:hidden;border:1px solid #aaa}",
  ".crm-os-bar .fill{height:100%;background:#ff3fad}",
  ".crm-os-action{background:#ccff00;color:#111;border:1px solid #111;border-radius:40px;padding:10px 15px;font-size:12px;font-weight:800;cursor:pointer}",
  ".crm-os-calendar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}",
  ".crm-os-inline-links{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0}",
  "@media(max-width:800px){.crm-os-tiles,.crm-os-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.crm-os-calendar{grid-template-columns:1fr}.crm-mobile-nav{grid-template-columns:repeat(6,minmax(0,1fr))}.crm-os-bar{grid-template-columns:110px 1fr 30px}.crm-os-pane{padding-bottom:120px}}",
  "@media(max-width:440px){.crm-os-tile{padding:12px;min-height:90px}.crm-os-tile strong{font-size:25px}.crm-os-preview{padding-top:17px}.crm-os-stat{padding:12px}}"
  ].join("\n");document.head.appendChild(css);

  const preview=document.createElement("section");preview.className="crm-os-preview";
  preview.innerHTML='<h2>мой штаб · os</h2><div class="crm-os-tiles" id="crm-os-tiles"></div>';
  today.querySelector("#today-stats").insertAdjacentElement("afterend",preview);

  const page=document.createElement("section");page.className="crm-page crm-os-pane";page.dataset.page="os";page.hidden=true;
  page.innerHTML='<p class="kicker">dashhkuns os × crm</p><h2>всё под контролем</h2><p class="crm-os-muted">сайт, календарь, задачи и быт. показатели обновляются из базы crm.</p><div class="crm-os-tabs"><button type="button" data-os-action="site">аналитика сайта</button><button type="button" data-os-action="calendar">встречи и события</button><button type="button" data-os-action="apartment">квартира</button><button type="button" data-os-action="archive">архив задач</button></div><section class="crm-os-section" id="crm-os-site"><h3>сайт · последние 7 дней</h3><div class="crm-os-stats" id="crm-os-web-stats"></div><p class="crm-os-muted">события сайта, а не уникальные посетители. клики записи не означают подтверждённую встречу.</p><div class="crm-os-bars" id="crm-os-web-bars"></div><div class="crm-os-inline-links"><a href="https://dashhkuns.com" target="_blank" rel="noopener">открыть сайт ↗</a></div></section><section class="crm-os-section" id="crm-os-calendar"><h3>встречи и события</h3><div class="crm-os-stats" id="crm-os-cal-stats"></div><div class="crm-os-calendar"><div><h4>ближайшие</h4><div id="crm-os-upcoming"></div></div><div><h4>прошедшие</h4><div id="crm-os-past"></div></div></div></section><section class="crm-os-section" id="crm-os-home"><h3>квартира и быт</h3><p class="crm-os-muted">отдельный проект для дел по квартире. умный дом сохранён в своём проекте.</p><div class="crm-os-inline-links"><button class="crm-os-action" type="button" data-os-action="apartment">открыть задачи квартиры</button><button class="crm-os-action" type="button" data-os-action="new-home-task">+ новая домашняя задача</button></div><div id="crm-os-home-tasks"></div></section>';
  mobile.insertAdjacentElement("beforebegin",page);

  const b1=document.createElement("button");b1.type="button";b1.dataset.section="os";b1.textContent="os / сайт";
  desktop.appendChild(b1);
  const b2=document.createElement("button");b2.type="button";b2.dataset.section="os";b2.innerHTML="<span>▤</span>ещё";
  mobile.appendChild(b2);
  for(const b of [b1,b2])b.addEventListener("click",()=>openOS());
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number=n=>Number(n||0).toLocaleString("ru-RU");
  const date=(s)=>{try{return new Date(s).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return "нет даты"}};
  const stat=(num,label)=>'<div class="crm-os-stat"><strong>'+number(num)+'</strong><span>'+esc(label)+'</span></div>';
  let snapshot=window.__CRM_CURRENT_SNAPSHOT||null;
  let apartmentId="";
  function openOS(target){
    window.__CRM_GOTO?.("os");
    render(snapshot);
    if(target)requestAnimationFrame(()=>document.getElementById("crm-os-"+target)?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  function openApartment(create=false){
    if(!apartmentId){openOS("home");return}
    if(create){
      if(typeof window.__CRM_NEW_TASK_FOR==="function")window.__CRM_NEW_TASK_FOR(apartmentId);
      else openOS("home");
    }else window.__CRM_TASK_VIEW?.("open",apartmentId);
  }
  function openArchive(){window.__CRM_TASK_VIEW?.("done","all")}
  page.addEventListener("click",e=>{
    const action=e.target.closest("[data-os-action]")?.dataset.osAction;
    if(action==="site")openOS("site");
    else if(action==="calendar")openOS("calendar");
    else if(action==="apartment")openApartment();
    else if(action==="archive")openArchive();
    else if(action==="new-home-task")openApartment(true);
  });
  preview.addEventListener("click",e=>{
    const action=e.target.closest("[data-os-action]")?.dataset.osAction;
    if(action==="apartment")openApartment();
    else if(action==="archive")openArchive();
    else if(action==="site"||action==="calendar")openOS(action);
  });
  const labels={
    page_view_home:"главная",case_view:"кейсы",page_view_contact:"контакты",
    page_view_projects:"проекты",page_view_services:"услуги",page_view_about:"обо мне",
    cta_project_click:"клики «обсудить»",calendly_click:"клики записи",
    form_start:"начали форму",form_submit_success:"отправили форму"
  };
  function render(s){
    if(!s)return;
    const tasks=s.tasks||[],events=s.events||[],website=s.website||{};
    const projects=s.projects||[];
    const apartment=projects.find(p=>p.slug==="kvartira-byt"||p.name==="квартира / быт");
    apartmentId=apartment?.id||"";
    const activeTasks=tasks.filter(t=>t.status!=="done");
    const done=tasks.filter(t=>t.status==="done").length;
    const apartmentTasks=activeTasks.filter(t=>t.project_id===apartmentId).length;
    const now=Date.now();
    const upcoming=events.filter(e=>new Date(e.ends_at||e.starts_at).getTime()>=now).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    const past=events.filter(e=>new Date(e.ends_at||e.starts_at).getTime()<now).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
    const cards=[
      {action:"site",title:number(website.tracked_events),label:"событий сайта за 7 дней",cls:"green"},
      {action:"calendar",title:number(events.length),label:"встреч и событий в календаре",cls:""},
      {action:"apartment",title:number(apartmentTasks),label:"задач по квартире",cls:""},
      {action:"archive",title:number(done),label:"выполнено · архив",cls:"pink"}
    ];
    document.getElementById("crm-os-tiles").innerHTML=cards.map(c=>'<button class="crm-os-tile '+c.cls+'" type="button" data-os-action="'+c.action+'"><strong>'+c.title+'</strong><span>'+c.label+' ↗</span></button>').join("");
    document.getElementById("crm-os-web-stats").innerHTML=[
      stat(website.tracked_events,"зарегистрировано событий"),
      stat(website.page_views,"просмотры страниц и кейсов"),
      stat(website.unique_sessions,"сессии с идентификатором"),
      stat(website.leads_total,"заявки через сайт")
    ].join("");
    const by=website.by_event||{};
    const entries=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const max=Math.max(1,...entries.map(e=>e[1]));
    document.getElementById("crm-os-web-bars").innerHTML=entries.length?entries.map(([name,count])=>'<div class="crm-os-bar"><span>'+esc(labels[name]||name)+'</span><div class="track"><div class="fill" style="width:'+Math.round(100*count/max)+'%"></div></div><b>'+number(count)+'</b></div>').join(""):'<p class="crm-os-muted">данные статистики пока не поступили.</p>';
    document.getElementById("crm-os-cal-stats").innerHTML=[stat(events.length,"событий всего"),stat(upcoming.length,"предстоящие"),stat(past.length,"прошедшие"),stat((s.projects||[]).filter(p=>p.category==="home").length,"домашних проектов")].join("");
    function eventCards(rows){
      return rows.slice(0,20).map(e=>'<article class="crm-os-card"><strong>'+esc(e.title||"встреча")+'</strong><span>'+esc(date(e.starts_at))+' · '+esc(e.location||"без локации")+'</span></article>').join("")||'<p class="crm-os-muted">нет записей</p>';
    }
    document.getElementById("crm-os-upcoming").innerHTML=eventCards(upcoming);
    document.getElementById("crm-os-past").innerHTML=eventCards(past);
    document.getElementById("crm-os-home-tasks").innerHTML=apartment
      ? '<p>открытые задачи квартиры: <b>'+number(apartmentTasks)+'</b></p>'
      : '<p class="crm-os-muted">проект «квартира / быт» пока не появился в списке. обнови crm.</p>';
  }
  window.addEventListener("crm:snapshot",e=>{snapshot=e.detail.data;render(snapshot)});
  render(snapshot);
})();