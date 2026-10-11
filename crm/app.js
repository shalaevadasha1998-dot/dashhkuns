const API="https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/crm-api";
const APIKEY="sb_publishable_nlajzfkH1tYEOAUZKcBvgg_5hbYJCM4";
const TOKEN_KEY="dashhkuns_crm_token_v1";
const CLOSED=new Set(["bounce","declined"]);
const state={leads:[],view:"today",direction:"all",query:"",editing:null};

const $=(s)=>document.querySelector(s);
const esc=(v)=>String(v??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=(v)=>{if(!v)return "—";const d=new Date(v+"T12:00:00");return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"short"}).replace(".","")};
const statusClass=(v)=>"status-"+String(v||"").toLowerCase().replace(/[^a-z0-9а-я]+/g,"-");
const token=()=>localStorage.getItem(TOKEN_KEY);

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
  const el=$("#toast");el.textContent=message;el.classList.toggle("error",error);el.hidden=false;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2300);
}

function showLogin(){
  $("#app").hidden=true;$("#login-screen").hidden=false;$("#login-password").focus();
}
function showApp(){ $("#login-screen").hidden=true;$("#app").hidden=false; }

$("#login-form").addEventListener("submit",async(e)=>{
  e.preventDefault();const b=$("#login-button"),err=$("#login-error");err.hidden=true;b.disabled=true;b.textContent="вхожу…";
  try{const data=await api("login",{password:$("#login-password").value});localStorage.setItem(TOKEN_KEY,data.token);$("#login-password").value="";showApp();await load();}
  catch{err.hidden=false}
  finally{b.disabled=false;b.textContent="войти"}
});
$("#logout-button").addEventListener("click",()=>{localStorage.removeItem(TOKEN_KEY);showLogin()});

async function load(){
  $("#sync-label").textContent="обновляю…";
  try{const data=await api("list");state.leads=data.leads||[];$("#sync-label").textContent="обновлено сейчас";render();}
  catch(e){$("#sync-label").textContent="ошибка синхронизации";toast("не удалось обновить crm",true)}
}

function dueLead(l){return l.next_action_at&&!CLOSED.has(l.status)&&l.next_action_at<=today()}
function hotLead(l){return !CLOSED.has(l.status)&&(l.priority==="high"||l.status==="warm"||l.status==="replied")}
function activeLead(l){return !CLOSED.has(l.status)}
function score(l){
  let s=0;if(dueLead(l))s+=100;if(l.status==="warm")s+=80;if(l.status==="replied")s+=60;
  if(l.priority==="high")s+=30;else if(l.priority==="medium")s+=10;
  if(l.next_action_at){const diff=(new Date(l.next_action_at)-new Date(today()))/864e5;s+=Math.max(0,20-diff)}
  return s;
}

function filtered(){
  let rows=[...state.leads];
  if(state.view==="today")rows=rows.filter(dueLead);
  if(state.view==="hot")rows=rows.filter(hotLead);
  if(state.direction!=="all")rows=rows.filter(l=>l.direction===state.direction);
  if(state.query){
    const q=state.query.toLowerCase();
    rows=rows.filter(l=>[l.company,l.contact,l.notes,l.last_reply,l.direction,l.status].join(" ").toLowerCase().includes(q));
  }
  return rows.sort((a,b)=>score(b)-score(a)||String(a.company).localeCompare(String(b.company),"ru"));
}

function renderStats(){
  const active=state.leads.filter(activeLead).length;
  const due=state.leads.filter(dueLead).length;
  const hot=state.leads.filter(hotLead).length;
  const replies=state.leads.filter(l=>["replied","warm","auto-ack","paid-only"].includes(l.status)).length;
  $("#stats").innerHTML=[
    ["в работе",active,""],["сегодня",due,"due"],["горячие",hot,"hot"],["ответы",replies,""]
  ].map(([label,value,cl])=>`<article class="stat ${cl}"><strong>${value}</strong><span>${label}</span></article>`).join("");
}

function renderChips(){
  const dirs=["all",...new Set(state.leads.map(l=>l.direction).filter(Boolean))];
  const labels={"all":"все","producer jobs":"вакансии","producer sales":"продажи","iGaming production":"igaming","podcast venue":"подкаст","photo studio":"фотостудии"};
  $("#direction-chips").innerHTML=dirs.map(d=>`<button class="chip ${state.direction===d?"active":""}" data-direction="${esc(d)}">${esc(labels[d]||d)}</button>`).join("");
  document.querySelectorAll("[data-direction]").forEach(b=>b.onclick=()=>{state.direction=b.dataset.direction;render()});
}

