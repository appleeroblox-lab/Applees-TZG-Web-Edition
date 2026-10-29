import {atmosphereProfile} from './atmosphere-profiles.js?v=117';
export const ATMOSPHERE_HEIGHT=5000,LANDING_HEIGHT=800,SPACE_METERS_PER_UNIT=100000;
export const LANDING_MESSAGE='Descend below 800m to land.';
export function hasAtmosphere(body){return !!body&&(body.hasAtmosphere===true||!!atmosphereProfile(body)||/GAS GIANT|ICE GIANT/.test(body.type||''))}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// Anticipate the upper cap before crossing 800m; no velocity reset at the boundary.
export function atmosphereSpeedCap(body,altitude,vertical=0){if(!hasAtmosphere(body))return 450;if(altitude>=800)return 100;return vertical>0?450-350*smooth(600,800,altitude):450}
export const PLANET_VIEW_RADIUS=120000;
// Match the apparent planet size on both sides of the surface/space handoff.
export function atmosphereBoundary(body){return body?.solid&&hasAtmosphere(body)?body.r*(1+ATMOSPHERE_HEIGHT/PLANET_VIEW_RADIUS):body.r}
export function transitionState(altitude){return {terrain:1-smooth(4000,5000,altitude),planet:smooth(4000,5000,altitude),space:smooth(600,3000,altitude)}}
export function entryEffects(body,altitude,speed,vertical=0){
 if(!hasAtmosphere(body)||altitude>=ATMOSPHERE_HEIGHT||altitude<=800)return {plasma:0,wind:0,shake:0,exit:false};
 const motion=smooth(35,100,speed),exit=vertical>1,envelope=smooth(800,1000,altitude)*(1-smooth(1500,5000,altitude));
 const plasma=envelope*motion*(exit?.12:1),wind=motion*(1-smooth(3000,5000,altitude))*(exit?.18:.65);
 return {plasma,wind,shake:plasma*(exit?.35:1),exit}
}

// Gas worlds keep their radial interior; normalize its compressed outer shell to the same effect band.
export function atmosphereAltitude(session){if(session?.active&&session.body?.solid===false&&hasAtmosphere(session.body))return Math.max(0,Math.min(ATMOSPHERE_HEIGHT,(session.coreDistance-104)/Math.max(1,session.exitDistance-104)*ATMOSPHERE_HEIGHT));return session?.altitude||0}

// Leave room for the chase camera and ship outside the ordinary space sphere.
export function surfaceExitRadius(body){return Math.max(atmosphereBoundary(body)+.05,body.r+Math.max(20,body.r*.15))}
export function canLandHere(session){return !!(session?.active&&session.body?.solid&&session.body.landable!==false&&!session.onGround&&!session.crew?.onFoot&&session.phase!=='countdown'&&session.phase!=='descending'&&(!hasAtmosphere(session.body)||session.altitude<LANDING_HEIGHT))}
export function advanceLocalDay(session,transition){return !!(session?.active&&session.body?.name==='Earth'&&session.altitude<=4000&&transition?.cover?.mode!=='orbit')}
