import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionView,PLAN_OPTIONS} from '../../src/domain/plans.js';
test('free access needs neither an order nor a paid period',()=>{const sub={complimentary_access:true};assert.equal(subscriptionView(sub).active,true);assert.equal(subscriptionView(sub).free,true);assert.equal(sub.current_period_end,undefined);assert.equal(sub.last_order_id,undefined);});
test('free access overrides an expired paid period',()=>assert.equal(subscriptionView({complimentary_access:true,current_period_end:'2020-01-01'}).active,true));
test('free entitlement survives a reload serialization round trip',()=>assert.equal(subscriptionView(JSON.parse(JSON.stringify({complimentary_access:true}))).active,true));
test('paid enforcement can be restored and all Wompi plans remain',()=>{assert.equal(subscriptionView({complimentary_access:false}).active,false);assert.deepEqual(PLAN_OPTIONS.map(p=>p.code),['monthly','semiannual','annual']);});
