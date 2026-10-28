export const ATMOSPHERE_HEIGHT=2500,LANDING_HEIGHT=800,SPACE_METERS_PER_UNIT=100000;
export const LANDING_MESSAGE='Descend below 800m to land.';
export function hasAtmosphere(body){return !!body&&(body.hasAtmosphere===true||['Earth','Venus','Mars','Titan','Proxima b','Proxima d'].includes(body.name)||/GAS GIANT|ICE GIANT/.test(body.type||''))}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// Anticipate the upper cap before crossing 800m; no velocity reset at the boundary.
export function atmosphereSpeedCap(body,altitude){return hasAtmosphere(body)?450-250*smooth(600,800,altitude):450}
export function entryEffects(body,altitude,speed,vertical=0){if(!hasAtmosphere(body)||altitude>=ATMOSPHERE_HEIGHT)return {plasma:0,wind:0,shake:0,exit:false};const motion=smooth(35,190,speed),exit=vertical>1,envelope=smooth(800,1000,altitude)*(1-smooth(1500,2500,altitude));const plasma=envelope*motion*(exit?.14:1);return {plasma,wind:motion*(1-smooth(1800,2500,altitude))*(exit?.22:.65),shake:plasma*(exit?.2:1),exit}}

// Gas worlds keep their radial interior; normalize its compressed outer shell to the same effect band.
export function atmosphereAltitude(session){if(session?.active&&session.body?.solid===false&&hasAtmosphere(session.body))return Math.max(0,Math.min(2500,(session.coreDistance-104)/Math.max(1,session.exitDistance-104)*2500));return session?.altitude||0}
