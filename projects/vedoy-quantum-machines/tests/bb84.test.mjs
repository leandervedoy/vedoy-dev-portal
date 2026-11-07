import test from "node:test";
import assert from "node:assert/strict";
import {expectedQber,fiberTransmission,simulateBB84} from "../src/bb84.mjs";
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test("ideal intercept-resend yields theoretical 25 percent error",()=>assert.equal(expectedQber(1,0),.25));
test("fiber attenuates",()=>assert.ok(fiberTransmission(20)<fiberTransmission(10)));
test("zero attack and zero noise yield zero QBER",()=>{
 const r=simulateBB84({rounds:8192,intercept:0,noise:0,km:0},seeded(45));
 assert.equal(r.observedQber,0);assert.equal(r.counts.finalSecureBits,0);
});
test("full attack approaches 25 percent QBER",()=>{
 const r=simulateBB84({rounds:8192,intercept:1,noise:0,km:0},seeded(36));
 assert.ok(r.observedQber>.17&&r.observedQber<.33);
 assert.equal(r.securityVerified,false);
});
test("invalid settings rejected",()=>assert.throws(()=>simulateBB84({rounds:3},seeded(1)),/Invalid/));
