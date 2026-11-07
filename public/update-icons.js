// Only named controls use the supplied artwork. HUD status images are explicit
// exceptions to the button-only 85% sizing rule, retaining their original size.
export function installUpdateIcons(doc=document){
 const mappings=[['#achievementsBtn','achievement'],['#dailyRewardsOpen','daily-rewards'],['[data-account-page="security"]','security'],['[data-account-page="data"]','database'],['#gaugeWarpBtn,#warpBtn','warp'],['#boostBtn','boost'],['[data-icon="report"],.reportButton,#debugReportsTab','report']];
 const apply=()=>{for(const [selector,name] of mappings)for(const button of doc.querySelectorAll(selector)){
  const source='icons/ui/update-'+name+'.png';let image=button.querySelector('img');if(button.dataset.updateIcon===name&&image?.getAttribute('src')===source&&button.querySelectorAll('img,svg').length===1)continue;button.dataset.updateIcon=name;
  const label=button.getAttribute('aria-label')||button.textContent.trim()||button.title;button.setAttribute('aria-label',label);button.title||=label;
  if(!image){image=doc.createElement('img');if(['boostBtn','gaugeWarpBtn'].includes(button.id))button.replaceChildren()}for(const old of button.querySelectorAll('img,svg,.uiIcon'))if(old!==image)old.remove();if(!image.classList.contains('previewIcon'))image.classList.add('uiIcon');if(image.parentElement!==button)button.prepend(image);image.src=source;image.alt='';image.setAttribute('aria-hidden','true');image.style.setProperty('filter','none','important');image.style.setProperty('mix-blend-mode','normal','important');
  if(!button.textContent.trim())button.classList.add('iconOnly');
 }
 for(const [selector,name] of [['#temperatureValue','temperature'],['#altitudeValue','altitude'],['#pilotStatus','level']]){const image=doc.querySelector(selector)?.closest('.vitalRow')?.querySelector('img');if(image&& !image.src.includes('update-'+name))image.src='icons/ui/update-'+name+'.png'}
 };
 apply();const Observer=doc.defaultView?.MutationObserver||globalThis.MutationObserver;if(!Observer)return null;let queued=false;const observer=new Observer(()=>{if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;apply()})});observer.observe(doc.body,{childList:true,subtree:true});return observer;
}
