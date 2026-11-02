import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {mockFetch} from './fixture.mjs';
async function helpers(){const src=await readFile(new URL('../web/transport.js',import.meta.url),'utf8');vm.runInThisContext(src);return globalThis.HFTransport;}
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('UI: supplier entities become readable text without interpreting markup',async()=>{
 const h=await helpers();assert.equal(h.label('HQ &amp;amp; Profile &quot;A&quot;'),'HQ & Profile "A"');assert.equal(h.label('&lt;img onerror=alert(1)&gt;'),'<img onerror=alert(1)>');
});
test('UI: quantities reject decimals, scientific notation, blanks and provider bounds',async()=>{
 const h=await helpers();for(const n of ['', ' ', '1e3','100.5','-1','0','10001'])assert.throws(()=>h.quantity(n,100,10000));assert.equal(h.quantity('500',100,10000),500);
});
test('UI: quotes require exact quantity and at least THB 50 in exact cents',async()=>{
 const h=await helpers();assert.equal(h.validateQuote({ok:true,price:'50.10',quantity:100},100),5010);for(const q of [{ok:true,price:0,quantity:100},{ok:true,price:'50.005',quantity:100},{ok:true,price:50,quantity:101},{ok:false,price:50,quantity:100}])assert.throws(()=>h.validateQuote(q,100));
});
test('UI: safe GET retries a transient failure and returns confirmed data',async t=>{
 const h=await helpers();let calls=0;mockFetch(t,async()=>++calls===1?new Response('{}',{status:503}):Response.json({ok:true}));assert.deepEqual(await h.json('/api/quote'),{ok:true});assert.equal(calls,2);
});
test('UI: unknown POST response is uncertain and never automatically retried',async t=>{
 const h=await helpers();let calls=0;mockFetch(t,async()=>{calls++;throw new TypeError('lost response');});await assert.rejects(()=>h.json('/api/order',{data:{demo:true}}),e=>e.uncertain===true);assert.equal(calls,1);
});
test('UI: malformed successful POST response stays uncertain',async t=>{
 const h=await helpers();mockFetch(t,async()=>new Response('<html>proxy error</html>'));await assert.rejects(()=>h.json('/api/order',{data:{demo:true}}),e=>e.uncertain===true);
});
test('UI: null or primitive successful POST response stays uncertain',async t=>{
 const h=await helpers();let value=null;mockFetch(t,async()=>Response.json(value));for(value of [null,42,'ok'])await assert.rejects(()=>h.json('/api/order',{data:{demo:true}}),e=>e.uncertain===true);
});
test('UI: 429 gives a safe wait message and does not retry order creation',async t=>{
 const h=await helpers();let calls=0;mockFetch(t,async()=>{calls++;return Response.json({error:'provider secret detail'},{status:429,headers:{'Retry-After':'30'}});});await assert.rejects(()=>h.json('/api/order',{data:{demo:true}}),e=>e.status===429&&e.retryAfter===30&&!e.message.includes('secret'));assert.equal(calls,1);
});
test('UI: uncertain submission remains blocked after a page reload',async()=>{
 const h=await helpers(),storage=memory(),guard=new h.SubmissionGuard(storage);const id=guard.begin();assert.ok(id);guard.fail({uncertain:true});const reloaded=new h.SubmissionGuard(storage);assert.throws(()=>reloaded.begin(),/ตรวจสอบ|ส่งซ้ำ/);assert.equal(reloaded.blocked,true);
});
test('UI: known validation failure permits correcting and resubmitting',async()=>{
 const h=await helpers(),guard=new h.SubmissionGuard(memory());guard.begin();guard.fail({status:400,uncertain:false});assert.equal(guard.blocked,false);assert.ok(guard.begin());guard.complete();assert.equal(guard.blocked,false);
});
