import {createSpeechInput} from "/assets/nasypateli-live-voice-input.mjs";
const channelName = "dashhkuns-live-stage-v1";
const allowedStates = new Set(["idle","listening","thinking","speaking","error"]);
const labels = {idle:"на связи",listening:"слушает",thinking:"думает",speaking:"говорит",error:"связь прервана"};
const stageMode = new URLSearchParams(location.search).get("view") === "stage";
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : null;
const byId = id => document.getElementById(id);
const stage = byId("stage");
const character = byId("character");
const caption = byId("caption");
const status = byId("status");
const episodeLabel = byId("episodeLabel");
const connectionState = byId("connectionState");
const operatorState = byId("operatorState");
const stateButtons = [...document.querySelectorAll("[data-state]")].filter(el => el.matches("button"));
let current = {state:"idle",cue:"тут никто не обязан знать ответ",episode:"пилот"};
let mouthTimer = null;
let speaking = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function paint(next) {
  if (next && typeof next === "object") {
    const incoming = {};
    if (typeof next.state === "string" && allowedStates.has(next.state)) incoming.state = next.state;
    if (typeof next.cue === "string") incoming.cue = next.cue.slice(0,750);
    if (typeof next.episode === "string") incoming.episode = next.episode.slice(0,70);
    current = {...current,...incoming};
  }
  stage.dataset.state = current.state;
  character.dataset.state = current.state;
  caption.textContent = current.cue;
  status.textContent = labels[current.state];
  episodeLabel.textContent = current.episode || "пилот";
  stateButtons.forEach(btn => { btn.classList.toggle("active",btn.dataset.state === current.state); btn.setAttribute("aria-pressed",String(btn.dataset.state === current.state)); });
  if (stageMode && current.state === "speaking" && !reducedMotion) startMouth();
  else stopMouth();
}

function stopMouth() {
  if (mouthTimer !== null) clearInterval(mouthTimer);
  mouthTimer = null;
  byId("mouth").setAttribute("d","M171 322 Q210 346 252 320");
}
function startMouth() {
  if (mouthTimer !== null) return;
  const shapes = [
    "M171 322 Q210 346 252 320",
    "M178 315 Q210 354 242 316 Q231 368 210 371 Q185 367 178 315 Z",
    "M177 317 Q211 349 246 319 Q210 363 177 317 Z",
    "M189 318 Q210 305 233 318 Q235 346 211 351 Q187 345 189 318 Z"
  ];
  let index=0;
  mouthTimer = setInterval(() => byId("mouth").setAttribute("d",shapes[(index++) % shapes.length]),140);
}

function publish(payload) {
  paint(payload);
  if (channel) channel.postMessage({type:"scene",scene:{...current}});
}
function speak(text) {
  if (!stageMode || !("speechSynthesis" in window) || !text.trim()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = .93;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang.toLowerCase().startsWith("ru")) || null;
  utterance.onstart = () => { speaking = true; paint({state:"speaking"}); };
  utterance.onend = () => { speaking = false; paint({state:"idle"}); channel?.postMessage({type:"tts-done"}); };
  utterance.onerror = () => { speaking = false; paint({state:"error"}); channel?.postMessage({type:"tts-error"}); };
  speechSynthesis.speak(utterance);
}
function clearSpeech() {
  if (stageMode && "speechSynthesis" in window) speechSynthesis.cancel();
  speaking = false;
  paint({state:"idle"});
}
if (stageMode) document.body.classList.add("stage-only");
paint();
channel?.addEventListener("message",event => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "hello" && !stageMode) channel.postMessage({type:"scene",scene:{...current}});
  if (message.type === "scene" && stageMode) {
    paint(message.scene);
    connectionState.textContent = "оператор подключён";
  }
  if (message.type === "speak" && stageMode && typeof message.text === "string") {
    paint({cue:message.text.slice(0,750),state:"speaking"});
    speak(message.text.slice(0,400));
  }
  if (message.type === "stop" && stageMode) clearSpeech();
  if (message.type === "tts-done" && !stageMode) {operatorState.textContent = "голос завершён";paint({state:"idle"});}
  if (message.type === "tts-error" && !stageMode) operatorState.textContent = "ошибка синтеза речи в браузере";
});
if (stageMode) {
  connectionState.textContent = channel ? "подключаем оператора" : "браузер не поддерживает связь между вкладками";
  channel?.postMessage({type:"hello"});
  byId("fullscreen").addEventListener("click",async () => {
    try { if (!document.fullscreenElement) await stage.requestFullscreen(); else await document.exitFullscreen(); }
    catch { connectionState.textContent = "полноэкранный режим недоступен"; }
  });
} else {
  byId("fullscreen").hidden = true;
  const micStatus = byId("micStatus");
  const mic = createSpeechInput({
    Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
    onText(text) {
      // recognized text stays inside operator console until manually approved
      byId("cue").value = text;
    },
    onStatus(message) { micStatus.textContent = message; }
  });
  if (!mic.supported) {
    byId("startMic").disabled = true;
    micStatus.textContent = "распознавание речи недоступно в этом браузере, используй ручной ввод";
  }
  byId("startMic").addEventListener("click", () => mic.start());
  byId("stopMic").addEventListener("click", () => mic.stop());
  window.addEventListener("beforeunload", () => mic.dispose(), {once:true});
  const readCue = () => byId("cue").value.trim().slice(0,750);
  stateButtons.forEach(btn => btn.addEventListener("click",() => publish({state:btn.dataset.state})));
  byId("episode").addEventListener("input",e => publish({episode:e.target.value}));
  byId("showCue").addEventListener("click",() => publish({cue:readCue(),state:"idle"}));
  byId("clearCue").addEventListener("click",() => {byId("cue").value="";publish({cue:"",state:"idle"});});
  byId("speakCue").addEventListener("click",() => {
    const text = readCue();
    if (!text) {operatorState.textContent = "сначала введи реплику";return;}
    publish({cue:text,state:"speaking"});
    if (!channel) {operatorState.textContent = "открой экран проектора в поддерживаемом браузере";return;}
    channel.postMessage({type:"speak",text});
    operatorState.textContent = "отправлено на экран";
  });
  byId("stopSpeech").addEventListener("click",() => {channel?.postMessage({type:"stop"});publish({state:"idle"});});
  byId("openStage").addEventListener("click",() => {
    const url = new URL(location.href);
    url.searchParams.set("view","stage");
    const win = window.open(url.toString(),"_blank","noopener");
    if (!win) operatorState.textContent = "разреши открытие новой вкладки и повтори";
  });
}
window.addEventListener("beforeunload",() => { if (stageMode && speaking) clearSpeech();channel?.close();stopMouth(); });
