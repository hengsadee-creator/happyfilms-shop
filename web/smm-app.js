const $=(q,e=document)=>e.querySelector(q), $$=(q,e=document)=>[...e.querySelectorAll(q)];
const categoryLabels={all:'ทั้งหมด',premium:'แอปพรีเมียม',game:'เติมเกม',mobile:'เติมมือถือ',smm:'โซเชียล SMM',byshop:'ร้านภายนอก'};
const statusLabels={payment_review:'รอตรวจสลิป',processing:'กำลังดำเนินการ',completed:'สำเร็จ',cancelled:'ยกเลิก',rejected:'สลิปไม่ผ่าน'};
const lineDefault='https://line.me/R/ti/p/@365groav';const lineURL=()=>siteContent?.line?.url||lineDefault;function applyLineLinks(){document.querySelectorAll('[data-line-oa]').forEach(a=>{a.href=lineURL();a.target='_blank';a.rel='noopener noreferrer'})}
const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let catalogAutoPolls=0,catalogAutoTimer=null;
const storePage=document.body.dataset.store||'home';let byshopKind='all';
let catalog=[],smmOnly=false,activeCategory='all',selectedProduct=null,selectedVariant=null,orderDeadline=0,timerId=null,latestOrderNo='',checkoutStep=1,appliedCoupon=null,adminPresence={online:false},siteContent=null;
let smmQuote=null,smmQuoteSeq=0,smmQuoteTimer=null,qrRequestSeq=0;
const isFlexibleSmm=()=>selectedProduct?.category==='smm'&&selectedVariant?.socialhub_variable===true&&selectedVariant?.price_mode!=='manual';
function payableCheckout(){if(!selectedVariant)return null;try{const base=HFTransport.minorUnits(isFlexibleSmm()?(smmQuote?.price??NaN):selectedVariant.sale_price),fee=HFTransport.minorUnits(calcServiceFee()),discount=HFTransport.minorUnits(appliedCoupon?.discountAmount??0),total=Math.max(0,base+fee-discount);if(!Number.isSafeInteger(total))return null;return {base:base/100,fee:fee/100,discount:discount/100,total:total/100}}catch{return null}}
function clearPendingQuote(){smmQuote=null;smmQuoteSeq++;clearTimeout(smmQuoteTimer)}
async function requestSmmQuote(){
 if(!isFlexibleSmm())return;
 const el=$('#smmQuantity'),note=$('#smmQuantityNote');if(!el)return;
 const seq=++smmQuoteSeq,variantId=String(selectedVariant.id);smmQuote=null;updateCheckout();let qty;
 try{qty=HFTransport.quantity(el.value,Number(el.min),Number(el.max))}
 catch(error){if(note)note.textContent=error.message;return}
 if(note)note.textContent='กำลังคำนวณราคาตามจำนวนที่เลือก…';
 try{
  const u=new URL('/api/smm-quote',location.origin);u.searchParams.set('productId',selectedProduct.id);u.searchParams.set('variantId',variantId);u.searchParams.set('quantity',String(qty));
  const data=await HFTransport.json(u,{token:agentToken});
  if(seq!==smmQuoteSeq||String(selectedVariant?.id)!==variantId)return;
  HFTransport.validateQuote(data,qty);
  smmQuote=data;
  if(note)note.textContent='จำนวน '+qty.toLocaleString('th-TH')+' รายการ · ราคา '+money(data.price)+' · ราคายืนยันจากเซิร์ฟเวอร์';
  updateCheckout();
 }catch(error){if(seq!==smmQuoteSeq)return;if(note)note.textContent=error.message||'คำนวณราคาไม่สำเร็จ';updateCheckout()}
}

