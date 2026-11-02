import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {mockFetch} from './fixture.mjs';
const source=await readFile(new URL('../web/smm-app.js',import.meta.url),'utf8');
vm.runInThisContext(await readFile(new URL('../web/transport.js',import.meta.url),'utf8'));
const helpers=globalThis.HFTransport;
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const modalStart=source.indexOf('async function requestSmmQuote(){'),modalEnd=source.indexOf('\n}\n',modalStart)+2;
test('actual checkout totals add base, fee and coupon in integer satang',()=>{
 const line=source.split('\n').find(line=>line.startsWith('function payableCheckout()'));
 const context={selectedVariant:{sale_price:'0.10'},isFlexibleSmm:()=>false,calcServiceFee:()=>0.20,appliedCoupon:null,HFTransport:helpers};vm.runInNewContext(line+';this.quote=payableCheckout;',context);assert.equal(context.quote().total,0.30);
});
for(const data of [{ok:true,quantity:100,price:'50.005'},{ok:true,quantity:101,price:50},{ok:true,quantity:100,price:0}])test('actual checkout modal rejects invalid quote '+JSON.stringify(data),async t=>{
 mockFetch(t,async()=>Response.json(data));const note={textContent:'',innerHTML:''},quantity={value:'100',min:'100',max:'10000'};
 const context={selectedProduct:{id:'demo'},selectedVariant:{id:'variant'},smmQuoteSeq:0,smmQuote:null,isFlexibleSmm:()=>true,$:selector=>selector==='#smmQuantity'?quantity:note,updateCheckout(){},agentToken:'',URL,location:{origin:'https://demo.example'},AbortSignal,fetch:globalThis.fetch,HFTransport:helpers,money:n=>'THB '+n};
 vm.runInNewContext(source.slice(modalStart,modalEnd)+';this.run=requestSmmQuote;',context);await context.run();assert.equal(context.smmQuote,null);
});
test('actual legacy submission remains blocked when successful JSON response is null',async t=>{
 let calls=0;mockFetch(t,async()=>{calls++;return Response.json(null);});let callback,errorNode;
 const button={disabled:false,textContent:'',before(node){errorNode=node;}};
 const form={addEventListener(event,handler){if(event==='submit')callback=handler;}};
 const storage=memory();
 const context={HFTransport:helpers,sessionStorage:storage,document:{createElement(){return {setAttribute(){},textContent:'',hidden:false};}},$:selector=>selector==='#orderForm'?form:selector==='#submitOrderBtn'?button:selector==='#hfOrderError'?errorNode:selector==='#slipInput'?{files:[{size:100}]}:{close(){}},validateCheckoutStep:()=>true,orderDeadline:Date.now()+60000,selectedProduct:{id:'demo',name:'demo',input_schema:[]},selectedVariant:{id:'variant'},agent:null,agentToken:'',isFlexibleSmm:()=>false,FormData:class{get(key){return key==='phone'?'0000000000':'';}},fileToDataUrl:async()=> 'data:image/jpeg;base64,REVNTw==',notifyNetlifyForm(){},showSuccess(){},location:{origin:'https://demo.example'},console};
 const start=source.indexOf('let legacySubmitting=false;'),end=source.indexOf('\nasync function notifyNetlifyForm',start);
 vm.runInNewContext(source.slice(start,end),context);
 context.appliedCoupon=null;
 await callback({preventDefault(){},target:form});assert.equal(calls,1);assert.equal(button.disabled,true);assert.match(errorNode.textContent,/ตรวจ|ยืนยัน/);
 await callback({preventDefault(){},target:form});assert.equal(calls,1);assert.equal(new helpers.SubmissionGuard(storage).blocked,true);
});
