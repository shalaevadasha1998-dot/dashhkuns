document.documentElement.classList.add('motion-ready');
document.getElementById('year')?.replaceChildren(String(new Date().getFullYear()));

const INTAKE_URL='https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/website-intake';
const BOOKING_API_URL='https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/website-booking';
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



const stockMotions=[...document.querySelectorAll('[data-stock-motion]')];
if(stockMotions.length){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData=Boolean(navigator.connection?.saveData);
  if(!reduced&&!saveData){
    stockMotions.forEach(stockMotion=>{
      const source=stockMotion.querySelector('source[data-src]');
      if(source&&!source.src){
        source.src=source.dataset.src||'';
        stockMotion.load();
      }
      stockMotion.play().catch(()=>{});
    });
    const syncStockMotion=()=>{
      stockMotions.forEach(stockMotion=>{
        if(document.hidden)stockMotion.pause();
        else stockMotion.play().catch(()=>{});
      });
    };
    document.addEventListener('visibilitychange',syncStockMotion);
  }
}

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
const bookingDays=document.querySelector('#booking-days');
const bookingTimes=document.querySelector('#booking-times');
const bookingTimeStep=document.querySelector('#booking-time-step');
const bookingStatus=document.querySelector('#booking-status');
const bookingStart=document.querySelector('#booking-start');
const bookingSubmit=document.querySelector('#booking-submit');
const bookingSuccessCopy=document.querySelector('#booking-success-copy');
const bookingMeet=document.querySelector('#booking-meet');

let formStarted=false;
let availability=[];
let selectedDay=-1;
let selectedSlot='';
let pendingLeadId='';

const markFormStart=()=>{
  if(formStarted)return;
  formStarted=true;
  track('form_start');
};
form?.addEventListener('focusin',markFormStart,{once:true});
form?.addEventListener('input',markFormStart,{once:true});

const setBookingError=message=>{
  if(!formError)return;
  formError.textContent=message;
  formError.hidden=false;
};

const clearBookingError=()=>formError?.setAttribute('hidden','');

const renderTimes=index=>{
  if(!bookingTimes||!bookingTimeStep)return;
  selectedDay=index;
  selectedSlot='';
  if(bookingStart)bookingStart.value='';
  if(bookingSubmit)bookingSubmit.disabled=true;

  document.querySelectorAll('.booking-day').forEach((el,i)=>el.classList.toggle('active',i===index));
  const day=availability[index];
  bookingTimes.replaceChildren();
  day.slots.forEach(slot=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='booking-time';
    button.textContent=slot.time;
    button.dataset.start=slot.start;
    button.addEventListener('click',()=>{
      selectedSlot=slot.start;
      if(bookingStart)bookingStart.value=slot.start;
      document.querySelectorAll('.booking-time').forEach(el=>el.classList.toggle('active',el===button));
      if(bookingSubmit)bookingSubmit.disabled=false;
    });
    bookingTimes.append(button);
  });
  bookingTimeStep.hidden=false;
};

const renderAvailability=days=>{
  availability=Array.isArray(days)?days:[];
  if(!bookingDays||!bookingStatus)return;
  bookingDays.replaceChildren();
  bookingTimeStep?.setAttribute('hidden','');

  if(!availability.length){
    bookingStatus.textContent='свободных слотов на ближайшие две недели нет. напиши мне в телеграм.';
    return;
  }

  bookingStatus.textContent='выбирай. занятые часы я уже убрала.';
  availability.forEach((day,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='booking-day';
    button.innerHTML='<span>'+day.weekday+'</span><strong>'+day.label+'</strong><small>'+day.slots.length+' слотов</small>';
    button.addEventListener('click',()=>renderTimes(index));
    bookingDays.append(button);
  });
};

const loadAvailability=async()=>{
  if(!form||!bookingStatus)return;
  bookingStatus.textContent='смотрю свободное время…';
  clearBookingError();
  try{
    const response=await fetch(BOOKING_API_URL+'?action=availability',{headers:{'Accept':'application/json'},cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||'availability_failed');
    renderAvailability(data.days);
  }catch(error){
    console.error(error);
    bookingStatus.textContent='календарь пока не подключён.';
    setBookingError('не смогла получить свободное время. пока можно написать мне в телеграм: @dashhkunsik');
  }
};

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  clearBookingError();
  if(!form.checkValidity()){form.reportValidity();return}
  if(!selectedSlot){setBookingError('сначала выбери день и время.');return}

  const original=bookingSubmit?.textContent||'забронировать созвон';
  if(bookingSubmit){bookingSubmit.disabled=true;bookingSubmit.textContent='бронирую…'}

  const data=new FormData(form);
  const name=String(data.get('name')||'').trim();
  const email=String(data.get('email')||'').trim();
  const extraContact=String(data.get('contact')||'').trim();
  const details=String(data.get('details')||'').trim();

  try{
    if(!pendingLeadId){
      const lead=await postIntake({
        kind:'lead',
        name,
        contact:[email,extraContact].filter(Boolean).join(' / '),
        projectType:'созвон / 30 минут',
        projectStage:'новая заявка',
        budgetRange:'не указан',
        launchDate:'',
        details,
        companyWebsite:data.get('companyWebsite')||'',
        context:getContext()
      });
      pendingLeadId=lead?.id||'';
    }

    const response=await fetch(BOOKING_API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'book',
        leadId:pendingLeadId,
        name,
        email,
        contact:extraContact,
        details,
        start:selectedSlot,
        context:getContext()
      })
    });
    const booked=await response.json();
    if(!response.ok||!booked.ok){
      if(booked.error==='slot_unavailable'){
        selectedSlot='';
        if(bookingStart)bookingStart.value='';
        await loadAvailability();
        throw new Error('slot_unavailable');
      }
      throw new Error(booked.error||'booking_failed');
    }

    form.reset();
    form.hidden=true;
    pendingLeadId='';
    if(bookingSuccessCopy)bookingSuccessCopy.textContent='созвон '+(booked.display||'')+' мск. приглашение и google meet уже отправлены на '+email+'.';
    if(bookingMeet&&booked.meetUrl){
      bookingMeet.href=booked.meetUrl;
      bookingMeet.hidden=false;
    }
    if(success){
      success.hidden=false;
      success.classList.add('visible');
      success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    }
  }catch(error){
    console.error(error);
    const message=error?.message==='slot_unavailable'
      ? 'этот слот только что заняли. я обновила свободное время, выбери другой.'
      : 'не получилось создать встречу. данные заявки сохранены, попробуй ещё раз или напиши @dashhkunsik.';
    setBookingError(message);
  }finally{
    if(bookingSubmit){bookingSubmit.textContent=original;bookingSubmit.disabled=!selectedSlot}
  }
});

if(form)loadAvailability();

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
