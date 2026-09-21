import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
const marker='this.authSubscription=onAuthChange((event,session)=>{';
const start=source.indexOf(marker)+marker.length,end=source.indexOf('\n    });',start);
function subject(){
 const queue=[],app={mounted:true,authEpoch:1,state:{authenticatedUserId:'account-a'},cleared:0,restored:0,clearSessionView(){this.cleared++;},restoreProductionSession(){this.restored++;},setState(patch){Object.assign(this.state,patch);}};
 const handle=new Function('setTimeout',`return function(event,session){${source.slice(start,end)}};`)(fn=>queue.push(fn)).bind(app);
 return {app,handle,flush:()=>queue.forEach(fn=>fn())};
}
test('a queued sign-out cannot clear a newer authenticated session',()=>{const {app,handle,flush}=subject();handle('SIGNED_OUT');app.authEpoch++;app.state.authenticatedUserId='account-b';flush();assert.equal(app.cleared,0);});
test('a current external sign-out clears the current session',()=>{const {app,handle,flush}=subject();handle('SIGNED_OUT');flush();assert.equal(app.cleared,1);});
