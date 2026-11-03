// Native photo pickers may leave fullscreen and rotate Android into portrait.
// Suspend only the game's rotation prompt/layout work; never reopen fullscreen automatically.
export class FilePickerGuard{
 constructor(input,{onReturn=()=>{},delay=250,autoBegin=true}={}){this.input=input;this.onReturn=onReturn;this.delay=delay;this.active=false;this.listeners=[];const listen=(node,type,fn)=>{node.addEventListener(type,fn);this.listeners.push(()=>node.removeEventListener(type,fn))};if(autoBegin)listen(input,'click',()=>this.begin());for(const type of ['input','change','cancel'])listen(input,type,()=>this.finishSoon());listen(window,'focus',()=>this.finishSoon());listen(document,'visibilitychange',()=>{if(!document.hidden)this.finishSoon()})}
 dispose(){clearTimeout(this.timer);if(this.active){this.active=false;window.__tzgFilePickerOpen=false;window.dispatchEvent(new window.Event('tzg-file-picker'))}for(const off of this.listeners)off();this.listeners=[]}

 begin(){if(this.active)return;this.input.value='';clearTimeout(this.timer);this.active=true;this.sequence=(this.sequence||0)+1;window.__tzgFilePickerOpen=true;try{globalThis.screen?.orientation?.unlock?.()}catch{}window.dispatchEvent(new window.Event('tzg-file-picker'))}
 finishSoon(){if(!this.active||document.hidden)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.finish(),this.delay);this.timer.unref?.()}
 finish(){if(!this.active||document.hidden)return;clearTimeout(this.timer);this.active=false;window.__tzgFilePickerOpen=false;window.dispatchEvent(new window.Event('tzg-file-picker'));this.onReturn()}
}
