const pendingDialogs=new Set();
export function closeChatDialogs(){for(const close of [...pendingDialogs])close(false)}
// In-game action panels keep confirmation and reporting inside the game UI.
export function chatDialog({title,text='',reason=false,submit='Confirm',onSubmit=async()=>{}}){
 return new Promise(resolve=>{
  const root=document.createElement('section');root.className='chatActionDialog';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title);
  const heading=document.createElement('h2');heading.textContent=title;
  const description=document.createElement('p');description.textContent=text;
  const form=document.createElement('form'),input=document.createElement('textarea');input.setAttribute('aria-label','Report reason');input.placeholder='Tell us what happened…';input.maxLength=300;input.required=true;input.rows=3;
  if(reason)form.append(input);
  const status=document.createElement('p');status.setAttribute('role','status');const actions=document.createElement('div');actions.className='messageEditorActions';const cancel=document.createElement('button'),confirm=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';confirm.type='submit';confirm.textContent=submit;actions.append(cancel,confirm);form.append(actions,status);root.append(heading,description,form);const overlay=document.createElement('div');overlay.className='chatActionBackdrop';overlay.append(root);overlay.addEventListener('pointerdown',event=>event.stopPropagation());document.body.append(overlay);
  let busy=false,closed=false;const finish=value=>{if(closed)return;closed=true;pendingDialogs.delete(finish);overlay.remove();previous?.focus?.();resolve(value)},previous=document.activeElement;pendingDialogs.add(finish);
  cancel.onclick=()=>{if(!busy)finish(false)};
  form.onsubmit=async event=>{event.preventDefault();if(busy||closed)return;if(reason&&!input.value.trim()){status.textContent='Please enter a reason.';input.focus();return}busy=true;cancel.disabled=confirm.disabled=true;status.textContent='Working…';try{await onSubmit(input.value.trim());finish(true)}catch(error){if(closed)return;status.textContent=error.message||'Please retry.';busy=false;cancel.disabled=confirm.disabled=false}};
  for(const type of ['keydown','keyup','pointerdown'])root.addEventListener(type,event=>{event.stopPropagation();if(type==='keydown'&&event.key==='Escape'&&!busy)finish(false);if(type==='keydown'&&event.key==='Tab'){const nodes=[...(reason?[input]:[]),cancel,confirm],index=nodes.indexOf(document.activeElement);event.preventDefault();nodes[(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length].focus()}});
  (reason?input:cancel).focus();
 });
}
