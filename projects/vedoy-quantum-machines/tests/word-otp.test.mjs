import test from "node:test";
import assert from "node:assert/strict";
import {segmentWords,xor,encryptWords,decryptLocally,makePad} from "../src/word-otp.mjs";
test("preserves all Unicode segments including punctuation and spaces",()=>{
 const t="Hei, verden! 👋 Én test.";
 const s=segmentWords(t);assert.equal(s.map(x=>x.text).join(""),t);
 assert.ok(s.some(x=>!x.word));assert.ok(s.some(x=>x.word));
});
test("distinct pad regions per word and separators, flat ciphertext roundtrip",async()=>{
 const message="Hei til verden! 🗝️";
 const r=await encryptWords(message);
 assert.equal(decryptLocally(r.envelope,r.localPad),message);
 assert.equal(r.visual.reduce((n,x)=>n+x.bytes,0),new TextEncoder().encode(message).length);
 assert.equal(Object.hasOwn(r.envelope,"visual"),false);
 assert.equal(Object.hasOwn(r.envelope,"localPad"),false);
 r.localPad.fill(0);
});
test("fresh cipher for repeated message",async()=>{
 const x=await encryptWords("Hei alle"),y=await encryptWords("Hei alle");
 assert.notEqual(x.envelope.ciphertext,y.envelope.ciphertext);
 x.localPad.fill(0);y.localPad.fill(0);
});
test("quantum mode fails without real verified provider",async()=>{
 await assert.rejects(encryptWords("test",{requireQuantum:true}),/unavailable/);
 const qrng={readAttestedBytes:async n=>({bytes:new Uint8Array(n),attestationVerified:false,provider:"mock"})};
 await assert.rejects(makePad(32,{requireQuantum:true,qrng}),/Unverified/);
});
test("adaptor-reported quantum output is mixed rather than used directly",async()=>{
 const qrng={readAttestedBytes:async n=>({bytes:new Uint8Array(n).fill(7),attestationVerified:true,provider:"test-only"})};
 const p=await makePad(32,{requireQuantum:true,qrng});
 assert.match(p.source,/experimental/);assert.equal(p.bytes.length,32);p.bytes.fill(0);
});
test("mismatched pad is rejected",()=>assert.throws(()=>xor(new Uint8Array(4),new Uint8Array(3)),/One independent/));
