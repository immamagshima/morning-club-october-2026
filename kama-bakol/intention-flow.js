/* Living Hebrew intentions: full phrases, word waves, and a complete rotating queue. */
(() => {
  'use strict';
  const wall=document.getElementById('groupWordWall'),cloud=wall?.querySelector('.group-word-cloud');
  if(!wall||!cloud)return;
  const stage=document.createElement('div');stage.className='intention-flow-stage';stage.setAttribute('aria-hidden','true');cloud.before(stage);
  const wash=document.createElement('div');wash.className='intention-flow-wash';stage.append(wash);
  const media=matchMedia('(prefers-reduced-motion: reduce)'),slots=[];
  let words=[],signature='',next=0,paused=false,active=false,destroyed=false,owner=null;
  let resizeObserver,sceneObserver;
  function values(entries){return (Array.isArray(entries)?entries:[]).map(e=>typeof e==='string'?e:e?.word).filter(v=>typeof v==='string'&&v.length);}
  function choose(){const index=next%words.length;next=(index+1)%words.length;return {value:words[index],index};}
  function cancel(slot){clearTimeout(slot.timer);slot.timer=null;slot.motion?.cancel();slot.motion=null;}
  function centre(slot){slot.motion?.cancel();slot.motion=null;slot.text.style.opacity='1';slot.text.style.transform='none';}
  function visible(){const scene=wall.closest('.scene');return !document.hidden&&(!scene||scene.classList.contains('is-active'))&&wall.getClientRects().length>0;}
  function fit(slot){
    const n=slot.text;if(slot.cell.clientWidth<1||slot.cell.clientHeight<1)return;
    n.style.fontSize='';let size=parseFloat(getComputedStyle(n).fontSize)||34;
    const height=slot.cell.clientHeight-36,width=n.clientWidth+4;
    while((n.scrollHeight>height||n.scrollWidth>width)&&size>18){size--;n.style.fontSize=`${size}px`;}
  }
  function write(slot){
    const chosen=choose();slot.value=chosen.value;slot.text.dataset.phraseIndex=String(chosen.index);
    slot.text.className='intention-flow-text';slot.text.replaceChildren();
    let index=0;
    for(const part of slot.value.split(/(\s+)/)){
      if(!part)continue;
      if(/^\s+$/.test(part)){slot.text.append(document.createTextNode(part));continue;}
      const word=document.createElement('span');word.className='intention-wave-word';word.textContent=part;
      word.style.setProperty('--word-phase',`${-index*.22}s`);word.style.setProperty('--ink-phase',`${-index*.37}s`);
      if(part.length>25)word.classList.add('is-unbroken');slot.text.append(word);index++;
    }
    fit(slot);
  }
  function schedule(slot,initial=false){
    clearTimeout(slot.timer);slot.timer=null;
    if(!active||paused||media.matches||words.length<=slots.length)return;
    const cycle=Math.min(11000,Math.max(9000,5500+slot.value.length*90));
    slot.timer=setTimeout(()=>advance(slot),initial?cycle-1000+slot.position*4200:cycle-2000);
  }
  async function animate(slot,frames,duration){
    if(!slot.text.animate)return;
    const a=slot.text.animate(frames,{duration,easing:'cubic-bezier(.35,0,.25,1)',fill:'forwards'});slot.motion=a;
    try{await a.finished;}catch(_){}if(slot.motion===a)slot.motion=null;
  }
  async function advance(slot){
    slot.timer=null;if(!active||paused||media.matches||destroyed)return;
    if(owner){slot.timer=setTimeout(()=>advance(slot),180);return;}
    const token={};owner=token;const turn=++slot.turn;
    const valid=()=>active&&!paused&&!media.matches&&!destroyed&&turn===slot.turn;
    await animate(slot,[{opacity:1,transform:'translate(0,0)'},{opacity:0,transform:'translate(-32px,-5px)'}],900);
    if(valid()){
      write(slot);
      await animate(slot,[{opacity:0,transform:'translate(32px,6px)'},{opacity:1,transform:'translate(0,0)'}],1100);
    }
    if(owner===token)owner=null;
    if(turn===slot.turn){centre(slot);schedule(slot);}
  }
  function flags(){
    wall.classList.toggle('intention-flow-paused',paused||!active);
    wall.classList.toggle('intention-flow-reduced',media.matches);
    wall.classList.toggle('has-intention-flow',words.length>0);
  }
  function rebuild(force=false){
    if(destroyed)return;
    const count=Math.min(wall.clientWidth<430?1:2,words.length);
    if(!force&&count===slots.length){slots.forEach(fit);return;}
    slots.forEach(s=>{s.turn++;cancel(s);s.cell.remove();});slots.length=0;owner=null;
    stage.style.setProperty('--flow-lanes',String(Math.max(1,count)));stage.dataset.lanes=String(count);stage.dataset.total=String(words.length);
    for(let i=0;i<count;i++){
      const cell=document.createElement('div');cell.className='intention-flow-cell';
      const text=document.createElement('p');text.dir='rtl';cell.append(text);stage.append(cell);
      const slot={cell,text,position:i,value:'',turn:0,timer:null,motion:null};slots.push(slot);write(slot);
    }
    active=visible();flags();slots.forEach(s=>schedule(s,true));
  }
  function sync(){
    const value=visible();if(value===active)return;active=value;owner=null;flags();
    slots.forEach(s=>{s.turn++;cancel(s);centre(s);fit(s);schedule(s,true);});
  }
  function setWords(entries){
    const list=values(entries),sig=JSON.stringify(list);if(sig===signature)return;
    const wasEmpty=!words.length;signature=sig;words=list;stage.dataset.total=String(words.length);
    if(wasEmpty||!words.length||slots.length!==Math.min(wall.clientWidth<430?1:2,words.length)){next=0;rebuild(true);}
    else {next%=words.length;slots.forEach(s=>{fit(s);if(!s.timer&&!s.motion)schedule(s,true);});}
  }
  function setPaused(value){paused=Boolean(value);owner=null;flags();slots.forEach(s=>{s.turn++;cancel(s);centre(s);schedule(s,true);});}
  function reducedChanged(){rebuild(true);}
  function destroy(){
    destroyed=true;slots.forEach(cancel);resizeObserver?.disconnect();sceneObserver?.disconnect();
    document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',reducedChanged);stage.remove();
    wall.classList.remove('has-intention-flow','intention-flow-paused','intention-flow-reduced');
  }
  document.addEventListener('visibilitychange',sync);media.addEventListener('change',reducedChanged);
  if('ResizeObserver'in window){resizeObserver=new ResizeObserver(()=>rebuild());resizeObserver.observe(wall);}
  const scene=wall.closest('.scene');if(scene){sceneObserver=new MutationObserver(sync);sceneObserver.observe(scene,{attributes:true,attributeFilter:['class','aria-hidden']});}
  document.fonts?.ready.then(()=>{if(!destroyed)slots.forEach(fit);});
  window.KEREN_INTENTION_FLOW={setWords,setPaused,destroy};
  window.addEventListener('pagehide',()=>{active=false;slots.forEach(cancel);flags();});
  window.addEventListener('pageshow',()=>{active=visible();flags();slots.forEach(s=>schedule(s,true));});
})();
