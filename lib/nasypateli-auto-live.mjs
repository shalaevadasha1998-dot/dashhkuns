// Optional, explicitly enabled voice mode for the authenticated operator.
// The existing studio controls, session authentication and projector remain intact.
export function wakeText(text){
  return typeof text==='string'&&/(?:^|[^\p{L}\p{N}])(?:на\s*с[ыи][пх]атель|nasypatel)(?=$|[^\p{L}\p{N}])/iu.test(text);
}
export function tidySpoken(text){
  return String(text||'').replace(/\.(?!\d)(?=\s|$|[»”])/gu,'').replace(/…/gu,'').replace(/\s{2,}/gu,' ').trim();
}
export function writeWave(chunks,sampleRate){
  let total=0;
  for(const chunk of chunks)total+=chunk.length;
  const float=new Float32Array(total);let at=0;
  for(const chunk of chunks){float.set(chunk,at);at+=chunk.length;}
  const frames=Math.floor(float.length*16000/sampleRate);
  if(frames<3200||frames>300000)throw new Error('length');
  const bytes=new Uint8Array(44+frames*2),view=new DataView(bytes.buffer);
  for(let i=0;i<4;i++)bytes[i]=[82,73,70,70][i];
  view.setUint32(4,bytes.length-8,true);
  bytes.set([87,65,86,69,102,109,116,32],8);
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,16000,true);view.setUint32(28,32000,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  bytes.set([100,97,116,97],36);view.setUint32(40,frames*2,true);
  for(let i=0;i<frames;i++){
    const pos=i*sampleRate/16000,index=Math.floor(pos),frac=pos-index;
    const value=(float[index]||0)*(1-frac)+(float[Math.min(index+1,float.length-1)]||0)*frac;
    view.setInt16(44+i*2,Math.max(-32768,Math.min(32767,Math.round(value*32767))),true);
  }
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export function autoLiveClient(){
  const el=id=>document.getElementById(id);
  if(new URL(location.href).searchParams.get('view')==='stage'||!el('autoLiveStart'))return;
  const status=t=>{el('autoLiveStatus').textContent=t;};
  const state=s=>document.querySelector('#states button[data-state="'+s+'"]')?.click();
  const room=new URL(location.href).searchParams.get('room');
  let channel=null;
  try{if(room&&typeof BroadcastChannel==='function')channel=new BroadcastChannel('nasypateli.studio.v3.'+room);}catch{}
  let enabled=false,busy=false,context=null,stream=null,processor=null,source=null,silent=null;
  let tail=[],tailSize=0,frames=[],frameSize=0,active=false,loudFrames=0,quietSeconds=0,noise=.001;
  let recognition=null,interimText='',primed=false,history=[],voiceTimeout=null,fetchController=null,audioReady=false;
  const startBtn=el('autoLiveStart'),stopBtn=el('autoLiveStop');
  const putHistory=(role,content)=>{if(!content)return;history.push({role,content:String(content).slice(0,3000)});if(history.length>20)history=history.slice(-20);};
  const restartRecognition=()=>{
    if(!enabled||busy||recognition||!('SpeechRecognition'in window)&&!('webkitSpeechRecognition'in window))return;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    try{
      const rec=new Recognition();recognition=rec;
      rec.lang='ru-RU';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=4;
      rec.onresult=e=>{
        if(!enabled||busy)return;
        const results=Array.from(e.results).slice(-3);
        const candidates=results.flatMap(r=>Array.from(r).slice(0,4).map(x=>String(x.transcript||'')));
        interimText=candidates.join(' ').slice(-1600);
        if(candidates.some(wakeText)&&!primed){primed=true;state('thinking');status('услышала «насыпатель» · принимаю вопрос');}
      };
      rec.onerror=e=>{
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){status('нет разрешения на распознавание в браузере · продолжаю слушать через сервер');recognition=null;}
      };
      rec.onend=()=>{if(rec===recognition)recognition=null;if(enabled&&!busy)setTimeout(restartRecognition,600);};
      rec.start();
    }catch{recognition=null;}
  };
  const pauseRecognition=()=>{
    const rec=recognition;recognition=null;
    if(rec){rec.onend=null;try{rec.abort();}catch{}}
  };
  function finish(){
    if(voiceTimeout)clearTimeout(voiceTimeout);voiceTimeout=null;
    busy=false;primed=false;interimText='';tail=[];tailSize=0;frames=[];frameSize=0;active=false;quietSeconds=0;loudFrames=0;
    if(enabled){status('слушаю разговор · можешь говорить обычным голосом');restartRecognition();}
  }
  if(channel)channel.addEventListener('message',e=>{
    const m=e.data||{};
    if(m.type==='ready'&&m.audio===true)audioReady=true;
    if(m.type==='voice-error'||m.type==='voice-end')if(busy)finish();
    if(m.type==='panic'||m.type==='logout')stop();
  });
  function stop(silent=false){
    enabled=false;busy=false;primed=false;audioReady=false;
    if(fetchController)fetchController.abort();fetchController=null;
    if(voiceTimeout)clearTimeout(voiceTimeout);voiceTimeout=null;
    pauseRecognition();
    if(processor)processor.onaudioprocess=null;
    try{source?.disconnect();processor?.disconnect();silent?.disconnect();}catch{}
    stream?.getTracks().forEach(track=>track.stop());stream=null;processor=null;source=null;silent=null;
    context?.close().catch(()=>{});context=null;
    tail=[];frames=[];tailSize=0;frameSize=0;active=false;
    startBtn.disabled=false;stopBtn.disabled=true;
    if(!silent)state('idle');status('автоматический слух выключен');
  }
  async function transcribe(chunks,sampleRate,localWake,localText){
    if(!enabled)return;
    busy=true;pauseRecognition();
    const hadWake=primed||localWake;
    if(hadWake)state('thinking');
    status(hadWake?'насыпатель думает · сыплется в ухо':'расшифровываю фразу');
    try{
      const audio=writeWave(chunks,sampleRate);
      fetchController=new AbortController();
      const signal=fetchController.signal;
      const response=await fetch('/api/nasypateli-ai?route=transcribe',{
        method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({audio,respond:true,fast:true,history:history.slice(-16),...(hadWake&&wakeText(localText)?{prefix:'насыпатель'}:{})}),
        signal
      });
      if(!response.ok){if(response.status===401){stop();status('сеанс истёк · войди заново');return;}throw new Error('server_'+response.status);}
      const data=await response.json();
      const heard=String(data.text||'').trim();
      const reply=data.reply||{};
      const confirmed=Boolean(reply.speak&&reply.text);
      if(heard)putHistory('user',heard);
      if(confirmed){
        const text=tidySpoken(reply.text);
        if(text){
          state('thinking');
          el('cue').value=text;
          putHistory('assistant',text);
          if(audioReady){
            el('speakCue').click();
            status('насыпатель отвечает · после ответа снова слушаю');
            voiceTimeout=setTimeout(finish,70000);
            return;
          }
          el('showCue').click();
          status('ответ на экране · для озвучки включи звук на экране зрителя');
          voiceTimeout=setTimeout(finish,1800);
          return;
        }
      }
      if(hadWake&&wakeText(localText)&&!wakeText(heard)){
        // Browser recognized the address but server missed it: use the actual browser transcript.
        const retry=await fetch('/api/nasypateli-ai',{method:'POST',credentials:'same-origin',
          headers:{'content-type':'application/json'},signal,
          body:JSON.stringify({mode:'live',prompt:localText,history:history.slice(-16)})});
        if(retry.ok){
          const guess=await retry.json();
          if(guess.speak&&guess.text){
            const text=tidySpoken(guess.text);el('cue').value=text;putHistory('assistant',text);
            if(audioReady){el('speakCue').click();voiceTimeout=setTimeout(finish,70000);return;}
            el('showCue').click();voiceTimeout=setTimeout(finish,1800);return;
          }
        }
      }
      if(hadWake)state('idle');
      finish();
    }catch(error){
      if(enabled){state('idle');status('не удалось распознать фразу · продолжу слушать');finish();}
    }finally{fetchController=null;}
  }
  function onAudioProcess(event){
    if(!enabled||busy||!context)return;
    const block=new Float32Array(event.inputBuffer.getChannelData(0));
    const sr=context.sampleRate,seconds=block.length/sr;
    let power=0;for(let i=0;i<block.length;i++)power+=block[i]*block[i];
    const rms=Math.sqrt(power/block.length);
    if(!active)noise=Math.min(.012,Math.max(.0004,noise*.97+rms*.03));
    const threshold=Math.max(.0027,noise*2.25);
    const loud=rms>threshold;
    tail.push(block);tailSize+=block.length;
    while(tailSize>sr*.6&&tail.length>1){tailSize-=tail.shift().length;}
    if(!active){
      if(loud)loudFrames++;else loudFrames=0;
      if(loudFrames>=2){active=true;frames=tail.slice();frameSize=frames.reduce((n,f)=>n+f.length,0);quietSeconds=0;}
      return;
    }
    frames.push(block);frameSize+=block.length;
    if(loud)quietSeconds=0;else quietSeconds+=seconds;
    if((quietSeconds>=.72&&frameSize>=sr*.46)||frameSize>=sr*13.5){
      const completed=frames,localWake=primed,localText=interimText;
      frames=[];frameSize=0;active=false;quietSeconds=0;loudFrames=0;tail=[];tailSize=0;
      void transcribe(completed,sr,localWake,localText);
    }
  }
  async function start(){
    if(enabled)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext&&!window.webkitAudioContext){
      status('микрофон недоступен в этом браузере');return;
    }
    enabled=true;startBtn.disabled=true;stopBtn.disabled=false;
    status('запрашиваю разрешение на микрофон');
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1
      },video:false});
      if(!enabled){stream.getTracks().forEach(track=>track.stop());return;}
      const Audio=window.AudioContext||window.webkitAudioContext;
      context=new Audio({latencyHint:'interactive'});await context.resume();
      source=context.createMediaStreamSource(stream);
      processor=context.createScriptProcessor(2048,1,1);
      silent=context.createGain();silent.gain.value=0;
      source.connect(processor);processor.connect(silent);silent.connect(context.destination);
      processor.onaudioprocess=onAudioProcess;
      interimText='';primed=false;restartRecognition();
      status('слушаю разговор · можешь говорить обычным голосом');
    }catch{
      stop();status('доступ к микрофону не получен · проверь разрешения браузера');
    }
  }
  startBtn.addEventListener('click',start);
  stopBtn.addEventListener('click',stop);
  el('startMic')?.addEventListener('click',stop,true);
  el('panicStop')?.addEventListener('click',stop);
  el('logoutStudio')?.addEventListener('submit',stop);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
  window.addEventListener('pagehide',()=>{stop(true);channel?.close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&enabled)stop();});
}
const autoCSS='.auto-live{border:1px solid var(--red);padding:13px 14px;margin:12px 0 18px;background:#170e0b}.auto-live strong{font-size:14px;font-weight:600}.auto-live p{font-size:12px!important;margin:9px 0!important}.auto-live .buttons{margin:12px 0}.ear-loader{position:absolute;top:0;left:0;width:100%;height:77%;pointer-events:none;opacity:0;overflow:visible;z-index:3;transition:opacity .1s}#character{position:relative}#character[data-state="thinking"] .ear-loader{opacity:1}.ear-loader i{position:absolute;width:4px;height:6px;left:58%;top:0;background:var(--red);border-radius:2px;opacity:0;box-shadow:0 0 6px #b24d3c;animation:ear-sand 1.15s ease-in infinite}.ear-loader i:nth-child(2n){left:53%;width:3px;height:4px;background:var(--paper)}.ear-loader i:nth-child(3n){left:62%;width:5px;height:5px}.ear-loader i:nth-child(1){animation-delay:0s}.ear-loader i:nth-child(2){animation-delay:-.13s}.ear-loader i:nth-child(3){animation-delay:-.26s}.ear-loader i:nth-child(4){animation-delay:-.39s}.ear-loader i:nth-child(5){animation-delay:-.52s}.ear-loader i:nth-child(6){animation-delay:-.65s}.ear-loader i:nth-child(7){animation-delay:-.78s}.ear-loader i:nth-child(8){animation-delay:-.91s}.ear-loader i:nth-child(9){animation-delay:-1.04s}.ear-loader i:nth-child(10){animation-delay:-1.15s}@keyframes ear-sand{0%{opacity:0;transform:translate(38px,-30px) scale(.8)}18%{opacity:1}82%{opacity:.9}100%{opacity:0;transform:translate(-16px,130px) scale(.4)}}@media(prefers-reduced-motion:reduce){.ear-loader i{animation:none;opacity:.5;transform:translate(-16px,62px)}}';
const autoPanel='<section class="auto-live" id="autoLivePanel"><strong>живой насыпатель · автоматический слух</strong><p>один раз включи микрофон, дальше можно говорить обычным голосом · на обращение «насыпатель» он запускает анимацию уха, слушает вопрос и отвечает</p><div class="buttons"><button id="autoLiveStart" class="primary" type="button">включить слух</button><button id="autoLiveStop" type="button" disabled>выключить</button></div><p id="autoLiveStatus" role="status">микрофон выключен</p><p>обрывки речи отправляются в подключённый сервис распознавания · ручной пульт остаётся доступным</p></section>';
export function applyAutoLive(html){
  if(typeof html!=='string'||!html.includes('id="console"')||html.includes('id="autoLivePanel"'))return html;
  const nonce=html.match(/<style nonce="([A-Za-z0-9+/=_-]+)"/)?.[1];
  if(!nonce)throw new Error('authenticated nonce missing');
  const grains='<span class="ear-loader" aria-hidden="true">'+Array.from({length:10},()=>'<i></i>').join('')+'</span>';
  const script=[wakeText,tidySpoken,writeWave,autoLiveClient].map(fn=>fn.toString()).join('\n')+'\nautoLiveClient();';
  return html.replace('</style>',autoCSS+'</style>')
    .replace('<div class="mode">',autoPanel+'<div class="mode">')
    .replace('id="character" data-state="idle">','id="character" data-state="idle">'+grains)
    .replace('id="cue" rows="4" maxlength="750"','id="cue" rows="4" maxlength="2400"')
    .replace('</body>','<script type="module" nonce="'+nonce+'">'+script+'</script></body>');
}
