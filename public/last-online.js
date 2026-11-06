// Dates are stored as instants; the viewer's browser chooses its own timezone.
export function formatLastOnline(value,online=false){
 if(online)return 'Online now';
 if(!value)return 'Unknown';
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unknown';
}
