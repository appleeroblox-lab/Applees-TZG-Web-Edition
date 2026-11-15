export function guestProfile(displayName){const d=document.createElement('dialog');d.className='guestPublicProfile';const close=document.createElement('button');close.textContent='✕';close.type='button';close.onclick=()=>d.close();const name=document.createElement('strong');name.textContent=displayName;const tag=document.createElement('span');tag.className='guestTag';tag.textContent='Guest';d.append(close,name,tag);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();}
export function storedGuestName(){try{const n=(localStorage.getItem('tzg-guest-display-name')||'').trim();return n.length>=2&&n.length<=32?n:''}catch{return ''}}
export function askGuestName(current=storedGuestName(),required=false){
 return new Promise(resolve=>{
 const d=document.createElement('dialog');d.id='guestNamePrompt';d.className='guestNameDialog';d.setAttribute('aria-labelledby','guestNameTitle');
 const h=document.createElement('h2');h.id='guestNameTitle';h.textContent=current?'Guest Display Name':'Welcome, Explorer!';
 const help=document.createElement('p');help.className='guestNameHelp';help.textContent='Choose a name for our Global Chat. Your name is saved on this device.';
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button'),cancel=document.createElement('button'),actions=document.createElement('div'),status=document.createElement('p');
 label.textContent='Display name';input.value=current;input.placeholder='Your explorer name';input.setAttribute('aria-label','Display name');input.minLength=2;input.maxLength=32;input.required=true;input.autocomplete='nickname';label.append(input);
 status.className='guestNameStatus';status.setAttribute('role','status');actions.className='guestNameActions';
 save.textContent=required?'Play as Guest':'Save name';save.type='submit';cancel.textContent='Cancel';cancel.type='button';
 let done=false;const finish=value=>{if(done)return;done=true;d.close();d.remove();resolve(value)};
 cancel.onclick=()=>finish(null);d.addEventListener('cancel',e=>{e.preventDefault();finish(null)});
 form.onsubmit=e=>{e.preventDefault();const name=input.value.trim().replace(/[\u0000-\u001f\u007f]/g,'');if(name.length<2||name.length>32){status.textContent='Use 2–32 characters for your name.';input.focus();return}try{localStorage.setItem('tzg-guest-display-name',name)}catch{}finish(name)};
 actions.append(cancel,save);form.append(label,status,actions);d.append(h,help,form);
 for(const type of ['keydown','keyup','pointerdown'])d.addEventListener(type,e=>e.stopPropagation());
 document.body.append(d);d.showModal();input.focus();
 })
}
