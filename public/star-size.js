// Rendering only: catalog radii, orbital coordinates and travel units stay unchanged.
export function starVisualRadius(star,bodies=[]){
 const stars=bodies.filter(b=>b.type==='STAR'&&b.system===star.system);
 const planets=bodies.filter(b=>b.system===star.system&&(/PLANET|GIANT/.test(b.type))&&!b.parent&&stars.every(s=>s===star||b.pos.distanceToSquared(star.pos)<=b.pos.distanceToSquared(s.pos)));
 const largest=Math.max(0,...planets.map(b=>b.r));
 const separation=Math.min(Infinity,...planets.map(b=>b.pos.distanceTo(star.pos)-b.r));
 return Math.max(star.r,Math.min(Math.max(star.r*1.8,largest*1.8),separation*.35));
}
