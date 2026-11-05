import test from 'node:test';
import assert from 'node:assert/strict';
import { run, planShip } from '../src/cli.mjs';
test('ship refuses live deployment', async () => {
  await assert.rejects(run(['ship'], {log(){}}, '.', ()=>{throw Error('must not run')}), /dry-run/);
});
test('ship dry-run does not execute subprocesses', async () => {
  const out=[];
  await run(['ship','--dry-run'], {log:s=>out.push(s)}, '.', ()=>{throw Error('must not run')});
  assert.match(out.join(''),/Planned only/);
});
test('save only stages tracked files and commits', async () => {
  const calls=[];const mock=(a)=>{calls.push(a);return a[0]==='diff'?'README.md':''};
  await run(['save','test commit'],{log(){}},'.',mock);
  assert.deepEqual(calls,[['add','--update'],['diff','--cached','--name-only'],['commit','-m','test commit']]);
});
test('sync fetches but never merges', async () => {
  const calls=[];await run(['sync'],{log(){}},'.',a=>{calls.push(a);return ''});
  assert.deepEqual(calls,[['fetch','--all','--prune']]);
});
test('plan describes approval gate',()=>assert.ok(planShip().some(x=>x.includes('approval'))));
