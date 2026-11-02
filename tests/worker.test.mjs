import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {quote,validateCharge} from '../worker/worker.mjs';
import {fixture,create,request,intent,key,token,product,mockFetch,pendingCharge,charge} from './fixture.mjs';

test('money: refuses prices with excess decimal precision rather than silently rounding',()=>{
  assert.throws(()=>quote({}, {sale_price:'1.005'},1,{}),/price|decimal|precision/i);
});
test('money: refuses non-decimal and malformed prices',()=>{
  for(const sale_price of ['0x10','1e3','1,000.00','',null,'Infinity','-1.00']) assert.throws(()=>quote({}, {sale_price},1,{}));
});
test('money: amount stays in exact integer satang, including bundle rounding',()=>{
  assert.equal(quote({}, {sale_price:'20.10',cost_price:'10.00'},3,{BUNDLE_QUANTITY:'3',BUNDLE_PERCENT:'5'}).amount,5729);
});
test('money: refuses unsafe total arithmetic',()=>{
  assert.throws(()=>quote({}, {sale_price:'90071992547409.00'},10,{}));
});
for(const quantity of [0,'1',null,false,1.5,-1,11])test(`create: rejects quantity ${JSON.stringify(quantity)}`,async t=>{
  const {env,sqlite}=await fixture(t);const r=await create(worker,env,{quantity});assert.equal(r.status,400);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_orders').get().n,0);
});
test('create: identical key and intent returns same reserved order',async t=>{
  const {env,sqlite}=await fixture(t);const a=await (await create(worker,env)).json(),b=await (await create(worker,env)).json();assert.equal(a.id,b.id);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_stock WHERE order_id IS NOT NULL').get().n,1);
});
test('create: idempotency key cannot be reused for changed quantity',async t=>{
  const {env}=await fixture(t);await create(worker,env);const r=await create(worker,env,{quantity:2});assert.equal(r.status,409);
});
test('create: concurrent identical requests reserve once and both replay success',async t=>{
  const {env,sqlite}=await fixture(t);const responses=await Promise.all([create(worker,env),create(worker,env)]);assert.deepEqual(responses.map(r=>r.status),[201,201]);const a=await responses[0].json(),b=await responses[1].json();assert.equal(a.id,b.id);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_orders').get().n,1);
});
test('auth: a different private token cannot replay an order',async t=>{
  const {env}=await fixture(t);await create(worker,env);const r=await create(worker,env,{token:'b'.repeat(64)});assert.equal(r.status,403);
});
test('origin: forbidden Origin cannot consume database-backed request budget',async t=>{
  const {env,sqlite}=await fixture(t);const r=await worker.fetch(request('/api/orders',intent(),{Origin:'https://evil.example','Idempotency-Key':key}),env,{});assert.equal(r.status,403);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_rate').get().n,0);
});
test('cors: allowed preflight returns explicit allowed origin and request headers',async t=>{
  const {env}=await fixture(t);const r=await worker.fetch(new Request('https://happyfilms.example/api/orders',{method:'OPTIONS',headers:{Origin:env.PUBLIC_ORIGIN}}),env,{});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),env.PUBLIC_ORIGIN);assert.match(r.headers.get('access-control-allow-headers')||'',/idempotency-key/i);
});
test('body: malformed JSON is a client error',async t=>{
  const {env}=await fixture(t);const r=await worker.fetch(new Request('https://happyfilms.example/api/orders',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN},body:'{'}),env,{});assert.equal(r.status,400);
});
test('errors: unexpected database failures are 500 with an opaque request id',async()=>{
  const env={PUBLIC_ORIGIN:'https://happyfilms.example',DB:{prepare(){throw Error('internal database detail');}}};const r=await worker.fetch(request('/api/orders',intent()),env,{});assert.equal(r.status,500);assert.ok(r.headers.get('x-request-id'));assert.doesNotMatch(await r.text(),/internal database detail/);
});
test('provider GET: transient failure is retried before reconciliation succeeds',async t=>{
  const {env,sqlite}=await fixture(t);const order=await pendingCharge(worker,env,sqlite);let calls=0;mockFetch(t,async()=>++calls===1?new Response('{}',{status:503}):Response.json(charge(order)));
  const r=await worker.fetch(request('/api/webhook/payment',{key:'charge.complete',data:{id:order.charge_id}}),env,{});assert.equal(r.status,200);assert.equal(calls,2);
});
test('provider GET: authentication failures are not retried or exposed',async t=>{
  const {env,sqlite}=await fixture(t);const order=await pendingCharge(worker,env,sqlite);let calls=0;mockFetch(t,async()=>{calls++;return Response.json({secret:'SYNTHETIC_PROVIDER_DETAIL'},{status:401});});const r=await worker.fetch(request('/api/webhook/payment',{key:'charge.complete',data:{id:order.charge_id}}),env,{});assert.equal(r.status,503);assert.equal(calls,1);assert.doesNotMatch(await r.text(),/SYNTHETIC_PROVIDER_DETAIL/);
});
test('provider GET: long Retry-After is surfaced without retrying too early',async t=>{
  const {env,sqlite}=await fixture(t);const order=await pendingCharge(worker,env,sqlite);let calls=0;mockFetch(t,async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'60'}});});const r=await worker.fetch(request('/api/webhook/payment',{key:'charge.complete',data:{id:order.charge_id}}),env,{});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');assert.equal(calls,1);
});
test('provider POST: lost response does not create a second charge',async t=>{
  const {env,sqlite}=await fixture(t);const o=await (await create(worker,env)).json();let calls=0;mockFetch(t,async()=>{calls++;throw new TypeError('SYNTHETIC_NETWORK_ERROR');});const req=()=>request('/api/orders/'+o.id+'/checkout',{method:'promptpay'},{Authorization:'Bearer '+token});const r=await worker.fetch(req(),env,{});assert.equal(r.status,503);const retry=await worker.fetch(req(),env,{});assert.equal(retry.status,409);assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT error FROM hf_auto_orders WHERE id=?').get(o.id).error,'payment_creation_unresolved');
});
test('payments: duplicate concurrent webhooks record one verified payment',async t=>{
  const {env,sqlite}=await fixture(t);const order=await pendingCharge(worker,env,sqlite);mockFetch(t,async()=>Response.json(charge(order,{status:'successful',paid:true})));const req=()=>request('/api/webhook/payment',{key:'charge.complete',data:{id:order.charge_id}});const responses=await Promise.all([worker.fetch(req(),env,{}),worker.fetch(req(),env,{})]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_payments').get().n,1);
});
test('payments: refunded or mismatched charges never settle',()=>{
  const o={id:'demo',charge_id:'chrg_SYNTHETIC',amount:2010,method:'promptpay'};for(const changes of [{amount:1},{livemode:false},{refunded_amount:1},{currency:'USD'}])assert.throws(()=>validateCharge(charge(o,changes),o));
});
test('configuration: no payment credentials means checkout is closed',async t=>{
  const {env,sqlite}=await fixture(t);delete env.OMISE_SECRET_KEY;const r=await create(worker,env);assert.equal(r.status,503);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM hf_auto_orders').get().n,0);
});
test('UI integration: Worker serves the shared helper without origin or database access',async t=>{
 let upstream=0;mockFetch(t,async()=>{upstream++;return new Response('missing',{status:404});});const r=await worker.fetch(request('/assets/hf-transport.js'),{PUBLIC_ORIGIN:'https://happyfilms.example'},{});assert.equal(r.status,200);assert.match(await r.text(),/SubmissionGuard/);assert.equal(upstream,0);
});
test('provider GET: repeated network timeouts stop after three attempts',async t=>{
 const {env,sqlite}=await fixture(t);const order=await pendingCharge(worker,env,sqlite);let calls=0;mockFetch(t,async()=>{calls++;throw new DOMException('timed out','TimeoutError');});const r=await worker.fetch(request('/api/webhook/payment',{key:'charge.complete',data:{id:order.charge_id}}),env,{});assert.equal(r.status,503);assert.equal(calls,3);
});
test('provider POST: non-JSON reply remains unresolved without another charge request',async t=>{
 const {env,sqlite}=await fixture(t);const o=await (await create(worker,env)).json();let calls=0;mockFetch(t,async()=>{calls++;return new Response('<html>error</html>');});const r=await worker.fetch(request('/api/orders/'+o.id+'/checkout',{method:'promptpay'},{Authorization:'Bearer '+token}),env,{});assert.equal(r.status,503);assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT error FROM hf_auto_orders WHERE id=?').get(o.id).error,'payment_creation_unresolved');
});
test('rate limit: returns 429 and Retry-After once request budget is exhausted',async t=>{
 const {env}=await fixture(t);let r;for(let n=0;n<31;n++)r=await worker.fetch(request('/api/orders',{}),env,{});assert.equal(r.status,429);assert.ok(Number(r.headers.get('retry-after'))>0);
});
