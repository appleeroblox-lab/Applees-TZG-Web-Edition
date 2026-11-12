import {captureGameViewport,downloadScreenshot} from './game-screenshot.js';

// One shared, keyboard-accessible method picker for both capture tools.
export function installCaptureMethods(doc=document){
 const dialog=doc.createElement('dialog');dialog.id='captureMethodDialog';dialog.className='captureMethod';
 dialog.innerHTML='<div class="captureHead"><div><small>CAPTURE</small><h2 id="captureMethodTitle">Screenshot Method</h2></div><button type="button" class="captureClose" aria-label="Close capture method">×</button></div><p>Choose what appears in your capture. Videos stop and save after 1 minute.</p><div class="captureChoices"><button type="button" data-guis="show"><strong>Show GUIs</strong><span>Include game menus and flight information</span></button><button type="button" data-guis="hide"><strong>Hide GUIs</strong><span>Capture only the game world</span></button></div>';
 dialog.setAttribute('aria-labelledby','captureMethodTitle');doc.body.append(dialog);let pending=null,previous;
 const finish=value=>{if(dialog.open)dialog.close();else dialog.removeAttribute('open');const resolve=pending;pending=null;previous?.focus?.();resolve?.(value)};
 dialog.querySelector('.captureClose').onclick=()=>finish(null);
 for(const button of dialog.querySelectorAll('[data-guis]'))button.onclick=()=>finish(button.dataset.guis==='show');
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null)});
 for(const type of ['keydown','keyup','pointerdown','pointerup'])dialog.addEventListener(type,event=>event.stopPropagation());
 return title=>{if(pending)finish(null);previous=doc.activeElement;doc.getElementById('utilityMenu')?.setAttribute('hidden','');doc.getElementById('menuBtn')?.setAttribute('aria-expanded','false');dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=title==='Record Method'?'Choose what appears in your video. Stops and saves after 1 minute.':'Choose what appears in your screenshot.';if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');return new Promise(resolve=>{pending=resolve})};
}

export function recordingMime(Recorder){return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>Recorder.isTypeSupported?.(type))||''}
export function clampRecorder(left,top,width,height,viewportWidth,viewportHeight){return {left:Math.max(0,Math.min(left,viewportWidth-width)),top:Math.max(0,Math.min(top,viewportHeight-height))}}

// Compose the world and GUI separately so recording indicators never enter the video.
export async function createGameRecordingStream({showUI,doc=document,win=window,renderFrame=()=>{},onError=()=>{},captureOverlay=captureGameViewport}){
 const source=doc.getElementById('space'),output=doc.createElement('canvas');if(!source||!output.captureStream)throw Error('Video recording is unavailable in this browser');
 const scale=Math.min(1,1280/(source.width||1280),720/(source.height||720));output.width=Math.max(2,Math.round(source.width*scale));output.height=Math.max(2,Math.round(source.height*scale));const context=output.getContext('2d');if(!context)throw Error('Video canvas unavailable');
 let ended=false,frameTimer,overlayTimer,overlay=null;
 const getOverlay=()=>captureOverlay({doc,win,renderFrame,returnCanvas:true,overlayOnly:true});
 const refreshOverlay=async()=>{try{const next=await getOverlay();if(ended)return;overlay=next;overlayTimer=win.setTimeout(refreshOverlay,250)}catch(error){if(!ended){ended=true;onError(error)}}};
 const paint=()=>{if(ended)return;try{renderFrame();context.drawImage(source,0,0,output.width,output.height);if(overlay)context.drawImage(overlay,0,0,output.width,output.height);frameTimer=win.setTimeout(paint,1000/30)}catch(error){ended=true;onError(error)}};
 if(showUI)overlay=await getOverlay();paint();
 if(ended)throw Error('Could not capture the game view');
 let stream;try{stream=output.captureStream(30)}catch(error){ended=true;win.clearTimeout(frameTimer);throw error}if(showUI)overlayTimer=win.setTimeout(refreshOverlay,250);
 return {stream,cleanup:()=>{ended=true;win.clearTimeout(frameTimer);win.clearTimeout(overlayTimer)}};
}

