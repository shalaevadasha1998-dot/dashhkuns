document.documentElement.classList.add('motion-ready');
const IS_EN=document.documentElement.lang.toLowerCase().startsWith('en');

document.getElementById('year')?.replaceChildren(String(new Date().getFullYear()));

const brand=document.querySelector('.brand');
if(brand&&!brand.querySelector('.brand-state')){
  const state=document.createElement('span');
  state.className='brand-state';
  state.setAttribute('aria-hidden','true');
  const words=IS_EN?['idea','build','launch']:['идея','сборка','запуск'];
  let brandWord=0;
  state.textContent=words[0];
  brand.append(state);
  setInterval(()=>{
    brandWord=(brandWord+1)%words.length;
    state.classList.add('brand-state-out');
    setTimeout(()=>{state.textContent=words[brandWord];state.classList.remove('brand-state-out')},240);
  },4200);
}

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

const menuBtn=document.querySelector('.menu-btn');
const mobileMenu=document.querySelector('.mobile-menu');
const setMenu=open=>{
  if(!menuBtn||!mobileMenu)return;
  mobileMenu.classList.toggle('open',open);
  mobileMenu.setAttribute('aria-hidden',String(!open));
  menuBtn.setAttribute('aria-expanded',String(open));
  menuBtn.setAttribute('aria-label',open?(IS_EN?'close menu':'закрыть меню'):(IS_EN?'open navigation':'открыть навигацию'));
  menuBtn.textContent=open?(IS_EN?'close':'закрыть'):(IS_EN?'menu':'тык сюда');
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
  const mobile=matchMedia('(max-width:700px)').matches;
  const canPlay=!reduced&&!saveData&&!mobile;
  const startStockMotion=()=>{
    if(!canPlay)return;
    stockMotions.forEach(video=>{
      const source=video.querySelector('source[data-src]');
      if(source&&!source.getAttribute('src')){
        source.setAttribute('src',source.dataset.src||'');
        video.load();
      }
      video.play().catch(()=>{});
    });
  };
  if(canPlay){
    const startLater=()=>setTimeout(startStockMotion,700);
    if(document.readyState==='complete')startLater();
    else window.addEventListener('load',startLater,{once:true});
    document.addEventListener('visibilitychange',()=>{
      stockMotions.forEach(video=>{
        if(!video.currentSrc)return;
        if(document.hidden)video.pause();
        else video.play().catch(()=>{});
      });
    });
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

const leadForm=document.querySelector('#project-form');
const leadSuccess=document.querySelector('#lead-success');
const leadError=document.querySelector('#lead-error');

leadForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  leadError?.setAttribute('hidden','');
  if(!leadForm.checkValidity()){leadForm.reportValidity();return}
  const button=leadForm.querySelector('button[type="submit"]');
  const original=button?.textContent||(IS_EN?'send inquiry':'отправить заявку');
  if(button){button.disabled=true;button.textContent=IS_EN?'sending…':'отправляю…'}
  const data=new FormData(leadForm);
  try{
    await postIntake({
      kind:'lead',
      name:String(data.get('name')||'').trim(),
      contact:String(data.get('contact')||'').trim(),
      projectType:'продюсирование / заявка',
      projectStage:'новая заявка',
      budgetRange:'не указан',
      launchDate:'',
      details:String(data.get('details')||'').trim(),
      companyWebsite:data.get('companyWebsite')||'',
      context:getContext()
    });
    track('form_submit',{type:'application'});
    leadForm.reset();
    leadForm.hidden=true;
    leadSuccess?.removeAttribute('hidden');
    leadSuccess?.classList.add('visible');
    leadSuccess?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }catch(error){
    console.error(error);
    leadError?.removeAttribute('hidden');
  }finally{
    if(button){button.disabled=false;button.textContent=original}
  }
});


const BOOKING_API='https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/website-booking';
const bookingForm=document.getElementById('booking-form');
const bookingCalendar=document.getElementById('booking-calendar');
const bookingLoading=document.getElementById('booking-loading');
const bookingOptions=document.getElementById('booking-options');
const bookingDays=document.getElementById('booking-days');
const bookingSlots=document.getElementById('booking-slots');
const bookingEmpty=document.getElementById('booking-empty');
const bookingFetchError=document.getElementById('booking-fetch-error');
const bookingStart=document.getElementById('booking-start');
const bookingPicked=document.getElementById('booking-picked-date');
const bookingError=document.getElementById('booking-error');
const bookingSuccess=document.getElementById('booking-success');
const bookingMeetLink=document.getElementById('booking-meet-link');
let bookingData=[];
let bookingDayIndex=0;
let bookingSelected='';
let bookingSubmitting=false;


