import assert from 'node:assert/strict';
import {formatOnlineCount} from '../public/online-count.js';
for(const [n,text] of [[0,'0'],[10,'10'],[100,'100'],[1250,'1.25k'],[10500,'10.5k'],[100500,'100.5k'],[1250000,'1.25m']])assert.equal(formatOnlineCount(n),text);
console.log('PASS compact online player counts');
