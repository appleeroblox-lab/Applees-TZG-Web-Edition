const LEGACY_KEY='cosmic-flight-v6';
export function flightSaveKey(owner){return owner?LEGACY_KEY+':'+owner:LEGACY_KEY}
export function writeFlightSave(storage,owner,state){
 const checkpoint={...state,owner:owner||'local'};
 storage.setItem(flightSaveKey(owner),JSON.stringify(checkpoint));
 return checkpoint;
}
export function readFlightSave(storage,owner){
 const decode=key=>{try{return JSON.parse(storage.getItem(key))}catch{return null}};
 const state=decode(flightSaveKey(owner));
 if(state){
  if(owner&&state.owner!==owner)return null;
  if(!owner&&state.owner&&state.owner!=='local')return null;
  return state;
 }
 if(!owner)return null;
 // Old shared checkpoints without an owner are ambiguous: keep the backup,
 // but never give one account another player's flight. Proto saves have an ID.
 const legacy=decode(LEGACY_KEY);
 if(!legacy||((legacy.owner??legacy.temporal?.owner)!==owner))return null;
 writeFlightSave(storage,owner,legacy);
 return legacy;
}
