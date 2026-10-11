const API="https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/crm-api";
const APIKEY="sb_publishable_nlajzfkH1tYEOAUZKcBvgg_5hbYJCM4";
const TOKEN_KEY="dashhkuns_crm_token_v2";
const CLOSED_LEADS=new Set(["bounce","declined"]);
const DONE_TASKS=new Set(["done"]);

const state={
  section:"today",
  projects:[],tasks:[],leads:[],messages:[],events:[],briefings:[],outbox:[],
  taskView:"open",taskSearch:"",taskProject:"all",
  messageView:"all",messageSearch:"",
  leadView:"today",leadSearch:"",leadDirection:"all",
  editingTask:null,editingLead:null,editingProject:null,currentMessage:null
};

const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
const esc=(v)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const token=()=>localStorage.getItem(TOKEN_KEY);
const moscowDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const today=()=>moscowDate();
const fmtDate=(v)=>{if(!v)return "—";const d=new Date(String(v).length===10?v+"T12:00:00":v);return new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"short"}).format(d).replace(".","")};
const fmtDateLong=(v)=>{if(!v)return "—";const d=new Date(v);return new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(d).replace(".","")};
const projectById=(id)=>state.projects.find(p=>p.id===id);
const projectName=(id)=>projectById(id)?.name||"без проекта";
const isTaskOpen=(t)=>!DONE_TASKS.has(t.status);
const isTaskDue=(t)=>isTaskOpen(t)&&t.due_at&&t.due_at<=today();
const isTaskOverdue=(t)=>isTaskOpen(t)&&t.due_at&&t.due_at<today();
const isLeadDue=(l)=>l.next_action_at&&!CLOSED_LEADS.has(l.status)&&l.next_action_at<=today();
const isLeadHot=(l)=>!CLOSED_LEADS.has(l.status)&&(l.priority==="high"||["warm","replied","action needed"].includes(l.status));
const normalize=(v)=>String(v||"").toLowerCase();

async function api(action,payload={}){
  const headers={"Content-Type":"application/json","apikey":APIKEY};
  if(action!=="login"&&token())headers.Authorization="Bearer "+token();
  const res=await fetch(API,{method:"POST",headers,body:JSON.stringify({action,...payload})});
  const data=await res.json().catch(()=>({}));
  if(res.status===401&&action!=="login"){localStorage.removeItem(TOKEN_KEY);showLogin();throw new Error("unauthorized")}
  if(!res.ok)throw new Error(data.detail||data.error||"request_failed");
  return data;
}
function toast(message,error=false){
  const el=$("#toast");el.textContent=message;el.style.background=error?"#ff8baa":"var(--acid)";el.hidden=false;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2200);
}
function showLogin(){ $("#app").hidden=true;$("#login-screen").hidden=false;setTimeout(()=>$("#login-password")?.focus(),80) }
function showApp(){ $("#login-screen").hidden=true;$("#app").hidden=false }

$("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();const b=$("#login-button"),err=$("#login-error");err.hidden=true;b.disabled=true;b.textContent="вхожу…";
  try{const data=await api("login",{password:$("#login-password").value});localStorage.setItem(TOKEN_KEY,data.token);$("#login-password").value="";showApp();await load()}
  catch{err.hidden=false}
  finally{b.disabled=false;b.textContent="войти"}
});
$("#logout-button").addEventListener("click",()=>{localStorage.removeItem(TOKEN_KEY);showLogin()});

