// Keep existing jump/stick preferences when adding independently sized ship controls.
export function installControlSizes(doc,storage){
 const specs={jump:{value:76,min:48,max:112,css:'--jump-size'},run:{value:48,min:36,max:100,css:'--run-size'},stick:{value:91,min:60,max:140,css:'--stick-size'},shipLeft:{value:100,min:60,max:140,css:'--ship-left-scale'},shipRight:{value:100,min:60,max:140,css:'--ship-right-scale'}};
 const clamp=(value,spec)=>Math.max(spec.min,Math.min(spec.max,value));
 if(!storage)try{storage=globalThis.localStorage}catch{}
 let saved;try{saved=JSON.parse(storage.getItem('zero-gravity-controls'))}catch{}
 const sizes={};
 const apply=(key)=>{const spec=specs[key],ship=key.startsWith('ship');doc.body.style.setProperty(spec.css,ship?String(sizes[key]/100):sizes[key]+'px');doc.getElementById(key+'Size').value=sizes[key];doc.getElementById(key+'SizeValue').textContent=sizes[key]+(ship?'%':' px')};
 for(const [key,spec] of Object.entries(specs)){
  sizes[key]=Number.isFinite(saved?.[key])?clamp(saved[key],spec):spec.value;
  apply(key);
  doc.getElementById(key+'Size').oninput=e=>{const value=Number(e.target.value);if(!Number.isFinite(value))return;sizes[key]=clamp(value,spec);apply(key);try{storage.setItem('zero-gravity-controls',JSON.stringify(sizes))}catch{}};
 }
 return sizes;
}
