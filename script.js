document.documentElement.classList.add('js');
document.body.classList.add('page-enter');

document.getElementById('year')?.append(new Date().getFullYear());

const menuBtn = document.querySelector('.menu-btn');
const mobileMenu = document.querySelector('.mobile-menu');
menuBtn?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'закрыть ×' : 'меню +';
});
mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click',()=> mobileMenu.classList.remove('open')));

const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

const glow = document.querySelector('.pointer-glow');
if(glow && matchMedia('(pointer:fine)').matches){
  window.addEventListener('pointermove', e => { glow.style.left=e.clientX+'px'; glow.style.top=e.clientY+'px'; }, {passive:true});
}

document.querySelectorAll('.tilt-card').forEach(card=>{
  if(!matchMedia('(pointer:fine)').matches) return;
  card.addEventListener('mousemove',e=>{
    const r=card.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
    card.style.transform=`perspective(900px) rotateX(${y*-3}deg) rotateY(${x*4}deg) translateY(-3px)`;
  });
  card.addEventListener('mouseleave',()=> card.style.transform='');
});

const form = document.querySelector('#project-form');
form?.addEventListener('submit', e=>{
  e.preventDefault();
  const data = new FormData(form);
  const subject = encodeURIComponent('проект для dashhkuns — ' + (data.get('name') || 'новый запрос'));
  const body = encodeURIComponent([
    'имя: ' + (data.get('name') || ''),
    'контакт: ' + (data.get('contact') || ''),
    'что это: ' + (data.get('type') || ''),
    'бюджет / модель: ' + (data.get('budget') || ''),
    '',
    'про проект:',
    data.get('about') || ''
  ].join('\n'));
  window.location.href = `mailto:shalaevadasha1998@gmail.com?subject=${subject}&body=${body}`;
});
