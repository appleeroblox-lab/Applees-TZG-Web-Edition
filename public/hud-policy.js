// Keep a single nearby, visible mineral label in the play area.
export function focusedMineral(items){return items.filter(n=>n.hp>0&&n.distance<=18&&n.z<0&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&Math.abs(n.x)<.78&&Math.abs(n.y)<.58).sort((a,b)=>(a.x*a.x+a.y*a.y+a.distance*.015)-(b.x*b.x+b.y*b.y+b.distance*.015))[0]?.id??null}
