// Isolated demo only. All orders, products and payment confirmations are synthetic.
// This handler never receives production bindings and never calls a real provider.
const previewOrders = new Map(), previewKeys = new Map();
function demoJson(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-happyfilms-mode':'mock'}})}
export default {
 async fetch(req){
  const url=new URL(req.url),path=url.pathname;
  if(path==='/api/automation/catalog')return demoJson(previewCatalogue);
  if(path==='/api/smm-quote'){
   if(url.searchParams.get('mode')==='unavailable')return demoJson({error:'Synthetic unavailable'},503);
   if(url.searchParams.get('mode')==='rate-limit')return new Response('{"error":"Synthetic rate limit"}',{status:429,headers:{'content-type':'application/json','Retry-After':'30'}});
   const quantity=Number(url.searchParams.get('quantity'));
   if(!Number.isInteger(quantity)||quantity<100||quantity>10000)return demoJson({error:'Invalid demo quantity'},400);
   return demoJson({ok:true,quantity,price:(quantity*50/100).toFixed(2)});
  }
  if(path==='/api/orders'&&req.method==='POST'){
   const data=await req.json(),key=req.headers.get('idempotency-key');
   if(previewKeys.has(key))return demoJson(previewOrders.get(previewKeys.get(key)).view,201);
   const product=previewCatalogue.products.find(p=>p.id===data.productId),variant=product?.variants.find(v=>v.id===data.variantId);
   if(!variant||![1,3].includes(data.quantity))return demoJson({error:'Synthetic products only'},400);
   const view={id:'HFA-'+crypto.randomUUID(),name:product.name+' · '+variant.name,quantity:data.quantity,amount:data.quantity===3?variant.bundle.amount:variant.price,status:'pending',expires:Date.now()+900000,checkout:null,delivery:[]};
   previewOrders.set(view.id,{token:data.token,view});previewKeys.set(key,view.id);return demoJson(view,201);
  }
  const match=path.match(/^\/api\/orders\/(HFA-[a-f0-9-]+)(?:\/(checkout))?$/);
  if(match){
   const record=previewOrders.get(match[1]);if(!record||req.headers.get('authorization')!=='Bearer '+record.token)return demoJson({error:'Demo session expired; start a new synthetic order'},404);
   if(match[2]){record.view.checkout={method:'promptpay',demo:true};return demoJson(record.view.checkout);}
   return demoJson(record.view);
  }
  if(path==='/api/mock/complete'&&req.method==='POST'){
   const {id}=await req.json(),record=previewOrders.get(id);if(!record||req.headers.get('authorization')!=='Bearer '+record.token)return demoJson({error:'Demo session expired'},404);
   record.view.status='paid';record.view.delivery=['DEMO ONLY — ตัวอย่างการส่งมอบ ไม่มีรหัสบัญชีหรือการชำระเงินจริง'];return demoJson({ok:true});
  }
  if(path==='/.netlify/functions/create-order'&&req.method==='POST')return demoJson({ok:true,orderNo:'DEMO-'+crypto.randomUUID().slice(0,8).toUpperCase(),amount:50});
  if(path.startsWith('/api/')||path.startsWith('/.netlify/'))return demoJson({error:'Not available in isolated preview'},404);
  if(previewAssets[path]){const [body,type]=previewAssets[path];return new Response(body,{headers:{'content-type':type+'; charset=utf-8','cache-control':'no-cache','x-happyfilms-mode':'mock'}});}
  return new Response('Preview page not found',{status:404});
 }
};
