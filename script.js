document.documentElement.classList.add('motion-ready');
document.getElementById('year')?.replaceChildren(String(new Date().getFullYear()));

const INTAKE_URL='https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/website-intake';
const REF_TTL=90*24*60*60*1000;
const now=()=>Date.now();
const readJSON=(key,store=localStorage)=>{try{return JSON.parse(store.getItem(key)||'null')}catch{return null}};
const writeJSON=(key,value,store=localStorage)=>{try{store.setItem(key,JSON.stringify(value))}catch{}};
const validStored=value=>value&&value.expiresAt>now();

const params=new URLSearchParams(location.search);
let refData=readJSON('dashhkuns_ref_v1');
if(!validStored(refData)){refData=null;try{localStorage.removeItem('dashhkuns_ref_v1')}catch{}}
const incomingRef=(params.get('ref')||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,64);
if(incomingRef&&!refData){
  refData={value:incomingRef,setAt:now(),expiresAt:now()+REF_TTL};
  writeJSON('dashhkuns_ref_v1',refData);
}

let utmData=readJSON('dashhkuns_utm_v1');
if(!validStored(utmData)){utmData=null;try{localStorage.removeItem('dashhkuns_utm_v1')}catch{}}
const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const hasIncomingUtm=utmKeys.some(k=>params.get(k));
if(hasIncomingUtm&&!utmData){
  utmData={
    utmSource:(params.get('utm_source')||'').slice(0,180),
    utmMedium:(params.get('utm_medium')||'').slice(0,180),
    utmCampaign:(params.get('utm_campaign')||'').slice(0,240),
    utmContent:(params.get('utm_content')||'').slice(0,240),
    utmTerm:(params.get('utm_term')||'').slice(0,240),
    setAt:now(),expiresAt:now()+REF_TTL
  };
  writeJSON('dashhkuns_utm_v1',utmData);
}

let firstTouch=readJSON('dashhkuns_first_touch_v1');
if(!firstTouch){
  firstTouch={referrer:document.referrer||'',landingUrl:location.href,setAt:now()};
  writeJSON('dashhkuns_first_touch_v1',firstTouch);
}

let sessionId;
try{
  sessionId=sessionStorage.getItem('dashhkuns_session_v1');
  if(!sessionId){
    sessionId=crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));
    sessionStorage.setItem('dashhkuns_session_v1',sessionId);
  }
}catch{sessionId=Date.now().toString(36)+Math.random().toString(36).slice(2)}

const getContext=()=>({
  path:location.pathname,
  pageTitle:document.title,
  refCode:refData?.value||'',
  utmSource:utmData?.utmSource||'',
  utmMedium:utmData?.utmMedium||'',
  utmCampaign:utmData?.utmCampaign||'',
  utmContent:utmData?.utmContent||'',
  utmTerm:utmData?.utmTerm||'',
  referrer:firstTouch?.referrer||document.referrer||'',
  landingUrl:firstTouch?.landingUrl||location.href,
  sessionId
});

const postIntake=async(payload,{keepalive=false}={})=>{
  const response=await fetch(INTAKE_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    keepalive
  });
  if(!response.ok)throw new Error('intake_'+response.status);
  return response.json();
};

const track=(eventName,data={})=>{
  postIntake({kind:'event',eventName,data,context:getContext()},{keepalive:true}).catch(()=>{});
};

const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
const pageEvents={
  '/':'page_view_home',
  '/services':'page_view_services',
  '/projects':'page_view_projects',
  '/about':'page_view_about',
  '/contact':'page_view_contact'
};
if(pageEvents[path])track(pageEvents[path]);

document.querySelectorAll('.js-project-cta').forEach(el=>el.addEventListener('click',()=>track('cta_project_click',{label:(el.textContent||'').trim(),path:location.pathname})));
document.querySelectorAll('a[href*="calendly.com"]').forEach(el=>el.addEventListener('click',()=>track('calendly_click',{label:(el.textContent||'').trim()})));
document.querySelectorAll('a[href*="t.me/"]').forEach(el=>el.addEventListener('click',()=>track('telegram_click',{label:(el.textContent||'').trim()})));
document.querySelectorAll('a[href^="mailto:"]').forEach(el=>el.addEventListener('click',()=>track('email_click',{label:(el.textContent||'').trim()})));

