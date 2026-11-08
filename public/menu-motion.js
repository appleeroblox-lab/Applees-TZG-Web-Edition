// Animate the existing positioned element with additive translation. No layout or
// transform overrides: centered dialogs and player menu scales stay unchanged.
const states=new WeakMap();
export function menuVisible(node){if(node.hidden||node.tagName==='DIALOG'&&!(node.open||node.hasAttribute('open')))return false;const s=states.get(node);return s?s.visible:!node.hidden&&(node.tagName!=='DIALOG'||node.open||node.hasAttribute('open'))}
export function menuMotion(node,visible,finish=()=>{},axis='y'){
 const old=states.get(node);if(old?.visible===visible&&old.animation)return;
 const property=axis==='scale'?'scale':'translate',current=old?.animation?globalThis.getComputedStyle?.(node)?.[property]:null;old?.animation?.cancel();const state={visible,animation:null};states.set(node,state);
 if(visible)node.hidden=false;
 if(!node.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return}
 const offset=axis==='x'?'110vw 0':axis==='left'?'-110vw 0':'0 110vh',frames=axis==='scale'?(visible?[{scale:current&&current!=='none'?current:'0',opacity:0},{scale:'1',opacity:1}]:[{scale:current&&current!=='none'?current:'1',opacity:1},{scale:'0',opacity:0}]):visible?[{translate:current&&current!=='none'?current:offset},{translate:'0 0'}]:[{translate:current&&current!=='none'?current:'0 0'},{translate:offset}];
 if(node.id==='achievementsMenu'){frames[0].opacity=visible?0:1;frames[1].opacity=visible?1:0}const animation=node.animate(frames,{duration:240,easing:'cubic-bezier(.22,.7,.25,1)',fill:'none'});state.animation=animation;
 animation.onfinish=()=>{if(states.get(node)!==state)return;state.animation=null;finish()};
}
export function showMenu(node,axis='y'){menuMotion(node,true,()=>{},axis)}
export function hideMenu(node,axis='y'){if(node.hidden)return;menuMotion(node,false,()=>{node.hidden=true},axis)}
export function closeMenuDialog(node){if(!node.open&&!node.hasAttribute('open'))return;menuMotion(node,false,()=>node.close())}

export function animateMessage(node){if(!node.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;node.animate([{translate:node.classList.contains('ownMessage')?'28px 0':'-28px 0',opacity:0},{translate:'0 0',opacity:1}],{duration:220,easing:'cubic-bezier(.22,.7,.25,1)'})}