async function load(){
  $("#sync-label").textContent="обновляю…";
  try{
    const data=await api("snapshot");
    Object.assign(state,{
      projects:data.projects||[],tasks:data.tasks||[],leads:data.leads||[],messages:data.messages||[],events:data.events||[],briefings:data.briefings||[],outbox:data.outbox||[]
    });
    $("#sync-label").textContent="обновлено сейчас";
    renderAll();
  }catch(e){$("#sync-label").textContent="ошибка синхронизации";toast("не удалось обновить crm",true)}
}
function renderAll(){
  populateProjectSelects();
  renderToday();renderTasks();renderInbox();renderProjects();renderLeads();
}
function goto(section){
  state.section=section;
  $$("[data-page]").forEach(p=>p.hidden=p.dataset.page!==section);
  $$("[data-section]").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
  const fab=$("#global-fab");fab.textContent="+";
  window.scrollTo({top:0,behavior:"instant"});
}
$$("[data-section]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.section)));
$$("[data-goto]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.goto)));

function stat(label,value,cl=""){return `<article class="crm-stat ${cl}"><strong>${value}</strong><span>${label}</span></article>`}

function renderToday(){
  const open=state.tasks.filter(isTaskOpen).length;
  const due=state.tasks.filter(isTaskDue).length;
  const unread=state.messages.filter(m=>m.status==="unread").length;
  const hot=state.leads.filter(isLeadHot).length;
  $("#today-stats").innerHTML=stat("открыто",open)+stat("сегодня",due,"due")+stat("ответы",unread)+stat("горячие",hot,"hot");

  const priority={high:0,medium:1,low:2};
  let tasks=state.tasks.filter(t=>isTaskDue(t)||(["high"].includes(t.priority)&&isTaskOpen(t)&&t.status!=="backlog"))
    .sort((a,b)=>(isTaskOverdue(b)-isTaskOverdue(a))||((priority[a.priority]??9)-(priority[b.priority]??9))||String(a.due_at||"9999").localeCompare(String(b.due_at||"9999")));
  tasks=tasks.slice(0,12);
  $("#today-task-count").textContent=tasks.length;
  $("#today-tasks").innerHTML=tasks.length?tasks.map(taskRow).join(""):`<div class="crm-empty">на сегодня пусто. это хорошо.</div>`;
  bindTaskRows("#today-tasks");

  const messages=state.messages.filter(m=>m.direction==="inbound").slice(0,5);
  $("#today-messages").innerHTML=messages.length?messages.map(m=>miniMessage(m)).join(""):`<div class="crm-mini-item"><p>новых ответов нет</p></div>`;
  $$("#today-messages [data-message-id]").forEach(el=>el.onclick=()=>openMessage(el.dataset.messageId));

  const now=Date.now();
  const events=state.events.filter(e=>new Date(e.ends_at||e.starts_at).getTime()>=now).slice(0,6);
  $("#today-events").innerHTML=events.length?events.map(e=>`<div class="crm-mini-item"><strong>${esc(e.title)}</strong><p>${esc(e.location||projectName(e.project_id)||"")}</p><time>${fmtDateLong(e.starts_at)}</time></div>`).join(""):`<div class="crm-mini-item"><p>в календаре пусто</p></div>`;

  const waitingTasks=state.tasks.filter(t=>t.status==="waiting").slice(0,5);
  const waitingLeads=state.leads.filter(l=>l.status==="waiting"&&l.priority==="high").slice(0,3);
  const chunks=[
    ...waitingTasks.map(t=>`<div class="crm-mini-item" data-edit-task="${t.id}"><strong>${esc(t.title)}</strong><p>ждём: ${esc(t.waiting_on||"ответ")} · ${esc(projectName(t.project_id))}</p><time>${t.due_at?"до "+fmtDate(t.due_at):"без срока"}</time></div>`),
    ...waitingLeads.map(l=>`<div class="crm-mini-item" data-edit-lead="${l.id}"><strong>${esc(l.company)}</strong><p>${esc(l.contact||"")} · ${esc(l.direction)}</p><time>follow-up ${fmtDate(l.next_action_at)}</time></div>`)
  ];
  $("#today-waiting").innerHTML=chunks.length?chunks.join(""):`<div class="crm-mini-item"><p>ничего критичного не ждём</p></div>`;
  $$("#today-waiting [data-edit-task]").forEach(el=>el.onclick=()=>openTask(el.dataset.editTask));
  $$("#today-waiting [data-edit-lead]").forEach(el=>el.onclick=()=>openLead(el.dataset.editLead));
}
function taskRow(t){
  const p=projectById(t.project_id);
  return `<div class="crm-task-row" data-task-row="${t.id}">
    <input class="crm-check" type="checkbox" data-task-check="${t.id}" ${t.status==="done"?"checked":""}>
    <div class="crm-task-main"><button type="button" data-edit-task="${t.id}">${esc(t.title)}</button>
      ${t.description?`<p>${esc(t.description)}</p>`:""}
      <div class="crm-task-meta">${p?`<span class="crm-pill">${esc(p.name)}</span>`:""}${t.waiting_on?`<span class="crm-pill pink">ждём: ${esc(t.waiting_on)}</span>`:""}<span class="crm-pill ${t.priority==="high"?"acid":""}">${esc(t.priority)}</span></div>
    </div>
    <div class="crm-due ${isTaskOverdue(t)?"overdue":""}">${fmtDate(t.due_at)}</div>
  </div>`;
}
function bindTaskRows(root){
  $$(root+" [data-task-check]").forEach(cb=>cb.onchange=()=>toggleTask(cb.dataset.taskCheck,cb.checked));
  $$(root+" [data-edit-task]").forEach(b=>b.onclick=()=>openTask(b.dataset.editTask));
}
async function toggleTask(id,done){
  try{await api("update_task",{id,patch:{status:done?"done":"todo"}});toast(done?"готово ✓":"вернула в работу");await load()}catch{toast("не сохранилось",true)}
}

function renderTasks(){
  const projectFilter=$("#task-project-filter");projectFilter.value=state.taskProject;
  const q=normalize(state.taskSearch);
  let rows=state.tasks.filter(t=>{
    if(state.taskView==="open"&&["done","backlog"].includes(t.status))return false;
    if(state.taskView==="today"&&!isTaskDue(t))return false;
    if(state.taskView==="waiting"&&t.status!=="waiting")return false;
    if(state.taskView==="backlog"&&t.status!=="backlog")return false;
    if(state.taskView==="done"&&t.status!=="done")return false;
    if(state.taskProject!=="all"&&t.project_id!==state.taskProject)return false;
    if(q&&!normalize([t.title,t.description,t.waiting_on,projectName(t.project_id)].join(" ")).includes(q))return false;
    return true;
  });
  const rank={high:0,medium:1,low:2};rows.sort((a,b)=>(rank[a.priority]-rank[b.priority])||String(a.due_at||"9999").localeCompare(String(b.due_at||"9999")));
  $("#task-board").innerHTML=rows.length?rows.map(t=>`<article class="crm-task-card priority-${esc(t.priority)} status-${esc(t.status)}">
    <input class="crm-check" type="checkbox" data-task-check="${t.id}" ${t.status==="done"?"checked":""}>
    <div><button class="crm-text-btn crm-task-title" data-edit-task="${t.id}">${esc(t.title)}</button>
    ${t.description?`<div class="crm-task-desc">${esc(t.description)}</div>`:""}
    <div class="crm-task-meta"><span class="crm-pill">${esc(projectName(t.project_id))}</span><span class="crm-pill">${esc(t.status)}</span>${t.waiting_on?`<span class="crm-pill pink">ждём: ${esc(t.waiting_on)}</span>`:""}</div></div>
    <div class="crm-task-side"><div class="crm-due ${isTaskOverdue(t)?"overdue":""}">${fmtDate(t.due_at)}</div><span class="crm-pill ${t.priority==="high"?"acid":""}">${esc(t.priority)}</span></div>
  </article>`).join(""):`<div class="crm-empty">ничего нет</div>`;
  bindTaskRows("#task-board");
}
$("#task-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-task-view]");if(!b)return;state.taskView=b.dataset.taskView;$$("[data-task-view]").forEach(x=>x.classList.toggle("active",x===b));renderTasks()});
$("#task-search").addEventListener("input",e=>{state.taskSearch=e.target.value;renderTasks()});
$("#task-project-filter").addEventListener("change",e=>{state.taskProject=e.target.value;renderTasks()});

