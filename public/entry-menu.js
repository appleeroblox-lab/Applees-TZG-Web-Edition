export const RULES_VERSION='2026-11-13-scroll';
export const GAME_RULES=[
 ['Respect Other Players',['Treat everyone with respect.','Harassment, bullying, discrimination, threats, and hate speech are prohibited.',"Do not intentionally disturb or ruin other players’ experiences."]],
 ['Chat & Communication',['No spamming, flooding, or excessive repeated messages.','No inappropriate, sexual, hateful, or extremely offensive content.','Do not advertise unrelated websites, games, or services without permission.',"Do not share anyone’s private information.",'Impersonating developers, moderators, or other players is prohibited.']],
 ['Cheating & Exploiting',['Using cheats, exploits, unauthorized scripts, or modified clients to gain unfair advantages is prohibited.','Do not abuse bugs to duplicate items, currencies, or rewards.','Report serious vulnerabilities instead of exploiting them.']],
 ['Accounts & Security',['You are responsible for keeping your account secure.',"Do not attempt to access another player’s account.",'Account stealing, phishing, and impersonation are prohibited.','Do not sell, purchase, or trade game accounts.','Creating alternative accounts to evade bans is prohibited.']],
 ['Game Economy & Trading',['Scamming players during trades is prohibited.','Do not exploit the FlightPoints, RocketCoin, or GalaxyToken systems.','Using unauthorized methods to generate currencies or items is prohibited.',"Trades must follow the game’s supported trading system."]],
 ['Multiplayer & Social Features',['Respect other players in global chat, friendships, and groups.','Do not abuse reports or submit intentionally false accusations.','Do not use social features to harass, threaten, or scam others.']],
 ['Bugs & Glitches',['Report major bugs to the development team.','Do not intentionally crash, overload, or disrupt game servers.','Exploiting bugs for personal gain may result in penalties.']],
 ['Moderation & Enforcement',['Warning','Temporary communication restrictions','Temporary account suspension','Permanent account ban']],
 ['Updates & Changes',['Game rules may be updated as new features are introduced.','Players are expected to follow the latest published rules.','Continued use of the game after updated rules take effect constitutes acceptance of those rules.']]
];
export function installEntryMenu(root,flow){
 const doc=root.ownerDocument,$=id=>root.querySelector('#'+id),storage=()=>doc.defaultView?.localStorage||globalThis.localStorage;
 $('gameRulesDialog')?.remove();const box=$('accountRulesAccepted');let verified=root.rulesConsentVersion===RULES_VERSION;try{verified=verified||storage()?.getItem('tzg-rules-accepted')===RULES_VERSION}catch{}box.checked=verified;box.setAttribute('aria-label','Read and accept the game rules');
 root.append(root.querySelector('.entryRules'));
 if(!root.querySelector('.entryLegalLinks')){
 const links=doc.createElement('nav');links.className='entryLegalLinks';links.setAttribute('aria-label','Privacy and terms');links.style.cssText='display:flex;justify-content:center;gap:16px;margin-top:4px;font-size:inherit';
 for(const [label,path] of [['Privacy Policy','./privacy.html'],['Terms of Service','./terms.html']]){const a=doc.createElement('a');a.textContent=label;a.href=path;a.target='_blank';a.rel='noopener';a.style.cssText='color:#9cddff;text-decoration:underline';links.append(a)}
 root.querySelector('.entryRules').append(links);
 }
 const refresh=()=>{for(const id of ['accountGoogle','accountCreate','accountEmailLogin','entryGuest','accountGuest','accountSubmit','accountContinue','signupEmailContinue','signupSkipEmail'])$(id).disabled=!box.checked;};
 box.onchange=()=>{if(box.checked&&!verified)box.checked=false;root.rulesConsentVersion=box.checked?RULES_VERSION:null;try{if(box.checked)storage()?.setItem('tzg-rules-accepted',RULES_VERSION);else storage()?.removeItem('tzg-rules-accepted')}catch{}refresh()};
 root.rulesAllowed=()=>{if(box.checked&&verified)return true;flow.status('Please read and accept the rules before continuing.');box.focus?.();return false};
 $('entryGuest').onclick=()=>{if(root.rulesAllowed())$('accountGuest').click()};
 $('accountCreate').onclick=()=>{if(!root.rulesAllowed())return;root.dataset.entry='form';flow.setMode('signup');$('accountName').focus?.()};
 $('accountEmailLogin').onclick=()=>{if(!root.rulesAllowed())return;root.dataset.entry='form';flow.setMode('login');$('accountEmail').focus?.()};
 $('entryBack').onclick=()=>{if(flow.busy)return;root.dataset.entry='welcome';flow.setMode('login')};
 $('accountGoogle').onclick=()=>flow.google();
 $('accountRulesLink').onclick=()=>{
 let dialog=$('gameRulesDialog');if(!dialog){dialog=doc.createElement('dialog');dialog.id='gameRulesDialog';dialog.setAttribute('aria-label','Official Game Rules');dialog.innerHTML='<div class="rulesHeader"><h2>Official Game Rules</h2><button type="button" class="entryClose" aria-label="Close rules">✕</button></div><div class="rulesContent"><section class="rulesPage"><h3>Welcome, Explorer!</h3><p>By playing The Zero Gravity – Web Edition, you agree to follow these rules to help maintain a safe, friendly, and fair gaming environment.</p></section></div><div class="rulesActions"><p id="rulesScrollHint">Scroll to the end to accept the rules.</p><button type="button" id="rulesAccept" disabled>Accept</button></div>';
 const content=dialog.querySelector('.rulesContent');GAME_RULES.forEach(([title,items],i)=>{const section=doc.createElement('section');section.className='rulesPage';const heading=doc.createElement('h3');heading.textContent=(i+1)+'. '+title;section.append(heading);if(i===7){const p=doc.createElement('p');p.textContent='Violations may result in:';section.append(p)}const list=doc.createElement('ul');items.forEach(text=>{const li=doc.createElement('li');li.textContent=text;list.append(li)});section.append(list);if(i===7){const p=doc.createElement('p');p.textContent='Penalties depend on the severity and frequency of violations. Serious violations may result in an immediate permanent ban.';section.append(p)}content.append(section)});
 const acknowledgement=doc.createElement('section');acknowledgement.className='rulesPage';acknowledgement.innerHTML='<h3>Your agreement</h3><p>By selecting “I have read and agree to the rules,” you acknowledge that you have read and agree to follow these Game Rules.</p><p>Game: The Zero Gravity – Web Edition<br>Developer: Meowple Studios</p>';content.append(acknowledgement);
 root.append(dialog);content.tabIndex=0;content.setAttribute('role','region');content.setAttribute('aria-label','Scroll through the game rules');
 const accept=$('rulesAccept');let reached=false;
 const check=()=>{if(content.clientHeight>0&&content.scrollTop+content.clientHeight>=content.scrollHeight-8){reached=true;accept.disabled=false;$('rulesScrollHint').textContent='You have reached the end of the rules.'}};
 content.addEventListener('scroll',check);dialog.checkRulesEnd=check;
 accept.onclick=()=>{if(!reached)return;verified=true;box.checked=true;box.onchange();if(dialog.close)dialog.close();else dialog.removeAttribute('open');};
 dialog.querySelector('.entryClose').onclick=()=>{if(dialog.close)dialog.close();else dialog.removeAttribute('open')};for(const type of ['keydown','keyup','pointerdown'])dialog.addEventListener(type,e=>e.stopPropagation());}
 if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');doc.defaultView?.requestAnimationFrame?.(()=>dialog.checkRulesEnd?.());
 };box.onclick=e=>{if(!verified){e.preventDefault();box.checked=false;$('accountRulesLink').onclick()}};refresh();return refresh;
}