const menuBtn=document.querySelector('.menu-btn');
const mobileMenu=document.querySelector('.mobile-menu');
const setMenu=open=>{
  if(!menuBtn||!mobileMenu)return;
  mobileMenu.classList.toggle('open',open);
  mobileMenu.setAttribute('aria-hidden',String(!open));
  menuBtn.setAttribute('aria-expanded',String(open));
  menuBtn.setAttribute('aria-label',open?'закрыть меню':'открыть навигацию');
  menuBtn.textContent=open?'закрыть':'открыть';
  document.body.classList.toggle('menu-open',open);
};
menuBtn?.addEventListener('click',()=>setMenu(!mobileMenu?.classList.contains('open')));
mobileMenu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobileMenu?.classList.contains('open')){setMenu(false);menuBtn?.focus()}});
window.addEventListener('resize',()=>{if(window.innerWidth>980&&mobileMenu?.classList.contains('open'))setMenu(false)},{passive:true});

const accentEls=[...document.querySelectorAll('.accent-pop')];
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const aio=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('accent-live');aio.unobserve(e.target)}
  }),{threshold:.35});
  accentEls.forEach(el=>aio.observe(el));
}else accentEls.forEach(el=>el.classList.add('accent-live'));

const revealEls=[...document.querySelectorAll('.reveal')];
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.1});
  revealEls.forEach(el=>io.observe(el));
}else revealEls.forEach(el=>el.classList.add('visible'));

const caseEls=[...document.querySelectorAll('[data-case]')];
if(caseEls.length&&'IntersectionObserver' in window){
  const seen=new Set();
  const cio=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting&&e.intersectionRatio>=.55){
      const name=e.target.dataset.case;
      if(name&&!seen.has(name)){seen.add(name);track('case_view',{case:name});cio.unobserve(e.target)}
    }
  }),{threshold:[.55]});
  caseEls.forEach(el=>cio.observe(el));
}

const glow=document.querySelector('.pointer-glow');
if(glow&&matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  let raf=0,x=0,y=0;
  window.addEventListener('pointermove',e=>{
    x=e.clientX;y=e.clientY;
    if(!raf)raf=requestAnimationFrame(()=>{glow.style.left=x+'px';glow.style.top=y+'px';raf=0});
  },{passive:true});
}

const form=document.querySelector('#project-form');
const success=document.querySelector('#form-success');
const formError=document.querySelector('#form-error');
let formStarted=false;
const markFormStart=()=>{
  if(formStarted)return;
  formStarted=true;
  track('form_start');
};
form?.addEventListener('focusin',markFormStart,{once:true});
form?.addEventListener('input',markFormStart,{once:true});

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  formError?.setAttribute('hidden','');
  if(!form.checkValidity()){form.reportValidity();return}
  const button=form.querySelector('button[type="submit"]');
  const original=button?.textContent||'отправить заявку';
  if(button){button.disabled=true;button.textContent='отправляю…'}
  const data=new FormData(form);
  const payload={
    kind:'lead',
    name:data.get('name')||'',
    contact:data.get('contact')||'',
    projectType:data.get('type')||'короткая заявка',
    projectStage:data.get('stage')||'не указан',
    budgetRange:data.get('budget')||'не указан',
    launchDate:data.get('launchDate')||'',
    details:data.get('details')||'',
    companyWebsite:data.get('companyWebsite')||'',
    context:getContext()
  };
  try{
    await postIntake(payload);
    form.reset();
    form.hidden=true;
    if(success){success.hidden=false;success.classList.add('visible');success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})}
  }catch(error){
    console.error(error);
    formError?.removeAttribute('hidden');
  }finally{
    if(button){button.disabled=false;button.textContent=original}
  }
});

document.querySelectorAll('[data-photo-cycle]').forEach(gallery=>{
  const photos=[...gallery.querySelectorAll('img')];
  const count=gallery.querySelector('.tap-count');
  if(photos.length<2)return;
  let index=Math.max(0,photos.findIndex(img=>img.classList.contains('active')));
  const show=next=>{
    photos[index]?.classList.remove('active');
    index=(next+photos.length)%photos.length;
    photos[index]?.classList.add('active');
    if(count)count.textContent=String(index+1).padStart(2,'0')+' / '+String(photos.length).padStart(2,'0');
  };
  gallery.addEventListener('click',()=>show(index+1));
  gallery.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();show(index+1)}
    if(e.key==='ArrowRight')show(index+1);
    if(e.key==='ArrowLeft')show(index-1);
  });
});