function miniMessage(m){return `<div class="crm-mini-item" data-message-id="${m.id}"><strong>${esc(m.sender||m.subject||"ответ")}</strong><p>${esc(m.snippet||m.subject||"")}</p><time>${fmtDateLong(m.received_at)} ${m.status==="unread"?"· новое":""}</time></div>`}
function renderInbox(){
  const q=normalize(state.messageSearch);
  let rows=state.messages.filter(m=>{
    if(state.messageView==="unread"&&m.status!=="unread")return false;
    if(state.messageView==="actionable"&&!m.actionable)return false;
    if(q&&!normalize([m.sender,m.subject,m.body,m.snippet].join(" ")).includes(q))return false;
    return true;
  });
  $("#message-list").innerHTML=rows.length?rows.map(m=>`<article class="crm-message-card ${m.status==="unread"?"unread":""} ${m.actionable?"actionable":""}" data-message-id="${m.id}">
    <div><p class="kicker">${esc(m.channel)} · ${esc(m.direction)}</p><h3>${esc(m.subject||"без темы")}</h3><p><strong>${esc(m.sender||"")}</strong></p><p>${esc(m.snippet||m.body||"")}</p></div>
    <div class="crm-message-side"><time>${fmtDateLong(m.received_at)}</time>${m.actionable?`<span class="crm-pill acid">нужно действие</span>`:""}${m.status==="unread"?`<span class="crm-pill pink">новое</span>`:""}</div>
  </article>`).join(""):`<div class="crm-empty">ответов по этому фильтру нет</div>`;
  $$("#message-list [data-message-id]").forEach(el=>el.onclick=()=>openMessage(el.dataset.messageId));
}
$("#message-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-message-view]");if(!b)return;state.messageView=b.dataset.messageView;$$("[data-message-view]").forEach(x=>x.classList.toggle("active",x===b));renderInbox()});
$("#message-search").addEventListener("input",e=>{state.messageSearch=e.target.value;renderInbox()});