let memberToken=localStorage.getItem('hf_member_token')||'',member=null,agentToken=localStorage.getItem('hf_agent_token')||'',agent=null,chatAccess={orderNo:'',phone:''},chatTimer=null,gameTimer=null,gameSeconds=10,gameScore=0;
try{chatAccess=JSON.parse(sessionStorage.getItem('hf_chat_access')||'null')||chatAccess}catch{}
function rememberChatAccess(){try{if(chatAccess.orderNo&&chatAccess.phone)sessionStorage.setItem('hf_chat_access',JSON.stringify(chatAccess))}catch{}}
function productIconMarkup(p){if(p.image_key)return `<div class="product-icon app-brand-icon"><img src="/api/media?key=${encodeURIComponent(p.image_key)}&type=${encodeURIComponent(p.image_type||'image/jpeg')}&v=${p.image_updated_at||0}" alt="${esc(p.name)}"></div>`;const initials=String(p.name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();return `<div class="product-icon app-brand-icon initials"><span>${esc(initials)}</span></div>`}
let hfCatalogLoadFailed=false;async function fetchCatalog(retry=true){hfCatalogLoadFailed=false;try{const r=await fetch('/.netlify/functions/catalog',{signal:AbortSignal.timeout(15000),cache:'no-store',headers:agentToken?{authorization:`Bearer ${agentToken}`}:{}}),d=await r.json();if(r.status===401&&agentToken&&retry){agentToken='';agent=null;localStorage.removeItem('hf_agent_token');renderAgentAccount();return fetchCatalog(false)}if(!r.ok||!Array.isArray(d.products))throw new Error(d.error||'โหลดสินค้าไม่สำเร็จ');catalog=d.products;smmOnly=false;if(d.agent)agent=d.agent}catch{if(retry){await new Promise(resolve=>setTimeout(resolve,500));return fetchCatalog(false)}hfCatalogLoadFailed=true;catalog=window.HAPPYFILMS_CATALOG||catalog||[];agent=null}applySmmMode();const urlState=new URLSearchParams(location.search);if(storePage==='apps'){const q=urlState.get('q');if(q!==null&&$('#searchInput')&&!$('#searchInput').value)$('#searchInput').value=q.slice(0,90);if(q!==null&&$('#appSearchFast'))$('#appSearchFast').value=q.slice(0,90);const c=urlState.get('category');if(['premium','game','mobile','all'].includes(c))activeCategory=c;}renderTabs();renderCatalog();renderSocialHubPanel();if(hfCatalogLoadFailed)shPanelSetStatus('โหลดสินค้าไม่สำเร็จ กรุณากดโหลดสินค้าอีกครั้ง รายการเดิมจะยังอยู่ถ้ามี',true);renderAgentAccount();renderAgentModeBanner();maybeRetrySmmCatalog();const pack=new URLSearchParams(location.search).get('pack');if(pack&&!window.__hfOpenedLink){const found=catalog.flatMap(p=>(p.variants||[]).map(v=>({p,v}))).find(x=>x.v.permalink===('/'+pack.replace(/^\//,''))&&x.p.active!==false&&x.v.active!==false&&Number(x.v.sale_price)>0);if(found){window.__hfOpenedLink=true;openOrder(found.p.id,found.v.id,new URLSearchParams(location.search).get('qty'))}}}
function maybeRetrySmmCatalog(){
 if(!document.getElementById('socialOrderPanel')||catalogAutoPolls>=16||shPanelRows().length>0)return;
 clearTimeout(catalogAutoTimer);
 catalogAutoTimer=setTimeout(async()=>{
  try{
   const response=await fetch('/api/sync-health',{cache:'no-store'});
   if(!response.ok)return;
   const status=await response.json();
   if(!status.enabled||status.lastError){if(status.lastError)shPanelSetStatus('ซิงก์สินค้าไม่สำเร็จ: '+String(status.lastError).slice(0,160),true);return}
   const stillImporting=Number(status.progress||0)>0 && Number(status.eligible||0)>Number(status.progress||0);
   const hasNoServices=!catalog.some(p=>p.category==='smm'&&p.active!==false);
   if(!stillImporting&&!hasNoServices)return;
   catalogAutoPolls++;await fetchCatalog(false);
  }catch{}
 },6500)
}
function applySmmMode(){document.documentElement.classList.toggle('smm-only-mode',smmOnly);if(!smmOnly)return;const h=document.querySelector('.hero-copy h1');if(h)h.innerHTML='บริการโซเชียลมีเดีย<br><span>สั่งง่าย ติดตามงานได้</span>';const hp=document.querySelector('.hero-copy p');if(hp)hp.textContent='เลือกบริการโซเชียลที่ต้องการ จ่ายผ่าน PromptPay ให้แอดมินตรวจยอดเงินจริง แล้วส่งคำสั่งซื้อเข้าระบบต้นทาง';const t=document.querySelector('.page-intro h1');if(t)t.textContent='บริการโซเชียล SMM';const p=document.querySelector('.page-intro p');if(p)p.textContent='เลือกบริการและจำนวนที่ต้องการ แนบสลิป แล้วรอแอดมินตรวจยอดเงินก่อนดำเนินการ';const search=document.querySelector('#searchInput');if(search)search.placeholder='ค้นหาบริการ SMM…'}
function renderTabs(){const categories=storePage==='smm'?['all','smm']:storePage==='byshop'?['all','byshop']:['all','premium','game','mobile'];const products=catalog.filter(p=>storePage==='smm'?p.category==='smm':storePage==='byshop'?p.category==='byshop':p.category!=='smm'&&p.category!=='byshop'),counts=products.reduce((a,p)=>(a[p.category]=(a[p.category]||0)+1,a),{});if(!categories.includes(activeCategory))activeCategory='all';$('#categoryTabs').innerHTML=categories.map(c=>`<button type="button" class="tab ${c===activeCategory?'active':''}" data-cat="${c}" aria-pressed="${c===activeCategory}">${categoryLabels[c]}${c!=='all'&&counts[c]?` · ${counts[c]}`:''}</button>`).join('');$$('.tab').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;renderTabs();renderCatalog()})}
function minPrice(p){const v=(p.variants||[]).filter(x=>x.active!==false&&Number(x.sale_price)>0);return v.length?Math.min(...v.map(x=>Number(x.sale_price))):null}
function renderCatalog(){if(storePage==='smm'&&!document.querySelector('.mk-secondary-catalog')?.open){$('#catalogGrid').innerHTML='<div class="loading-card">เปิดส่วนนี้เพื่อดูรายการ หรือค้นหาบริการจากฟอร์มด้านบน</div>';return}const q=$('#searchInput').value.trim().toLowerCase(),items=catalog.filter(p=>(storePage==='smm'?p.category==='smm':storePage==='byshop'?p.category==='byshop':p.category!=='smm'&&p.category!=='byshop')&&(activeCategory==='all'||p.category===activeCategory)&&(storePage!=='byshop'||byshopKind==='all'||String(p.byshop_kind||'other')===byshopKind)&&(!q||`${p.name} ${p.description||''} ${p.provider||''}`.toLowerCase().includes(q)));$('#catalogGrid').innerHTML=items.length?items.map(p=>{const mp=minPrice(p),hasAgentPrice=!agent||mp!=null;return `<article class="product-card ${agent?'agent-price-card':''} ${hasAgentPrice?'':'agent-price-missing'}" data-buy-card="${esc(p.id)}" role="button" tabindex="0" aria-label="เลือกแพ็ก ${esc(p.name)}">${productIconMarkup(p)}<h3>${esc(p.name)}</h3><p>${esc(p.description||'เลือกแพ็กเกจและสั่งซื้อได้ทันที')}</p><div class="product-meta"><span class="tag">${p.category==='smm'?'บริการ SMM':p.category==='mobile'?'เติมมือถือ':p.category==='game'?'เติมเกม':p.category==='byshop'?'ร้านภายนอก':'แอปพรีเมียม'}</span>${agent?`<span class="tag agent-tag">${hasAgentPrice?'ราคาตัวแทน':'ยังไม่ตั้งราคาตัวแทน'}</span>`:''}</div><div class="product-permalink">${(p.variants||[]).filter(v=>v.active!==false&&v.permalink&&Number(v.sale_price)>0).slice(0,1).map(v=>`<a class="mini-btn" href="${esc(v.permalink)}" title="ดูหน้าแพ็กและแชร์ลิงก์">🔗 ดูแพ็ก / แชร์ลิงก์</a>`).join('')}</div><div class="product-bottom"><div class="from-price"><small>${agent?(hasAgentPrice?'ราคาตัวแทนเริ่มต้น':'ยังไม่เปิดราคาตัวแทน'):'เริ่มต้น'}</small><b>${mp==null?'—':money(mp)}</b></div><button type="button" class="btn btn-secondary product-buy-btn" data-buy="${esc(p.id)}" ${hasAgentPrice?'':'disabled'}>${hasAgentPrice?'เลือกแพ็ก':'ยังซื้อไม่ได้'}</button></div></article>`}).join(''):(storePage==='byshop'?'<div class="hf-byshop-empty"><strong>ยังไม่มีสินค้าร้านภายนอกที่เปิดขาย</strong><p>รายการจาก BYShop จะปรากฏหลังร้านนำเข้ารหัสสินค้าและยืนยันต้นทุนจริงแล้ว เราจะไม่แสดงราคาคาดเดาหรือเรียกเก็บเงินก่อนยืนยันรายการ</p><a href="/shop">ไปดูแอพและบริการของร้าน →</a></div>':'<div class="loading-card">ไม่พบสินค้า</div>')} 
document.querySelector('.mk-secondary-catalog')?.addEventListener('toggle',()=>{if(document.querySelector('.mk-secondary-catalog').open)renderCatalog()});const catalogGrid=$('#catalogGrid');
function buyFromEvent(e){if(e.target.closest?.('a[href]'))return false;const btn=e.target.closest?.('[data-buy]');if(btn){e.preventDefault();e.stopPropagation();openOrder(btn.dataset.buy);return true}const card=e.target.closest?.('[data-buy-card]');if(card){e.preventDefault();openOrder(card.dataset.buyCard);return true}return false}
catalogGrid.addEventListener('click',buyFromEvent);
// Pointerup removed: mobile tap triggers click automatically, preventing double-open.
document.querySelectorAll('[data-bs-kind]').forEach(b=>b.addEventListener('click',()=>{byshopKind=b.dataset.bsKind;document.querySelectorAll('[data-bs-kind]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});renderCatalog()}));
catalogGrid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-buy-card]')){e.preventDefault();openOrder(e.target.dataset.buyCard)}});
$('#searchInput').addEventListener('input',()=>{const fast=$('#appSearchFast');if(fast)fast.value=$('#searchInput').value;renderCatalog()});$('#appSearchFast')?.addEventListener('input',e=>{const search=$('#searchInput');if(search){search.value=e.target.value;activeCategory='all';renderTabs();renderCatalog()}});
// v12.2: guided SMM order page. The supplier service/category list is sourced from /api/catalog,
// NEVER from a direct browser request to SocialHub and never from a hardcoded catalog.
// SMM purchase panel: catalogue and confirmed prices stay on the existing API.
let shPanelSelection='',shPanelQSeq=0,shPanelTimer=null,shPanelConfirmed=null,shPanelController=null,shSearchTimer=null;
const shPanelEl=id=>document.getElementById(id);
const shPanelSetStatus=(message,error=false)=>{const el=shPanelEl('shStatus');if(el){el.textContent=message;el.dataset.error=String(error)}};
function shPanelPlatform(p){const c=(p.socialhub_original_category||p.socialhub_provider_category||'')+' '+(p.socialhub_original_name||p.name||'');for(const [key,re] of [['TikTok',/tik\s*tok/i],['Instagram',/instagram|insta/i],['Facebook',/facebook|\bfb\b/i],['YouTube',/you\s*tube|\byt\b/i],['LINE',/\bline\b/i],['Telegram',/telegram/i],['X (Twitter)',/twitter|x\.com/i],['Spotify',/spotify/i],['Threads',/threads/i],['WhatsApp',/whatsapp/i],['Website',/website|traffic/i]])if(re.test(c))return key;return 'อื่น ๆ'}
function shPanelRows(){return catalog.filter(p=>p.category==='smm'&&p.active!==false).flatMap(p=>(p.variants||[]).filter(v=>v.active!==false&&v.socialhub_service_id&&Number(v.sale_price)>=50).map(v=>({p,v})))}
function shPanelOptions(select,options,placeholder,current){if(!select)return;select.replaceChildren(new Option(placeholder,''));for(const o of options)select.add(new Option(HFTransport.label(o.label),o.value));if(options.some(o=>o.value===current))select.value=current;select.disabled=!options.length}
function shPanelLink(){try{const u=new URL(shPanelEl('shTarget').value.trim());return ['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password}catch{return false}}
function shPanelBuyState(){shPanelEl('shBuy').disabled=!shPanelConfirmed||!shPanelLink()}
function renderSocialHubPanel(){if(!shPanelEl('shPlatform'))return;const rows=shPanelRows(),names=[...new Set(rows.map(x=>shPanelPlatform(x.p)))],popular=['TikTok','Facebook','Instagram','YouTube','LINE','WhatsApp','Telegram','Threads','X (Twitter)','Spotify','Website','อื่น ๆ'];names.sort((a,b)=>popular.indexOf(a)-popular.indexOf(b));const old=shPanelEl('shPlatform').value;shPanelOptions(shPanelEl('shPlatform'),names.map(value=>({value,label:value})),'เลือกแพลตฟอร์ม',names.includes(old)?old:names[0]);shPanelRefreshCategory(rows,true)}
function shPanelRefreshCategory(rows=shPanelRows(),preserve=false){const platform=shPanelEl('shPlatform').value,old=preserve?shPanelEl('shCategory').value:'',cats=[...new Set(rows.filter(x=>shPanelPlatform(x.p)===platform).map(x=>x.p.socialhub_original_category||x.p.socialhub_provider_category||'หมวดอื่น ๆ'))].sort((a,b)=>a.localeCompare(b,'th'));shPanelOptions(shPanelEl('shCategory'),cats.map(value=>({value,label:value})),'ทุกหมวดในแพลตฟอร์มนี้',old);shPanelRefreshServices(rows)}
function shPanelRefreshServices(rows=shPanelRows()){
 const platform=shPanelEl('shPlatform').value,category=shPanelEl('shCategory').value,search=shPanelEl('shSearch').value.trim().toLocaleLowerCase();shPanelEl('shSearch').disabled=!rows.length;
 const matches=rows.filter(({p,v})=>shPanelPlatform(p)===platform&&(!category||(p.socialhub_original_category||p.socialhub_provider_category||'หมวดอื่น ๆ')===category)&&(!search||[p.name,p.socialhub_original_name,p.socialhub_original_category,v.socialhub_service_id].join(' ').toLocaleLowerCase().includes(search)));
 const old=shPanelSelection,cur=matches.some(x=>x.p.id+'|'+x.v.id===old)?old:(matches[0]?matches[0].p.id+'|'+matches[0].v.id:'');
 shPanelOptions(shPanelEl('shService'),matches.map(({p,v})=>({value:p.id+'|'+v.id,label:'#'+v.socialhub_service_id+' · '+p.name})),'เลือกบริการ ('+matches.length+' รายการ)',cur);shPanelSelection=cur;shPanelUpdateSelection(cur!==''&&cur===old);
 if(!matches.length)shPanelSetStatus(rows.length?'ไม่พบบริการที่ตรงกัน ลองล้างคำค้นหรือเลือกทุกหมวด':'โหลดรายการไม่สำเร็จหรือยังไม่มีบริการพร้อมขาย กดลองโหลดสินค้าอีกครั้ง',true);
 shPanelEl('shMatchCount').textContent=matches.length.toLocaleString('th-TH')+' บริการที่ตรงกับตัวกรอง';
}
function shPanelSelected(){return shPanelRows().find(({p,v})=>p.id+'|'+v.id===shPanelEl('shService').value)||null}
function shPanelInvalidate(){shPanelQSeq++;shPanelController?.abort();clearTimeout(shPanelTimer);shPanelConfirmed=null;shPanelBuyState();shPanelEl('shPrice').textContent='—';shPanelEl('shRetryQuote').hidden=true}
function shPanelUpdateSelection(preserve=false){
 shPanelInvalidate();const row=shPanelSelected(),q=shPanelEl('shQuantity'),link=shPanelEl('shTarget'),chips=shPanelEl('shQuantityChoices');chips.replaceChildren();shPanelEl('shDetails').textContent=HFTransport.label(row?.p.description||'');
 if(!row){q.disabled=true;link.disabled=true;q.value='';shPanelEl('shQtyRange').textContent='เลือกบริการก่อน';shPanelEl('shPriceNote').textContent='ยังไม่ได้เลือกบริการ';return}
 const v=row.v,variable=v.socialhub_variable===true&&v.price_mode!=='manual',min=Number(variable?v.socialhub_min_quantity:v.socialhub_quantity||1),max=Number(variable?v.socialhub_max_quantity:min),previous=Number(q.value);
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min){q.disabled=true;link.disabled=true;shPanelSetStatus('บริการนี้มีเงื่อนไขจำนวนไม่สมบูรณ์ กรุณาเลือกบริการอื่น',true);return}
 q.min=String(min);q.max=String(max);q.value=String(preserve&&Number.isSafeInteger(previous)&&previous>=min&&previous<=max?previous:Math.min(max,Math.max(min,Number(v.socialhub_quantity)||min)));q.disabled=!variable;link.disabled=false;
 shPanelEl('shQtyRange').textContent=variable?`เลือกได้ ${min.toLocaleString('th-TH')}–${max.toLocaleString('th-TH')} รายการ`:'แพ็กจำนวนคงที่ '+min.toLocaleString('th-TH')+' รายการ';
 if(variable)for(const n of [...new Set([min,100,500,1000])].filter(n=>n>=min&&n<=max).sort((a,b)=>a-b)){const b=document.createElement('button');b.type='button';b.className='mini-btn';b.textContent=n.toLocaleString('th-TH');b.addEventListener('click',()=>{q.value=String(n);q.dispatchEvent(new Event('input',{bubbles:true}))});chips.append(b)}
 shPanelRequestQuote();
}
async function shPanelRequestQuote(){
 const row=shPanelSelected();if(!row)return;shPanelInvalidate();
 const q=shPanelEl('shQuantity'),seq=shPanelQSeq;let qty;
 try{qty=HFTransport.quantity(q.value,Number(q.min),Number(q.max))}
 catch(error){shPanelSetStatus(error.message,true);shPanelEl('shPriceNote').textContent='ตรวจจำนวนก่อนคำนวณราคา';return}
 shPanelEl('shPrice').textContent='…';shPanelEl('shPriceNote').textContent='กำลังยืนยันราคากับระบบ';shPanelSetStatus('กำลังคำนวณราคา…');
 const controller=new AbortController();shPanelController=controller;
 try{
  const u=new URL('/api/smm-quote',location.origin);u.searchParams.set('productId',row.p.id);u.searchParams.set('variantId',row.v.id);u.searchParams.set('quantity',String(qty));
  const data=await HFTransport.json(u,{token:agentToken,signal:controller.signal});
  if(seq!==shPanelQSeq)return;
  HFTransport.validateQuote(data,qty);
  shPanelConfirmed={pid:row.p.id,vid:row.v.id,qty,price:Number(data.price)};
  shPanelEl('shPrice').textContent=money(data.price);shPanelEl('shPriceNote').textContent=qty.toLocaleString('th-TH')+' รายการ • ราคายืนยันจากเซิร์ฟเวอร์';
  shPanelSetStatus(shPanelLink()?'พร้อมซื้อ กดไปกรอกเบอร์และชำระเงินได้เลย':'วางลิงก์บัญชีหรือโพสต์เพื่อสั่งซื้อ ไม่ต้องให้รหัสผ่าน');shPanelBuyState();
 }catch(error){
  if(seq!==shPanelQSeq||error.cancelled)return;
  shPanelEl('shPrice').textContent='—';shPanelEl('shPriceNote').textContent='ยังไม่เรียกเก็บเงิน';shPanelSetStatus(error.message||'เชื่อมต่อไม่สำเร็จ',true);shPanelEl('shRetryQuote').hidden=false;
 }
}
function shPanelInit(){if(!shPanelEl('shPlatform'))return;
 const style=document.createElement('style');style.textContent='#shRetryQuote[hidden]{display:none!important}.sh-panel-grid>details{display:block!important;grid-column:1/-1}.sh-panel-grid>details>summary{display:list-item!important;cursor:pointer;color:#b5d8ff;padding:8px 0}.sh-panel-grid>*{min-width:0}.sh-panel-field select,.sh-panel-field input{width:100%;max-width:100%;min-height:48px;font-size:16px}.sh-panel-field select{white-space:nowrap;text-overflow:ellipsis}.hf-smm-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}#shDetails{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:14px;line-height:1.6}#shMatchCount{display:block;margin:6px 0;color:#acbed3}.sh-panel-bottom{gap:16px}.sh-panel-status[data-error="true"]{color:#ffbdad}#socialOrderPanel{scroll-margin-top:90px}@media(max-width:600px){.sh-panel-grid{grid-template-columns:minmax(0,1fr)}.sh-panel-bottom{flex-direction:column;align-items:stretch}#shBuy{width:100%;min-height:50px}.sh-panel-card{padding:18px}.sh-panel-heading{flex-wrap:wrap}}';document.head.append(style);
 shPanelEl('shCategory').previousElementSibling.textContent='หมวดบริการ (เลือกได้)';shPanelEl('shSearch').placeholder='ค้นชื่อหรือรหัสบริการในแพลตฟอร์มนี้';shPanelEl('shBuy').textContent='เลือกบริการนี้ → กรอกเบอร์และชำระเงิน';
 const count=document.createElement('small');count.id='shMatchCount';shPanelEl('shService').after(count);const details=document.createElement('details');details.innerHTML='<summary>รายละเอียดและเงื่อนไขบริการ</summary><p id="shDetails"></p>';shPanelEl('shService').closest('label').after(details);
 const chips=document.createElement('div');chips.id='shQuantityChoices';chips.className='hf-smm-chips';shPanelEl('shQuantity').closest('label').append(chips);
 const retry=document.createElement('button');retry.type='button';retry.id='shRetryQuote';retry.className='mini-btn';retry.textContent='ลองคำนวณราคาอีกครั้ง';retry.hidden=true;retry.onclick=shPanelRequestQuote;shPanelEl('shStatus').after(retry);
 shPanelEl('shPlatform').onchange=()=>{shPanelEl('shSearch').value='';shPanelRefreshCategory()};shPanelEl('shCategory').onchange=()=>shPanelRefreshServices();
 shPanelEl('shSearch').oninput=()=>{shPanelInvalidate();clearTimeout(shSearchTimer);shSearchTimer=setTimeout(()=>shPanelRefreshServices(),180)};
 shPanelEl('shService').onchange=()=>{shPanelSelection=shPanelEl('shService').value;shPanelUpdateSelection()};shPanelEl('shQuantity').oninput=()=>{shPanelInvalidate();shPanelTimer=setTimeout(shPanelRequestQuote,240)};
 shPanelEl('shTarget').oninput=()=>{shPanelBuyState();if(shPanelConfirmed)shPanelSetStatus(shPanelLink()?'พร้อมซื้อ กดไปกรอกเบอร์และชำระเงินได้เลย':'กรุณาวางลิงก์เต็มที่ขึ้นต้นด้วย https://',!shPanelLink())};
 shPanelEl('shBuy').onclick=()=>{const c=shPanelConfirmed;if(!c||!shPanelLink()||Number(shPanelEl('shQuantity').value)!==c.qty)return;openOrder(c.pid,c.vid,c.qty);const input=document.querySelector('#dynamicFields input[name="link"],#optionalDynamicFields input[name="link"]');if(input)input.value=shPanelEl('shTarget').value.trim();$('#orderForm [name=phone]')?.focus()};
 shPanelEl('shReload').onclick=async()=>{const b=shPanelEl('shReload');b.disabled=true;shPanelInvalidate();shPanelSetStatus('กำลังโหลดข้อมูลสินค้า…');try{await fetchCatalog(false)}finally{b.disabled=false}};
}
shPanelInit();
if(shPanelEl('socialOrderPanel')){
 const note=document.createElement('p');note.className='hf-policy-note';note.textContent='บริการเพิ่มยอดอาจขัดนโยบายแพลตฟอร์ม ยอดอาจลดลงหรือบัญชีถูกจำกัด ไม่มีการรับประกันยอดถาวร กรุณาอ่านเงื่อนไขก่อนสั่ง';shPanelEl('socialOrderPanel').append(note);
 shPanelEl('shStatus').setAttribute('role','status');shPanelEl('shStatus').setAttribute('aria-live','polite');
}

async function fetchAdminPresence(){try{const r=await fetch('/.netlify/functions/admin-presence',{cache:'no-store'});adminPresence=r.ok?await r.json():{online:false}}catch{adminPresence={online:false}}renderAdminPresence()}
function queueMeta(){const q=siteContent?.queue||{},status=['normal','busy','paused'].includes(q.status)?q.status:'normal';return {status,label:status==='busy'?'คิวเยอะ':status==='paused'?'พักคิวชั่วคราว':'คิวปกติ',message:String(q.message||'')}}
function renderAdminPresence(){const online=adminPresence.online===true,q=queueMeta(),baseMsg=online?'แอดมินกำลังใช้งานหลังบ้านอยู่ ออเดอร์จะดำเนินการตามคิว':'สั่งได้ 24 ชม. ระบบรับออเดอร์ไว้ก่อน และดำเนินการเมื่อแอดมินกลับมาออนไลน์',msg=q.message?`${baseMsg} • ${q.message}`:baseMsg;const badge=$('#adminPresenceBadge');if(badge){badge.className=`presence-badge ${online?'online':'offline'}`;badge.innerHTML=`<span class="presence-dot"></span>${online?'แอดมินออนไลน์':'แอดมินออฟไลน์'}`}const text=$('#adminPresenceText');if(text)text.textContent=msg;const qb=$('#queueStatusBadge');if(qb){qb.className=`queue-badge ${q.status}`;qb.textContent=q.label}$('#chatFloatBtn')?.classList.toggle('online',online);const chatText=$('#chatPresenceText');if(chatText)chatText.textContent=online?'แอดมินออนไลน์อยู่ สามารถส่งข้อความได้เลย':'ฝากข้อความไว้ได้ แอดมินจะตอบเมื่อกลับมาออนไลน์';const c=$('#checkoutAdminPresence');if(c){const queueCopy=q.status==='busy'?'คิวค่อนข้างเยอะ อาจใช้เวลานานกว่าปกติ':q.status==='paused'?'ร้านพักคิวชั่วคราว ระบบยังรับออเดอร์ไว้ก่อน':online?'ดำเนินการตามคิวหลังตรวจสลิป':'สั่งได้ 24 ชม. แต่ต้องรอแอดมินกลับมาออนไลน์ก่อน';c.className=`checkout-presence ${online?'online':'offline'} queue-${q.status}`;c.innerHTML=`<span class="presence-dot"></span><div><b>${online?'แอดมินออนไลน์':'แอดมินออฟไลน์'} • ${q.label}</b><small>${esc(q.message||queueCopy)}</small></div>`}}
function openOrder(id, preferredVariantId=null, preferredQuantity=null){
  $('#orderForm').reset();clearPendingQuote();appliedCoupon=null;checkoutStep=1;$('#couponMessage').textContent='';$('#couponRow').classList.add('hidden');const rememberedPhone=(()=>{try{return sessionStorage.getItem('hf_easy_phone')||''}catch{return ''}})();if(rememberedPhone)$('#orderForm [name=phone]').value=rememberedPhone;
  selectedProduct=catalog.find(p=>String(p.id)===String(id));if(!selectedProduct)return;
  const variants=(selectedProduct.variants||[]).filter(v=>v.active!==false&&(!agent||Number(v.sale_price)>0));if(agent&&!variants.length){alert('สินค้านี้ยังไม่ได้ตั้งราคาตัวแทน กรุณาติดต่อร้าน');return}selectedVariant=variants.find(v=>String(v.id)===String(preferredVariantId))||variants[0]||null;
  const optionText=v=>`${v.name} — ${money(v.sale_price)}${agent&&Number(v.retail_price)>Number(v.sale_price)?` (ปกติ ${money(v.retail_price)})`:''}${v.warranty?` · ${v.warranty}`:''}`;
  $('#orderProductSummary').innerHTML=`
    <div class="order-summary">${productIconMarkup(selectedProduct)}<div><div class="eyebrow">${categoryLabels[selectedProduct.category]}</div><h2>${esc(selectedProduct.name)}</h2><p>${esc(selectedProduct.description||'')}</p></div></div>
    <div class="variant-help">เลือกแพ็กที่ต้องการ 👇</div>
    <div class="mobile-variant-picker">
      <label for="mobileVariantSelect">แพ็กเกจ</label>
      <select id="mobileVariantSelect" aria-label="เลือกแพ็กเกจ">
        ${variants.map((v,i)=>`<option value="${esc(v.id)}" ${String(v.id)===String(selectedVariant?.id)?'selected':''}>${esc(optionText(v))}</option>`).join('')}
      </select>
      <div id="mobileVariantPreview" class="mobile-variant-preview"></div>
    </div>
    <div class="variant-grid desktop-variant-grid ${selectedProduct.category==='mobile'?'mobile-amount-grid':''}">
      ${variants.map((v,i)=>`<button type="button" class="variant-choice ${String(v.id)===String(selectedVariant?.id)?'selected':''}" data-variant-id="${esc(v.id)}" aria-pressed="${String(v.id)===String(selectedVariant?.id)?'true':'false'}"><span class="variant-check">✓</span><b>${esc(v.name)}</b><small>${agent&&Number(v.retail_price)>Number(v.sale_price)?`<s>${money(v.retail_price)}</s> `:(v.compare_price?`<s>${money(v.compare_price)}</s> `:'')}<strong>${money(v.sale_price)}</strong>${agent?' · ราคาตัวแทน':''}${v.warranty?` · ${esc(v.warranty)}`:''}</small></button>`).join('')}
    </div>`;
  const summary=$('#orderProductSummary');
  const preview=$('#mobileVariantPreview',summary),select=$('#mobileVariantSelect',summary);
  const paintPreview=()=>{if(!preview||!selectedVariant)return;preview.innerHTML=`<span>${agent?'ราคาตัวแทน • ':''}เลือกแล้ว</span><b>${esc(selectedVariant.name)}</b><strong>${money(selectedVariant.sale_price)}</strong>`};
  const chooseVariant=id=>{
    const picked=variants.find(v=>String(v.id)===String(id));if(!picked)return;
    selectedVariant=picked;
    $$('.variant-choice',summary).forEach(x=>{const active=String(x.dataset.variantId)===String(picked.id);x.classList.toggle('selected',active);x.setAttribute('aria-pressed',active?'true':'false')});
    if(select&&String(select.value)!==String(picked.id))select.value=String(picked.id);
    paintPreview();renderQuantityChooser(null);clearCoupon();updateCheckout();if(navigator.vibrate)navigator.vibrate(12);
  };
  const chooseFromTap=e=>{const btn=e.target.closest?.('.variant-choice');if(!btn||!summary.contains(btn))return;e.preventDefault();chooseVariant(btn.dataset.variantId)};
  summary.addEventListener('click',chooseFromTap);
  // Use click only: touch already generates click.
  select?.addEventListener('change',e=>chooseVariant(e.currentTarget.value));
  paintPreview();
  const fields=Array.isArray(selectedProduct.input_schema)?selectedProduct.input_schema:[];
  const renderField=f=>`<label class="${f.wide?'wide':''}"><span>${esc(f.name==='link'?'ลิงก์บัญชี / โพสต์เป้าหมาย':(f.label||f.name))} ${f.required?'':'<em>(ไม่บังคับ)</em>'}</span><input name="${esc(f.name)}" type="${esc(f.type||'text')}" ${f.required?'required':''} ${f.name==='link'?'inputmode="url" autocomplete="url"':''} placeholder="${esc(f.name==='link'?'วางลิงก์ที่นี่ เช่น https://www.tiktok.com/@...':(f.placeholder||''))}"></label>`;
  const renderQuantityChooser=(prefer=null)=>{
    clearPendingQuote();let block='';
    if(isFlexibleSmm()){
      const min=Number(selectedVariant.socialhub_min_quantity),max=Number(selectedVariant.socialhub_max_quantity),fallback=Number(selectedVariant.socialhub_quantity||min);const requested=prefer!==null&&prefer!==''?Number(prefer):fallback;const qty=Number.isSafeInteger(requested)&&requested>=min&&requested<=max?requested:fallback;
      block=`<label class="wide hf-smm-quantity"><span>จำนวนที่ต้องการ <em>(ขั้นต่ำต้นทาง ${min.toLocaleString('th-TH')} · ยอดซื้อขั้นต่ำ 50 บาท)</em></span><input id="smmQuantity" type="number" name="smmQuantity" min="${min}" max="${max}" step="1" value="${qty}" inputmode="numeric" required><small id="smmQuantityNote" class="hf-quantity-note">กำลังคำนวณราคา…</small></label>`;
    }
    $('#dynamicFields').innerHTML=block+fields.filter(f=>f.required).map(renderField).join('');
    $('#optionalDynamicFields').innerHTML=fields.filter(f=>!f.required).map(renderField).join('');
    if(isFlexibleSmm()){const input=$('#smmQuantity');input?.addEventListener('input',()=>{clearTimeout(smmQuoteTimer);smmQuoteSeq++;smmQuote=null;updateCheckout();smmQuoteTimer=setTimeout(requestSmmQuote,200)});requestSmmQuote()}
  };
  renderQuantityChooser(preferredQuantity);
  const ref=$('#referralInput');if(ref){ref.disabled=!!agent;ref.value=agent?.code||'';ref.placeholder=agent?`บัญชีตัวแทน ${agent.code}`:'เช่น A0';const lab=ref.closest('label')?.querySelector('span');if(lab)lab.innerHTML=agent?'บัญชีตัวแทน <em>(ใช้ราคาตัวแทนอัตโนมัติ)</em>':'รหัสผู้แนะนำ <em>(ไม่บังคับ)</em>'}
  orderDeadline=Date.now()+15*60*1000;startCountdown();updateCheckout();setCheckoutStep(preferredVariantId?2:1);$('#orderDialog').showModal();
}
function clearCoupon(){appliedCoupon=null;$('#couponCode').value='';$('#couponMessage').textContent=''}
$('#referralInput').addEventListener('input',()=>{if(appliedCoupon){appliedCoupon=null;$('#couponMessage').textContent='รหัสผู้แนะนำเปลี่ยนแล้ว กรุณากดใช้คูปองใหม่';updateCheckout()}});
function calcServiceFee(){if(!selectedVariant||selectedProduct.category!=='mobile')return 0;const p=Number(selectedVariant.sale_price||0),f=siteContent?.fees||{};return p<50?Number(f.mobileUnder50??2):p<100?Number(f.mobile50to99??1):Number(f.mobileFrom100??0)}
function updateCheckout(){if(!selectedVariant)return;const quoted=payableCheckout();if(!quoted){qrRequestSeq++;$('#basePrice').textContent='รอราคายืนยัน';$('#totalPrice').textContent='รอราคายืนยัน';$('#payAmount').textContent='รอราคา';$('#promptpayQr')?.removeAttribute('src');return}const {base,fee,discount,total}=quoted;$('#basePrice').textContent=money(base);$('#serviceFee').textContent=fee?money(fee):'ฟรี';$('#couponRow').classList.toggle('hidden',!discount);$('#couponDiscount').textContent=discount?`-${money(discount)}`:'—';$('#totalPrice').textContent=money(total);$('#payAmount').textContent=money(total);drawPromptPay(total)}
function startCountdown(){clearInterval(timerId);const tick=()=>{const left=Math.max(0,orderDeadline-Date.now()),m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);$('#countdown').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;if(left<=0)clearInterval(timerId)};tick();timerId=setInterval(tick,1000)}
async function drawPromptPay(amount){const myRequest=++qrRequestSeq;const img=$('#promptpayQr'),fallback=$('#qrFallback');if(!img||!fallback)return;fallback.classList.add('hidden');img.classList.remove('hidden');img.removeAttribute('src');try{const url=`/.netlify/functions/promptpay-qr?amount=${encodeURIComponent(Number(amount).toFixed(2))}&v=${Date.now()}`;const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`QR ${r.status}`);const svg=await r.text();if(myRequest!==qrRequestSeq)return;if(!svg.includes('<svg'))throw new Error('QR response invalid');img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;img.onload=()=>{fallback.classList.add('hidden');img.classList.remove('hidden')};img.onerror=()=>{img.classList.add('hidden');fallback.classList.remove('hidden')}}catch(e){if(myRequest!==qrRequestSeq)return;console.error('PromptPay QR failed',e);img.classList.add('hidden');fallback.classList.remove('hidden')}}
function setCheckoutStep(n){checkoutStep=n;$$('[data-checkout-step]').forEach(s=>s.classList.toggle('hidden',Number(s.dataset.checkoutStep)!==n));$$('[data-step-dot]').forEach(d=>{const x=Number(d.dataset.stepDot);d.classList.toggle('active',x===n);d.classList.toggle('done',x<n)});if(n===3)renderFinalReview()}
function validateCheckoutStep(n){if(n===2&&isFlexibleSmm()&&(!smmQuote||Number($('#smmQuantity')?.value)!==Number(smmQuote.quantity))){alert('กรุณารอระบบคำนวณราคาที่ถูกต้องก่อนดำเนินการต่อ');return false}const box=$(`[data-checkout-step="${n}"]`);for(const el of $$('input[required],select[required],textarea[required]',box)){if(el.type!=='hidden'&&!el.checkValidity()){el.reportValidity();return false}}if(n===3&&!$('#slipInput').files[0]){alert('แนบสลิปก่อนครับ');return false}return true}
function renderFinalReview(){const fd=new FormData($('#orderForm')),{total}=payableCheckout()||{total:0};const dynamic=(selectedProduct?.input_schema||[]).filter(f=>f.required).map(f=>`<div><span>${esc(f.name==='link'?'ลิงก์เป้าหมาย':(f.label||f.name))}</span><b>${esc(fd.get(f.name)||'-')}</b></div>`).join('');$('#finalReview').innerHTML=`<div class="hf-mini-review"><b>${esc(selectedProduct?.name||'-')}</b><small>${esc(selectedVariant?.name||'-')}${isFlexibleSmm()?' · จำนวน '+Number(smmQuote?.quantity||0).toLocaleString('th-TH')+' รายการ':''}</small></div>${dynamic}<div class="hf-mini-phone"><span>ติดต่อ / เช็กออเดอร์</span><b>${esc(fd.get('phone')||'-')}</b></div><div class="hf-mini-total"><span>ยอดที่ต้องโอน</span><strong>${money(total)}</strong></div>`}
$$('[data-next-step]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.nextStep);if(validateCheckoutStep(checkoutStep))setCheckoutStep(next)});$$('[data-prev-step]').forEach(b=>b.onclick=()=>setCheckoutStep(Number(b.dataset.prevStep)));$('#closeOrderBtn').onclick=()=>$('#orderDialog').close();
$('#applyCouponBtn').onclick=async()=>{if(isFlexibleSmm()){ $('#couponMessage').textContent='บริการระบุจำนวนเองไม่รองรับคูปอง';return }const code=$('#couponCode').value.trim().toUpperCase(),msg=$('#couponMessage');appliedCoupon=null;updateCheckout();if(!code){msg.textContent='';return}msg.textContent='กำลังตรวจคูปอง…';try{const u=new URL('/.netlify/functions/validate-coupon',location.origin);u.searchParams.set('code',code);u.searchParams.set('productId',selectedProduct.id);u.searchParams.set('variantId',selectedVariant.id);u.searchParams.set('referralCode',$('#referralInput').value.trim().toUpperCase());const r=await fetch(u,{headers:agentToken?{authorization:`Bearer ${agentToken}`}:{}}),d=await r.json();if(!r.ok)throw new Error(d.error);appliedCoupon={code,discountAmount:Number(d.discountAmount||0)};msg.textContent=`ใช้คูปองแล้ว ลด ${money(appliedCoupon.discountAmount)}`;updateCheckout()}catch(e){msg.textContent=e.message;appliedCoupon=null;updateCheckout()}};
function readFileDataUrl(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result||''));fr.onerror=()=>rej(new Error('อ่านไฟล์รูปไม่ได้'));fr.readAsDataURL(file)})}
function loadImageFile(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img)};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('เปิดรูปนี้ไม่ได้'))};img.src=url})}
async function fileToDataUrl(file){if(!file)return '';const type=String(file.type||'').toLowerCase(),browserReady=/^image\/(png|jpeg|webp)$/i.test(type);if(file.size<=900000&&browserReady)return readFileDataUrl(file);let source=null,sw=0,sh=0,cleanup=()=>{};try{if(typeof createImageBitmap==='function'){try{const bmp=await createImageBitmap(file);source=bmp;sw=bmp.width;sh=bmp.height;cleanup=()=>bmp.close?.()}catch{}}if(!source){const img=await loadImageFile(file);source=img;sw=img.naturalWidth||img.width;sh=img.naturalHeight||img.height}if(!sw||!sh)throw new Error('อ่านขนาดรูปไม่ได้');const maxSide=1400,scale=Math.min(1,maxSide/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale)),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{alpha:false});x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(source,0,0,w,h);cleanup();let q=.86,data='';for(let i=0;i<7;i++){data=c.toDataURL('image/jpeg',q);if(data.length*.75<1250000)break;q=Math.max(.42,q-.08)}if(data.length*.75>=1450000)throw new Error('สลิปยังใหญ่เกินไป กรุณาถ่ายภาพหน้าจอสลิปแล้วเลือกใหม่');return data}catch(e){cleanup();if(browserReady&&file.size<=1450000)return readFileDataUrl(file);throw new Error('อ่านรูปสลิปไม่ได้ กรุณาเลือก JPG/PNG หรือถ่ายภาพหน้าจอสลิปใหม่')}}
function formatFileSize(n){n=Number(n||0);return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}
let slipPreviewUrl='';function clearSlipPreview(){if(slipPreviewUrl){URL.revokeObjectURL(slipPreviewUrl);slipPreviewUrl=''}const input=$('#slipInput');if(input)input.value='';$('#slipPreview')?.classList.add('hidden');const img=$('#slipPreviewImg');if(img)img.removeAttribute('src')}
$('#slipInput')?.addEventListener('change',e=>{const file=e.currentTarget.files?.[0];if(!file)return clearSlipPreview();if(file.size>12*1024*1024){alert('รูปสลิปต้นฉบับต้องไม่เกิน 12MB');return clearSlipPreview()}if(!String(file.type||'').startsWith('image/')&&!/\.(jpe?g|png|webp)$/i.test(file.name||'')){alert('กรุณาเลือกไฟล์รูปสลิป');return clearSlipPreview()}if(slipPreviewUrl)URL.revokeObjectURL(slipPreviewUrl);slipPreviewUrl=URL.createObjectURL(file);$('#slipPreviewImg').src=slipPreviewUrl;$('#slipFileName').textContent=file.name||'สลิปที่เลือก';$('#slipFileMeta').textContent=`${formatFileSize(file.size)} • พร้อมแนบ`;$('#slipPreview').classList.remove('hidden')});
$('#removeSlipBtn')?.addEventListener('click',clearSlipPreview);

