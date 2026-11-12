// Mediabunny 1.65.2 (MPL-2.0), bundled unmodified in vendor; loaded only for export.
let toolkit;
const loadToolkit=()=>toolkit??=import('./vendor/mediabunny.min.mjs?v=202').catch(error=>{toolkit=null;throw error});

export function recordingMime(Recorder,audio=true){
 const mp4=audio?['video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1.424028,mp4a.40.2']:['video/mp4;codecs=avc1','video/mp4;codecs=avc1.424028'];
 return [...mp4,'video/mp4','video/webm;codecs=vp8,opus','video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>Recorder.isTypeSupported?.(type))||'';
}

// Rebuild real packet/sample tables, duration and seek indexes after the final chunk.
// Native AVC/AAC MP4 is copied without re-encoding into a regular fast-start MP4.
export async function finalizeRecording(blob,{load=loadToolkit}={}){
 const m=await load(),input=new m.Input({source:new m.BlobSource(blob),formats:[m.MP4,m.WEBM,m.MATROSKA]});
 try{
  const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();if(!video)throw Error('No video frames were recorded');
  const attempt=async(compatible)=>{
   const isMP4=compatible||blob.type.includes('mp4'),target=new m.BufferTarget(),output=new m.Output({target,format:isMP4?new m.Mp4OutputFormat({fastStart:'in-memory'}):new m.WebMOutputFormat()});
   let conversion;
   try{conversion=await m.Conversion.init({input,output,copy:{boundaryPolicy:'expand',boundaryTolerance:.1,shiftTolerance:.1},...(compatible?{video:{codec:'avc'},audio:{codec:'aac'}}:{})});
    // Never silently discard audio or video when an encoder is unavailable.
    if(!conversion.isValid||conversion.discardedTracks.length)throw Error('This browser cannot export all tracks in MP4');
    await conversion.execute();if(!target.buffer?.byteLength)throw Error('Empty recording export');
    return new Blob([target.buffer],{type:isMP4?'video/mp4':'video/webm'});
   }catch(error){try{await conversion?.cancel()}catch{}try{await output.cancel()}catch{}throw error}
  };
  const compatible=(await video.getCodec()==='avc'||await m.canEncodeVideo('avc'))&&(!audio||await audio.getCodec()==='aac'||await m.canEncodeAudio('aac'));
  if(compatible){try{return await attempt(true)}catch{}}return await attempt(false);
 }finally{input.dispose()}
}