async function openMessage(id){
  const m=state.messages.find(x=>x.id===id);if(!m)return;state.currentMessage=id;
  $("#message-channel").textContent=m.channel||"email";$("#message-subject").textContent=m.subject||"ответ";
  $("#message-full-meta").innerHTML=`<span class="crm-pill">${esc(m.sender||"")}</span><span class="crm-pill">${fmtDateLong(m.received_at)}</span>${m.actionable?`<span class="crm-pill acid">нужно действие</span>`:""}`;
  $("#message-full-body").textContent=m.body||m.snippet||"";
  const url=m.metadata?.gmail_url;
  $("#message-actions").innerHTML=`<div>${url?`<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">открыть в gmail</a>`:""}</div><div class="button-row"><button class="btn ghost" id="message-toggle-action">${m.actionable?"действие закрыто":"нужно действие"}</button><button class="btn primary" id="message-mark-read">${m.status==="unread"?"прочитано":"закрыть"}</button></div>`;
  $("#message-reply").value="";
  const queued=state.outbox.find(o=>o.source_message_id===id&&o.status==="queued");
  if(queued){$("#message-reply").value=queued.body||"";$("#message-queue-reply").textContent="уже в очереди";$("#message-queue-reply").disabled=true}else{$("#message-queue-reply").textContent="отправить";$("#message-queue-reply").disabled=false}
  $("#message-queue-reply").onclick=async()=>{
    const body=$("#message-reply").value.trim();if(!body)return toast("напиши ответ",true);
    const match=String(m.sender||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const recipient=match?match[0]:String(m.sender||"").trim();
    if(!recipient.includes("@"))return toast("не нашла email получателя",true);
    const subject=/^re:/i.test(m.subject||"")?(m.subject||""):"Re: "+(m.subject||"");
    try{await api("queue_email",{source_message_id:id,recipient,subject,body});toast("письмо поставлено в отправку");$("#message-queue-reply").textContent="в очереди";$("#message-queue-reply").disabled=true;await load()}catch{toast("не удалось поставить в очередь",true)}
  };
  $("#message-dialog").showModal();
  $("#message-mark-read").onclick=async()=>{if(m.status==="unread"){await api("update_message",{id,patch:{status:"read"}});m.status="read";toast("прочитано");renderAll()}else $("#message-dialog").close()};
  $("#message-toggle-action").onclick=async()=>{await api("update_message",{id,patch:{actionable:!m.actionable}});m.actionable=!m.actionable;toast(m.actionable?"пометила как действие":"убрала из действий");renderAll();openMessage(id)};
  if(m.status==="unread"){api("update_message",{id,patch:{status:"read"}}).then(()=>{m.status="read";renderToday();renderInbox()}).catch(()=>{})}
}

function renderProjects(){
  const rows=[...state.projects].sort((a,b)=>(a.sort_order||100)-(b.sort_order||100));
  $("#project-grid").innerHTML=rows.map(p=>{
    const open=state.tasks.filter(t=>t.project_id===p.id&&isTaskOpen(t)&&t.status!=="backlog").length;
    return `<article class="crm-project-card priority-${esc(p.priority)} status-${esc(p.status)}" data-project-id="${p.id}">
      <div class="crm-project-top"><div><span class="crm-pill">${esc(p.status)}</span> <span class="crm-pill">${esc(p.category)}</span></div><span class="crm-project-count">${open}</span></div>
      <h3>${esc(p.name)}</h3><p class="crm-project-goal">${esc(p.goal||"")}</p>
      <div class="crm-project-next"><strong>следующий шаг ${p.deadline?"· "+fmtDate(p.deadline):""}</strong>${esc(p.next_action||"нет следующего действия")}</div>
    </article>`;
  }).join("");
  $$("#project-grid [data-project-id]").forEach(el=>el.onclick=()=>openProject(el.dataset.projectId));
}

function leadScore(l){let s=0;if(isLeadDue(l))s+=100;if(l.status==="warm")s+=80;if(l.status==="replied")s+=60;if(l.priority==="high")s+=30;return s}
function renderLeads(){
  const active=state.leads.filter(l=>!CLOSED_LEADS.has(l.status)).length,due=state.leads.filter(isLeadDue).length,hot=state.leads.filter(isLeadHot).length,replies=state.leads.filter(l=>["replied","warm","auto-ack","paid-only"].includes(l.status)).length;
  $("#lead-stats").innerHTML=stat("в работе",active)+stat("сегодня",due,"due")+stat("горячие",hot,"hot")+stat("ответы",replies);
  renderLeadChips();
  const q=normalize(state.leadSearch);
  let rows=state.leads.filter(l=>{
    if(state.leadView==="today"&&!isLeadDue(l))return false;
    if(state.leadView==="hot"&&!isLeadHot(l))return false;
    if(state.leadDirection!=="all"&&l.direction!==state.leadDirection)return false;
    if(q&&!normalize([l.company,l.contact,l.notes,l.last_reply,l.direction,l.status].join(" ")).includes(q))return false;
    return true;
  }).sort((a,b)=>leadScore(b)-leadScore(a)||String(a.company).localeCompare(String(b.company),"ru"));
  $("#lead-list").innerHTML=rows.length?rows.map(leadCard).join(""):`<div class="crm-empty">здесь сейчас пусто</div>`;
  $$("#lead-list [data-lead-id]").forEach(el=>el.onclick=()=>openLead(el.dataset.leadId));
}
function leadCard(l){return `<article class="crm-lead priority-${esc(l.priority)} ${isLeadDue(l)?"is-due":""} ${["warm","replied"].includes(l.status)?"is-warm":""}" data-lead-id="${l.id}">
  <div><p class="kicker">${esc(l.direction)}</p><h3>${esc(l.company)}</h3><div class="crm-contact">${esc(l.contact||"контакт не указан")}</div><div class="crm-meta"><span class="crm-tag status-${esc(l.status).replace(/\s+/g,"-")}">${esc(l.status)}</span><span class="crm-tag">${esc(l.priority)}</span><span class="crm-tag">${esc(l.channel||"")}</span></div></div>
  <div class="crm-date ${l.next_action_at<today()&&isLeadDue(l)?"overdue":""}"><b>${fmtDate(l.next_action_at)}</b><span>next</span></div>
  <div class="crm-note">${esc(l.last_reply||l.notes||"")}</div></article>`}
function renderLeadChips(){
  const dirs=["all",...new Set(state.leads.map(l=>l.direction).filter(Boolean))];
  const labels={"all":"все","producer jobs":"вакансии","producer sales":"продажи","iGaming production":"igaming","podcast venue":"подкаст","photo studio":"фотостудии"};
  $("#lead-direction-chips").innerHTML=dirs.map(d=>`<button class="crm-chip ${state.leadDirection===d?"active":""}" data-dir="${esc(d)}">${esc(labels[d]||d)}</button>`).join("");
  $$("#lead-direction-chips [data-dir]").forEach(b=>b.onclick=()=>{state.leadDirection=b.dataset.dir;renderLeads()});
}
$("#lead-tabs").addEventListener("click",e=>{const b=e.target.closest("[data-lead-view]");if(!b)return;state.leadView=b.dataset.leadView;$$("[data-lead-view]").forEach(x=>x.classList.toggle("active",x===b));renderLeads()});
$("#lead-search").addEventListener("input",e=>{state.leadSearch=e.target.value;renderLeads()});

function populateProjectSelects(){
  const options=state.projects.filter(p=>p.status!=="done").map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("#task-project-select").innerHTML='<option value="">без проекта</option>'+options;
  $("#task-project-filter").innerHTML='<option value="all">все проекты</option>'+options;
  $("#task-project-filter").value=state.taskProject;
}

const taskDialog=$("#task-dialog"),taskForm=$("#task-form");
$$("[data-open-task]").forEach(b=>b.onclick=()=>openTask());
function openTask(id=null){
  const t=id?state.tasks.find(x=>x.id===id):null;state.editingTask=t?.id||null;
  $("#task-dialog-title").textContent=t?"задача":"новая задача";$("#delete-task").hidden=!t;
  const defaults={title:"",description:"",project_id:"",priority:"medium",status:"todo",due_at:"",owner:"dora",waiting_on:"",category:"work"};
  for(const [k,v] of Object.entries(defaults))if(taskForm.elements[k])taskForm.elements[k].value=t?.[k]??v;
  taskDialog.showModal();
}
taskForm.addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(taskForm),task={};for(const [k,v] of fd.entries())task[k]=String(v).trim()||null;
  try{if(state.editingTask)await api("update_task",{id:state.editingTask,patch:task});else await api("create_task",{task});taskDialog.close();toast("задача сохранена");await load()}catch{toast("не сохранилось",true)}
});
$("#delete-task").onclick=async()=>{if(!state.editingTask||!confirm("удалить задачу?"))return;await api("delete_task",{id:state.editingTask});taskDialog.close();toast("удалено");await load()};

