import assert from 'node:assert/strict';
import {installControlSizes} from '../public/control-sizes.js';

function fixture(raw){
 const elements=new Map(),css=new Map();let saved=raw;
 const doc={body:{style:{setProperty:(name,value)=>css.set(name,value)}},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}};
 const storage={getItem:()=>saved,setItem:(key,value)=>{assert.equal(key,'zero-gravity-controls');saved=value}};
 const sizes=installControlSizes(doc,storage);
 const change=(key,value)=>doc.getElementById(key+'Size').oninput({target:{value}});
 return {doc,storage,sizes,css,change,saved:()=>saved};
}
const f=fixture(JSON.stringify({jump:94,stick:110}));
assert.equal(f.css.get('--jump-size'),'94px');
assert.equal(f.css.get('--stick-size'),'110px');
assert.equal(f.css.get('--ship-left-scale'),'1');
assert.equal(f.css.get('--ship-right-scale'),'1');
f.change('shipLeft',140);
assert.equal(f.css.get('--ship-left-scale'),'1.4');
assert.equal(f.css.get('--ship-right-scale'),'1','left slider does not resize right controls');
f.change('shipRight',60);
assert.equal(f.doc.getElementById('shipRightSizeValue').textContent,'60%');
const reload=fixture(f.saved());
assert.deepEqual(reload.sizes,{jump:94,stick:110,shipLeft:140,shipRight:60});
f.change('shipLeft',900);assert.equal(f.sizes.shipLeft,140);
f.change('shipRight',-1);assert.equal(f.sizes.shipRight,60);
f.change('shipRight','NaN');assert.equal(f.sizes.shipRight,60);
assert.equal(fixture('{invalid').sizes.shipLeft,100);
assert.equal(fixture(JSON.stringify({shipLeft:0,shipRight:'bad'})).sizes.shipLeft,60);
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
const b=fixture(null);installControlSizes(b.doc,blocked);b.doc.getElementById('shipLeftSize').oninput({target:{value:120}});
assert.equal(b.css.get('--ship-left-scale'),'1.2','controls still work when storage is blocked');
console.log('PASS: independent live ship sizes, prior jump/stick preferences, reload persistence, range limits, malformed preferences and blocked storage.');
