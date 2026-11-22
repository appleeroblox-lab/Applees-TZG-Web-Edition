// Native scrolling can be suppressed when another finger owns a touch-action:none control.
// Scroll the second pointer explicitly, without replacing ordinary single-finger scrolling.
export function installMobileInput(doc,win){const down=new Set(),scrolls=new Map(),captures=new Map(),scrollSelector='#inventoryGrid,#catalog,.cargoGrid,#debugContent main,#debugAuth,#hotbar,.craftGrid';
 doc.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const secondary=down.size>0;down.add(e.pointerId);const el=e.target.closest?.(scrollSelector);if(!secondary||!el)return;scrolls.set(e.pointerId,{el,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragging:false});e.preventDefault()},true);
 doc.addEventListener('pointermove',e=>{const s=scrolls.get(e.pointerId);if(!s)return;if(!s.dragging){if(Math.hypot(e.clientX-s.startX,e.clientY-s.startY)<12)return;s.dragging=true;s.el.setPointerCapture?.(e.pointerId)}const dx=e.clientX-s.x,dy=e.clientY-s.y;if(s.el.id==='hotbar')s.el.scrollLeft-=dx;else s.el.scrollTop-=dy;s.x=e.clientX;s.y=e.clientY;e.preventDefault()}, {capture:true,passive:false});
 const release=e=>{down.delete(e.pointerId);scrolls.delete(e.pointerId)};doc.addEventListener('pointerup',release,true);doc.addEventListener('pointercancel',release,true);doc.addEventListener('gotpointercapture',e=>captures.set(e.pointerId,e.target),true);
 doc.addEventListener('lostpointercapture',e=>{if(captures.get(e.pointerId)===e.target)captures.delete(e.pointerId)},true);
 function reset(){
  down.clear();scrolls.clear();
  const held=[...captures];captures.clear();
  for(const [id,element] of held){try{if(element.hasPointerCapture?.(id))element.releasePointerCapture(id)}catch{}}
 }
 win.addEventListener('blur',reset);
 doc.addEventListener('touchstart',e=>{if(e.target.closest?.('#moveStick,#lookStick,#flightPad,#upBtn,#downBtn,#walkJump,#walkRun,#reversePad,#forwardPad,#brakePad'))e.preventDefault()}, {passive:false});
 doc.addEventListener('contextmenu',e=>{if(e.target.closest?.('button,.stick,canvas')){e.preventDefault();if(!e.target.closest?.('canvas'))e.stopImmediatePropagation()}},true);
 doc.addEventListener('dragstart',e=>{if(!e.target.closest?.('input,textarea'))e.preventDefault()},true);
 return {down,scrolls,reset,keepCapture(el,e){if(e.type!=='lostpointercapture'||!down.has(e.pointerId))return false;try{el.setPointerCapture(e.pointerId)}catch{}return true}};
}
