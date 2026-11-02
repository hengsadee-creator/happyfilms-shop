import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export const token = 'a'.repeat(64);
export const key = 'demo-request-00000001';
export const product = { id:'demo',name:'Demo package',active:true,category:'premium',variants:[{id:'month',name:'30 days',sale_price:'20.10',cost_price:'10.00',active:true}] };
export async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url),'utf8'));
  const wrap = (sql, params = []) => ({
    bind(...args) { return wrap(sql,args); },
    async first() { return sqlite.prepare(sql).get(...params) ?? null; },
    async all() { return {results:sqlite.prepare(sql).all(...params)}; },
    async run() { const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}}; }
  });
  const DB = {prepare:sql=>wrap(sql),async batch(statements) { sqlite.exec('BEGIN');try {const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;} }};
  // Production D1 serializes each batch. Preserve that when concurrent requests hit this adapter.
  const originalBatch=DB.batch.bind(DB);let queue=Promise.resolve();DB.batch=statements=>{const next=queue.then(()=>originalBatch(statements));queue=next.catch(()=>{});return next;};
  sqlite.prepare('INSERT INTO kv(store,key,value) VALUES(?,?,?)').run('happyfilms-data','products/demo',JSON.stringify(product));
  for(let i=0;i<8;i++)sqlite.prepare('INSERT INTO hf_auto_stock(id,product_id,variant_id,ciphertext,fingerprint,created) VALUES(?,?,?,?,?,?)').run('stock-'+i,'demo','month','synthetic-ciphertext','fingerprint-'+i,Date.now());
  t.after(()=>sqlite.close());
  return {sqlite,env:{DB,PUBLIC_ORIGIN:'https://happyfilms.example',ORIGIN:'https://origin.example',OMISE_SECRET_KEY:'skey_live_SYNTHETIC_TEST_ONLY',BUNDLE_QUANTITY:'3',BUNDLE_PERCENT:'5'}};
}
export function request(path, data, headers={}) {
  return new Request('https://happyfilms.example'+path,{method:data===undefined?'GET':'POST',headers:{Origin:'https://happyfilms.example','content-type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
}
export const intent = (changes={}) => ({productId:'demo',variantId:'month',quantity:1,token,...changes});
export const create = (worker,env,changes={},requestKey=key) => worker.fetch(request('/api/orders',intent(changes),{'Idempotency-Key':requestKey}),env,{});
export function mockFetch(t, handler) { const original=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=original;}); }
export function charge(order,changes={}) {return {id:order.charge_id,livemode:true,metadata:{happyfilm_order:order.id},amount:order.amount,currency:'THB',source:{type:'promptpay'},status:'pending',paid:false,...changes};}
export async function pendingCharge(worker,env,sqlite) {const response=await create(worker,env);const order=await response.json();sqlite.prepare("UPDATE hf_auto_orders SET method='promptpay',charge_id='chrg_SYNTHETIC' WHERE id=?").run(order.id);return sqlite.prepare('SELECT * FROM hf_auto_orders WHERE id=?').get(order.id);}
