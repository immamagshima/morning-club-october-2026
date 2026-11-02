(() => {
  'use strict';
  const wall = document.getElementById('groupWordWall');
  const cloud = wall?.querySelector('.group-word-cloud');
  if (!wall || !cloud) return;
  const stage = document.createElement('div');
  stage.className = 'intention-flow-stage';
  stage.setAttribute('aria-hidden', 'true');
  cloud.before(stage);
  const wash = document.createElement('div');
  wash.className = 'intention-flow-wash';
  stage.appendChild(wash);
  const slots = [];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let words = [], signature = '', next = 0, paused = false, active = false;
  let desiredSlots = 0, destroyed = false, transitionOwner = null;
  let observer, visibilityObserver;
  function plainWords(entries) {
    return (Array.isArray(entries) ? entries : []).map(entry => typeof entry === 'string' ? entry : entry?.word).filter(value => typeof value === 'string' && value.length > 0);
  }
  function clearSlot(slot) {
    clearTimeout(slot.timer); slot.timer = null;
    slot.motion?.cancel(); slot.motion = null;
  }
  function stop() { slots.forEach(clearSlot); }
  function choose() {
    if (!words.length) return '';
    const text = words[next % words.length]; next = (next + 1) % words.length; return text;
  }
  function fit(slot) {
    const node = slot.text;
    node.style.fontSize = '';
    node.style.letterSpacing = '';
    // Every phrase stays whole. Long phrases get more lines and enough dwell time.
    let size = parseFloat(getComputedStyle(node).fontSize) || 32;
    const maxHeight = Math.max(70, slot.cell.clientHeight - 30);
    while ((node.scrollHeight > maxHeight || node.scrollWidth > slot.cell.clientWidth - 28) && size > 18) {
      size -= 1; node.style.fontSize = `${size}px`;
    }
    // API phrases are bounded to 72 chars; if a future source exceeds that limit,
    // allow a legible internal scroll rather than hide or truncate the original.
    node.classList.toggle('is-long-overflow', node.scrollHeight > maxHeight);
    if (node.scrollHeight > maxHeight) node.style.maxHeight = `${maxHeight}px`;
    else node.style.maxHeight = '';
  }
  function styleText(slot) {
    const short = slot.value.length <= 11;
    slot.text.className = `intention-flow-text tone-${['ink','cobalt','ink','mauve'][slot.index % 4]} size-${slot.index % 3}`;
    if (short && slot.index % 5 === 3) slot.text.classList.add('handwritten');
    slot.text.textContent = slot.value;
    slot.text.style.fontSize = '';
    slot.text.style.maxHeight = '';
    fit(slot);
  }
  function centre(slot) {
    slot.motion?.cancel(); slot.motion = null;
    slot.text.style.opacity = '1'; slot.text.style.transform = 'translate(0,0) rotate(0deg)';
  }
  function schedule(slot, first = false) {
    clearSlot(slot); centre(slot);
    if (!active || paused || media.matches || !words.length) return;
    const dwell = Math.min(16000, Math.max(8000, 5000 + slot.value.length * 145));
    // All cells are visible immediately; staggering affects only first renewal.
    slot.timer = setTimeout(() => advance(slot), first ? dwell + slot.index * 1500 : dwell);
  }
  async function animate(slot, frames, options) {
    if (!slot.text.animate) return;
    const motion = slot.text.animate(frames, { ...options, fill: 'forwards' });
    slot.motion = motion;
    try { await motion.finished; } catch (_) {}
    if (slot.motion === motion) slot.motion = null;
  }
  async function advance(slot) {
    slot.timer = null;
    if (!active || paused || media.matches || destroyed) return;
    if (transitionOwner) { slot.timer=setTimeout(()=>advance(slot),700);return; }
    const ownership={};transitionOwner=ownership;
    const release=()=>{if(transitionOwner===ownership)transitionOwner=null;};
    const turn = ++slot.turn;
    await animate(slot, [
      { transform:'translate(0,0) rotate(0deg)', opacity:1, offset:0 },
      { transform:'translate(-10px,-8px) rotate(-.7deg)', opacity:.85, offset:.4 },
      { transform:'translate(-35px,7px) rotate(-1.2deg)', opacity:0, offset:1 }
    ], { duration:1550, easing:'cubic-bezier(.45,0,.35,1)' });
    if (!active || paused || media.matches || destroyed || turn !== slot.turn) { centre(slot); release(); return; }
    slot.value = choose(); styleText(slot);
    await animate(slot, [
      { transform:'translate(36px,9px) rotate(1deg)', opacity:0, offset:0 },
      { transform:'translate(12px,-7px) rotate(.4deg)', opacity:.8, offset:.6 },
      { transform:'translate(0,0) rotate(0deg)', opacity:1, offset:1 }
    ], { duration:1900, easing:'cubic-bezier(.2,.65,.25,1)' });
    if (!active || paused || destroyed || turn !== slot.turn) { centre(slot); release(); return; }
    centre(slot); release(); schedule(slot);
  }
  function visible() {
    const scene = wall.closest('.scene');
    return !document.hidden && (!scene || scene.classList.contains('is-active')) && wall.getClientRects().length > 0;
  }
  function syncActive() {
    const now = visible();
    if (now === active) return;
    active = now;
    if (!active) { slots.forEach(slot=>{slot.turn++;clearSlot(slot);centre(slot);}); }
    else slots.forEach(slot=>schedule(slot,true));
  }
  function rebuild(force = false) {
    if (destroyed) return;
    const count = wall.clientWidth < 620 ? 2 : wall.clientWidth < 1000 ? 3 : 4;
    if (!force && count === desiredSlots) { slots.forEach(fit); return; }
    desiredSlots = count; stop(); transitionOwner=null;
    slots.forEach(slot=>{slot.turn++;slot.cell.remove();});slots.length=0;
    stage.style.setProperty('--flow-slots', String(count));
    stage.dataset.slots = String(count);
    const amount = Math.min(count, words.length);
    for (let i=0;i<amount;i++) {
      const cell=document.createElement('div');cell.className='intention-flow-cell';
      const text=document.createElement('span');cell.appendChild(text);stage.appendChild(cell);
      const slot={cell,text,index:i,value:choose(),timer:null,motion:null,turn:0};slots.push(slot);styleText(slot);
    }
    wall.classList.toggle('has-intention-flow', words.length > 0);
    wall.classList.toggle('intention-flow-reduced', media.matches);
    wall.classList.toggle('intention-flow-paused', paused);
    active=visible();slots.forEach(slot=>schedule(slot,true));
  }
  function setWords(entries) {
    const values=plainWords(entries), nextSignature=JSON.stringify(values);
    if (nextSignature === signature) return;
    const wasEmpty = words.length === 0;
    signature=nextSignature;words=values;
    if (wasEmpty || !words.length || slots.length !== Math.min(desiredSlots, words.length)) { next=0;rebuild(true); }
    else { next %= words.length; slots.forEach(fit); }
  }
  function setPaused(value) {
    paused=Boolean(value);transitionOwner=null;wall.classList.toggle('intention-flow-paused',paused);
    slots.forEach(slot=>{slot.turn++;clearSlot(slot);centre(slot);});
    if (!paused && active) slots.forEach(slot=>schedule(slot,true));
  }
  function reducedChanged() { rebuild(true); }
  function visibilityChanged() { syncActive(); }
  document.addEventListener('visibilitychange',visibilityChanged);
  media.addEventListener('change',reducedChanged);
  if ('ResizeObserver' in window) { observer=new ResizeObserver(()=>rebuild());observer.observe(wall); }
  const scene=wall.closest('.scene');
  if (scene) { visibilityObserver=new MutationObserver(syncActive);visibilityObserver.observe(scene,{attributes:true,attributeFilter:['class','aria-hidden']}); }
  function destroy() {
    if(destroyed)return;destroyed=true;stop();observer?.disconnect();visibilityObserver?.disconnect();
    document.removeEventListener('visibilitychange',visibilityChanged);media.removeEventListener('change',reducedChanged);
    stage.remove();wall.classList.remove('has-intention-flow','intention-flow-reduced','intention-flow-paused');
  }
  document.fonts?.ready.then(()=>{if(!destroyed)slots.forEach(fit);});
  window.KEREN_INTENTION_FLOW = {setWords,setPaused,destroy};
  window.addEventListener('pagehide',()=>{active=false;stop();},{once:true});
  window.addEventListener('pageshow',()=>{if(!destroyed){active=visible();slots.forEach(slot=>schedule(slot,true));}});
})();
