(function () {
  'use strict';
  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    var target=document.getElementById(button.getAttribute('data-copy-target'));
    if(!target || !navigator.clipboard || !navigator.clipboard.writeText) return;
    button.hidden=false;
    button.addEventListener('click', async function () {
      var status=button.parentElement.querySelector('[role="status"]');
      var text=Array.from(target.querySelectorAll('li')).map(function (item,index) { return (index+1)+'. '+item.textContent.trim(); }).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        if(status)status.textContent='список скопирован';
      } catch (_) {
        if(status)status.textContent='можно выделить и скопировать список выше';
      }
    });
  });
})();
