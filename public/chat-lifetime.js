export const CHAT_LIFETIMES={global:5*60*1000,private:5*60*60*1000};
export function messageExpiry(message,kind='global'){const time=Date.parse(message?.created_at);return Number.isFinite(time)?time+CHAT_LIFETIMES[kind]:Infinity}
export function expiredMessage(message,kind='global',now=Date.now()){return messageExpiry(message,kind)<=now}
export function nextMessageExpiry(messages,kind='global',now=Date.now()){const next=Math.min(...Array.from(messages,m=>messageExpiry(m,kind)));return Number.isFinite(next)?Math.max(1,next-now):null}
