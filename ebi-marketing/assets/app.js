const groups = [...document.querySelectorAll('.service-group')];
// Native details keep every service accessible when JavaScript is unavailable.
groups.forEach(group => group.addEventListener('toggle', () => {
  if (!group.open) return;
  groups.forEach(other => { if (other !== group) other.open = false; });
}));
function openLinkedService() {
  const id = location.hash.slice(1);
  if (!id.startsWith('service-')) return;
  const target = document.getElementById(id);
  const parent = target?.closest('.service-group');
  if (!parent) return;
  groups.forEach(group => { group.open = group === parent; });
  requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
}
addEventListener('hashchange', openLinkedService);
openLinkedService();
const portrait = document.querySelector('[data-opal-stage], [data-portrait]');
const motion = matchMedia('(prefers-reduced-motion:reduce)');
const pointer = matchMedia('(hover:hover) and (pointer:fine)');
let frame = 0;
let position = null;
function resetPortrait() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0; position = null;
  portrait?.style.removeProperty('--rx'); portrait?.style.removeProperty('--ry');
}
portrait?.addEventListener('pointermove', event => {
  if (motion.matches || !pointer.matches) return;
  const rect = portrait.getBoundingClientRect();
  position = {x:(event.clientX-rect.left)/rect.width-.5,y:(event.clientY-rect.top)/rect.height-.5};
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame=0;
    if(!position)return;
    portrait.style.setProperty('--rx',`${(-position.y*3).toFixed(2)}deg`);
    portrait.style.setProperty('--ry',`${(position.x*3).toFixed(2)}deg`);
  });
});
portrait?.addEventListener('pointerleave',resetPortrait);
motion.addEventListener('change',resetPortrait);
pointer.addEventListener('change',resetPortrait);
