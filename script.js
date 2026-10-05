document.getElementById('year')?.replaceChildren(String(new Date().getFullYear()));

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

const revealEls=[...document.querySelectorAll('.reveal')];
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.1});
  revealEls.forEach(el=>io.observe(el));
}else{
  revealEls.forEach(el=>el.classList.add('visible'));
}

const glow=document.querySelector('.pointer-glow');
if(glow&&matchMedia('(pointer:fine)').matches){
  let raf=0,x=0,y=0;
  window.addEventListener('pointermove',e=>{
    x=e.clientX;y=e.clientY;
    if(!raf)raf=requestAnimationFrame(()=>{glow.style.left=x+'px';glow.style.top=y+'px';raf=0});
  },{passive:true});
}

const form=document.querySelector('#project-form');
form?.addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(form);
  const subject=encodeURIComponent('проект для dashhkuns — '+(data.get('name')||'новый запрос'));
  const body=encodeURIComponent([
    'имя: '+(data.get('name')||''),
    'контакт: '+(data.get('contact')||''),
    'что это: '+(data.get('type')||''),
    'бюджет / модель: '+(data.get('budget')||''),
    '',
    'про проект:',
    data.get('about')||''
  ].join('\n'));
  window.location.href='mailto:shalaevadasha1998@gmail.com?subject='+subject+'&body='+body;
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


/* russian typography: no hanging short words and fewer one-word last lines */
const typographyTargets=document.querySelectorAll(
  'h1,h2,h3,p,li,.btn,.top-cta,.nav a,.mobile-menu a,.desc,.small,.role,.project-role,.stats-label,.media-editorial em,.media-editorial strong,.case-punch strong,.case-punch p'
);

const shortWordRe=/\b(а|и|но|да|в|во|на|к|ко|с|со|о|об|обо|от|до|из|изо|за|у|по|под|над|при|для|без|про|не)\s+/gi;

const textNodesOf=el=>{
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      if(!node.nodeValue?.trim())return NodeFilter.FILTER_REJECT;
      const parent=node.parentElement;
      if(parent?.closest('.marquee,[data-photo-cycle] .tap-count'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  return nodes;
};

typographyTargets.forEach(el=>{
  const nodes=textNodesOf(el);
  nodes.forEach(node=>{
    node.nodeValue=node.nodeValue.replace(shortWordRe,'$1\u00a0');
  });

  for(let i=nodes.length-1;i>=0;i--){
    const node=nodes[i];
    const value=node.nodeValue;
    const match=value.match(/(\S+)\s+(\S+)(\s*)$/);
    if(match){
      node.nodeValue=value.slice(0,match.index)+match[1]+'\u00a0'+match[2]+match[3];
      break;
    }
  }
});
