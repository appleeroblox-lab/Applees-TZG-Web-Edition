const enc=new TextEncoder(),COOKIE='__Secure-tzg-debug',PAGE_EXPIRY=Number.MAX_SAFE_INTEGER;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
async function codeHash(code,salt){const key=await crypto.subtle.importKey('raw',enc.encode(code),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
function equal(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
const cookie=value=>`${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/debug${value?'':'; Max-Age=0'}`;
const tokenFrom=request=>(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
import {parseDebugCommand} from '../public/debug-commands.js';
export {parseDebugCommand};
export async function debugRequest(request,env){try{
 const url=new URL(request.url),action=url.pathname.split('/').pop(),db=env.DB,owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to this private Site to use developer tools.'},401);
 if(!db)return json({error:'Developer authorization storage is unavailable.'},503);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Cross-site request rejected.'},403);
 const access=await db.prepare('SELECT * FROM debug_access WHERE id=1').first(),bootstrapOwner=!!env.DEBUG_OWNER_EMAIL&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.DEBUG_OWNER_EMAIL.toLowerCase();
 if(action==='status'&&request.method==='GET')return json({configured:!!access,setupAllowed:!access&&bootstrapOwner&&env.DEBUG_BOOTSTRAP_ENABLED==='1'});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'A same-origin JSON request is required.'},403);
 if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'Request too large.'},413);
 const raw=await request.text();if(raw.length>2048)return json({error:'Request too large.'},413);let data;try{data=JSON.parse(raw)}catch{return json({error:'Invalid JSON.'},400)}
 const page=request.headers.get('X-Debug-Page')||'';if(!/^[a-f0-9]{64}$/.test(page))return json({error:'Reload the page to start a new debug session.'},400);const now=Date.now(),token=tokenFrom(request),tokenHash=token?await digest(token+':'+page):'',session=tokenHash?await db.prepare('SELECT * FROM debug_sessions WHERE hash=? AND owner=? AND expires>?').bind(tokenHash,owner,now).first():null;
 if(action==='logout'){if(tokenHash)await db.prepare('DELETE FROM debug_sessions WHERE hash=? AND owner=?').bind(tokenHash,owner).run();return json({ok:true},200,data.pageExit?{}:{'Set-Cookie':cookie('')})}
 if(action==='setup'||action==='login'){
  const limit=await db.prepare('SELECT * FROM debug_limits WHERE owner=?').bind(owner).first();if(limit&&limit.reset>now&&limit.attempts>=5)return json({error:'Too many attempts. Try again in five minutes.'},429,{'Retry-After':String(Math.max(1,Math.ceil((limit.reset-now)/1000)))});
  await db.prepare('INSERT INTO debug_limits(owner,attempts,reset) VALUES(?,1,?) ON CONFLICT(owner) DO UPDATE SET attempts=CASE WHEN reset<=? THEN 1 ELSE attempts+1 END, reset=CASE WHEN reset<=? THEN ? ELSE reset END').bind(owner,now+300000,now,now,now+300000).run();
  if(typeof data.code!=='string'||data.code.length<12||data.code.length>128)return json({error:'Use an authorization code with 12–128 characters.'},400);
  if(action==='setup'){if(access||!bootstrapOwner||env.DEBUG_BOOTSTRAP_ENABLED!=='1')return json({error:'Initial setup is unavailable.'},403);const salt=random(),hash=await codeHash(data.code,salt);await db.prepare('INSERT OR IGNORE INTO debug_access(id,owner,salt,hash) VALUES(1,?,?,?)').bind(owner,salt,hash).run();const created=await db.prepare('SELECT * FROM debug_access WHERE id=1').first();if(created?.owner!==owner||!equal(created.hash,hash))return json({error:'Authorization was already configured.'},403)}
  else if(!access||access.owner!==owner||!equal(await codeHash(data.code,access.salt),access.hash))return json({error:'Authorization denied.'},403);
  await db.prepare('DELETE FROM debug_limits WHERE owner=?').bind(owner).run();await db.prepare('DELETE FROM debug_sessions WHERE expires<=? OR owner=?').bind(now,owner).run();const value=random();await db.prepare('INSERT INTO debug_sessions(hash,owner,expires) VALUES(?,?,?)').bind(await digest(value+':'+page),owner,PAGE_EXPIRY).run();return json({ok:true,expires:PAGE_EXPIRY},200,{'Set-Cookie':cookie(value)})
 }
 if(!access||access.owner!==owner||!session)return json({error:'Authorization expired. Close and reopen Debug Menu.'},401,{'Set-Cookie':cookie('')});
 if(action==='command'){let command;try{command=parseDebugCommand(data.command)}catch(e){return json({error:e.message},400)}await db.prepare('INSERT INTO debug_audit(id,owner,created,command) VALUES(?,?,?,?)').bind(crypto.randomUUID(),owner,now,JSON.stringify(command)).run();await db.prepare('DELETE FROM debug_audit WHERE id IN (SELECT id FROM debug_audit ORDER BY created DESC LIMIT -1 OFFSET 500)').run();return json({ok:true,command})}
 return json({error:'Not found.'},404)
 }catch{return json({error:'Developer service unavailable. Try again later.'},503)}}