let legacySubmitting=false;
let submissionStorage;try{submissionStorage=sessionStorage}catch{}
const submissionGuard=new HFTransport.SubmissionGuard(submissionStorage);
function orderMessage(message){
 let out=$('#hfOrderError');if(!out){out=document.createElement('p');out.id='hfOrderError';out.className='hf-inline-error';out.setAttribute('role','alert');$('#submitOrderBtn').before(out);}
 out.textContent=message;out.hidden=!message;
}
if(submissionGuard.blocked){$('#submitOrderBtn').disabled=true;orderMessage('ยังยืนยันผลออเดอร์ก่อนหน้าไม่ได้ กรุณาตรวจสอบกับร้านก่อนส่งซ้ำ เพื่อป้องกันออเดอร์ซ้ำ');}
$('#orderForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(legacySubmitting)return;
 if(submissionGuard.blocked){orderMessage('กรุณาตรวจสอบออเดอร์เดิมกับร้านก่อนส่งซ้ำ');return;}
 if(!validateCheckoutStep(2)||!validateCheckoutStep(3))return;
 if(Date.now()>orderDeadline){orderMessage('ออเดอร์หมดเวลาแล้ว กรุณาเปิดรายการใหม่');return;}
 const file=$('#slipInput').files[0];
 if(!file||file.size>12*1024*1024){orderMessage('กรุณาเลือกรูปสลิปไม่เกิน 12 MB');return;}
 const btn=$('#submitOrderBtn'),fd=new FormData(e.target),dynamic={};
 (selectedProduct.input_schema||[]).forEach(f=>dynamic[f.name]=fd.get(f.name)||'');
 legacySubmitting=true;btn.disabled=true;btn.textContent='กำลังเตรียมสลิป…';orderMessage('');
 try{
  const idempotencyKey=submissionGuard.begin();
  const slipDataUrl=await fileToDataUrl(file);
  btn.textContent='กำลังส่งออเดอร์…';
  const payload={productId:selectedProduct.id,variantId:selectedVariant.id,customerName:'',phone:String(fd.get('phone')||'').trim(),referralCode:agent?'':String(fd.get('referralCode')||'').trim().toUpperCase(),couponCode:appliedCoupon?.code||'',quantity:isFlexibleSmm()?smmQuote?.quantity:undefined,expectedAmount:isFlexibleSmm()?payableCheckout()?.total:undefined,dynamic,slipDataUrl};
  // The Pages backend has not been recovered. This key is forwarded, but server-side legacy idempotency is not assumed.
  const d=await HFTransport.json('/.netlify/functions/create-order',{data:payload,token:agentToken,idempotencyKey});
  if(typeof d?.orderNo!=='string'||!d.orderNo.trim())throw Object.assign(Error('ระบบยังไม่ส่งเลขออเดอร์กลับ กรุณาตรวจสอบกับร้านก่อนส่งซ้ำ'),{uncertain:true});
  submissionGuard.complete();latestOrderNo=d.orderNo;
  try{sessionStorage.setItem('hf_easy_phone',String(fd.get('phone')||''));sessionStorage.setItem('hf_last_order_access',JSON.stringify({orderNo:d.orderNo,phone:String(fd.get('phone')||'')}))}catch{}
  $('#orderDialog').close();showSuccess(d.orderNo);
  notifyNetlifyForm({subject:'ออเดอร์ใหม่ Happyfilms.clerk '+d.orderNo,order_no:d.orderNo,product:selectedProduct.name,package:selectedVariant.name,customer:'ลูกค้า',phone:fd.get('phone'),amount:d.amount,referral_code:agent?'ตัวแทน '+agent.code:(String(fd.get('referralCode')||'').trim().toUpperCase()||'-'),status:'รอตรวจสลิป',admin_url:location.origin+'/admin.html',submitted_at:new Date().toLocaleString('th-TH')});
 }catch(error){
  submissionGuard.fail(error);orderMessage(error.message||'ส่งออเดอร์ไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
 }finally{
  legacySubmitting=false;btn.disabled=submissionGuard.blocked;btn.textContent=submissionGuard.blocked?'รอตรวจสอบออเดอร์เดิม':'ส่งออเดอร์';
 }
});
async function notifyNetlifyForm(fields){try{const body=new URLSearchParams({'form-name':'order-notify',...fields});await fetch('/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body})}catch{}}
function showSuccess(no){$('#successOrderNo').textContent=no;const msg=encodeURIComponent(`ออเดอร์ ${no} จาก Happyfilms.clerk`);$('#lineOrderBtn').href=lineURL();$('#successDialog').showModal()}
$('#copyOrderBtn').onclick=async()=>{try{await navigator.clipboard.writeText(latestOrderNo);$('#copyOrderBtn').textContent='คัดลอกแล้ว ✓'}catch{prompt('คัดลอกเลขออเดอร์',latestOrderNo)}};
$('#trackForm').addEventListener('submit',async e=>{e.preventDefault();const out=$('#trackResult');out.innerHTML='<div class="track-result">กำลังค้นหา…</div>';try{const u=new URL('/.netlify/functions/get-order',location.origin);u.searchParams.set('orderNo',$('#trackOrderNo').value.trim());u.searchParams.set('phone',$('#trackPhone').value.trim());const r=await fetch(u),d=await r.json();if(!r.ok)throw new Error(d.error);const o=d.order;out.innerHTML=`<div class="track-result"><div class="track-head"><div><b>${esc(o.order_no)}</b><small>${esc(o.product_name)} · ${esc(o.variant_name)}</small></div><span class="status-pill status-${esc(o.status)}">${statusLabels[o.status]||esc(o.status)}</span></div><div class="track-grid"><div>ยอดชำระ<br><b>${money(o.amount)}</b></div><div>อัปเดตล่าสุด<br><b>${new Date(o.updated_at||o.created_at).toLocaleString('th-TH')}</b></div></div>${o.checkslips_status?`<div class="club-message">🧾 ตรวจสลิป: <b>${o.checkslips_pass?'ผ่านการตรวจ API (ร้านยังต้องตรวจเงินเข้าจริง)':esc(o.checkslips_status==='processing'?'กำลังตรวจ':o.checkslips_status==='pending'?'อยู่ระหว่างรอผล':o.checkslips_status==='duplicate'?'สลิปซ้ำ':o.checkslips_status==='verified'?'ต้องตรวจยอดหรือผู้รับอีกครั้ง':o.checkslips_status==='submission_uncertain'?'รอตรวจสอบกับ CheckSlips':'รอแอดมินตรวจสอบ')}</b></div>`:''}${o.reward_code?`<div class="club-message">🎟️ คูปองจากออเดอร์: <b>${esc(o.reward_code)}</b></div>`:''}${o.member_points_awarded?`<div class="club-message">✨ ได้ ${Number(o.member_points_awarded)} แต้ม Happy Club</div>`:''}<a class="btn btn-secondary" id="trackLineBtn" target="_blank" rel="noopener noreferrer" href="${esc(lineURL())}">💚 ติดต่อร้านทาง LINE OA</a></div>`;}catch(ex){out.innerHTML=`<div class="track-result error">${esc(ex.message)}</div>`}});
async function loadSiteContent(){try{const r=await fetch('/.netlify/functions/site-content',{cache:'no-store'});siteContent=await r.json();applyLineLinks();const gameCopy=$('#gameDialog p');if(gameCopy&&siteContent?.loyalty?.gameMaxPoints)gameCopy.textContent=`เล่นฟรีวันละครั้ง 10 วินาที รับสูงสุด ${Number(siteContent.loyalty.gameMaxPoints)} แต้ม`;renderAdminPresence();maybeShowPopup()}catch{}}
function facebookEmbedUrl(p,width){
  try{
    const src=new URL(p.embedUrl||'https://www.facebook.com/plugins/post.php',location.origin);
    if(src.hostname.endsWith('facebook.com')&&src.pathname.startsWith('/plugins/'))src.searchParams.set('width',String(width));
    return src.toString();
  }catch{return p.embedUrl||''}
}
function maybeShowPopup(){
  const p=siteContent?.popup;if(!p?.active)return;
  const now=Date.now();if(p.startAt&&new Date(p.startAt).getTime()>now)return;if(p.endAt&&new Date(p.endAt).getTime()<now)return;
  if(p.showMode==='once_per_day'){const key=`hf_popup_${new Date().toLocaleDateString('en-CA')}`;if(localStorage.getItem(key))return;localStorage.setItem(key,'1')}
  $('#sitePopupTitle').textContent=p.title||'ประกาศ';$('#sitePopupBody').textContent=p.body||'';
  const media=$('#sitePopupMedia');media.innerHTML='';
  if(p.contentType==='image'&&p.imageKey)media.innerHTML=`<img class="promo-image" src="/api/media?key=${encodeURIComponent(p.imageKey)}&type=${encodeURIComponent(p.imageType||'image/jpeg')}&v=${encodeURIComponent(p.updatedAt||'')}" alt="${esc(p.title||'ประกาศ')}">`;
  if(p.contentType==='facebook'&&p.embedUrl){
    const width=Math.max(280,Math.min(500,window.innerWidth-58));
    media.innerHTML=`<div class="facebook-embed-wrap" style="width:${width}px"><iframe src="${esc(facebookEmbedUrl(p,width))}" width="${width}" height="${Number(p.embedHeight||610)}" title="Facebook post" style="border:none;overflow:hidden;width:${width}px" scrolling="no" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe></div>`;
  }
  const fb=$('#sitePopupFacebook'),fbUrl=p.facebookUrl||((p.contentType==='facebook'&&p.buttonUrl)?p.buttonUrl:'');
  if(fb&&fbUrl){fb.href=fbUrl;fb.classList.remove('hidden')}else fb?.classList.add('hidden');
  const a=$('#sitePopupButton');if(p.buttonLabel&&p.buttonUrl){a.textContent=p.buttonLabel;a.href=p.buttonUrl;a.classList.remove('hidden')}else a.classList.add('hidden');
  setTimeout(()=>$('#sitePopupDialog').showModal(),350)
}
$('#closeSitePopup').onclick=()=>$('#sitePopupDialog').close();
$('#agentForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),out=$('#agentMessage');out.textContent='กำลังส่ง…';try{const r=await fetch('/.netlify/functions/agent-apply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:f.get('name'),phone:f.get('phone'),contact:f.get('contact'),channel:f.get('channel'),pin:f.get('pin'),accepted:f.get('accepted')==='on'})}),d=await r.json();if(!r.ok)throw new Error(d.error);out.innerHTML=`<div class="track-result ok-message">✅ ${esc(d.message)}</div>`;e.currentTarget.reset()}catch(ex){out.innerHTML=`<div class="track-result error">${esc(ex.message)}</div>`}});
async function agentApi(url,opt={}){const r=await fetch(url,{...opt,headers:{'content-type':'application/json',...(agentToken?{authorization:`Bearer ${agentToken}`}:{}) ,...(opt.headers||{})},cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'เกิดข้อผิดพลาด');return d}
function renderAgentAccount(){const out=$('#agentLoggedOut'),inside=$('#agentLoggedIn');if(out)out.classList.toggle('hidden',!!agent);if(inside)inside.classList.toggle('hidden',!agent);if(agent){if($('#agentAccountName'))$('#agentAccountName').textContent=agent.name||'';if($('#agentAccountCode'))$('#agentAccountCode').textContent=agent.code||'';if($('#agentAccountStats')){const exp=agent.expires_at?new Date(agent.expires_at):null,expiry=exp&&!Number.isNaN(exp.getTime())?exp.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}):'-';$('#agentAccountStats').textContent=`ออเดอร์แนะนำสำเร็จ ${Number(agent.completed_orders||0)} • ค่าคอมค้าง ${money(agent.pending_commission||0)} • อายุบัญชีเหลือ ${Number(agent.days_remaining||0)} วัน (ถึง ${expiry})`}}}
function renderAgentModeBanner(){const section=$('#catalog');if(!section)return;let banner=$('#agentModeBanner');if(!agent){banner?.remove();return}if(!banner){banner=document.createElement('div');banner.id='agentModeBanner';banner.className='agent-mode-banner';section.insertBefore(banner,$('#catalogGrid'))}banner.innerHTML=`<div><b>🤝 โหมดตัวแทน ${esc(agent.code)}</b><span>ระบบกำลังแสดงราคาตัวแทน และจะคิดยอดตัวแทนตอนส่งออเดอร์</span></div><a href="/agent.html" class="mini-btn">บัญชีตัวแทน</a>`}
async function refreshAgent(){if(!agentToken){agent=null;renderAgentAccount();renderAgentModeBanner();return}try{const d=await agentApi('/.netlify/functions/agent-auth?action=profile',{method:'GET'});agent=d.agent;renderAgentAccount();renderAgentModeBanner()}catch{agentToken='';agent=null;localStorage.removeItem('hf_agent_token');renderAgentAccount();renderAgentModeBanner()}}
$('#agentLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),msg=$('#agentLoginMessage');if(msg)msg.textContent='กำลังเข้าสู่ระบบ…';try{const d=await agentApi('/.netlify/functions/agent-auth',{method:'POST',body:JSON.stringify({action:'login',phone:f.get('phone'),pin:f.get('pin')})});agentToken=d.token;agent=d.agent;localStorage.setItem('hf_agent_token',agentToken);renderAgentAccount();await fetchCatalog();if(msg)msg.textContent=''}catch(ex){if(msg)msg.textContent=ex.message}});
$('#agentForgotPinForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),msg=$('#agentForgotPinMessage'),btn=e.currentTarget.querySelector('button[type="submit"]');if(msg)msg.textContent='กำลังส่งคำขอ…';if(btn)btn.disabled=true;try{const d=await agentApi('/.netlify/functions/agent-auth',{method:'POST',body:JSON.stringify({action:'forgot-pin',phone:f.get('phone')})});if(msg)msg.innerHTML=`<div class="track-result ok-message">✅ ${esc(d.message||'ส่งคำขอแล้ว')}</div>`;e.currentTarget.reset()}catch(ex){if(msg)msg.innerHTML=`<div class="track-result error">${esc(ex.message)}</div>`}finally{if(btn)btn.disabled=false}});
$('#agentLogoutBtn')?.addEventListener('click',async()=>{try{if(agentToken)await agentApi('/.netlify/functions/agent-auth',{method:'POST',body:JSON.stringify({action:'logout'})})}catch{}agentToken='';agent=null;localStorage.removeItem('hf_agent_token');renderAgentAccount();renderAgentModeBanner();await fetchCatalog()});
async function memberApi(url,opt={}){const r=await fetch(url,{...opt,headers:{'content-type':'application/json',...(memberToken?{authorization:`Bearer ${memberToken}`}:{}) ,...(opt.headers||{})},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'เกิดข้อผิดพลาด');return d}
function renderMember(){const logged=!!member;$('#memberLoggedOut').classList.toggle('hidden',logged);$('#memberLoggedIn').classList.toggle('hidden',!logged);if(logged){$('#memberPoints').textContent=Number(member.points||0).toLocaleString('th-TH');$('#memberName').textContent=member.name||''}}
async function refreshMember(){try{const d=await memberApi('/.netlify/functions/member-auth?action=profile',{method:'GET'});member=d.member;renderMember()}catch{if(memberToken){memberToken='';localStorage.removeItem('hf_member_token')}member=null;renderMember()}}
$('#memberRegisterForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await memberApi('/.netlify/functions/member-auth',{method:'POST',body:JSON.stringify({action:'register',name:f.get('name'),phone:f.get('phone'),pin:f.get('pin')})});memberToken=d.token;localStorage.setItem('hf_member_token',memberToken);member=d.member;renderMember();e.currentTarget.reset()}catch(ex){alert(ex.message)}});
$('#memberLoginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await memberApi('/.netlify/functions/member-auth',{method:'POST',body:JSON.stringify({action:'login',phone:f.get('phone'),pin:f.get('pin')})});memberToken=d.token;localStorage.setItem('hf_member_token',memberToken);member=d.member;renderMember();e.currentTarget.reset()}catch(ex){alert(ex.message)}});
$('#memberLogoutBtn').onclick=async()=>{try{await fetch('/api/account?action=logout',{method:'POST'})}catch{}memberToken='';member=null;localStorage.removeItem('hf_member_token');renderMember()};
$('#dailySpinBtn').onclick=async()=>{const btn=$('#dailySpinBtn');btn.disabled=true;btn.classList.add('is-spinning');$('#memberMessage').textContent='กำลังสุ่มรางวัล…';try{const d=await memberApi('/.netlify/functions/member-reward',{method:'POST',body:JSON.stringify({action:'daily_spin'})});$('#memberMessage').innerHTML=d.result.type==='coupon'?`🎁 ได้ <b>${esc(d.result.code)}</b> — ${esc(d.result.label)}<br><small>ส่วนลดจริงจะตรวจตามกำไรของแพ็กตอนใช้</small>`:`✨ ${esc(d.result.label)}`;await refreshMember()}catch(ex){$('#memberMessage').textContent=ex.message}finally{btn.disabled=false;btn.classList.remove('is-spinning')}};
$$('[data-redeem]').forEach(b=>b.onclick=async()=>{try{const d=await memberApi('/.netlify/functions/member-reward',{method:'POST',body:JSON.stringify({action:'redeem',tier:Number(b.dataset.redeem)})});$('#memberMessage').innerHTML=`แลกสำเร็จ 🎟️ โค้ด <b>${esc(d.code)}</b> ลดสูงสุด ${money(d.discount)}`;await refreshMember()}catch(ex){$('#memberMessage').textContent=ex.message}});
function openGame(){if(!member)return alert('เข้าสู่ระบบสมาชิกก่อนครับ');$('#gameResult').textContent='';$('#gameDialog').showModal();resetGame()}
$('#playGameBtn').onclick=openGame;$('#closeGameBtn').onclick=()=>{clearInterval(gameTimer);$('#gameDialog').close()};
function resetGame(){clearInterval(gameTimer);gameSeconds=10;gameScore=0;$('#gameTime').textContent=gameSeconds;$('#gameScore').textContent=gameScore;$('#gameTarget').disabled=true;$('#startGameBtn').disabled=false;moveTarget()}
function moveTarget(){const a=$('#gameArena'),t=$('#gameTarget'),maxX=Math.max(0,a.clientWidth-56),maxY=Math.max(0,a.clientHeight-56);t.style.left=`${Math.random()*maxX}px`;t.style.top=`${Math.random()*maxY}px`}
$('#gameTarget').onclick=()=>{gameScore++;$('#gameScore').textContent=gameScore;moveTarget()};
$('#startGameBtn').onclick=()=>{$('#startGameBtn').disabled=true;$('#gameTarget').disabled=false;gameTimer=setInterval(async()=>{gameSeconds--;$('#gameTime').textContent=gameSeconds;if(gameSeconds<=0){clearInterval(gameTimer);$('#gameTarget').disabled=true;try{const d=await memberApi('/.netlify/functions/member-reward',{method:'POST',body:JSON.stringify({action:'game_reward',score:gameScore})});$('#gameResult').textContent=`จบเกม! คะแนน ${gameScore} — รับ ${d.points} แต้ม 🎉`;await refreshMember()}catch(ex){$('#gameResult').textContent=ex.message}}},1000)};
function setCustomerChatStatus(text,isError=false){const el=$('#customerChatStatus');if(!el)return;el.textContent=text||'';el.classList.toggle('error-text',!!isError)}
function initMotion(){const targets=$$('.section-head,.product-card,.steps article,.club-card,.agent-box,.track-section,.notice');targets.forEach((el,i)=>{el.classList.add('hf-reveal');el.style.transitionDelay=`${Math.min((i%6)*45,180)}ms`});if(!('IntersectionObserver'in window))return targets.forEach(x=>x.classList.add('hf-visible'));const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('hf-visible');io.unobserve(e.target)}}),{threshold:.08});targets.forEach(x=>io.observe(x))}
(async()=>{await refreshAgent();await fetchCatalog()})();fetchAdminPresence();loadSiteContent();refreshMember();setInterval(fetchAdminPresence,30000);requestAnimationFrame(initMotion);
