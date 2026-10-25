export const PAD_RADIUS=8,PAD_HEIGHT=.55;
export const PAD_SIGN={x:16,z:8,yaw:Math.atan2(-16,-8)};
export const CRAFT_LAYOUT={x:-28,z:-38,yaw:Math.PI/2,halfX:4,halfZ:6,frontX:-23.1,frontZ:-38};
export const TRADE_LAYOUT={x:0,z:-45,halfX:6,halfZ:4};
export function padHeightAt(x,z){if(Math.hypot(x,z)<PAD_RADIUS)return PAD_HEIGHT;if(Math.abs(x)<=1.5&&z<=-PAD_RADIUS&&z>=-PAD_RADIUS-3)return PAD_HEIGHT*(1-(-z-PAD_RADIUS)/3);return 0}
export function isSolidBlock(p){return p.type!=='ladder'&&p.type!=='torch'}
export function buildingFootprint(x,z,margin=0){return Math.abs(x-CRAFT_LAYOUT.x)<CRAFT_LAYOUT.halfX+margin&&Math.abs(z-CRAFT_LAYOUT.z)<CRAFT_LAYOUT.halfZ+margin||Math.abs(x-TRADE_LAYOUT.x)<TRADE_LAYOUT.halfX+margin&&Math.abs(z-TRADE_LAYOUT.z)<TRADE_LAYOUT.halfZ+margin}
