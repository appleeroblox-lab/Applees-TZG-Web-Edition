import {graphicsPolicy} from './graphics-policy.js?v=110';
export function resolutionRatio(width,height,dpr,quality,touch){const p=graphicsPolicy(quality),requested=touch?p.mobileRatio:p.ratio,pixels=touch?p.mobilePixels:p.pixels;return Math.max(.35,Math.min(dpr||1,requested,Math.sqrt(pixels/Math.max(1,width*height))))}
export function clampPanel(x,y,w,h,vw,vh){const width=Math.min(w,Math.max(32,vw-16));return {x:Math.min(Math.max(8,x),Math.max(8,vw-width-8)),y:Math.min(Math.max(8,y),Math.max(8,vh-h-8)),width}}
