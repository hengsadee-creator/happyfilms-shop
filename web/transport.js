(function (root) {
  'use strict';
  const fail = message => { throw new Error(message); };
  function minorUnits(value) {
    if (!['string', 'number'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) fail('ราคาต้องเป็นตัวเลขและมีทศนิยมไม่เกิน 2 ตำแหน่ง');
    const [whole, fraction = ''] = String(value).split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) fail('ราคาเกินขอบเขตที่รองรับ');
    return Number(cents);
  }
  function quantity(value, min, max) {
    const text = String(value);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max) fail('กรุณาระบุจำนวนเต็มระหว่าง ' + min + '–' + max);
    return Number(text);
  }
  function validateQuote(data, expectedQuantity) {
    if (data?.ok !== true || data.quantity !== expectedQuantity) fail('จำนวนหรือราคาเปลี่ยน กรุณาคำนวณใหม่ก่อนชำระเงิน');
    const cents = minorUnits(data.price);
    if (cents < 5000) fail('ยอดสั่งซื้อขั้นต่ำ 50 บาท');
    return cents;
  }
  function label(value) {
    let text = String(value ?? '');
    const named = {amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' '};
    for (let pass = 0; pass < 3; pass++) text = text.replace(/&(?:([a-z]+)|#(\d+)|#x([a-f\d]+));/gi, (all, name, decimal, hex) => {
      if (name) return named[name.toLowerCase()] ?? all;
      const code = parseInt(decimal || hex, decimal ? 10 : 16);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : all;
    });
    return text; // Callers use textContent/Option or escape again before HTML.
  }
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  async function json(path, options = {}) {
    const method = options.method || (options.data === undefined ? 'GET' : 'POST');
    const safe = method.toUpperCase() === 'GET';
    for (let attempt = 0; ; attempt++) {
      let response, data;
      try {
        const timeout = AbortSignal.timeout(10000);
        response = await fetch(path, {
          method, credentials:'same-origin', cache:'no-store', redirect:'error',
          signal:options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
          headers:{'Content-Type':'application/json', ...(options.token ? {Authorization:'Bearer ' + options.token} : {}), ...(options.idempotencyKey ? {'Idempotency-Key':options.idempotencyKey} : {})},
          ...(options.data === undefined ? {} : {body:JSON.stringify(options.data)})
        });
        const retryHeader=response.headers.get('Retry-After');
        const retrySeconds=retryHeader?(/^\d+$/.test(retryHeader)?Number(retryHeader):Math.max(1,Math.ceil((Date.parse(retryHeader)-Date.now())/1000))):0;
        if (safe && attempt < 2 && [429,500,502,503,504].includes(response.status) && (!retrySeconds || retrySeconds <= 2)) {
          await response.body?.cancel();await wait(retrySeconds ? retrySeconds * 1000 : 200 * 2 ** attempt + Math.floor(Math.random() * 100));continue;
        }
        try { data = await response.json(); }
        catch { throw Object.assign(new Error('ระบบตอบกลับไม่สมบูรณ์ กรุณาตรวจสถานะก่อนส่งซ้ำ'), {uncertain:!safe, status:response.status}); }
        if (data === null || typeof data !== 'object') throw Object.assign(new Error('ยังยืนยันคำตอบจากระบบไม่ได้ กรุณาตรวจสอบออเดอร์ก่อนส่งซ้ำ'), {uncertain:!safe, status:response.status});
        if (!response.ok) {
          const message = response.status === 429 ? 'มีคำขอมากเกินไป กรุณารอแล้วลองอีกครั้ง' : response.status >= 500 ? 'ระบบตอบช้าหรือขัดข้อง กรุณาตรวจสถานะก่อนส่งซ้ำ' : response.status === 401 || response.status === 403 ? 'กรุณาเข้าสู่ระบบใหม่หรือใช้หน้าร้านที่ถูกต้อง' : 'ข้อมูลยังไม่ถูกต้อง กรุณาตรวจจำนวนและรายละเอียดอีกครั้ง';
          throw Object.assign(new Error(message), {status:response.status, retryAfter:retrySeconds, uncertain:!safe && response.status >= 500, requestId:response.headers.get('x-request-id')});
        }
        return data;
      } catch (error) {
        if (options.signal?.aborted) throw Object.assign(new Error('ยกเลิกการคำนวณครั้งก่อนแล้ว'), {cancelled:true});
        if (error.status !== undefined || error.uncertain !== undefined) throw error;
        if (safe && attempt < 2) { await wait(200 * 2 ** attempt + Math.floor(Math.random() * 100));continue; }
        throw Object.assign(new Error(safe ? 'เชื่อมต่อไม่ได้ กรุณาลองโหลดอีกครั้ง' : 'ยังยืนยันผลการส่งออเดอร์ไม่ได้ กรุณาตรวจสอบกับร้านก่อนส่งซ้ำ'), {uncertain:!safe});
      }
    }
  }
  class SubmissionGuard {
    constructor(storage, name = 'hf_pending_legacy_order') { this.storage=storage;this.name=name;this.current=null;try { this.current=JSON.parse(storage?.getItem(name)||'null'); } catch {} }
    get blocked() { return ['sending','unknown'].includes(this.current?.state); }
    save() { try {if(this.current)this.storage?.setItem(this.name,JSON.stringify(this.current));else this.storage?.removeItem(this.name);} catch {} }
    begin() { if(this.blocked)fail('มีออเดอร์ที่ยังไม่ทราบผล กรุณาตรวจสอบกับร้านก่อนส่งซ้ำ');this.current={key:crypto.randomUUID(),state:'sending',created:Date.now()};this.save();return this.current.key; }
    fail(error) { if(error.uncertain&&this.current)this.current.state='unknown';else this.current=null;this.save(); }
    complete() { this.current=null;this.save(); }
  }
  root.HFTransport=Object.freeze({json,minorUnits,quantity,validateQuote,label,SubmissionGuard});
})(globalThis);
