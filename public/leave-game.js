// Commit pending progress before navigating away. A failed save keeps the page
// available for retry rather than dropping unsaved inventory or currency.
export function installLeaveGame(button,{save,flush=async()=>{},onLeave=()=>{},close=()=>window.close(),closed=()=>window.closed,exit=()=>location.replace(new URL('exit.html',location.href).href),schedule=setTimeout,notify=()=>{}}){
 let busy=false;
 button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;
  try{save();await flush()}catch(error){busy=false;button.disabled=false;notify(error?.message||'Progress could not be saved. Please reconnect and try Leave again.');return}
  onLeave();try{close()}catch{}
  schedule(()=>{if(!closed())exit()},180);
 };
 return{get busy(){return busy}};
}
