// Preparation of an owner's voice reference only. No network requests or voice synthesis.
export function validateVoiceFile(file){
  if(!file||!Number.isFinite(file.size)||file.size<44||file.size>15*1024*1024)throw new Error('нужен аудиофайл до 15 мб');
  const ext=String(file.name||'').split('.').at(-1).toLowerCase();
  if(!['wav','mp3','m4a','ogg','webm','flac'].includes(ext))throw new Error('поддерживаются wav, mp3, m4a, ogg, webm и flac');
  if(file.type&&!/^audio\//i.test(file.type)&&!['video/webm','video/mp4','application/ogg','application/octet-stream'].includes(file.type))throw new Error('это не аудиофайл');
  return ext;
}
export function createReferenceCapture({Recorder,acquire,onSample,onStatus,onState,now=()=>Date.now(),every=setInterval,cancel=clearInterval}){
  let state='idle',version=0,disposed=false,session=null;
  const announce=(next,message)=>{state=next;if(!disposed){onState(next);if(message)onStatus(message);}};
  const release=s=>{if(!s)return;if(s.timer)cancel(s.timer);s.timer=null;s.stream.getTracks().forEach(t=>t.stop());};
  function finish(s){
    release(s);if(session!==s)return;session=null;
    const data=new Blob(s.chunks,{type:s.recorder.mimeType||'audio/webm'});s.chunks=[];
    announce('idle');
    if(disposed||s.failed)return;
    if(data.size<44||data.size>15*1024*1024){onStatus('запись не получилась или слишком большая · повтори');return;}
    const seconds=Math.round((now()-s.started)/1000);
    const ext=data.type.includes('mp4')?'m4a':data.type.includes('ogg')?'ogg':'webm';
    onSample(data,ext,seconds);
  }
  function stop(){
    version++;
    if(state==='requesting'){announce('idle','запрос микрофона отменён');return;}
    if(state!=='recording'||!session)return;
    const s=session;announce('stopping','сохраняю запись в памяти вкладки');
    try{s.recorder.stop();}catch{s.failed=true;finish(s);}
    release(s);
  }
  async function start(){
    if(disposed||state!=='idle')return false;
    const id=++version;announce('requesting','разреши микрофон в окне браузера');
    let stream;
    try{
      stream=await acquire();
      if(disposed||id!==version){stream.getTracks().forEach(t=>t.stop());return false;}
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>Recorder.isTypeSupported(t));
      const r=mime?new Recorder(stream,{mimeType:mime}):new Recorder(stream);
      const s={stream,recorder:r,chunks:[],bytes:0,started:now(),timer:null,failed:false};session=s;
      r.ondataavailable=e=>{if(session!==s||disposed)return;if(e.data.size){s.chunks.push(e.data);s.bytes+=e.data.size;if(s.bytes>15*1024*1024)stop();}};
      r.onerror=()=>{if(session!==s)return;s.failed=true;stop();if(!disposed)onStatus('ошибка записи · можно выбрать файл из диктофона');};
      r.onstop=()=>finish(s);
      r.start(500);announce('recording','идёт запись · говори обычным голосом');
      s.timer=every(()=>{if(session!==s||disposed)return;const seconds=Math.floor((now()-s.started)/1000);onStatus('идёт запись · '+seconds+' сек · предел 90 сек');if(seconds>=90)stop();},500);
      return true;
    }catch(error){
      stream?.getTracks().forEach(t=>t.stop());
      if(id===version&&!disposed){session=null;announce('idle',error.name==='NotAllowedError'?'нет разрешения на микрофон · выбери файл из диктофона':'микрофон не запустился · выбери готовый файл');}
      return false;
    }
  }
  return {start,stop,get state(){return state;},dispose(){disposed=true;version++;const s=session;session=null;if(s){s.failed=true;try{if(s.recorder.state!=='inactive')s.recorder.stop();}catch{}release(s);s.chunks=[];}state='idle';}};
}
export function voiceReferenceClient(){
  if(new URLSearchParams(location.search).get('view')==='stage')return;
  const el=id=>document.getElementById(id);if(!el('voiceReferencePanel'))return;
  let blob=null,url=null,extension='webm';
  const status=text=>{el('voiceReferenceStatus').textContent=text;};
  const consent=()=>el('voiceOwnerConsent').checked;
  const supported=Boolean(window.MediaRecorder&&navigator.mediaDevices?.getUserMedia);
  const capture=createReferenceCapture({Recorder:window.MediaRecorder,acquire:()=>navigator.mediaDevices.getUserMedia({audio:{channelCount:1},video:false}),onStatus:status,onState:()=>buttons(),onSample:(data,ext,seconds)=>preview(data,ext,'образец записан · '+seconds+' сек'+(seconds<20?' · лучше 45–60 сек':''))});
  function buttons(){
    const busy=capture.state!=='idle';
    el('recordOwnVoice').disabled=!consent()||busy||!supported;el('stopOwnVoice').disabled=!busy;
    el('ownVoiceFile').disabled=!consent()||busy;el('downloadOwnVoice').disabled=!blob||busy;el('clearOwnVoice').disabled=!blob||busy;
  }
  function clear(){const audio=el('ownVoicePlayer');audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;if(url)URL.revokeObjectURL(url);url=null;blob=null;}
  function preview(data,ext,message){clear();blob=data;extension=ext;url=URL.createObjectURL(data);el('ownVoicePlayer').src=url;el('ownVoicePlayer').hidden=false;status(message+' · прослушай и скачай файл');buttons();}
  const pause=()=>{capture.stop();el('ownVoicePlayer').pause();};
  el('voiceOwnerConsent').addEventListener('change',()=>{if(!consent())pause();buttons();});
  el('recordOwnVoice').addEventListener('click',()=>{if(!consent())return;if(blob&&!confirm('заменить образец в этой вкладке? сначала скачай прежний, если он нужен'))return;el('stopMic')?.click();el('stopSpeech')?.click();capture.start();});
  el('stopOwnVoice').addEventListener('click',()=>capture.stop());
  el('ownVoiceFile').addEventListener('change',()=>{
    const file=el('ownVoiceFile').files?.[0];el('ownVoiceFile').value='';if(!file)return;
    try{if(!consent())throw new Error('сначала подтверди, что это твой голос');if(capture.state!=='idle')throw new Error('сначала закончи запись');const ext=validateVoiceFile(file);if(blob&&!confirm('заменить текущий образец?'))return;preview(file,ext,'файл открыт в пульте · '+(file.size/1024/1024).toFixed(1)+' мб');}catch(error){status(error.message);}
  });
  el('ownVoicePlayer').addEventListener('error',()=>status('браузер не смог воспроизвести файл · попробуй wav / mp3'));
  el('downloadOwnVoice').addEventListener('click',()=>{if(!blob||!url)return;const a=document.createElement('a');a.href=url;a.download='dashhkuns-voice-reference.'+extension;document.body.append(a);a.click();a.remove();status('скачивание запрошено · проверь папку загрузок');});
  el('clearOwnVoice').addEventListener('click',()=>{clear();buttons();status('образец удалён из памяти вкладки · скачанный файл не затронут');});
  el('panicStop')?.addEventListener('click',pause);el('startMic')?.addEventListener('click',pause,true);el('logoutStudio')?.addEventListener('submit',()=>{capture.dispose();clear();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')pause();});window.addEventListener('pagehide',()=>{capture.dispose();clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  buttons();if(!supported)status('запись в этом браузере недоступна · можно выбрать файл из диктофона');
}
const css=`.voice-reference audio{display:block;width:100%;margin:14px 0}.voice-reference audio[hidden]{display:none}.voice-reference .voice-readtext{white-space:pre-wrap;font-size:12px;line-height:1.65;padding:12px;border:1px solid var(--line);max-height:240px;overflow:auto}.voice-reference .voice-boundary{border-left:2px solid var(--red);padding-left:10px}.voice-reference input[type=file]{max-width:100%;font-size:11px}.voice-reference button:disabled{opacity:.4;cursor:not-allowed}`;
const panel=`<details id="voiceReferencePanel" class="studio-section voice-reference"><summary>мой голос · записать или загрузить</summary><p class="voice-boundary"><strong>образец для дашкунса</strong><br>здесь можно подготовить свой голос · синтез новых фраз этим голосом пока не подключён</p><p>запиши 45–60 секунд обычной речи в тишине, без музыки, фильтров и других людей · запись сама остановится через 90 секунд</p><label class="studio-check"><input id="voiceOwnerConsent" type="checkbox">это мой голос, я готовлю образец для дашкунса</label><div class="buttons"><button id="recordOwnVoice" type="button" disabled>записать мой голос</button><button id="stopOwnVoice" type="button" disabled>закончить запись</button></div><label for="ownVoiceFile">или выбрать запись из диктофона</label><input id="ownVoiceFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac" disabled><p id="voiceReferenceStatus" role="status">ничего не записывается</p><audio id="ownVoicePlayer" controls preload="metadata" hidden aria-label="прослушать свой образец голоса"></audio><div class="buttons"><button id="downloadOwnVoice" type="button" disabled>скачать образец</button><button id="clearOwnVoice" type="button" disabled>удалить из вкладки</button></div><p class="subtle">звук остаётся только в памяти этой вкладки · не отправляется на сервер, не попадает на проектор и не входит в архив выпусков · перед закрытием скачай образец</p><details><summary>текст для записи</summary><p class="voice-readtext">меня зовут дора, и это мой обычный голос<br><br>мы делаем насыпателей — разговоры, в которых не обязательно заранее знать правильный ответ<br><br>мне интересно, почему люди меняют своё мнение, чего боятся и над чем смеются<br><br>подожди, а почему ты так уверен? ты правда так думаешь или просто привык это говорить?<br><br>вот сейчас было неожиданно. я бы с этим поспорила. но сначала хочу понять, что именно ты имеешь в виду<br><br>давай без красивых формулировок. расскажи, как это было на самом деле<br><br>кажется, мы начали с простого вопроса и опять дошли до смысла жизни. ладно, продолжим</p></details></details>`;
export function applyVoiceReference(html){
  if(typeof html!=='string'||!html.includes('id="console"')||html.includes('id="voiceReferencePanel"'))return html;
  const nonce=html.match(/<style nonce="([A-Za-z0-9+/=_-]+)"/)?.[1];if(!nonce)throw new Error('authenticated nonce missing');
  const script=[validateVoiceFile,createReferenceCapture,voiceReferenceClient].map(fn=>fn.toString()).join('\n')+'\nvoiceReferenceClient();';
  return html.replace('</style>',css+'</style>').replace('<div class="portrait-note">',panel+'<div class="portrait-note">').replace('</body>','<script type="module" nonce="'+nonce+'">'+script+'</script></body>');
}
