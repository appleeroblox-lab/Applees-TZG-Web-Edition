// Elapsed time is independent of the viewer timezone.
export function formatLastOnline(value,online=false,now=Date.now()){
 if(online)return 'Online now';
 if(!value)return 'Unknown';
 const time=new Date(value).getTime();
 if(!Number.isFinite(time))return 'Unknown';
 const seconds=Math.max(0,Math.floor((now-time)/1000));
 const [amount,unit]=seconds<60?[seconds,'sec']:seconds<3600?[Math.floor(seconds/60),'min']:seconds<86400?[Math.floor(seconds/3600),'hour']:[Math.floor(seconds/86400),'day'];
 return 'Last Seen '+amount+' '+unit+(amount!==1&&['hour','day'].includes(unit)?'s':'')+' ago';
}
