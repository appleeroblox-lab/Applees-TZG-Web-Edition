// Secondary fingers do not consistently receive a native click on mobile browsers.
// Track each tap separately; scrolling, held controls and desktop clicks stay native.
export function installTouchButtons(doc,win){
 const taps=new Map();let recent=[],activating=false;
 const buttonFor=e=>e.target?.closest?.('button');
 const identity=button=>button?.id||button?.getAttribute('aria-label')||button?.textContent;
 doc.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  const button=buttonFor(e);
  if(!button||button.disabled||button.onpointerdown||button.closest('.dragHandle'))return;
  taps.set(e.pointerId,{button,x:e.clientX,y:e.clientY});
 },true);
 doc.addEventListener('pointermove',e=>{const tap=taps.get(e.pointerId);if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>12)taps.delete(e.pointerId)},true);
 doc.addEventListener('pointerup',e=>{
  const tap=taps.get(e.pointerId);taps.delete(e.pointerId);
  if(!tap||tap.button.disabled||!tap.button.isConnected||buttonFor(e)!==tap.button||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>12)return;
  // Equip handlers rebuild both inventory and hotbar. Keep gesture identity,
  // rather than a WeakMap entry tied to the button that is about to disappear.
  recent=recent.filter(t=>Date.now()-t.time<1000);
  recent.push({id:e.pointerId,x:e.clientX,y:e.clientY,time:Date.now(),button:tap.button,key:identity(tap.button)});
  activating=true;
  try{tap.button.click()}finally{activating=false}
 },true);
 doc.addEventListener('click',e=>{
  const button=buttonFor(e);
  if(activating||e.pointerType==='mouse'||e.pointerType==='pen')return;
  const touch=e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents;
  if(!touch&&!(e.detail>0))return; // Retain keyboard and programmatic activation.
  const duplicate=recent.some(t=>Date.now()-t.time<1000&&(
   (touch&&e.pointerId===t.id)||
   Math.hypot(e.clientX-t.x,e.clientY-t.y)<25||
   (button&&(button===t.button||identity(button)===t.key))));
  if(duplicate){e.preventDefault();e.stopImmediatePropagation()}
 },true);
 const cancel=e=>taps.delete(e.pointerId);
 doc.addEventListener('pointercancel',cancel,true);
 doc.addEventListener('lostpointercapture',cancel,true);
 win.addEventListener('blur',()=>taps.clear());
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)taps.clear()});
}
