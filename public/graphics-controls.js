import {GRAPHICS_MODES} from './graphics-policy.js?v=110';
export function ensureGraphicsControls(doc){
 const slider=doc.getElementById('graphicsSlider');if(slider){slider.max='4';slider.closest('label')?.setAttribute('hidden','')}
 let preset=doc.getElementById('graphicsPreset');if(!preset){const label=doc.createElement('label');label.className='graphicsSetting';label.append(doc.createTextNode('Graphics quality'));preset=doc.createElement('select');preset.id='graphicsPreset';preset.setAttribute('aria-label','Graphics quality');preset.setAttribute('translate','no');label.append(preset);const anchor=slider?.closest('label');if(anchor)anchor.before(label);else doc.querySelector('#settingsContent .settingsSection')?.append(label)}
 for(const select of [preset,doc.getElementById('quality')].filter(Boolean)){for(const name of GRAPHICS_MODES){let option=[...select.options].find(option=>option.value===name);if(!option){option=doc.createElement('option');option.value=name;option.textContent=name;option.setAttribute('translate','no');select.append(option)}}}
 return preset;
}
