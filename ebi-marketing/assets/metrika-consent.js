/* Load Yandex Metrika only after this site's explicit consent. */
(function () {
  'use strict';
  var hosts = { 'ebi.dashhkuns.com': 114040507, 'dashhkuns.com': 114040499, 'www.dashhkuns.com': 114040499 };
  var counter = hosts[location.hostname];
  if (!counter || location.protocol !== 'https:' || window.__dashhkunsMetrikaConsentV1) return;
  var paths = location.hostname === 'ebi.dashhkuns.com'
    ? ['/', '/experience', '/marketing-strategy', '/marketing-outsourcing', '/smm-content', '/marketing-audit', '/business-websites', '/seo-promotion', '/context-advertising', '/guides', '/marketing-strategy-brief', '/marketing-audit-checklist']
    : ['/', '/services', '/projects', '/about', '/contact', '/marketing', '/en', '/en/services', '/en/projects', '/en/about', '/en/contact', '/creative-producer', '/creative-producer-moscow', '/project-launch', '/reality-show-producer', '/insights', '/faq'];
  var key = 'dashhkuns_metrika_choice_v1';
  var internalKey = 'dashhkuns_internal_v1';
  var query;
  try { query = new URLSearchParams(location.search); } catch (_) { return; }
  try {
    if (query.get('internal') === '1') localStorage.setItem(internalKey, '1');
    if (query.get('internal') === '0') localStorage.removeItem(internalKey);
  } catch (_) {}
  function isInternal() {
    try { return localStorage.getItem(internalKey) === '1'; } catch (_) { return false; }
  }
  function publicPage() {
    var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    if (paths.indexOf(path) < 0 || isInternal()) return false;
    var params;
    try { params = new URLSearchParams(location.search); } catch (_) { return false; }
    var permitted = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
    var safe = true;
    params.forEach(function (_, name) { if (permitted.indexOf(name.toLowerCase()) < 0) safe = false; });
    return safe && !/^#booking(?:[=/]|$)/i.test(location.hash) && location.hash.indexOf('=') < 0;
  }
  if (!publicPage()) return;
  var privacySignal = navigator.globalPrivacyControl === true || /^(1|yes)$/i.test(String(navigator.doNotTrack || window.doNotTrack || ''));
  var state = { initialized: false, stopped: false, panel: null, message: null, choice: null };
  window.__dashhkunsMetrikaConsentV1 = state;
  try {
    var saved = localStorage.getItem(key);
    if (saved === 'accepted' || saved === 'declined') state.choice = saved;
  } catch (_) {}
  function saveChoice(choice) {
    state.choice = choice;
    try { localStorage.setItem(key, choice); } catch (_) {}
  }
  function cleanUrl(value, originOnly) {
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.origin + (originOnly ? '/' : url.pathname);
    } catch (_) { return ''; }
  }
  function start() {
    if (privacySignal || state.choice !== 'accepted' || state.initialized || state.stopped || !publicPage()) return;
    state.initialized = true;
    var page = cleanUrl(location.href, false);
    var referer = cleanUrl(document.referrer, true);
    if (typeof window.ym !== 'function') {
      window.ym = function () { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
    }
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + counter;
    script.referrerPolicy = 'no-referrer';
    script.setAttribute('data-ebi-metrika', String(counter));
    document.head.appendChild(script);
    window.ym(counter, 'init', { defer: true, disableYtm: true, webvisor: false, clickmap: false, trackLinks: false, ecommerce: false, accurateTrackBounce: false, url: page, referrer: referer });
    window.ym(counter, 'hit', page, { title: document.title, referer: referer });
  }
  function stop() {
    if (state.initialized && !state.stopped) {
      state.stopped = true;
      try { window.ym(counter, 'destruct'); } catch (_) {}
    }
  }
  function hidePanel() { if (state.panel) state.panel.hidden = true; }
  function button(label, handler, style) {
    var element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.style.cssText = style || 'font:inherit;font-size:16px;line-height:1.3;padding:10px 14px;border:1px solid #d7b7ca;border-radius:10px;background:#fff;color:#222;cursor:pointer;min-height:44px';
    element.addEventListener('click', handler);
    return element;
  }
  function render() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', render, { once: true }); return; }
    var footer = document.querySelector('footer');
    var review = button('настройки Яндекс Метрики', function () { state.panel.hidden = false; }, 'font:inherit;font-size:14px;line-height:1.3;background:transparent;color:inherit;border:0;padding:8px 0;text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:36px');
    review.setAttribute('aria-controls', 'ebi-metrika-consent');
    if (!footer) review.style.cssText += ';position:fixed;left:14px;bottom:10px;z-index:9998;background:#fffefb;border:1px solid #ecd7e3;border-radius:9px;padding:7px 10px;color:#333';
    (footer || document.body).appendChild(review);
    var panel = document.createElement('section');
    state.panel = panel;
    panel.id = 'ebi-metrika-consent';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'выбор статистики Яндекс Метрики');
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:20px;border:1px solid #ecd7e3;border-radius:18px;background:#fffefb;color:#2d2028;box-shadow:0 10px 40px #6d184820;font-family:inherit;text-align:left';
    var heading = document.createElement('strong');
    heading.textContent = 'статистика Яндекс Метрики';
    heading.style.cssText = 'display:block;font:inherit;font-size:21px;line-height:1.25;margin:0 0 8px';
    panel.appendChild(heading);
    var copy = document.createElement('p');
    copy.textContent = 'разрешишь передавать Яндексу статистику посещений? запись действий и заполнения форм выключена. выбор можно изменить внизу страницы';
    copy.style.cssText = 'font:inherit;font-size:17px;line-height:1.4;margin:0 0 10px';
    panel.appendChild(copy);
    var link = document.createElement('a');
    link.textContent = 'о данных и выборе';
    link.href = location.hostname === 'ebi.dashhkuns.com' ? '/privacy' : 'https://yandex.ru/support/metrica/ru/general/opt-out.html';
    link.style.cssText = 'font:inherit;font-size:15px;color:inherit;text-decoration:underline;text-underline-offset:3px';
    if (location.hostname !== 'ebi.dashhkuns.com') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    panel.appendChild(link);
    var message = document.createElement('p');
    state.message = message;
    message.setAttribute('role', 'status');
    message.style.cssText = 'font:inherit;font-size:15px;line-height:1.4;margin:9px 0 0';
    message.textContent = privacySignal ? 'сбор выключен настройками конфиденциальности браузера' : '';
    panel.appendChild(message);
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:14px';
    var accept = button('разрешить', function () {
      if (privacySignal) return;
      saveChoice('accepted');
      if (state.stopped) { message.textContent = 'разрешение сохранено. сбор включится при следующем открытии страницы'; return; }
      start();
      hidePanel();
    });
    accept.style.cssText += ';background:#ff309f';
    accept.disabled = privacySignal;
    if (privacySignal) accept.style.cssText += ';opacity:.5;cursor:default';
    actions.appendChild(accept);
    actions.appendChild(button('отказаться', function () { saveChoice('declined'); stop(); hidePanel(); }));
    panel.appendChild(actions);
    panel.hidden = state.choice !== null || privacySignal;
    document.body.appendChild(panel);
    start();
  }
  window.addEventListener('hashchange', function () { if (!publicPage()) { stop(); hidePanel(); } });
  window.addEventListener('popstate', function () { if (!publicPage()) { stop(); hidePanel(); } });
  render();
})();
