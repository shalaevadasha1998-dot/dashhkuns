document.getElementById('year')?.append(new Date().getFullYear());
const menuBtn=document.querySelector('.menu-btn');
const mobileMenu=document.querySelector('.mobile-menu');
menuBtn?.addEventListener('click',()=>{const open=mobileMenu.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open));menuBtn.textContent=open?'закрыть':'меню'});
mobileMenu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mobileMenu.classList.remove('open')));
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const glow=document.querySelector('.pointer-glow');
if(glow&&matchMedia('(pointer:fine)').matches){window.addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px'},{passive:true})}
const form=document.querySelector('#project-form');
form?.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(form);const subject=encodeURIComponent('проект для dashhkuns — '+(data.get('name')||'новый запрос'));const body=encodeURIComponent(['имя: '+(data.get('name')||''),'контакт: '+(data.get('contact')||''),'что это: '+(data.get('type')||''),'бюджет / модель: '+(data.get('budget')||''),'','про проект:',data.get('about')||''].join('\n'));window.location.href='mailto:shalaevadasha1998@gmail.com?subject='+subject+'&body='+body});