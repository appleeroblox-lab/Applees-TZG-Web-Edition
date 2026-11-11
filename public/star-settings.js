// 100% matches the previous 320% image size; world and map remain independent.
export const STAR_EFFECT_BASE_SCALE=3.2;
export const starSettings={worldBloom:100,mapBloom:100,worldFlare:100};
export function starEffectStyle(radius,map=false){const bloom=Math.max(0,Math.min(300,Number(map?starSettings.mapBloom:starSettings.worldBloom)||0))/100,flare=map?0:Math.max(0,Math.min(300,Number(starSettings.worldFlare)||0))/100;return {bloomSize:radius*2*1.4*STAR_EFFECT_BASE_SCALE*bloom,flareSize:radius*2*2*STAR_EFFECT_BASE_SCALE*flare,bloomOpacity:Math.min(.75,.46*Math.sqrt(bloom)),flareOpacity:Math.min(.5,.24*Math.sqrt(flare))};}
export function installStarSettings(doc){
 const section=doc.getElementById('graphicsPreset')?.closest('.settingsSection')||doc.querySelector('#settingsContent .settingsSection');if(!section)return;
 for(const [id,key,label]of [['worldStarBloomIntensity','worldBloom','World Star Bloom Intensity'],['universeStarBloomIntensity','mapBloom','Universe Map Star Bloom Intensity'],['starFlareIntensity','worldFlare','Star Flare Intensity']]){
  if(doc.getElementById(id))continue;const row=doc.createElement('label'),input=doc.createElement('input'),out=doc.createElement('output');row.append(doc.createTextNode(label));input.id=id;input.type='range';input.min='0';input.max='300';input.step='5';input.value='100';input.setAttribute('aria-label',label);out.textContent='100%';row.append(out,input);section.append(row);
  input.oninput=()=>{starSettings[key]=Math.max(0,Math.min(300,Number(input.value)||0));out.textContent=starSettings[key]+'%';doc.defaultView?.dispatchEvent(new doc.defaultView.Event('tzg-star-settings'));};
 }
}
