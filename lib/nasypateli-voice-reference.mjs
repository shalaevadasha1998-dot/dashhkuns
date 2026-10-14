// Audio never leaves the operator tab. This prepares a reference; it is NOT a voice clone.
export function validateVoiceFile(file){
  if(!file||!Number.isFinite(file.size)||file.size<44||file.size>15*1024*1024)throw new Error('нужен аудиофайл до 15 мб');
  const ext=String(file.name||'').split('.').at(-1).toLowerCase();
  if(!['wav','mp3','m4a','ogg','webm','flac'].includes(ext))throw new Error('поддерживаются wav, mp3, m4a, ogg, webm и flac');
  if(file.type&&!/^audio\//i.test(file.type)&&!['video/webm','video/mp4','application/ogg','application/octet-stream'].includes(file.type))throw new Error('это не аудиофайл');
  return ext;
}
export function voiceReferenceClient(){
  if(new URLSearchParams(location.search).get('view')==='stage')return;
  const el=id=>document.getElementById(id);if(!el('voiceReferencePanel'))return;
  let recorder=null,stream=null,chunks=[],blob=null,url=null,extension='webm',timer=null,started=0,generation=0,recording=false,pending=false;
  const status=text=>{el('voiceReferenceStatus').textContent=text;};
  const consent=()=>el('voiceOwnerConsent').checked;
  function buttons(){
    el('recordOwnVoice').disabled=!consent()||recording||pending||!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia;
    el('stopOwnVoice').disabled=!recording&&!pending;
    el('ownVoiceFile').disabled=!consent()||recording||pending;
    el('downloadOwnVoice').disabled=!blob||recording||pending;
    el('clearOwnVoice').disabled=!blob||recording||pending;
  }
  function release(){if(timer)clearInterval(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;}
  function clearPreview(){
    const audio=el('ownVoicePlayer');audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;
    if(url)URL.revokeObjectURL(url);url=null;blob=null;
  }
  function setPreview(value,ext,message){
    clearPreview();blob=value;extension=ext;url=URL.createObjectURL(blob);
    el('ownVoicePlayer').src=url;el('ownVoicePlayer').hidden=false;
    status(message+' · прослушай и скачай файл, чтобы не потерять его');buttons();
  }
  function stop(message='запись остановлена'){
    generation++;pending=false;
    if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{release();}}
    release();recording=false;buttons();status(message);
  }
  el('voiceOwnerConsent').addEventListener('change',()=>{if(!consent())stop('согласие снято · микрофон выключен');buttons();});
  el('recordOwnVoice').addEventListener('click',async()=>{
    if(!consent()||pending||recording)return;
    if(blob&&!confirm('заменить образец в этой вкладке? сначала скачай прежний, если он нужен'))return;
    // Prevent simultaneous use by the existing one-phrase dictation controller.
    el('stopMic')?.click();el('stopSpeech')?.click();
    const id=++generation;pending=true;buttons();status('разреши микрофон в окне браузера');
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1},video:false});
      if(id!==generation||!consent()||document.hidden){acquired.getTracks().forEach(t=>t.stop());return;}
      stream=acquired;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const active=recorder;chunks=[];let bytes=0;started=Date.now();pending=false;recording=true;
      active.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>15*1024*1024)stop('достигнут предел размера');}};
      active.onerror=()=>stop('ошибка записи · можно выбрать готовый файл');
      active.onstop=()=>{
        const seconds=Math.round((Date.now()-started)/1000);release();recording=false;recorder=null;
        const data=new Blob(chunks,{type:active.mimeType||'audio/webm'});chunks=[];
        if(data.size>=44&&data.size<=15*1024*1024){
          const ext=data.type.includes('mp4')?'m4a':data.type.includes('ogg')?'ogg':'webm';
          setPreview(data,ext,seconds<20?'получилось '+seconds+' сек · лучше записать 45–60 сек':'образец записан · '+seconds+' сек');
        }else{status('запись не получилась или слишком большая · повтори');buttons();}
      };
      active.start(500);status('идёт запись · 0 сек · говори своим обычным голосом');buttons();
      timer=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);status('идёт запись · '+seconds+' сек · остановка не позднее 90 сек');if(seconds>=90)stop();},500);
    }catch(error){release();pending=false;recording=false;buttons();status(error.name==='NotAllowedError'?'доступ к микрофону не разрешён · можно выбрать файл из диктофона':'микрофон не запустился · можно выбрать файл из диктофона');}
  });
  el('stopOwnVoice').addEventListener('click',()=>stop());
  el('ownVoiceFile').addEventListener('change',async()=>{
    const file=el('ownVoiceFile').files?.[0];el('ownVoiceFile').value='';if(!file)return;
    try{
      if(!consent())throw new Error('сначала подтверди, что это твой голос');
      const ext=validateVoiceFile(file);
      if(blob&&!confirm('заменить текущий образец?'))return;
      setPreview(file,ext,'файл открыт в пульте · '+(file.size/1024/1024).toFixed(1)+' мб');
    }catch(error){status(error.message);}
  });
  el('ownVoicePlayer').addEventListener('error',()=>{status('браузер не смог воспроизвести файл · сохрани его или попробуй wav / mp3');});
  el('downloadOwnVoice').addEventListener('click',()=>{
    if(!blob||!url)return;const a=document.createElement('a');a.href=url;a.download='dashhkuns-voice-reference.'+extension;document.body.append(a);a.click();a.remove();status('скачивание запрошено · проверь папку загрузок');
  });
  el('clearOwnVoice').addEventListener('click',()=>{clearPreview();buttons();status('образец удалён из памяти вкладки · скачанный файл не затронут');});
  el('panicStop')?.addEventListener('click',()=>{stop();el('ownVoicePlayer').pause();});
  el('startMic')?.addEventListener('click',()=>{if(recording||pending)stop('запись образца остановлена для диктовки');},true);
  el('logoutStudio')?.addEventListener('submit',()=>{stop();clearPreview();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){stop();el('ownVoicePlayer').pause();}});
  window.addEventListener('pagehide',()=>{stop();clearPreview();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(recording||pending))stop('вкладка скрыта · микрофон выключен');});
  buttons();
}
const css=`.voice-reference audio{display:block;width:100%;margin:14px 0}.voice-reference audio[hidden]{display:none}.voice-reference .voice-readtext{white-space:pre-wrap;font-size:12px;line-height:1.65;padding:12px;border:1px solid var(--line);max-height:240px;overflow:auto}.voice-reference .voice-boundary{border-left:2px solid var(--red);padding-left:10px}.voice-reference input[type=file]{max-width:100%;font-size:11px}.voice-reference button:disabled{opacity:.4;cursor:not-allowed}`;
const panel=`<details id="voiceReferencePanel" class="studio-section voice-reference"><summary>мой голос · записать или загрузить</summary><p class="voice-boundary"><strong>образец для дашкунса</strong><br>здесь можно подготовить свой голос · синтез новых фраз этим голосом пока не подключён</p><p>запиши 45–60 секунд обычной речи в тишине, без музыки, фильтров и других людей · запись сама остановится через 90 секунд</p><label class="studio-check"><input id="voiceOwnerConsent" type="checkbox">это мой голос, я готовлю образец для дашкунса</label><div class="buttons"><button id="recordOwnVoice" type="button" disabled>записать мой голос</button><button id="stopOwnVoice" type="button" disabled>закончить запись</button></div><label for="ownVoiceFile">или выбрать запись из диктофона</label><input id="ownVoiceFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac" disabled><p id="voiceReferenceStatus" role="status">ничего не записывается</p><audio id="ownVoicePlayer" controls preload="metadata" hidden aria-label="прослушать свой образец голоса"></audio><div class="buttons"><button id="downloadOwnVoice" type="button" disabled>скачать образец</button><button id="clearOwnVoice" type="button" disabled>удалить из вкладки</button></div><p class="subtle">звук остаётся только в памяти этой вкладки · не отправляется на сервер, не попадает на проектор и не входит в архив выпусков · перед закрытием скачай образец</p><details><summary>текст для записи</summary><p class="voice-readtext">меня зовут дора, и это мой обычный голос<br><br>мы делаем насыпателей — разговоры, в которых не обязательно заранее знать правильный ответ<br><br>мне интересно, почему люди меняют своё мнение, чего боятся и над чем смеются<br><br>подожди, а почему ты так уверен? ты правда так думаешь или просто привык это говорить?<br><br>вот сейчас было неожиданно. я бы с этим поспорила. но сначала хочу понять, что именно ты имеешь в виду<br><br>давай без красивых формулировок. расскажи, как это было на самом деле<br><br>кажется, мы начали с простого вопроса и опять дошли до смысла жизни. ладно, продолжим</p></details></details>`;
export function applyVoiceReference(html){
  if(typeof html!=='string'||!html.includes('id="console"')||html.includes('id="voiceReferencePanel"'))return html;
  const nonce=html.match(/<style nonce="([A-Za-z0-9+/=_-]+)"/)?.[1];if(!nonce)throw new Error('authenticated nonce missing');
  const script=validateVoiceFile.toString()+'\n'+voiceReferenceClient.toString()+'\nvoiceReferenceClient();';
  return html.replace('</style>',css+'</style>').replace('<div class="portrait-note">',panel+'<div class="portrait-note">').replace('</body>','<script type="module" nonce="'+nonce+'">'+script+'</script></body>');
}