const projectDialog=$("#project-dialog"),projectForm=$("#project-form");
$("#new-project-button").onclick=()=>openProject();
function openProject(id=null){
  const p=id?state.projects.find(x=>x.id===id):null;state.editingProject=p?.id||null;$("#project-dialog-title").textContent=p?p.name:"новый проект";
  const defaults={name:"",status:"active",priority:"medium",category:"work",deadline:"",goal:"",next_action:"",notes:""};
  for(const [k,v] of Object.entries(defaults))if(projectForm.elements[k])projectForm.elements[k].value=p?.[k]??v;
  projectDialog.showModal();
}
projectForm.addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(projectForm),project={};for(const [k,v] of fd.entries())project[k]=String(v).trim()||null;
  try{if(state.editingProject)await api("update_project",{id:state.editingProject,patch:project});else await api("create_project",{project});projectDialog.close();toast("проект сохранён");await load()}catch{toast("не сохранилось",true)}
});

const leadDialog=$("#lead-dialog"),leadForm=$("#lead-form");
$$("[data-open-lead]").forEach(b=>b.onclick=()=>openLead());
function openLead(id=null){
  const l=id?state.leads.find(x=>x.id===id):null;state.editingLead=l?.id||null;$("#lead-dialog-title").textContent=l?l.company:"новый лид";$("#delete-lead").hidden=!l;
  const defaults={company:"",direction:"producer jobs",priority:"medium",contact:"",channel:"email",status:"new",sent_at:"",next_action_at:"",last_reply:"",notes:""};
  for(const [k,v] of Object.entries(defaults))if(leadForm.elements[k])leadForm.elements[k].value=l?.[k]??v;
  leadDialog.showModal();
}
$("#quick-status").addEventListener("click",e=>{const b=e.target.closest("[data-status]");if(b)leadForm.elements.status.value=b.dataset.status});
leadForm.addEventListener("submit",async e=>{
  e.preventDefault();const fd=new FormData(leadForm),lead={};for(const [k,v] of fd.entries())lead[k]=String(v).trim()||null;
  try{if(state.editingLead)await api("update_lead",{id:state.editingLead,patch:lead});else await api("create_lead",{lead});leadDialog.close();toast("лид сохранён");await load()}catch{toast("не сохранилось",true)}
});
$("#delete-lead").onclick=async()=>{if(!state.editingLead||!confirm("удалить лид?"))return;await api("delete_lead",{id:state.editingLead});leadDialog.close();toast("удалено");await load()};

$$("[data-close-dialog]").forEach(b=>b.onclick=()=>$("#"+b.dataset.closeDialog).close());
$("#global-fab").onclick=()=>state.section==="leads"?openLead():openTask();

(async()=>{if(token()){showApp();await load()}else showLogin()})();