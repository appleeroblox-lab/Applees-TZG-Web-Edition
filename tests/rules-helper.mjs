import assert from 'node:assert/strict';
// DOM tests have no layout engine: provide the same scroll measurements a
// browser reports, then use the actual Scroll and Accept event handlers.
export function acceptRules(document){
 const $=id=>document.getElementById(id);$('accountRulesLink').onclick();const content=$('gameRulesDialog').querySelector('.rulesContent');
 Object.defineProperties(content,{clientHeight:{configurable:true,value:200},scrollHeight:{configurable:true,value:1000}});
 content.scrollTop=0;content.dispatchEvent(new document.defaultView.Event('scroll'));assert($('rulesAccept').disabled,'Accept stays disabled at the top');
 content.scrollTop=800;content.dispatchEvent(new document.defaultView.Event('scroll'));assert(!$('rulesAccept').disabled);$('rulesAccept').onclick();assert($('accountRulesAccepted').checked);
}
