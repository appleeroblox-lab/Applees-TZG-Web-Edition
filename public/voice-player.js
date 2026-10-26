import {safeVoice} from './voice-message.js?v=86';
const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
const clock=value=>{const t=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
export async function transcribeVoice(value,{language='en',signal,onStatus=()=>{}}={}){
 if(!safeVoice(value))throw Error('Load the voice message first.');
 const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Recognition||!Context||typeof Recognition.available!=='function')throw Error('On-device voice-to-text is unavailable in this browser.');
 const rec=new Recognition();if(!('processLocally' in rec))throw Error('On-device voice-to-text is unavailable in this browser.');
 const lang=({en:'en-US',my:'my-MM',fr:'fr-FR',ja:'ja-JP',th:'th-TH'})[language]||'en-US';
 const available=await Recognition.available({langs:[lang],processLocally:true});
 if(signal?.aborted)throw Error('Transcription cancelled.');
 if(available!=='available'){const error=Error(available==='downloadable'||available==='downloading'?'Install this voice language in your browser before transcribing.':'On-device voice-to-text is unavailable for this language.');if(available==='downloadable')error.code='MODEL_REQUIRED';error.language=lang;throw error}
 let context,source,track,timer;try{
 context=new Context();await context.resume();
 const bytes=Uint8Array.from(atob(value.slice(value.indexOf(',')+1)),char=>char.charCodeAt(0));
 const buffer=await context.decodeAudioData(bytes.buffer);if(signal?.aborted)throw Error('Transcription cancelled.');
 source=context.createBufferSource();source.buffer=buffer;const destination=context.createMediaStreamDestination();source.connect(destination);track=destination.stream.getAudioTracks()[0];
 rec.lang=lang;rec.processLocally=true;rec.continuous=true;rec.interimResults=false;
 return await new Promise((resolve,reject)=>{let done=false,text='';const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);try{rec.abort()}catch{}error?reject(error):resolve(text.trim()||'No speech was recognized.')};const abort=()=>finish(Error('Transcription cancelled.'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort();rec.onresult=event=>{text=Array.from(event.results).filter(row=>row.isFinal).map(row=>row[0].transcript).join(' ')};rec.onerror=event=>finish(Error(event.error==='language-not-supported'?'On-device voice-to-text is unavailable for this language.':'Voice-to-text could not finish. Please retry.'));rec.onend=()=>finish();rec.onstart=()=>{onStatus('Transcribing…');source.start()};source.onended=()=>{try{rec.stop()}catch{}};timer=setTimeout(()=>finish(Error('Voice-to-text timed out.')),Math.max(12000,buffer.duration*1000+15000));try{rec.start(track)}catch{finish(Error('This browser cannot transcribe recorded audio.'))}});
 }finally{clearTimeout(timer);try{source?.stop()}catch{}track?.stop();await context?.close?.()}
}
export function voicePlayer({load,src,preview=false}={}){
 const root=make('section');root.className='voicePlayer';root.setAttribute('aria-label',preview?'Voice preview':'Voice message');
 const audio=make('audio');audio.preload='metadata';audio.hidden=true;if(src)audio.src=src;
 const play=make('button','▶');play.type='button';play.className='voicePlay';play.setAttribute('aria-label','Play voice');
 const seek=make('input');seek.type='range';seek.min=0;seek.max=100;seek.step=.1;seek.value=0;seek.disabled=true;seek.setAttribute('aria-label','Voice playback position');
 const time=make('span','0:00 / 0:00');time.className='voiceTime';time.setAttribute('translate','no');const transcript=make('p');transcript.className='voiceTranscript';transcript.hidden=true;transcript.setAttribute('translate','no');
 const text=make('button','Voice into Text');text.type='button';text.className='voiceToText';text.dataset.uiText='Voice into Text';let loading,disposed=false,controller;
 const ready=async()=>{if(audio.src)return audio.src;if(!loading)loading=Promise.resolve().then(load).then(value=>{if(!safeVoice(value))throw Error('Voice message unavailable.');if(!disposed)audio.src=value;return value}).finally(()=>loading=null);return loading};
 const status=(value,spoken=false)=>{transcript.hidden=false;transcript.textContent=value;if(spoken)delete transcript.dataset.uiText;else transcript.dataset.uiText=value};
 play.onclick=async()=>{play.disabled=true;try{await ready();if(disposed)return;if(audio.paused)await audio.play();else audio.pause()}catch(e){status(e.message)}finally{play.disabled=false}};
 audio.onplay=()=>{play.textContent='❚❚';play.setAttribute('aria-label','Pause voice')};audio.onpause=audio.onended=()=>{play.textContent='▶';play.setAttribute('aria-label','Play voice')};
 const update=()=>{seek.disabled=!Number.isFinite(audio.duration)||audio.duration<=0;seek.value=seek.disabled?0:audio.currentTime/audio.duration*100;time.textContent=clock(audio.currentTime)+' / '+clock(audio.duration)};audio.ontimeupdate=audio.onloadedmetadata=audio.ondurationchange=update;seek.oninput=()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value)/100*audio.duration};
 text.onclick=async()=>{text.disabled=true;controller=new AbortController();try{const value=await ready();if(disposed)return;const result=await transcribeVoice(value,{language:document.documentElement.lang||'en',signal:controller.signal,onStatus:status});if(!disposed)status(result,true)}catch(e){if(!disposed){status(e.message);if(e.code==='MODEL_REQUIRED'&&!root.querySelector('.voiceInstall')){const install=make('button','Install voice language');install.type='button';install.className='voiceInstall';install.dataset.uiText='Install voice language';install.onclick=async()=>{install.disabled=true;try{const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;status('Installing voice language…');if(!await Recognition.install({langs:[e.language],processLocally:true}))throw Error('Voice language installation failed.');install.remove();await text.onclick()}catch(error){status(error.message);install.disabled=false}};root.append(install)}}}finally{text.disabled=false;controller=null}};
 root.append(play,seek,time,text,audio,transcript);root.dispose=()=>{disposed=true;controller?.abort();audio.pause();audio.removeAttribute('src')};return root;
}
export function disposeVoicePlayers(root){for(const player of root?.querySelectorAll?.('.voicePlayer')||[])player.dispose?.()}
export function holdVoiceButton(recorder,{onStart=()=>{},onError=()=>{},onStatus=()=>{}}={}){
 const button=make('button','Hold to record');button.type='button';button.className='voiceRecordHold';button.setAttribute('aria-label','Hold to record voice');let held=false,pointer;
 const release=()=>{if(!held)return;held=false;recorder.requestStop();button.classList.remove('recording');button.textContent='Hold to record';document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel)};
 const up=e=>{if(e.pointerId===pointer)release()},cancel=()=>{if(!held)return;release();recorder.cancel();onStatus('Voice recording cancelled.')};
 const start=async()=>{if(held)return;held=true;onStart();button.classList.add('recording');button.textContent='Release to preview';try{await recorder.start()}catch(e){release();onError(e)}};
 button.onpointerdown=e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();pointer=e.pointerId;document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);start()};
 button.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start()}};button.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release()}};button.oncontextmenu=e=>e.preventDefault();button.dispose=cancel;return button;
}
