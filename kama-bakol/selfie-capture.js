/* One still frame, selected by the user. No upload, recording, or persistence. */
(() => {
 'use strict';
 const button=document.getElementById('captureGroupSelfie');if(!button)return;
 const scene=button.closest('.scene'),status=document.getElementById('selfieCaptureStatus'),preview=document.getElementById('selfieCapturePreview'),image=document.getElementById('selfieCaptureImage'),download=document.getElementById('selfieCaptureDownload');
 let stream=null,objectUrl=null,generation=0;
 const stop=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;};
 function cancel(){generation++;stop();button.disabled=false;}
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 button.addEventListener('click',async()=>{
  if(!navigator.mediaDevices?.getDisplayMedia){status.textContent='המכשיר הזה אינו מאפשר צילום מסך מהדפדפן. אפשר להשתמש בצילום המסך הרגיל של המכשיר.';return;}
  const token=++generation;button.disabled=true;status.textContent='בחרי את חלון הזום בבורר המסך. הצילום מתחיל שלוש שניות אחרי הבחירה.';
  let video,attemptStream;
  try{
   attemptStream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'window'},audio:false});
   if(token!==generation||!scene.classList.contains('is-active'))return;
   stream=attemptStream;
   video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
   await video.play();
   for(let n=3;n>0;n--){if(token!==generation)return;status.textContent=`עוד ${n}... חיוך של חמש בבוקר!`;await wait(1000);}
   if(token!==generation)return;
   const width=video.videoWidth,height=video.videoHeight;if(!width||!height)throw new Error('empty-frame');
   const banner=Math.max(110,Math.round(width*.07)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height+banner;
   const ctx=canvas.getContext('2d');ctx.drawImage(video,0,banner,width,height);stop();
   await document.fonts?.ready;
   ctx.fillStyle='#fffaf1';ctx.fillRect(0,0,width,banner);
   ['#173faf','#ed0874','#ff651b'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*width/3,0,width/3,Math.max(4,Math.round(width/350)));});
   const date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Bangkok',day:'numeric',month:'numeric',year:'2-digit'}).format(new Date());
   ctx.direction='rtl';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#171614';ctx.font=`700 ${Math.round(banner*.34)}px Polin,Arial,sans-serif`;ctx.fillText(`מועדון אמא מגשימה · ${date}`,width/2,banner*.48,width*.94);
   ctx.fillStyle='#173faf';ctx.font=`400 ${Math.round(banner*.18)}px Polin,Arial,sans-serif`;ctx.fillText('קמה בקול · קרן בן עמי',width/2,banner*.8,width*.9);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('image-failed');if(token!==generation)return;
   if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);image.src=objectUrl;download.href=objectUrl;download.download=`kama-bakol-group-${date.replace(/[^0-9]/g,'-')}.png`;preview.hidden=false;
   status.textContent='הצילום מוכן אצלך. אפשר לבדוק את התמונה ולהוריד אותה.';download.focus({preventScroll:true});
  }catch(error){if(token===generation)status.textContent=error?.name==='NotAllowedError'||error?.name==='AbortError'?'הצילום בוטל. אפשר לנסות שוב כשתרצי.':'הצילום לא הושלם. נסי שוב או השתמשי בצילום המסך של המכשיר.';}
  finally{attemptStream?.getTracks().forEach(t=>t.stop());if(stream===attemptStream)stream=null;if(video){video.srcObject=null;video.remove();}if(token===generation)button.disabled=false;}
 });
 new MutationObserver(()=>{if(!scene.classList.contains('is-active'))cancel();}).observe(scene,{attributes:true,attributeFilter:['class']});
 window.addEventListener('pagehide',()=>{cancel();if(objectUrl)URL.revokeObjectURL(objectUrl);});
})();
