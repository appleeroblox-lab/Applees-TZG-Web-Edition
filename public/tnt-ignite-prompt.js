import {blockBounds} from './door-rules.js';
export function nearestIgnitableTNT(economy,surface,crew){
 if(!crew.onFoot||!surface.active||!surface.body?.solid||economy.held?.type!=='torch')return null;
 const eye=crew.eye();let result=null,best=Infinity;
 for(const placement of economy.placements){if(placement.type!=='tnt'||placement.body!==surface.body.id||Number.isFinite(placement.fuse))continue;const box=blockBounds(placement),distance=Math.hypot(...['x','y','z'].map(k=>eye[k]-Math.max(box.min[k],Math.min(box.max[k],eye[k]))));if(distance<=5&&distance<best){result=placement;best=distance}}
 return result;
}
export function installTNTIgnitePrompt({doc=document,economy,surface,crew,blocked,onIgnite=()=>{},notify=()=>{}}){
 const button=doc.createElement('button');button.id='igniteTNTButton';button.type='button';button.textContent='Ignite TNT';button.setAttribute('aria-label','Light nearby TNT fuse');button.hidden=true;
 button.style.cssText='position:fixed;left:50%;transform:translateX(-50%);z-index:80;min-height:32px;padding:5px 12px;border:2px solid #d5f3ff;border-radius:8px;background:#197cab;color:white;font:14px Fredoka,sans-serif;touch-action:none';doc.body.append(button);
 const update=()=>{const target=!blocked()&&nearestIgnitableTNT(economy,surface,crew);button.hidden=!target;if(target){const rect=doc.getElementById('gearBar')?.getBoundingClientRect();button.style.bottom=rect&&rect.top>0?Math.max(12,(doc.defaultView?.innerHeight||globalThis.innerHeight||390)-rect.top+8)+'px':'150px'}return target;};
 button.onclick=()=>{const target=update();if(!target)return false;const ok=economy.igniteTNT(target.id,surface.body,crew.eye(),crew.onFoot);if(ok){onIgnite();notify('TNT lit · 4 seconds · move away')}update();return ok};
 return {button,update};
}
