// оператор включает распознавание явно; браузер может отправлять аудио своему провайдеру
export function finalPhrases(event) {
  if (!event || !event.results) return [];
  const phrases = [];
  for (let i = Number(event.resultIndex) || 0; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result?.[0]?.transcript;
    if (result?.isFinal && typeof transcript === "string" && transcript.trim()) {
      phrases.push(transcript.trim());
    }
  }
  return phrases;
}

export function createSpeechInput({Recognition, onText, onStatus} = {}) {
  if (typeof onText !== "function" || typeof onStatus !== "function") {
    throw new TypeError("onText and onStatus callbacks are required");
  }
  if (typeof Recognition !== "function") {
    return {supported:false, start:()=>false, stop:()=>{}, dispose:()=>{}};
  }
  let disposed = false;
  let active = false;
  let recognition = null;
  const report = (message) => { if (!disposed) onStatus(message); };
  function stop() {
    if (!active) return;
    active = false;
    try { recognition?.stop(); } catch { /* browser already stopped */ }
    report("микрофон выключен");
  }
  function start() {
    if (disposed || active) return false;
    try {
      recognition = new Recognition();
      recognition.lang = "ru-RU";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        if (!active || disposed) return;
        const text = finalPhrases(event).join(" ").trim().slice(0,400);
        if (text) { onText(text); report("текст распознан, проверь перед показом"); }
      };
      recognition.onerror = event => {
        if (!active || disposed) return;
        const errors = {
          "not-allowed":"нет разрешения на микрофон",
          "service-not-allowed":"распознавание речи запрещено браузером",
          "no-speech":"речь не обнаружена",
          "audio-capture":"микрофон недоступен",
          "network":"ошибка службы распознавания речи",
          "aborted":"распознавание остановлено"
        };
        report(errors[event?.error] || "ошибка распознавания речи");
      };
      recognition.onend = () => { active = false; report("микрофон выключен"); };
      active = true;
      recognition.start();
      report("слушаю — остановится автоматически после фразы");
      return true;
    } catch {
      active = false;
      report("не удалось включить микрофон");
      return false;
    }
  }
  return {
    supported:true,
    start,stop,
    dispose() {
      if (disposed) return;
      if (active) {
        try {recognition?.abort();} catch { /* already inactive */ }
      }
      active=false;
      disposed=true;
    }
  };
}