function leadCard(l){
  const due=dueLead(l),warm=l.status==="warm"||l.status==="replied";
  const dateClass=due&&l.next_action_at<today()?"overdue":"";
  return `<article class="lead priority-${esc(l.priority)} ${due?"is-due":""} ${warm?"is-warm":""}" data-id="${l.id}">
    <div>
      <p class="eyebrow">${esc(l.direction)}</p>
      <h3>${esc(l.company)}</h3>
      <div class="contact">${esc(l.contact||"контакт не указан")}</div>
      <div class="meta">
        <span class="tag ${statusClass(l.status)}">${esc(l.status)}</span>
        <span class="tag">${esc(l.priority)}</span>
        <span class="tag">${esc(l.channel||"")}</span>
      </div>
    </div>
    <div class="lead-date ${dateClass}">
      <b>${fmtDate(l.next_action_at)}</b>
      <span>next</span>
    </div>
    <div class="lead-note">${esc(l.last_reply||l.notes||"")}</div>
  </article>`;
}

function render(){
  renderStats();renderChips();
  document.querySelectorAll("#view-switch button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  const titles={today:["сегодня","нужно сделать"],hot:["приоритет","горячие контакты"],all:["pipeline","вся база"]};
  $("#section-kicker").textContent=titles[state.view][0];$("#section-title").textContent=titles[state.view][1];
  const rows=filtered();$("#result-count").textContent=rows.length;
  $("#lead-list").innerHTML=rows.length?rows.map(leadCard).join(""):`<div class="empty">здесь сейчас пусто. это хорошо.</div>`;
  document.querySelectorAll(".lead").forEach(el=>el.onclick=()=>openLead(state.leads.find(l=>l.id===el.dataset.id)));
}

$("#view-switch").addEventListener("click",(e)=>{const b=e.target.closest("button[data-view]");if(!b)return;state.view=b.dataset.view;render()});
$("#search-input").addEventListener("input",(e)=>{state.query=e.target.value.trim();render()});

const dialog=$("#lead-dialog"),form=$("#lead-form");
$("#close-dialog").onclick=()=>dialog.close();
$("#fab").onclick=()=>openLead(null);
$("#desktop-add").onclick=()=>openLead(null);

function setForm(l){
  const fields=["company","direction","priority","contact","channel","status","sent_at","next_action_at","last_reply","notes","deal_value","currency","source_url"];
  for(const name of fields){const el=form.elements[name];if(el)el.value=l?.[name]??(name==="priority"?"medium":name==="channel"?"email":name==="currency"?"RUB":name==="status"?"new":"")}
}
async function openLead(l){
  state.editing=l?.id||null;setForm(l);
  $("#dialog-kicker").textContent=l?l.direction:"новый лид";$("#dialog-title").textContent=l?l.company:"новый контакт";
  $("#delete-lead").hidden=!l;$("#activity-section").hidden=!l;$("#activity-list").innerHTML="";
  dialog.showModal();
  if(l)loadActivities(l.id);
}
$("#quick-status").addEventListener("click",(e)=>{const b=e.target.closest("[data-status]");if(b)form.elements.status.value=b.dataset.status});

form.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const b=$("#save-lead");b.disabled=true;b.textContent="сохраняю…";
  const fd=new FormData(form),lead={};
  for(const [k,v] of fd.entries())lead[k]=String(v).trim()||null;
  if(lead.deal_value)lead.deal_value=Number(lead.deal_value);else lead.deal_value=null;
  try{
    if(state.editing)await api("update",{id:state.editing,patch:lead});
    else await api("create",{lead});
    dialog.close();toast("сохранено");await load();
  }catch(e){toast("не сохранилось",true)}
  finally{b.disabled=false;b.textContent="сохранить"}
});

$("#delete-lead").addEventListener("click",async()=>{
  if(!state.editing||!confirm("точно удалить этот лид?"))return;
  try{await api("delete",{id:state.editing});dialog.close();toast("удалено");await load()}catch{toast("не удалилось",true)}
});

async function loadActivities(id){
  try{
    const data=await api("activities",{id});
    $("#activity-list").innerHTML=(data.activities||[]).length?(data.activities||[]).map(a=>`<div class="activity-item"><p>${esc(a.body)}</p><time>${new Date(a.happened_at).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time></div>`).join(""):`<div class="activity-item"><time>истории пока нет</time></div>`;
  }catch{}
}
$("#activity-add").addEventListener("click",async()=>{
  const input=$("#activity-input"),body=input.value.trim();if(!body||!state.editing)return;
  try{await api("add_activity",{id:state.editing,body});input.value="";await loadActivities(state.editing);toast("заметка добавлена")}catch{toast("не добавилось",true)}
});
$("#copy-contact").addEventListener("click",async()=>{
  const l=state.leads.find(x=>x.id===state.editing);if(!l?.contact)return;
  await navigator.clipboard.writeText(l.contact);toast("контакт скопирован")
});

(async()=>{if(token()){showApp();await load()}else showLogin()})();