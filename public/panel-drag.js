// Measure once per gesture and update only the compositor translation.
export function dragPanel(handle,panel,{margin=0,onEnd,blocked=()=>false}={}){
 let drag=null,frame=null;
 const offset=()=>(panel.style.translate||'').match(/-?[\d.]+/g)?.map(Number)||[0,0];
 const clamp=(value,size,limit)=>Math.max(Math.min(margin,Math.max(0,limit-size)),Math.min(value,limit-size-margin));
 const draw=()=>{
  frame=null;
  if(!drag)return;
  const {x,y,left,top,width,height,baseX,baseY}=drag;
  drag.leftNow=clamp(left+x,width,innerWidth);
  drag.topNow=clamp(top+y,height,innerHeight);
  panel.style.translate=`${baseX+drag.leftNow-left}px ${baseY+drag.topNow-top}px`;
 };
 handle.onpointerdown=e=>{
  if(e.button>0||drag||blocked()||e.target.closest('button,input'))return;
  const {left,top,width,height}=panel.getBoundingClientRect();
  const [baseX,baseY]=offset();
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:0,y:0,left,top,width,height,baseX,baseY};
  panel.style.willChange='translate';
  handle.setPointerCapture?.(e.pointerId);
  e.preventDefault();
 };
 const track=e=>{
  const latest=e.getCoalescedEvents?.().at(-1)||e;
  drag.x=latest.clientX-drag.startX;drag.y=latest.clientY-drag.startY;
 };
 handle.onpointermove=e=>{
  if(drag?.id!==e.pointerId)return;
  track(e);
  if(frame===null)frame=requestAnimationFrame(draw);
 };
 handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=e=>{
  if(drag?.id!==e.pointerId)return;
  if(e.type==='pointerup')track(e);
  if(frame!==null)globalThis.cancelAnimationFrame?.(frame);
  draw();
  const {leftNow,topNow}=drag;
  drag=null;panel.style.willChange='';
  if(onEnd){panel.style.translate='';onEnd(leftNow,topNow);}
 };
 return {get active(){return !!drag;}};
}