const bookingDatePicker=document.getElementById('booking-date-picker');
const bookingDayEmpty=document.getElementById('booking-day-empty');
let bookingDateUserSelected=false;

const bookingDateLabel=date=>{
  const parsed=new Date(date+'T12:00:00Z');
  return new Intl.DateTimeFormat(IS_EN?'en-GB':'ru-RU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(parsed);
};
const bookingTimeLabel=start=>{
  const date=new Date(start);
  return new Intl.DateTimeFormat(IS_EN?'en-GB':'ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Moscow'}).format(date);
};
const moscowToday=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Moscow'}).formatToParts(new Date());
  const value=part=>parts.find(p=>p.type===part)?.value||'';
  return value('year')+'-'+value('month')+'-'+value('day');
};
if(bookingDatePicker){
  const today=moscowToday();
  bookingDatePicker.min=today;
  const [year,month,day]=today.split('-').map(Number);
  bookingDatePicker.max=new Date(Date.UTC(year,month-1,day+13)).toISOString().slice(0,10);
}

const setBookingSlot=(slot,button)=>{
  bookingSelected=slot.start;
  if(bookingStart)bookingStart.value=slot.start;
  bookingSlots?.querySelectorAll('button').forEach(b=>{
    b.classList.toggle('active',b===button);
    b.setAttribute('aria-pressed',String(b===button));
  });
  if(bookingPicked)bookingPicked.textContent=bookingDateLabel(bookingData[bookingDayIndex].date)+' / '+bookingTimeLabel(slot.start)+' мск';
  if(bookingForm)bookingForm.hidden=false;
  if(bookingError)bookingError.hidden=true;
  bookingForm?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
};
const selectBookingDay=index=>{
  if(!bookingData[index])return;
  bookingDayIndex=index;
  bookingSelected='';
  if(bookingStart)bookingStart.value='';
  if(bookingForm)bookingForm.hidden=true;
  if(bookingDatePicker)bookingDatePicker.value=bookingData[index].date;
  bookingDays?.querySelectorAll('button').forEach((b,i)=>{
    b.classList.toggle('active',i===index);
    b.setAttribute('aria-pressed',String(i===index));
  });
  if(!bookingSlots)return;
  bookingSlots.replaceChildren();
  const day=bookingData[index];
  if(bookingDayEmpty)bookingDayEmpty.hidden=true;
  day.slots.forEach(slot=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='booking-slot';
    button.textContent=slot.time||bookingTimeLabel(slot.start);
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>setBookingSlot(slot,button));
    bookingSlots.append(button);
  });
};
const updateBookingDate=()=>{
  if(!bookingDatePicker?.value||!bookingOptions||!bookingData.length)return;
  const selected=bookingDatePicker.value;
  const index=bookingData.findIndex(day=>day.date===selected);
  if(index>=0){selectBookingDay(index);return;}
  bookingSelected='';
  if(bookingStart)bookingStart.value='';
  if(bookingForm)bookingForm.hidden=true;
  if(bookingSlots)bookingSlots.replaceChildren();
  bookingDays?.querySelectorAll('button').forEach(button=>{
    button.classList.remove('active');button.setAttribute('aria-pressed','false');
  });
  if(bookingDayEmpty)bookingDayEmpty.hidden=false;
};
bookingDatePicker?.addEventListener('change',()=>{
  bookingDateUserSelected=true;
  updateBookingDate();
});
const drawBookingCalendar=()=>{
  if(!bookingDays)return;
  bookingDays.replaceChildren();
  bookingData.forEach((day,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='booking-day';
    button.textContent=bookingDateLabel(day.date);
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{bookingDateUserSelected=true;selectBookingDay(index);});
    bookingDays.append(button);
  });
  if(bookingDateUserSelected&&bookingDatePicker?.value)updateBookingDate();
  else if(bookingData.length)selectBookingDay(0);
};
const loadBookingAvailability=async()=>{
  if(!bookingCalendar)return;
  if(bookingLoading)bookingLoading.hidden=false;
  if(bookingOptions)bookingOptions.hidden=true;
  if(bookingEmpty)bookingEmpty.hidden=true;
  if(bookingFetchError)bookingFetchError.hidden=true;
  if(bookingDayEmpty)bookingDayEmpty.hidden=true;
  if(bookingForm)bookingForm.hidden=true;
  bookingSelected='';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),62000);
  try{
    const response=await fetch(BOOKING_API+'?action=availability',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('availability_http_'+response.status);
    const result=await response.json();
    if(!result.ok||!Array.isArray(result.days))throw Error(result.error||'invalid_availability');
    bookingData=result.days.slice(0,14).filter(day=>typeof day.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&Array.isArray(day.slots)).map(day=>({
      date:day.date,
      slots:day.slots.slice(0,40).filter(slot=>typeof slot.start==='string'&&!Number.isNaN(new Date(slot.start).getTime())&&new Date(slot.start).getTime()>Date.now()).map(slot=>({start:slot.start,time:typeof slot.time==='string'?slot.time.slice(0,5):''}))
    })).filter(day=>day.slots.length>0);
    if(bookingData.length){drawBookingCalendar();if(bookingOptions)bookingOptions.hidden=false;}
    else if(bookingEmpty)bookingEmpty.hidden=false;
  }catch(error){
    console.error('availability unavailable',error);
    if(bookingFetchError)bookingFetchError.hidden=false;
  }finally{
    clearTimeout(timer);
    if(bookingLoading)bookingLoading.hidden=true;
  }
};
document.getElementById('booking-retry')?.addEventListener('click',loadBookingAvailability);
if(bookingCalendar)loadBookingAvailability();

bookingForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(bookingSubmitting)return;
  if(bookingError)bookingError.hidden=true;
  if(!bookingSelected||!bookingStart?.value)return;
  if(!bookingForm.checkValidity()){bookingForm.reportValidity();return;}
  const button=document.getElementById('booking-submit');
  const original=button?.textContent||'';
  if(button){button.disabled=true;button.textContent=IS_EN?'booking…':'бронирую…';}
  bookingSubmitting=true;
  const form=new FormData(bookingForm);
  const name=String(form.get('name')||'').trim();
  const email=String(form.get('email')||'').trim();
  const details=String(form.get('details')||'').trim();
  const start=bookingSelected;
  const honeypot=String(form.get('companyWebsite')||'');
  try{
    if(honeypot)return;
    const response=await fetch(BOOKING_API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'book',name,email,details,start,contact:email})
    });
    const result=await response.json();
    if(!response.ok||!result.ok){
      const err=new Error(result.error||'booking_failed');
      err.code=result.error||'booking_failed';
      throw err;
    }
    bookingForm.hidden=true;
    if(bookingOptions)bookingOptions.hidden=true;
    if(bookingEmpty)bookingEmpty.hidden=true;
    if(bookingFetchError)bookingFetchError.hidden=true;
    if(bookingSuccess)bookingSuccess.hidden=false;
    const copy=document.getElementById('booking-success-copy');
    if(copy)copy.textContent=(IS_EN?'confirmed for ':'встреча подтверждена: ')+bookingDateLabel(start.slice(0,10))+' / '+bookingTimeLabel(start)+' мск. '+(IS_EN?'an invitation will arrive by email.':'приглашение придёт на email.');
    if(bookingMeetLink&&typeof result.meetUrl==='string'&&/^https:\/\/meet\.google\.com\//.test(result.meetUrl)){
      bookingMeetLink.href=result.meetUrl;
      bookingMeetLink.hidden=false;
    }
    postIntake({
      kind:'lead',name,contact:email,
      projectType:'встреча / 30 минут',
      projectStage:'забронирована в календаре',
      budgetRange:'не указан',launchDate:'',
      details:['дата и время: '+start,'тема: '+details,'id встречи: '+String(result.eventId||'').slice(0,160)].join('\n'),
      context:getContext()
    },{keepalive:true}).catch(error=>console.error('booking lead archive failed',error));
    bookingSuccess?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }catch(error){
    console.error('booking failed',error);
    if(bookingError){
      bookingError.hidden=false;
      bookingError.textContent=error.code==='slot_unavailable'
        ?(IS_EN?'this slot was just taken. please choose another one.':'это время только что заняли. выбери другое.')
        :(IS_EN?'couldn’t confirm your booking. please try again or send an inquiry.':'не получилось подтвердить запись. попробуй ещё раз или оставь заявку.');
    }
    if(error.code==='slot_unavailable')await loadBookingAvailability();
  }finally{
    bookingSubmitting=false;
    if(button){button.disabled=false;button.textContent=original;}
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
