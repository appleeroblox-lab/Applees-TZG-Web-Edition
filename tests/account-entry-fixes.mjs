import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import CSSOM from 'cssom';
import {parse as selectors} from 'css-what';
import {accountGate} from '../public/account-gate.js';
import {AccountAuthFlow,verifiedEmail,authMessage} from '../public/account-auth-flow.js';
import {acceptRules} from './rules-helper.mjs';
const {document,window}=parseHTML('<html><body class="referenceHUD"></body></html>');
Object.assign(globalThis,{document,window,location:{origin:'https://game.test',pathname:'/index.html'}});
const root=accountGate(document);root.hidden=false;root.dataset.entry='form';
let available=true,loginError=null,complete=false,finished=0,recoveryCalls=0,releaseReset,invokeError=null;
const requests=[];
const google={id:'google-player',email:'test@example.test',email_confirmed_at:'2026-11-13T00:00:00Z',identities:[{provider:'google'}],app_metadata:{provider:'google'},user_metadata:{full_name:'Test Explorer'}};
const client={
 rpc:async(name,args)=>{requests.push({name,args});if(name==='tzg_google_profile_status')return {data:{complete}};if(name==='tzg_username_available')return {data:available};return {data:{}}},
 functions:{invoke:async(name,request)=>{requests.push(request.body);if(invokeError&&request.body.action!=='signup')return {error:{message:'Edge request failed',context:{json:async()=>({error:invokeError})}}};if(request.body.action==='signup')return {data:{session:{user:{id:'new-player',email:'placeholder@accounts.tzg.invalid',email_confirmed_at:google.email_confirmed_at}}}};return {data:{ok:true}}}},
 auth:{signInWithPassword:async args=>{requests.push(args);return {error:loginError}},setSession:async session=>({data:{user:session.user}}),getUser:async()=>({data:{user:google}}),resetPasswordForEmail:async(email,options)=>{recoveryCalls++;requests.push({email,options});await new Promise(resolve=>releaseReset=resolve);return {}}}
};
const flow=new AccountAuthFlow({root,client:()=>client,onSuccess:()=>finished++}),$=id=>document.getElementById(id);acceptRules(document);
// Resolve display using the actual shipped styles, including !important,
// selector specificity and short-screen media rules that caused hidden fields.
const html=fs.readFileSync('public/index.html','utf8');
const sheets=[...html.matchAll(/href="([^"?]+\.css)(?:\?[^\"]*)?"/g)].map(([,p])=>CSSOM.parse(fs.readFileSync('public/'+p,'utf8')));
const score=tokens=>tokens.reduce((n,t)=>n+(t.type==='tag'?1:t.type==='attribute'?(t.name==='id'&&t.action==='equals'?100:10):t.type==='pseudo'?(t.name==='where'?0:Array.isArray(t.data)?Math.max(...t.data.map(score)):10):0),0);
const media=(text,w,h)=>text.split(',').some(part=>{
 for(const [,op,kind,value]of part.matchAll(/\((max|min)-(width|height):\s*(\d+)px\)/g)){const actual=kind==='width'?w:h;if(op==='max'?actual>+value:actual<+value)return false}
 if(part.includes('orientation:portrait')&&w>h||part.includes('orientation:landscape')&&w<h)return false;
 return !part.includes('prefers-reduced-motion');
});
function display(node,w,h){let best=[0,-1,-1],value='block',order=0;const visit=rules=>{for(const rule of rules){if(rule.cssRules){if(!rule.media||media(rule.media.mediaText,w,h))visit(rule.cssRules);continue}if(!rule.selectorText||!rule.style?.display)continue;for(const selector of rule.selectorText.split(/,(?![^()]*\))/)){let matches=false;try{matches=node.matches(selector)}catch{}if(!matches)continue;const next=[rule.style.getPropertyPriority('display')==='important'?1:0,Math.max(...selectors(selector).map(score)),order++];if(next.some((n,i)=>n!==best[i]&&next.slice(0,i).every((v,j)=>v===best[j])&&n>best[i])){best=next;value=rule.style.display}}}};for(const sheet of sheets)visit(sheet.cssRules);return value}
const hiddenAtEverySize=id=>{assert($(id).hidden,id+' carries the hidden state');for(const [w,h]of [[1366,768],[844,390],[390,844]])assert.equal(display($(id),w,h),'none',id+' must be hidden at '+w+'×'+h)};
flow.setMode('login');for(const id of ['accountConfirmRow','signupProfile','signupBirthday','signupEmail'])hiddenAtEverySize(id);assert(!$('accountForgot').hidden,'recovery does not require typing a password first');
loginError={message:'Invalid login credentials',code:'invalid_credentials'};$('accountEmail').value=google.email;$('accountPassword').value='wrong';await flow.submit();assert.match($('accountStatus').textContent,/wrong password/);assert.equal($('accountStatus').getAttribute('role'),'alert');assert.equal($('accountStatus').dataset.kind,'error');assert(requests.some(r=>r.password==='wrong'),'existing users are not blocked by new-signup password minimum');
await flow.resumeGoogle(google);assert.equal($('signupVerifiedEmail').value,google.email);assert($('signupVerifiedEmail').hasAttribute('readonly'));assert(!$('signupVerifiedEmailRow').hidden);for(const id of ['accountEmailRow','signupPasswordFields','signupEmail','signupBirthday'])hiddenAtEverySize(id);
available=false;$('accountUsername').value='taken_name';await flow.submit();assert.match($('accountStatus').textContent,/Username already taken/);assert.equal($('accountUsernameCheck').dataset.state,'error');assert.notEqual(display($('accountUsernameCheck'),844,390),'none');
available=true;await flow.submit();assert.equal(flow.step,'birthday');for(const id of ['signupProfile','signupPasswordFields','signupEmail','accountEmailRow'])hiddenAtEverySize(id);
flow.showBirthdayConfirmation('2000-01-01',26);$('birthdayConfirmation').querySelector('.birthdayContinue').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,1);assert(!requests.some(r=>r.action==='signup'||r.action==='email_start'),'Google completion never creates a password account or asks for another email');
flow.setMode('login');$('accountEmail').value=google.email;const reset=flow.forgot();assert($('accountForgot').disabled);assert.match($('accountStatus').textContent,/Requesting/);await flow.forgot();assert.equal(recoveryCalls,1,'duplicate reset clicks do not send extra requests');releaseReset();await reset;assert(!$('accountForgot').disabled);assert.match($('accountStatus').textContent,/inbox.*reset link/);assert.equal(requests.at(-1).options.redirectTo,'https://game.test/index.html');
$('accountEmail').value='test_player';await flow.forgot();assert.equal(requests.at(-1).action,'recover');assert.equal(recoveryCalls,1,'username recovery uses the account service');
invokeError='Too many attempts. Please try again later.';await flow.forgot();assert.equal($('accountStatus').dataset.kind,'error');assert.match($('accountStatus').textContent,/Too many attempts/);invokeError=null;
flow.setMode('signup');flow.step='email';flow.birthDate='2000-01-01';$('accountName').value='New player';$('accountUsername').value='new_player';$('accountPassword').value=$('accountConfirm').value='test-only-password';$('signupRecoveryEmail').value='used@example.test';invokeError='A user with this email address has already been registered';await flow.create(false);assert(flow.created,'a duplicate recovery email does not lose the created account');assert.match($('accountStatus').textContent,/email is already registered/);assert.equal($('accountStatus').dataset.kind,'error');
assert.equal(verifiedEmail({...google,email_confirmed_at:null}),'');assert.equal(verifiedEmail({...google,email:'placeholder@accounts.tzg.invalid'}),'');assert.match(authMessage({code:'email_exists',message:'Conflict'}),/already registered/);
for(const node of root.querySelectorAll('input'))clearTimeout(node._errorTimer);clearTimeout(flow.checkTimer);
console.log('PASS actual CSS hidden-state cascade at 3 viewport sizes, verified Google email/skip, short wrong-password feedback, taken username, duplicate email, email/username reset progress and failure feedback.');
