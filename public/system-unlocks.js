// Stable progression IDs are shared with the server catalogue. Sol is always free.
export const SYSTEM_ORDER=['Proxima','TRAPPIST-1','Beyond','Nebulae','Procedural','Galaxy:Andromeda','Galaxy:Triangulum','Galaxy:Large Magellanic Cloud','Galaxy:Small Magellanic Cloud','Galaxy:M51','Galaxy:M104','Blackholes','Galaxy:M87'];
export function systemLabel(system){return system==='Sol'?'Solar System':system==='Proxima'?'Proxima Centauri':system==='Blackholes'?'Black Hole Systems':system.replace('Galaxy:','')}
export function systemUnlockQuote(system){
 const index=SYSTEM_ORDER.indexOf(system);if(index<0)return null;
 const blackhole=system==='Blackholes'||system==='Galaxy:M87',tier=blackhole?9:Math.min(8,Math.round(index*8/10));
 return {system,fp:1000+tier*1000,rc:250+tier*250,previous:index?SYSTEM_ORDER[index-1]:'Sol'};
}
export function systemUnlocked(system,unlocked=[]){if(system==='Sol')return true;const index=SYSTEM_ORDER.indexOf(system);return index>=0&&SYSTEM_ORDER.slice(0,index+1).every(id=>unlocked.includes(id))}
export function canUnlockSystem(system,unlocked=[]){const quote=systemUnlockQuote(system);return !!quote&&systemUnlocked(quote.previous,unlocked)}
