import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const server=http.createServer(async(req,res)=>{try{const file=path.join(process.cwd(),'public',decodeURIComponent(new URL(req.url,'http://localhost').pathname));const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');res.end(await fs.readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const html=(await fs.readFile('public/index.html','utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
await page.route('**/index.html',route=>route.fulfill({body:html,contentType:'text/html'}));
await page.goto(base+'/index.html');
await page.evaluate(async()=>{
 document.body.className='referenceHUD';document.getElementById('boot').style.display='none';document.getElementById('startupIntro')?.remove();
 const [{Achievements},{ACHIEVEMENTS},{CloudSave},{GameSound}]=await Promise.all([import('./achievements.js'),import('./achievement-catalog.js'),import('./cloud-save.js'),import('./sound.js')]);
 window.catalog=ACHIEVEMENTS;window.wallet={fp:500,rc:50,inventory:[]};window.notices=[];window.claimCalls=0;
 window.serverRows=ACHIEVEMENTS.map(a=>({id:a.id,target:a.target,available:+a.id>=61,progress:0,completed_at:null,claimed_at:null}));
 const account=window.account={ready:false,guest:true,loadedId:null,gate:{hidden:true},rpc:async(name)=>{
  if(name==='tzg_achievement_state')return structuredClone(window.serverRows);
  if(name==='tzg_achievement_notices')return window.notices.splice(0);
  if(name==='tzg_achievement_claim'){window.claimCalls++;const ids=window.serverRows.filter(r=>r.completed_at&&!r.claimed_at).map(r=>r.id);let fp=0,rc=0;for(const id of ids){const a=ACHIEVEMENTS.find(a=>a.id===id);fp+=a.fp;rc+=a.rc;window.serverRows.find(r=>r.id===id).claimed_at='now'}return {revision:1,state:{fp:window.wallet.fp+fp,rc:window.wallet.rc+rc,inventory:[]},ids}}
 },applyReward:(fp,rc)=>{window.wallet.fp+=fp;window.wallet.rc+=rc}};
 account.cloud=new CloudSave({rpc:(n,a)=>account.rpc(n,a),userId:'test',snapshot:()=>structuredClone(window.wallet)});account.cloud.hydrate({revision:0});
 window.sound=new GameSound();window.ach=new Achievements({account,sound:window.sound});const {installUITheme}=await import('./ui-theme.js');installUITheme();
});
for(const size of [{width:1280,height:800},{width:844,height:390},{width:667,height:375}]){
 await page.setViewportSize(size);await page.locator('#achievementsBtn').click();
 assert.equal(await page.locator('.achievementCard').count(),80);assert(await page.locator('#achievementsMenu').innerText().then(t=>t.includes('Guests can browse only')));
 const bounds=await page.locator('#achievementsMenu').boundingBox();assert(Math.abs(bounds.x+bounds.width/2-size.width/2)<2,'Menu horizontally centered');assert(Math.abs(bounds.y+bounds.height/2-size.height/2)<2,'Menu vertically centered');if(size.height<500)assert(bounds.width<=460&&bounds.height<=size.height-40,'Compact mobile menu');const buttons=await page.locator('#achievementsBtn').evaluate(n=>{const a=n.getBoundingClientRect(),b=document.querySelector('#accountBtn').getBoundingClientRect();return [a.width,a.height,b.width,b.height]});assert(Math.abs(buttons[0]-buttons[2])<1&&Math.abs(buttons[1]-buttons[3])<1,'Account and achievement button sizes match '+JSON.stringify(buttons));const centeredIcon=await page.locator('#achievementsBtn').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.querySelector('img').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1&&Math.abs(a.y+a.height/2-b.y-b.height/2)<1});assert(centeredIcon,'Achievement icon centered');const ranks=await page.locator('.achievementRarity').allTextContents();const order=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Celestial','Cosmic'];assert(ranks.every((r,i)=>!i||order.indexOf(r)>=order.indexOf(ranks[i-1])),'Ascending rarity');assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width&&bounds.y+bounds.height<=size.height);
 await page.locator('.achievementList').evaluate(n=>{n.scrollTop=n.scrollHeight});assert(await page.locator('.achievementList').evaluate(n=>n.scrollTop>0));
 await page.locator('.achievementTools input').fill('warp');assert((await page.locator('.achievementCard').count())>0);await page.locator('.achievementTools input').fill('');
 await page.locator('.achievementTools select').selectOption('Cosmic');assert.equal(await page.locator('.achievementCard').count(),8);await page.locator('.achievementTools select').selectOption('All');
 const contrast=await page.locator('.achievementRarity').evaluateAll(nodes=>{const light=css=>{const rgb=css.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};return nodes.every(n=>{const s=getComputedStyle(n),a=light(s.color),b=light(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5})});assert(contrast,'Rarity labels retain readable contrast');
 const colors=await page.locator('.achievementCard').first().evaluate(n=>[getComputedStyle(n).borderTopColor,getComputedStyle(n.querySelector('.achievementRarity')).color]);assert.equal(colors[0],colors[1]);
 await page.screenshot({path:'/tmp/tzg-achievements-'+size.width+'.png'});await page.locator('.achievementClose').click();
 await page.locator('#achievementsBtn').click();const toggle=await page.locator('#achievementsBtn').boundingBox();await page.mouse.click(toggle.x+toggle.width/2,toggle.y+toggle.height/2);assert.equal(await page.locator('#achievementsMenu').evaluate(n=>n.open),false);
}
await page.setViewportSize({width:667,height:375});
for(const side of ['left','right']){
 await page.locator('#achievementsBtn').click();await page.locator('#achievementsMenu').evaluate((n,side)=>n.style.setProperty('--achievement-safe-'+side,'44px'),side);
 const r=await page.locator('#achievementsMenu').boundingBox();assert(r.x>=(side==='left'?44:0));assert(r.x+r.width<=667-(side==='right'?44:0));
 await page.locator('.achievementClose').click();await page.locator('#achievementsMenu').evaluate((n,side)=>n.style.removeProperty('--achievement-safe-'+side),side);
}
await page.setViewportSize({width:844,height:390});
await page.evaluate(()=>{account.guest=false;account.ready=true;account.loadedId='test';window.dispatchEvent(new Event('tzg-signed-in'));});
await page.waitForTimeout(400);await page.evaluate(()=>{serverRows.find(r=>r.id==='061').completed_at='now';serverRows.find(r=>r.id==='061').progress=5;notices.push('061','071');window.dispatchEvent(new Event('tzg-play'));});
await page.waitForSelector('.achievementToastIn');assert.equal(await page.locator('.achievementToast strong').textContent(),'Achievement Unlocked!');
await page.waitForFunction(()=>wallet.fp===924);assert.equal(await page.evaluate(()=>claimCalls),1);
await page.evaluate(()=>{const minimap=document.createElement('dialog');minimap.id='achievementTestMinimap';minimap.style='width:100vw;height:100vh;background:#08213a;z-index:2147483647';minimap.textContent='Minimap overlay';document.body.append(minimap);minimap.showModal()});
await page.waitForTimeout(150);
const hit=await page.locator('.achievementToast').evaluate(n=>{const r=n.getBoundingClientRect();return {clickable:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),top:r.top,header:document.querySelector('#gameTop nav').getBoundingClientRect().bottom,transform:getComputedStyle(n).transform}});assert(hit.clickable);assert(hit.top>=hit.header+7);const toastColors=await page.locator('.achievementToast').evaluate(n=>[getComputedStyle(n).borderTopColor,getComputedStyle(n.querySelector('strong')).color]);assert.deepEqual(toastColors,['rgb(169, 176, 188)','rgb(169, 176, 188)']);assert.equal(await page.locator('.achievementToast').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(6, 32, 56)');
await page.screenshot({path:'/tmp/tzg-achievement-toast-minimap.png'});
await page.locator('.achievementToast').click();await page.waitForSelector('.achievementFocus');assert.equal(await page.locator('.achievementFocus').getAttribute('data-achievement'),'061');assert.equal(await page.locator('.achievementToast span span').textContent(),'First Friend');
await page.locator('.achievementToast').click();await page.locator('.achievementClose').click();await page.evaluate(()=>document.querySelector('#achievementTestMinimap').close());
// Real bundled MP3 decode and one Web Audio source after a user gesture.
await page.evaluate(()=>{document.getElementById('achievementsBtn').addEventListener('click',()=>sound.unlock(),{once:true})});await page.locator('#achievementsBtn').click();
await page.evaluate(async()=>{await sound.context.resume();notices.push('062');await ach.refresh()});await page.waitForSelector('.achievementToast');
await page.waitForFunction(()=>[...sound.nodes].some(n=>n.name==='achievement'));assert(await page.evaluate(()=>sound.buffers.has('sounds/achievement-unlocked.mp3')));
await page.evaluate(()=>{sound.enabled=false;sound.refresh();ach.dismissToast();notices.push('063');});await page.evaluate(()=>ach.refresh());await page.waitForSelector('.achievementToast');assert.equal(await page.evaluate(()=>sound.nodes.size),0);
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.achievementToast').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
await page.waitForFunction(()=>!ach.toast,{},{timeout:6500});
await page.evaluate(()=>{account.guest=true;account.ready=false;window.dispatchEvent(new Event('tzg-guest-start'))});assert.equal(await page.locator('.achievementToast').count(),0);
assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS: desktop/mobile, guest, 80 cards, scrolling/search/rarity, bounds, auto-claim, queued clickable top-layer toast over modal minimap, focus, actual MP3 Web Audio, mute and reduced motion');

