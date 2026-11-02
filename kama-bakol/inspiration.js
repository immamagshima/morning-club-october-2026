/* Private, browser-local inspiration. No query, selection, or copy is sent to a server. */
(() => {
 'use strict';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0591-\u05c7]/g,'').replace(/[^א-ת\s]/g,' ').replace(/\s+/g,' ').trim();
 function create(host){
  const themes=window.KAMA_INSPIRATION_THEMES||[];let current=null;
  host.classList.add('inspiration-studio');
  const form=document.createElement('form');form.className='inspiration-form';
  const label=document.createElement('label');label.textContent='מה הכוונה שלך להיום?';
  const input=document.createElement('input');input.type='text';input.maxLength=180;input.placeholder='למשל: לשמור על נחת בתוך העומס';input.autocomplete='off';input.name='local-intention';label.append(input);
  const submit=document.createElement('button');submit.type='submit';submit.className='primary-button';submit.textContent='לפתוח זרם מדויק';form.append(label,submit);
  const chooseLabel=document.createElement('label');chooseLabel.className='inspiration-theme-label';chooseLabel.append('או לבחור נושא ');
  const select=document.createElement('select');select.setAttribute('aria-label','לבחור נושא להשראה');const empty=document.createElement('option');empty.value='';empty.textContent='מה מבקש תמיכה עכשיו?';select.append(empty);
  themes.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;select.append(o);});chooseLabel.append(select);
  const status=document.createElement('p');status.className='inspiration-status';status.setAttribute('role','status');
  const results=document.createElement('section');results.className='inspiration-results';results.hidden=true;
  const heading=document.createElement('h2');heading.tabIndex=-1;const description=document.createElement('p');description.className='inspiration-description';
  const list=document.createElement('ol');list.className='inspiration-list';results.append(heading,description,list);
  const download=document.createElement('a');download.href='assets/guides/consciousness-supplements.pdf';download.className='secondary-button inspiration-download';download.textContent='להוריד את חוברת ההשראה';download.download='תוספי-תודעה-מועדון-אמא-מגשימה.pdf';
  const privacy=document.createElement('p');privacy.className='inspiration-privacy';privacy.textContent='הכוונה כאן נשארת אצלך. בחרי משפט שנוגע בך, העתיקי למחברת ושני אותו לשפה שלך.';
  host.append(form,chooseLabel,status,results,download,privacy);
  function score(theme,query){
   const q=normalize(query),terms=q.split(' ').filter(w=>w.length>2);
   const titleBonus=normalize(theme.title).split(' ').filter(w=>w.length>=3&&q.includes(w)).length*15;
   return titleBonus+(theme.keywords||[]).reduce((total,k)=>{const key=normalize(k);return total+(q.includes(key)?key.length+7:terms.some(w=>w.includes(key)||key.includes(w))?4:0);},0);
  }
  function render(theme,matched=false){
   current=theme;select.value=theme.id;results.hidden=false;heading.textContent=theme.title;description.textContent=theme.description;list.replaceChildren();
   theme.items.forEach((text,index)=>{const li=document.createElement('li');const number=document.createElement('span');number.className='inspiration-number';number.textContent=String(index+1).padStart(2,'0');
    const p=document.createElement('p');p.textContent=text;const b=document.createElement('button');b.type='button';b.className='inspiration-copy';b.textContent='להעתיק';b.setAttribute('aria-label',`להעתיק: ${text}`);
    b.onclick=async()=>{try{await navigator.clipboard.writeText(text);status.textContent='המשפט הועתק. אפשר גם לנסח אותו מחדש במילים שלך.';b.textContent='הועתק';setTimeout(()=>{b.textContent='להעתיק';},1600);}catch(_){const range=document.createRange();range.selectNodeContents(p);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='המשפט מסומן. אפשר להעתיק אותו דרך תפריט המכשיר.';}};
    li.append(number,p,b);list.append(li);
   });
   status.textContent=matched?'עשרה תוספים בנושא קרוב לכוונה שלך. אפשר לבחור נושא אחר.':'עשרה תוספים להשראה. אין צורך לבחור את כולם.';
  }
  form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(!q){input.focus();status.textContent='כתבי כוונה קצרה או בחרי נושא.';return;}
   const ranked=themes.map(t=>({theme:t,score:score(t,q)})).sort((a,b)=>b.score-a.score);
   if(!ranked[0]?.score){results.hidden=true;select.value='';status.textContent='לא מצאנו נושא קרוב מספיק. בחרי את הנושא שמרגיש לך מתאים מתוך הרשימה.';select.focus();return;}
   render(ranked[0].theme,true);heading.focus({preventScroll:true});
  });
  select.addEventListener('change',()=>{const t=themes.find(t=>t.id===select.value);if(t)render(t);else results.hidden=true;});
  return {prefill(value){if(!input.value)input.value=String(value||'');},reset(){input.value='';select.value='';status.textContent='';results.hidden=true;list.replaceChildren();current=null;}};
 }
 window.KAMA_SUPPLEMENT_STUDIO={create};
 document.querySelectorAll('[data-inspiration-standalone]').forEach(create);
})();
