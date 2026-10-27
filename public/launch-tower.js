// Shared dimensions for the visible launch tower and its individual solid parts.
export const TOWER_PARTS=[
 {size:[6,50,6],position:[-32,25,-15],paint:false},
 ...Array.from({length:5},(_,i)=>({size:[9,.6,9],position:[-32,5+i*9,-15],paint:true})),
 {size:[27,2,3],position:[-20,40,-15],paint:false}
];
