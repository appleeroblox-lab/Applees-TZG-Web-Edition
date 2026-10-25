export class BodyTransition{
 constructor(){this.element=document.createElement('div');this.element.id='bodyTransition';this.element.setAttribute('aria-hidden','true');document.body.append(this.element);this.sequence=0}
 play(direction,body){this.sequence++;this.element.dataset.direction=direction;this.element.dataset.body=body?.name||'';this.element.style.animation=(this.sequence%2?'bodyFadeA':'bodyFadeB')+' .85s ease-out both'}
}
