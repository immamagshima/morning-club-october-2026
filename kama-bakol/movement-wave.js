(() => {
  const stage=document.getElementById('movementWaveStage');
  if(!stage)return;
  const transcript=document.getElementById('movementTranscript');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let entries=[],lanes=[],cursor=0,paused=false;
  const destroy=()=>{lanes.forEach(l=>{l.token++;l.animations.forEach(a=>{a.onfinish=null;a.cancel()})});lanes=[];stage.replaceChildren()};
  function playLane(lane,initial=false){
    if(!entries.length)return;
    lane.animations.forEach(a=>{a.onfinish=null;a.cancel()});lane.animations=[];
    const token=++lane.token,item=entries[cursor++%entries.length];
    lane.entry.textContent=`נכנסתי עם ${item.entryPhrase}`;lane.exit.textContent=`אני יוצאת עם ${item.exitPhrase}`;
    const duration=Math.min(38000,22000+(item.entryPhrase.length+item.exitPhrase.length)*70);
    const travel=lane.traveller.animate([
      {offset:0,transform:'translate3d(135%,18px,0)',opacity:0},
      {offset:.13,transform:'translate3d(58%,-16px,0)',opacity:1},
      {offset:.28,transform:'translate3d(0,0,0)',opacity:1},
      {offset:.68,transform:'translate3d(0,-6px,0)',opacity:1},
      {offset:.86,transform:'translate3d(-62%,16px,0)',opacity:1},
      {offset:1,transform:'translate3d(-140%,-14px,0)',opacity:0}
    ],{duration,easing:'linear',fill:'both'});
    const before=lane.entry.animate([{offset:0,opacity:1},{offset:.4,opacity:1},{offset:.56,opacity:.52},{offset:1,opacity:.52}],{duration,fill:'both'});
    const after=lane.exit.animate([{offset:0,opacity:0,transform:'translateY(18px)'},{offset:.37,opacity:0,transform:'translateY(18px)'},{offset:.53,opacity:1,transform:'translateY(0)'},{offset:1,opacity:1,transform:'translateY(0)'}],{duration,fill:'both',easing:'ease-in-out'});
    lane.animations=[travel,before,after];
    if(initial){const phase=lane.index===0?.22:lane.index===1?.03:0;lane.animations.forEach(a=>a.currentTime=duration*phase)}
    if(paused)lane.animations.forEach(a=>a.pause());
    travel.onfinish=()=>{if(token===lane.token&&!reduced.matches)playLane(lane)};
  }
  function rebuild(){
    if(reduced.matches){destroy();stage.hidden=true;transcript.open=true;return}
    stage.hidden=false;
    const count=Math.min(entries.length,stage.clientWidth<600?2:3);
    if(lanes.length===count&&count)return;
    destroy();stage.style.setProperty('--wave-lanes',Math.max(1,count));
    if(!count){const p=document.createElement('p');p.className='movement-wave-empty';p.textContent='השיתופים שלכן יצטרפו כאן לגל.';stage.appendChild(p);return}
    for(let i=0;i<count;i++){
      const el=document.createElement('div');el.className='movement-wave-lane';
      const trace=document.createElementNS('http://www.w3.org/2000/svg','svg');trace.setAttribute('viewBox','0 0 1000 160');trace.setAttribute('preserveAspectRatio','none');trace.setAttribute('aria-hidden','true');trace.innerHTML='<path d="M-30 95 Q180 5 370 85 T720 68 T1030 80"/>';
      const traveller=document.createElement('div');traveller.className='movement-wave-traveller';
      const entry=document.createElement('span');entry.className='wave-entry';
      const exit=document.createElement('strong');exit.className='wave-exit';
      traveller.append(entry,exit);el.append(trace,traveller);stage.appendChild(el);
      const lane={el,traveller,entry,exit,animations:[],token:0,index:i};lanes.push(lane);playLane(lane,true);
    }
  }
  window.KEREN_MOVEMENT_WAVE={setMovements(items){entries=items.map(x=>({entryPhrase:x.entryPhrase,exitPhrase:x.exitPhrase}));cursor%=Math.max(1,entries.length);rebuild()},setPaused(value){paused=value;lanes.forEach(l=>l.animations.forEach(a=>{if(paused){a.pause();a.currentTime=Number(a.effect.getTiming().duration)*.6;}else a.play();}))}};
  new ResizeObserver(rebuild).observe(stage);reduced.addEventListener('change',rebuild);rebuild();
})();
