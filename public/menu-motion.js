// Animate the existing positioned element with additive translation. No layout or
// transform overrides: centered dialogs and player menu scales stay unchanged.
const states=new WeakMap();
export function menuVisible(node){if(node.hidden||node.tagName==='DIALOG'&&!(node.open||node.hasAttribute('open')))return false;const s=states.get(node);return s?s.visible:!node.hidden&&(node.tagName!=='DIALOG'||node.open||node.hasAttribute('open'))}
export function menuMotion(node,visible,finish=()=>{},axis='y'){
 const old=states.get(node);if(old?.visible===visible&&old.animation)return;
 const current=old?.animation?globalThis.getComputedStyle?.(node).translate:null;old?.animation?.cancel();const state={visible,animation:null};states.set(node,state);
 if(visible)node.hidden=false;
 if(!node.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return}
 const offset=axis==='x'?'110vw 0':'0 110vh',frames=visible?[{translate:current&&current!=='none'?current:offset},{translate:'0 0'}]:[{translate:current&&current!=='none'?current:'0 0'},{translate:offset}];
 const animation=node.animate(frames,{duration:240,easing:'cubic-bezier(.22,.7,.25,1)',fill:'none'});state.animation=animation;
 animation.onfinish=()=>{if(states.get(node)!==state)return;state.animation=null;finish()};
}
export function showMenu(node,axis='y'){menuMotion(node,true,()=>{},axis)}
export function hideMenu(node,axis='y'){if(node.hidden)return;menuMotion(node,false,()=>{node.hidden=true},axis)}
export function closeMenuDialog(node){if(!node.open&&!node.hasAttribute('open'))return;menuMotion(node,false,()=>node.close())}
