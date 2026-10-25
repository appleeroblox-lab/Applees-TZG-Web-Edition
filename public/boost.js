export const BOOST_SECONDS=20,BOOST_COOLDOWN=3;
export class ShipBoost{
 constructor(){this.selected=false;this.active=false;this.remaining=BOOST_SECONDS;this.cooldown=0}
 toggle(){if(this.cooldown>0)return false;if(this.selected){this.selected=false;if(this.active){this.active=false;this.cooldown=BOOST_COOLDOWN}}else{this.selected=true;this.remaining=BOOST_SECONDS}return true}
 step(dt,thrust,eligible=true){if(this.cooldown>0)this.cooldown=Math.max(0,this.cooldown-dt);if(!eligible){if(this.active){this.active=false;this.selected=false;this.cooldown=BOOST_COOLDOWN}return false}if(this.selected&&thrust&&this.cooldown===0)this.active=true;if(this.active){this.remaining=Math.max(0,this.remaining-dt);if(this.remaining<=1e-8){this.remaining=0;this.active=false;this.selected=false;this.cooldown=BOOST_COOLDOWN}}return this.active&&this.selected&&thrust}
}
