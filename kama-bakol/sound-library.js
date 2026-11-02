/* כל הזכויות שמורות © 2026, קרן בן עמי, אמא מגשימה */
(() => {
  'use strict';
  const instruments = [['flute','חליל'],['handpan','האנדפאן'],['guitar','גיטרה'],['violin','כינור'],['piano','פסנתר']];
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const defaults = ['flute-a','handpan-a','guitar-a','violin-a','piano-a','flute-a','piano-b'];
  const key = 'kamaSoundWeekV1';
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) {}
  const channels = new Map();
  // Preserve today's approved flute on first installation; later mornings use the weekly choices.
  if (!prefs.installed) { prefs.drain ||= {}; prefs.gratitude ||= {}; prefs.firstDate = '2026-11-2'; prefs.installed = true; try { localStorage.setItem(key,JSON.stringify(prefs)); } catch (_) {} }
  let dateKey = localDate(), day = new Date().getDay(), editedDay = day, editedChannel = 'drain', revision = 0;
  function localDate(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
  function selected(context,d=day){return prefs[context]?.[d] || (d===day&&prefs.firstDate===localDate()?'flute-a':defaults[d]);}
  function title(id){if(id==='silent')return 'ללא מוזיקה';const [name,version]=id.split('-');return `${instruments.find(i=>i[0]===name)?.[1]||'חליל'}${name==='flute'?'':version==='a'?' א׳':' ב׳'}`;}
  function path(id){return `assets/audio/loops/${id}.mp3`;}
  function save(){try{localStorage.setItem(key,JSON.stringify(prefs));}catch(_) { status.textContent='הבחירה פעילה. הדפדפן אינו מאפשר לשמור אותה לפעם הבאה.'; }}
  const dialog=document.createElement('dialog');dialog.className='sound-drawer';dialog.id='soundDrawer';dialog.setAttribute('aria-labelledby','soundDrawerTitle');
  dialog.innerHTML=`<div class="sound-drawer-head"><h2 id="soundDrawerTitle">פסקול הבוקר</h2><button type="button" data-close aria-label="סגירת בחירת הפסקול">×</button></div><label class="sound-day-label">לבוקר של <select id="soundDay">${days.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></label><p class="sound-drawer-note">כלי אחר לכל יום. תמיד אפשר להחליף.</p><div class="sound-options">${instruments.map(([id,label])=>`<div class="sound-instrument"><span>${label}</span>${(id==='flute'?['a']:['a','b']).map(v=>`<button type="button" data-track="${id}-${v}" aria-pressed="false">${id==='flute'?'בחירה':v==='a'?'א׳':'ב׳'}<span class="sr-only"> ${label}</span></button>`).join('')}</div>`).join('')}</div><div class="sound-drawer-actions"><button type="button" data-track="silent">ללא מוזיקה</button><button type="button" id="soundSurprise">הפתיעי אותי</button></div><p id="soundChoiceStatus" role="status"></p>`;
  document.body.append(dialog);
  const status=dialog.querySelector('#soundChoiceStatus');
  const daySelect=dialog.querySelector('#soundDay');
  function render(){
    daySelect.value=String(editedDay);
    dialog.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===selected(editedChannel,editedDay))));
    channels.forEach((c,context)=>{c.button.textContent=`♫ ${title(selected(context))} · החלפה`;c.button.setAttribute('aria-label',`בחירת כלי ${context==='drain'?'לניקוז תודעתי':'להודיות'}, ${title(selected(context))}`);});
  }
  function open(context){checkDay();editedChannel=context;editedDay=day;status.textContent='';dialog.querySelector('h2').textContent=context==='drain'?'פסקול הבוקר':'פסקול להודיות';render();dialog.showModal();}
  function checkDay(){if(dateKey===localDate())return;dateKey=localDate();day=new Date().getDay();channels.forEach((c,ctx)=>{if(c.audio.paused)configure(ctx);});render();}
  daySelect.addEventListener('change',()=>{editedDay=Number(daySelect.value);render();});
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  async function choose(id){
    prefs[editedChannel] ||= {};prefs[editedChannel][editedDay]=id;save();render();
    if(editedDay===day){const c=channels.get(editedChannel);const playing=!c.audio.paused;const seconds=c.context==='gratitude'&&c.deadline>0?Math.max(0,(c.deadline-Date.now())/1000):360;const stamp=++revision;await fade(c.audio);if(stamp!==revision)return;configure(editedChannel);if(playing&&id!=='silent')try{await play(c.audio,seconds);}catch(_){c.note.textContent='הניגון לא נפתח. אפשר להפעיל שוב או לבחור שקט.';}}
    dialog.close();
  }
  dialog.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>choose(b.dataset.track));
  dialog.querySelector('#soundSurprise').onclick=()=>{const ids=Array.from(dialog.querySelectorAll('.sound-options [data-track]')).map(b=>b.dataset.track).filter(id=>id!==selected(editedChannel,editedDay));choose(ids[Math.floor(Math.random()*ids.length)]);};
  function configure(context){const c=channels.get(context);const id=selected(context);if(id!=='silent'){c.audio.src=path(id);c.audio.loop=true;c.audio.volume=.22;c.audio.load();}c.note.textContent='';}
  const fades=new WeakMap();
  function fade(audio,rewind=false){
    const c=Array.from(channels.values()).find(c=>c.audio===audio);
    if(c){c.request++;c.want=false;clearTimeout(c.limit);c.limit=null;}
    const pending=fades.get(audio);if(pending){pending.rewind ||= rewind;return pending.promise;}
    if(audio.paused){if(rewind)audio.currentTime=0;return Promise.resolve();}
    const volume=audio.volume,start=performance.now();let resolve;
    const promise=new Promise(r=>resolve=r);const id=setInterval(()=>{const p=Math.min(1,(performance.now()-start)/800);audio.volume=volume*(1-p);if(p===1){clearInterval(id);audio.pause();if(fades.get(audio)?.rewind)audio.currentTime=0;audio.volume=volume;fades.delete(audio);resolve();}},20);
    fades.set(audio,{id,volume,promise,resolve,rewind});return promise;
  }
  async function play(audio,limitSeconds=360){
    checkDay();const c=Array.from(channels.values()).find(c=>c.audio===audio);if(!c)return audio.play();
    const request=++c.request;c.want=true;
    const pending=fades.get(audio);if(pending){clearInterval(pending.id);audio.volume=pending.volume;fades.delete(audio);pending.resolve();}
    if(selected(c.context)==='silent'){c.note.textContent='נבחר שקט. אפשר להחליף כלי בכל רגע.';return;}
    await Promise.all(Array.from(channels.values()).filter(other=>other!==c).map(other=>fade(other.audio)));
    if(request!==c.request)return;
    audio.volume=.22;try{await audio.play();}catch(error){if(request!==c.request)return;throw error;}
    if(request!==c.request){if(!c.want)audio.pause();return;}
    c.note.textContent='';
    if(c.context==='gratitude'){clearTimeout(c.limit);c.deadline=Date.now()+limitSeconds*1000;c.limit=setTimeout(()=>{fade(audio);c.note.textContent='שש דקות המוזיקה הושלמו.';},Math.max(0,limitSeconds*1000));}
  }
  function attach(context,audio,host){
    const button=document.createElement('button');button.type='button';button.className='sound-choice-button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','soundDrawer');button.onclick=()=>open(context);
    const note=document.createElement('span');note.className='sound-choice-note';note.setAttribute('role','status');
    host.append(button,note);channels.set(context,{context,audio,button,note,request:0,limit:null,deadline:0});
    audio.addEventListener('error',()=>{note.textContent='הקובץ לא נטען. אפשר לבחור כלי אחר או להמשיך בשקט.';});
    audio.addEventListener('pause',()=>{if(!audio.paused)return;const c=channels.get(context);clearTimeout(c.limit);c.limit=null;});configure(context);
  }
  const drainHost=document.createElement('div');drainHost.className='sound-choice-row';document.querySelector('.timer-field').after(drainHost);
  attach('drain',document.getElementById('drainSoundtrack'),drainHost);
  attach('gratitude',document.getElementById('gratitudeMusic'),document.querySelector('.gratitude-music-controls'));
  render();setInterval(()=>{checkDay();const c=channels.get('gratitude');const b=document.getElementById('gratitudeMusicToggle');if(!c.audio.paused&&c.limit){const left=Math.max(0,Math.ceil((c.deadline-Date.now())/1000));b.textContent=`לעצור מוזיקה · ${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;}},1000);
  window.addEventListener('storage',e=>{if(e.key!==key)return;try{prefs=JSON.parse(e.newValue)||{};channels.forEach((c,ctx)=>{if(c.audio.paused)configure(ctx);});render();}catch(_){}});
  window.MorningSound={has:audio=>Array.from(channels.values()).some(c=>c.audio===audio),play,fade};
})();
