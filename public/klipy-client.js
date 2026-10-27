let connection;
export const klipyImage=value=>typeof value==='string'&&value.length<=2048&&/^https:\/\/static[12]?\.klipy\.com\/[A-Za-z0-9._~%/-]+\.gif(?:\?[A-Za-z0-9._~%&=+;:@,/?!-]*)?$/.test(value);
export function configureKlipy(getConnection){connection=getConnection}
export const hasKlipy=()=>!!connection;
async function invoke(body,{signal}={}){
 const account=connection?.();if(!account?.client)throw Error('Sign in to browse KLIPY.');
 const {data,error}=await account.client.auth.getSession();if(error||!data?.session?.access_token)throw Error('Sign in to browse KLIPY.');
 const response=await fetch(account.config.url+'/functions/v1/klipy-gifs',{method:'POST',signal,credentials:'omit',headers:{'Content-Type':'application/json',apikey:account.config.publishableKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)});
 let result;try{result=await response.json()}catch{throw Error('Deploy the klipy-gifs function in Supabase first.')}
 if(!response.ok)throw Error(result.error||'KLIPY is unavailable. Please retry.');return result;
}
export async function searchKlipy(query,{signal,page=0,seen=[]}={}){const body=await invoke({action:'search',q:String(query||'').slice(0,80),page:page+1},{signal});const exclude=new Set(seen);return(body.items||[]).filter(item=>item.source==='klipy'&&klipyImage(item.url)&&klipyImage(item.preview)&&!exclude.has(item.url))}
export async function chooseKlipy(item,{signal}={}){if(item.source!=='klipy'||!klipyImage(item.url))throw Error('Invalid KLIPY GIF.');await invoke({action:'share',slug:item.slug,q:item.query||''},{signal});return{klipyUrl:item.url}}
