export function formatOnlineCount(value){
 const n=Math.max(0,Math.floor(Number(value)||0));
 if(n<1000)return String(n);
 const divisor=n<1000000?1000:1000000,unit=n<1000000?'k':'m';
 const scaled=n/divisor;
 return Number(scaled.toFixed(scaled<10?2:1))+unit;
}