export function installVideoRecorder(button,{choose,renderFrame,toast,doc=document,win=window,Recorder=win.MediaRecorder,createStream=createGameRecordingStream,download=downloadScreenshot}={}){
 let active=null,starting=false,disposed=false;
 const floating=doc.createElement('div');floating.id='recordingControls';floating.hidden=true;floating.setAttribute('data-html2canvas-ignore','true');floating.innerHTML='<button type="button" class="recordingGrip" aria-label="Drag recording controls" title="Drag to move">⠿</button><button type="button" class="recordingStop"><span class="recordingDot"></span>Stop Recording <time>00:00</time></button>';doc.body.append(floating);const border=doc.createElement('div');border.id='recordingBorder';border.hidden=true;border.setAttribute('aria-hidden','true');border.setAttribute('data-html2canvas-ignore','true');doc.body.append(border);
 const label=()=>{button.textContent=active?'Stop Recording':'System Video Recorder';button.setAttribute('aria-pressed',String(!!active))};label();
 const clamp=()=>{const rect=floating.getBoundingClientRect(),point=clampRecorder(rect.left,rect.top,rect.width,rect.height,win.innerWidth,win.innerHeight);floating.style.left=point.left+'px';floating.style.top=point.top+'px'};
 let drag=null;const grip=floating.querySelector('.recordingGrip');grip.onpointerdown=event=>{event.preventDefault();event.stopPropagation();const rect=floating.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX-rect.left,y:event.clientY-rect.top};grip.setPointerCapture?.(event.pointerId)};grip.onpointermove=event=>{if(!drag||event.pointerId!==drag.id)return;floating.style.left=event.clientX-drag.x+'px';floating.style.top=event.clientY-drag.y+'px';clamp()};grip.onpointerup=grip.onpointercancel=event=>{if(drag?.id===event.pointerId)drag=null};win.addEventListener('resize',clamp);
 for(const type of ['keydown','keyup','pointerdown','pointerup'])floating.addEventListener(type,event=>event.stopPropagation());
 function stop(){const session=active;if(!session||session.stopping)return;session.stopping=true;if(session.recorder.state!=='inactive')session.recorder.stop()}
 floating.querySelector('.recordingStop').onclick=stop;
 button.onclick=async()=>{
  if(active){stop();return}if(starting||disposed)return;starting=true;
  let resource;
  try{if(!Recorder)throw Error('Video recording is unavailable in this browser');const showUI=await choose('Record Method');if(showUI===null||disposed)return;
   resource=await createStream({showUI,doc,win,renderFrame,onError:error=>{toast?.('Recording interrupted · '+error.message);stop()}});
   if(disposed){resource.cleanup();resource.stream.getTracks().forEach(track=>track.stop());return}
   const mimeType=recordingMime(Recorder),recorder=new Recorder(resource.stream,mimeType?{mimeType,videoBitsPerSecond:6000000}:undefined),chunks=[];
   const session={recorder,stopping:false,finished:false,finish:()=>{if(session.finished)return;session.finished=true;win.clearInterval(session.timer);win.clearTimeout(session.limitTimer);resource.cleanup();resource.stream.getTracks().forEach(track=>track.stop());active=null;floating.hidden=true;border.hidden=true;label();if(chunks.length){const type=recorder.mimeType||chunks[0].type||'video/webm';try{download(new Blob(chunks,{type}),'The-Zero-Gravity-Web-'+new Date().toISOString().replace(/[:.]/g,'-')+(type.includes('mp4')?'.mp4':'.webm'),doc);toast?.('Recording saved to your device')}catch(error){toast?.('Could not save recording · '+error.message)}}else toast?.('No video was captured')}};
   recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};recorder.onstop=session.finish;recorder.onerror=()=>{toast?.('Recording failed');stop()};
   for(const track of resource.stream.getVideoTracks())track.addEventListener('ended',stop,{once:true});
   recorder.start(1000);active=session;floating.hidden=false;border.hidden=false;floating.querySelector('time').textContent='00:00';floating.style.left='16px';floating.style.top='80px';clamp();label();const started=Date.now();session.timer=win.setInterval(()=>{const seconds=Math.min(60,Math.floor((Date.now()-started)/1000));floating.querySelector('time').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(seconds>=60)stop()},1000);session.limitTimer=win.setTimeout(()=>{floating.querySelector('time').textContent='01:00';stop()},60000);toast?.('Recording started');
  }catch(error){resource?.cleanup();resource?.stream.getTracks().forEach(track=>track.stop());toast?.(error.name==='NotAllowedError'||error.name==='AbortError'?'Recording cancelled':'Recording failed · '+error.message)}finally{starting=false}
 };
 return {stop,get recording(){return !!active},dispose(){disposed=true;stop();button.onclick=null;win.removeEventListener('resize',clamp);floating.remove();border.remove()}};
}
