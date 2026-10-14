// Auth remains the responsibility of the existing renderer. This module only enhances permitted HTML.
export function studioTime(seconds){
  const n=Math.max(0,Math.floor(Number(seconds)||0));
  return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');
}
export function parseStudioTranscript(value){
  if(typeof value!=='string'||!value.trim())throw new Error('добавь расшифровку');
  if(value.length>180000)throw new Error('расшифровка больше 180 000 символов');
  const lines=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(lines.length>500)throw new Error('за один раз можно добавить до 500 реплик');
  let last=-1;
  return lines.map((line,i)=>{
    const m=/^(\d{1,2}:\d{2}(?::\d{2})?)\s*\|\s*([^|]{1,60})\s*\|\s*(.+)$/.exec(line);
    if(!m)throw new Error('строка '+(i+1)+': нужен формат 00:01:24 | участник | дословная фраза');
    const p=m[1].split(':').map(Number);
    if(p.at(-1)>59||(p.length===3&&p[1]>59))throw new Error('неверный таймкод в строке '+(i+1));
    const seconds=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];
    if(seconds<last)throw new Error('таймкоды должны идти по порядку');
    last=seconds;
    if(m[3].length>1800)throw new Error('слишком длинная реплика в строке '+(i+1));
    return {id:crypto.randomUUID(),seconds,speaker:m[2].trim(),text:m[3].trim(),kind:'transcript',reviewed:false,reviewedAt:null};
  });
}
export function validateStudioArchive(value){
  if(!value||value.project!=='nasypateli'||value.version!==3||!Array.isArray(value.episodes)||value.episodes.length>50)throw new Error('это не архив насыпателей v3');
  const ids=new Set();
  return value.episodes.map(ep=>{
    if(typeof ep.id!=='string'||!/^[a-z0-9-]{8,80}$/i.test(ep.id)||ids.has(ep.id))throw new Error('неверный или повторный id выпуска');
    ids.add(ep.id);
    if(typeof ep.title!=='string'||!ep.title.trim()||ep.title.length>100||!Array.isArray(ep.items)||ep.items.length>800)throw new Error('повреждён выпуск');
    const items=ep.items.map(q=>{
      if(!q||typeof q.text!=='string'||!q.text.trim()||q.text.length>1800||typeof q.speaker!=='string'||q.speaker.length>60||!Number.isFinite(q.seconds)||q.seconds<0||q.seconds>360000)throw new Error('повреждена цитата');
      return {id:crypto.randomUUID(),text:q.text,speaker:q.speaker,seconds:Math.floor(q.seconds),kind:q.kind==='transcript'?'transcript':'display',reviewed:false,reviewedAt:null};
    });
    return {id:ep.id,title:ep.title,createdAt:typeof ep.createdAt==='string'?ep.createdAt.slice(0,40):'',items};
  });
}
export function searchStudioQuotes(episodes,query){
  const tokens=String(query||'').toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{3,}/gu)||[];
  const found=[];
  for(const ep of episodes)for(const q of ep.items){
    if(!q.reviewed)continue;
    const hay=(q.text+' '+q.speaker+' '+ep.title).toLocaleLowerCase('ru');
    const score=tokens.reduce((n,t)=>n+Number(hay.includes(t)),0);
    if(tokens.length&&!score)continue;
    found.push({...q,episode:ep.title,episodeId:ep.id,score});
  }
  return found.sort((a,b)=>b.score-a.score).slice(0,8);
}
export function studioClient(){
  const $=id=>document.getElementById(id);
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const tell=(id,text)=>{if($(id))$(id).textContent=text;};
  const mode=new URL(location.href).searchParams.get('view')==='stage';
  const url=new URL(location.href);let room=url.searchParams.get('room');
  if(!room||!/^[a-f0-9]{32}$/.test(room)){room=crypto.randomUUID().replaceAll('-','');url.searchParams.set('room',room);history.replaceState(null,'',url);}
  const peer=crypto.randomUUID();
  const transport=typeof BroadcastChannel==='function'?new BroadcastChannel('nasypateli.studio.v3.'+room):null;
  const states={idle:'на связи',listening:'слушает',thinking:'думает',speaking:'говорит',error:'пауза'};
  const storeKey='nasypateli.studio.v3';
  let scene={state:'idle',cue:'',episode:'пилот',voice:'',rate:1};
  let audio=false,utterance=null,speechId=0,recognition=null,micId=0,lastOperator=Date.now(),lastSequence=-1,epoch='',seq=0,clockStart=0,elapsed=0;
  let current={id:crypto.randomUUID(),title:'пилот',createdAt:new Date().toISOString(),items:[]};
  let episodes=[current],queue=[],saveEnabled=false,aiStop=()=>{};
  const viewers=new Map();
  const send=(type,payload={})=>transport?.postMessage({type,from:peer,...payload});
  const at=()=>Math.floor((elapsed+(clockStart?Date.now()-clockStart:0))/1000);
  function persist(){
    if(!saveEnabled||mode)return;
    try{const data=JSON.stringify({project:'nasypateli',version:3,episodes,current:current.id,queue:queue.slice(0,60),draft:$('cue').value});if(data.length>1800000)throw new Error();localStorage.setItem(storeKey,data);tell('storageStatus','сохранено в этом браузере · '+new Date().toLocaleTimeString('ru-RU'));}
    catch{tell('storageStatus','не удалось сохранить — выгрузи резервную копию сейчас');}
  }
  function paint(next={}){
    if(typeof next.cue==='string')scene.cue=next.cue.slice(0,750);
    if(typeof next.episode==='string')scene.episode=next.episode.slice(0,100);
    if(Object.hasOwn(states,next.state))scene.state=next.state;
    if(typeof next.voice==='string')scene.voice=next.voice.slice(0,200);
    if(Number.isFinite(next.rate))scene.rate=Math.max(.7,Math.min(1.3,next.rate));
    $('stage').dataset.state=scene.state;$('character').dataset.state=scene.state;
    $('stage').classList.toggle('has-cue',Boolean(scene.cue));
    tell('caption',scene.cue);tell('status',states[scene.state]);tell('episodeLabel',scene.episode);
    for(const b of document.querySelectorAll('#states button')){b.classList.toggle('active',b.dataset.state===scene.state);b.setAttribute('aria-pressed',String(b.dataset.state===scene.state));}
  }
  function publish(next){paint(next);send('scene',{scene,seq:++seq});}
  function stopVoice(){speechId++;try{window.speechSynthesis?.cancel();}catch{}utterance=null;if(mode)paint({state:'idle'});}
  function stopMic(){micId++;try{recognition?.abort();}catch{}recognition=null;tell('micStatus','микрофон выключен');}
  function emergency(){stopVoice();stopMic();aiStop();if(mode){paint({cue:'',state:'idle'});send('panic');}else{publish({cue:'',state:'idle'});send('stop');tell('operatorState','всё остановлено · на экране заставка');}}
  function show(text,log=true){publish({cue:text,state:'idle'});if(log&&text){if(current.items.length>=800){tell('archiveStatus','лимит выпуска 800 реплик — начни следующий');return;}current.items.push({id:crypto.randomUUID(),seconds:at(),speaker:'дашкунс',text:text.slice(0,750),kind:'display',reviewed:false,reviewedAt:null});persist();renderArchive();}}
  function voiceList(){return (window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.toLowerCase().startsWith('ru'));}
  function talk(text,voice,rate,check=false){
    stopVoice();
    if(!('speechSynthesis'in window)){tell('connectionState','озвучка недоступна в этом браузере');send('voice-error');return;}
    const id=speechId;utterance=new SpeechSynthesisUtterance(text);utterance.lang='ru-RU';utterance.rate=rate||1;
    utterance.voice=voiceList().find(v=>v.name===voice)||voiceList()[0]||null;
    utterance.onstart=()=>{if(id!==speechId)return;audio=true;if(!check)paint({state:'speaking'});$('enableStageAudio').hidden=true;send('voice-start',{test:check});};
    utterance.onend=()=>{if(id!==speechId)return;paint({state:'idle'});send('voice-end',{test:check});utterance=null;};
    utterance.onerror=()=>{if(id!==speechId)return;audio=false;paint({state:'idle'});$('enableStageAudio').hidden=false;tell('connectionState','звук не запустился — нажми «включить звук»');send('voice-error');};
    window.speechSynthesis.speak(utterance);
  }
  function readiness(){if(mode)return;const now=Date.now();for(const[id,v]of viewers)if(now-v.at>9000)viewers.delete(id);const list=[...viewers.values()];tell('screenStatus',list.length?'экран подключён · '+(list.some(v=>v.audio)?'звук разрешён':'включи звук во вкладке зрителя'):'экран зрителя не подключён');}
  transport?.addEventListener('message',event=>{
    const m=event.data;if(!m||typeof m!=='object'||m.from===peer)return;
    if(mode){
      if(m.type==='scene'&&m.scene){lastOperator=Date.now();if(epoch!==m.from){epoch=m.from;lastSequence=-1;}if(Number.isInteger(m.seq)&&m.seq>=lastSequence){lastSequence=m.seq;paint(m.scene);}tell('connectionState','оператор на связи');send('ready',{audio});}
      if(m.type==='speak'&&m.target===peer&&typeof m.text==='string'){lastOperator=Date.now();if(audio)talk(m.text.slice(0,750),m.voice,m.rate);else send('voice-error');}
      if(m.type==='stop'){stopVoice();paint({state:'idle'});}
    }else{
      if(m.type==='hello'||m.type==='ready'){viewers.set(m.from,{at:Date.now(),audio:Boolean(m.audio)});readiness();if(m.type==='hello')send('scene',{scene,seq:++seq});}
      if(m.type==='voice-start'){paint({state:'speaking'});tell('operatorState',m.test?'звук проверен':'дашкунс говорит');}
      if(m.type==='voice-end'){paint({state:'idle'});tell('operatorState','озвучка завершена');}
      if(m.type==='voice-error'){paint({state:'idle'});tell('operatorState','звук не запустился — включи его на экране зрителя');}
      if(m.type==='panic')emergency();
    }
  });
  const tick=setInterval(()=>{
    if(mode){send('ready',{audio});if(Date.now()-lastOperator>12000){stopVoice();paint({cue:'',state:'idle'});tell('connectionState','связь с оператором потеряна · звук остановлен');}}
    else{send('scene',{scene,seq:++seq});readiness();tell('episodeClock',studioTime(at()));}
  },2000);
  paint();
  window.addEventListener('keydown',e=>{if(e.key==='Escape')emergency();});
  window.addEventListener('pagehide',()=>{stopVoice();stopMic();aiStop();if(!mode)send('stop');clearInterval(tick);transport?.close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!mode)stopMic();if(!document.hidden&&mode)send('hello',{audio});});
  if(mode){
    document.body.classList.add('stage-only');document.title='насыпатели · экран зрителя';send('hello',{audio:false});
    $('enableStageAudio').addEventListener('click',()=>talk('на связи','',1,true));
    $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{tell('connectionState','полный экран недоступен — разверни окно браузера');}});
    return;
  }
  document.title='насыпатели · пульт';$('enableStageAudio').hidden=true;$('fullscreen').hidden=true;
  if(!transport)tell('screenStatus','этот браузер не поддерживает связь вкладок');
  const cue=()=>$('cue').value.trim().slice(0,750);
  $('openStage').addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('view','stage');window.open(u.href,'_blank','noopener');tell('operatorState','ждём подключения вкладки зрителя');});
  $('showCue').addEventListener('click',()=>{if(!cue())return tell('operatorState','сначала напиши реплику');show(cue());});
  $('speakCue').addEventListener('click',()=>{readiness();const target=[...viewers].find(([,v])=>v.audio);if(!target)return tell('operatorState','открой экран зрителя и нажми в нём «включить звук»');if(!cue())return tell('operatorState','сначала напиши реплику');stopMic();show(cue());send('speak',{target:target[0],text:cue(),voice:$('voiceChoice').value,rate:Number($('voiceRate').value)});tell('operatorState','реплика отправлена · ждём запуска звука');});
  $('stopSpeech').addEventListener('click',()=>{send('stop');paint({state:'idle'});tell('operatorState','звук остановлен');});
  $('clearCue').addEventListener('click',()=>{send('stop');publish({cue:'',state:'idle'});});
  $('panicStop').addEventListener('click',emergency);
  $('episode').addEventListener('input',()=>{current.title=$('episode').value.trim().slice(0,70)||'без названия';publish({episode:current.title});persist();});
  $('cue').addEventListener('input',persist);
  for(const b of document.querySelectorAll('#states button'))b.addEventListener('click',()=>publish({state:b.dataset.state}));
  function voices(){const selected=$('voiceChoice').value;$('voiceChoice').replaceChildren(new Option('русский голос системы',''));for(const v of voiceList())$('voiceChoice').add(new Option(v.name,v.name));$('voiceChoice').value=selected;}
  voices();window.speechSynthesis?.addEventListener?.('voiceschanged',voices);
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){$('startMic').disabled=true;tell('micStatus','диктовка недоступна — текстовый ввод работает');}
  $('startMic').addEventListener('click',()=>{
    stopMic();const id=++micId;let received=false;recognition=new Recognition();recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=false;
    recognition.onresult=e=>{if(id!==micId)return;const text=Array.from(e.results).filter(r=>r.isFinal).map(r=>r[0].transcript).join(' ').trim();if(text){received=true;$('cue').value=text.slice(0,750);persist();tell('micStatus','фраза в черновике · проверь перед показом');}};
    recognition.onerror=e=>{if(id!==micId)return;tell('micStatus',e.error==='not-allowed'?'нет разрешения на микрофон':'диктовка не удалась · ручной ввод доступен');};
    recognition.onend=()=>{if(id===micId&&!received)tell('micStatus','микрофон выключен');};
    try{recognition.start();tell('micStatus','слушаю одну фразу · звук не записывается приложением');}catch{tell('micStatus','не удалось включить микрофон');}
  });
  $('stopMic').addEventListener('click',stopMic);
  $('startClock').addEventListener('click',()=>{if(clockStart){elapsed+=Date.now()-clockStart;clockStart=0;$('startClock').textContent='продолжить таймер';}else{clockStart=Date.now();$('startClock').textContent='пауза таймера';}tell('episodeClock',studioTime(at()));});
  $('newEpisode').addEventListener('click',()=>{if(episodes.length>=50)return tell('archiveStatus','лимит 50 выпусков — выгрузи архив');current={id:crypto.randomUUID(),title:'выпуск '+(episodes.length+1),createdAt:new Date().toISOString(),items:[]};episodes.push(current);elapsed=0;clockStart=0;$('startClock').textContent='начать таймер';$('episode').value=current.title;publish({episode:current.title,cue:'',state:'idle'});persist();renderArchive();});
  function renderQueue(){const area=$('cueQueue');area.replaceChildren();queue.forEach((text,index)=>{const card=make('article',undefined,'studio-card');card.append(make('p',text));const b=make('button','в черновик');b.type='button';b.addEventListener('click',()=>{$('cue').value=text;persist();tell('operatorState','заготовка в черновике — на экран ещё не отправлена');});const remove=make('button','убрать');remove.type='button';remove.addEventListener('click',()=>{queue.splice(index,1);renderQueue();persist();});card.append(b,remove);area.append(card);});}
  $('queueCue').addEventListener('click',()=>{if(!cue())return tell('operatorState','пустая заготовка не сохраняется');if(queue.length>=60)return tell('operatorState','лимит 60 заготовок');queue.push(cue());renderQueue();persist();tell('operatorState','заготовка сохранена');});
  function renderArchive(){
    const area=$('episodeArchive');area.replaceChildren();
    for(const ep of [...episodes].reverse()){
      const detail=make('details');detail.append(make('summary',ep.title+' · '+ep.items.length+' реплик'));
      const body=make('div');detail.append(body);let built=false;
      detail.addEventListener('toggle',()=>{if(!detail.open||built)return;built=true;for(const q of ep.items){const card=make('article',undefined,'studio-card');card.append(make('small',studioTime(q.seconds)+' · '+q.speaker+' · '+(q.kind==='transcript'?'расшифровка':'текст на экране')));card.append(make('p',q.text));const label=make('label',undefined,'studio-check');const box=document.createElement('input');box.type='checkbox';box.checked=q.reviewed;box.setAttribute('aria-label','сверено с записью');label.append(box,document.createTextNode('сверено с записью'));box.addEventListener('change',()=>{q.reviewed=box.checked;q.reviewedAt=q.reviewed?new Date().toISOString():null;persist();});card.append(label);body.append(card);}});area.append(detail);
    }
    tell('archiveStatus','выпуски: '+episodes.length+' · цитаты: '+episodes.reduce((n,e)=>n+e.items.length,0));
  }
  $('importTranscript').addEventListener('click',()=>{try{const items=parseStudioTranscript($('transcriptInput').value);if(current.items.length+items.length>800)throw new Error('в выпуске не может быть больше 800 реплик');current.items.push(...items);$('transcriptInput').value='';persist();renderArchive();tell('archiveStatus','расшифровка добавлена · отметь только сверенные цитаты');}catch(e){tell('archiveStatus',e.message);}});
  $('searchQuotes').addEventListener('click',()=>{const area=$('quoteResults');area.replaceChildren();const found=searchStudioQuotes(episodes,$('quoteQuery').value);if(!found.length)area.append(make('p','проверенных цитат по запросу нет'));for(const q of found){const card=make('article',undefined,'studio-card');card.append(make('small',q.episode+' · '+studioTime(q.seconds)+' · '+q.speaker));card.append(make('p',q.text));const b=make('button','цитату в черновик');b.addEventListener('click',()=>{$('cue').value=(q.speaker+', в выпуске «'+q.episode+'» на '+studioTime(q.seconds)+' прозвучало: «'+q.text+'»').slice(0,750);persist();});card.append(b);area.append(card);}});
  $('saveLocal').addEventListener('change',()=>{saveEnabled=$('saveLocal').checked;if(saveEnabled)persist();else{tell('storageStatus','автосохранение выключено · прежняя копия не удалена');}});
  $('exportArchive').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({project:'nasypateli',version:3,episodes},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=make('a');a.href=u;a.download='nasypateli-archive-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);tell('archiveStatus','архив выгружен без черновика и заготовок');});
  $('archiveFile').addEventListener('change',async()=>{const f=$('archiveFile').files?.[0];if(!f)return;try{if(f.size>2000000)throw new Error('файл больше 2 мб');const incoming=validateStudioArchive(JSON.parse(await f.text()));const existing=new Set(episodes.map(e=>e.id));const added=incoming.filter(ep=>!existing.has(ep.id));if(episodes.length+added.length>50)throw new Error('после импорта получится больше 50 выпусков');episodes.push(...added);persist();renderArchive();tell('archiveStatus','добавлено '+added.length+' выпусков · импортированные цитаты нужно сверить заново');}catch(e){tell('archiveStatus','импорт не выполнен: '+e.message);}finally{$('archiveFile').value='';}});
  try{const saved=localStorage.getItem(storeKey);if(saved){const raw=JSON.parse(saved);const restored=validateStudioArchive(raw);for(let i=0;i<restored.length;i++)for(let j=0;j<restored[i].items.length;j++){restored[i].items[j].id=raw.episodes[i].items[j].id;restored[i].items[j].reviewed=raw.episodes[i].items[j].reviewed===true;restored[i].items[j].reviewedAt=raw.episodes[i].items[j].reviewedAt||null;}if(restored.length){episodes=restored;current=episodes.find(e=>e.id===raw.current)||episodes.at(-1);queue=Array.isArray(raw.queue)?raw.queue.filter(v=>typeof v==='string'&&v.length<=750).slice(0,60):[];$('cue').value=typeof raw.draft==='string'?raw.draft.slice(0,750):'';$('episode').value=current.title;paint({episode:current.title});saveEnabled=true;$('saveLocal').checked=true;tell('storageStatus','архив восстановлен · черновик остаётся в пульте');}}}catch{tell('storageStatus','локальный архив не прочитан · исходная копия не перезаписана');}
  renderQueue();renderArchive();
  $('wipeLocal').addEventListener('click',()=>{if(!confirm('удалить только сохранённую копию насыпателей из этого браузера? сначала выгрузи резервную копию'))return;try{localStorage.removeItem(storeKey);saveEnabled=false;$('saveLocal').checked=false;tell('storageStatus','копия на устройстве удалена · открытая сессия сохранена в памяти вкладки');}catch{tell('storageStatus','не удалось удалить копию');}});
  $('logoutStudio').addEventListener('submit',()=>{emergency();});
  // Optional inference extension is initialized only by its explicit load button.
  window.dispatchEvent(new CustomEvent('nasypateli:studio-ready',{detail:{getQuotes:q=>searchStudioQuotes(episodes,q),getDraft:cue,setDraft:text=>{$('cue').value=String(text).slice(0,750);persist();},setStop:fn=>{aiStop=fn;}}}));
}
const extraCSS=`
.studio-ready{border:1px solid var(--line);padding:12px;margin:12px 0;font-size:11px}.studio-ready p{margin:0}.studio-panic{position:sticky;bottom:0;z-index:4;background:#24130f!important;width:100%;margin-top:15px}.studio-section{border-top:1px solid var(--line);margin-top:22px;padding-top:16px}.studio-section summary{cursor:pointer;font-size:13px;color:var(--paper)}.studio-section select{width:100%;padding:10px;border:1px solid var(--line);background:#080808;color:var(--paper);margin:8px 0}.studio-section small{font-size:10px;color:var(--muted)}.studio-section button{color:var(--paper);background:#181613;border:1px solid var(--line);padding:10px;margin:4px 6px 0 0;font-size:11px}.studio-section input[type=checkbox]{width:16px;min-width:16px}.studio-check{display:flex!important;align-items:center;gap:9px;line-height:1.45}.studio-card{border:1px solid var(--line);padding:10px;margin:10px 0;overflow-wrap:anywhere}.studio-card p{white-space:pre-wrap;margin:8px 0}.studio-section input[type=file]{font-size:11px}.studio-clock{font-size:20px;font-variant-numeric:tabular-nums;color:var(--paper)}.studio-audio{position:absolute;bottom:64px;left:30px;border:1px solid var(--line);background:#17130e;color:var(--paper);padding:10px 12px;font:12px Arial;cursor:pointer}.studio-audio[hidden]{display:none!important}.console .mode{margin-bottom:14px}.stage.has-cue .caption{font-size:clamp(18px,2.5vw,38px);max-height:46vh;overflow:auto}.stage-only .stage{height:100dvh!important;min-height:0!important}.stage-only .brand-lockup img{max-height:35vh;object-fit:contain}.stage-only .participant{margin-top:20px}.studio-logout{margin-top:22px}.studio-logout button{width:100%;border:1px solid var(--line);padding:12px;background:none;color:var(--muted)}@media(max-width:850px){.console{padding-bottom:22px}.stage.has-cue .caption{max-height:330px}.studio-section{max-width:100%}}
`;
const additions=`<section class="studio-ready"><p id="screenStatus" role="status">экран зрителя не подключён</p><p class="subtle">пульт и экран должны быть в одном браузере одного компьютера</p></section>`;
const features=`
<button type="button" id="panicStop" class="danger studio-panic">стоп всё · esc</button>
<details class="studio-section"><summary>звук и темп</summary><label for="voiceChoice">голос системы</label><select id="voiceChoice"><option value="">русский голос системы</option></select><label for="voiceRate">темп речи</label><select id="voiceRate"><option value="0.85">медленнее</option><option value="1" selected>обычный</option><option value="1.15">быстрее</option></select><p>для первой озвучки нажми «включить звук» во вкладке зрителя</p></details>
<details class="studio-section"><summary>заготовки реплик</summary><button id="queueCue" type="button">сохранить черновик в заготовки</button><div id="cueQueue"></div></details>
<details class="studio-section"><summary>выпуск и память</summary><p class="studio-clock" id="episodeClock">00:00:00</p><button id="startClock" type="button">начать таймер</button><button id="newEpisode" type="button">новый выпуск</button><p>это таймер, а не запись звука · показанные реплики сохраняются в журнал, но не считаются сверенными цитатами</p><label for="transcriptInput">добавить расшифровку текущего выпуска</label><textarea id="transcriptInput" rows="4" maxlength="180000" placeholder="00:01:24 | иван | дословная фраза"></textarea><button id="importTranscript" type="button">добавить расшифровку</button><p id="archiveStatus" role="status"></p><div id="episodeArchive"></div><label for="quoteQuery">поиск только по сверенным цитатам</label><input id="quoteQuery" maxlength="250" placeholder="свобода, дружба, счастье"><button id="searchQuotes" type="button">найти цитаты</button><div id="quoteResults"></div></details>
<details class="studio-section"><summary>сохранение и резервная копия</summary><label class="studio-check"><input id="saveLocal" type="checkbox">сохранять на этом устройстве</label><p>архив и черновик сохраняются только в хранилище этого браузера на dashhkuns.com, не на сервере · это не зашифрованный сейф: не используй на общем компьютере · очистка данных браузера удалит копию</p><p id="storageStatus" role="status">автосохранение выключено</p><button id="exportArchive" type="button">выгрузить архив json</button><label for="archiveFile">восстановить архив из файла</label><input id="archiveFile" type="file" accept="application/json,.json"><p>импорт добавляет новые выпуски, не перезаписывает существующие · цитаты из файла проходят повторную проверку</p><button id="wipeLocal" type="button">удалить копию с устройства</button></details>
<form id="logoutStudio" class="studio-logout" method="post" action="/nasypateli-live/app"><input type="hidden" name="action" value="logout"><button type="submit">завершить сеанс и выйти</button></form>
`;
export function applyStudio(html){
  if(typeof html!=='string'||!html.includes('id="console"')||!html.includes('id="stage"'))return html;
  const nonce=html.match(/<style nonce="([A-Za-z0-9+/=_-]+)"/)?.[1];if(!nonce)throw new Error('authenticated page nonce missing');
  const script=[studioTime,parseStudioTranscript,validateStudioArchive,searchStudioQuotes,studioClient].map(fn=>fn.toString()).join('\n')+'\nstudioClient();';
  return html.replace(/<script type="module" nonce="[^"]+">[\s\S]*?<\/script>/,'')
    .replace('</style>',extraCSS+'</style>')
    .replace('<div class="mode">',additions+'<div class="mode">')
    .replace('<div class="portrait-note">',features+'<div class="portrait-note">')
    .replace('<button class="fullscreen"','<button id="enableStageAudio" type="button" class="studio-audio">включить звук</button><button class="fullscreen"')
    .replace('</body>','<script type="module" nonce="'+nonce+'">'+script+'</script></body>');
}
