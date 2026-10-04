const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let accept=true;page.on('dialog',d=>accept?d.accept():d.dismiss());
  await page.goto('file://'+path.resolve('index.html'));
  await page.evaluate(()=>{
   state.entries=[{month:'2026-09',generation:300,gridImported:220,injected:100,creditsUsed:10,creditBalance:30,totalBill:90,cip:20,extras:0,billingCycle:null},{month:'2026-10',generation:400,gridImported:200,injected:120,creditsUsed:12,creditBalance:45,totalBill:110,cip:25,extras:5,billingCycle:null}];
   saveState();fillForm(state.entries[0]);goTo('entries');
  });
  assert.equal(await page.locator('#cycleInvoiceTitle').locator('..').locator('[data-ocr="cycle"]').count(),4);
  const review=async(target,values)=>{await page.evaluate(({target,values})=>{prepareOcr(target,'file');renderOcrReview({values,warnings:[],text:'Teste controlado de reconhecimento'});},{target,values});await page.locator('#ocrConfirm').check();await page.locator('#ocrApply').click();};
  await review('cycle',{month:'2026-10',startDate:'2026-09-15',endDate:'2026-10-15',startReading:5444,endReading:5466,multiplier:10,dueDate:'2026-10-25',nextReadingDate:'2026-11-16'});
  assert.equal(await page.inputValue('#fMonth'),'2026-10');assert.equal(await page.inputValue('#fGeneration'),'400');assert.equal(await page.inputValue('#fBill'),'110');
  assert.equal(await page.locator('#monthSave').textContent(),'Salvar alterações');
  // Reviewed OCR still has not modified persisted entries.
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).entries[1].billingCycle),null);
  await page.locator('#cycleUseConsumption').click();await page.locator('#monthSave').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).entries);
  assert.equal(saved.length,2);assert.equal(saved[0].month,'2026-09');assert.equal(saved[0].gridImported,220);assert.equal(saved[0].billingCycle,null);
  assert.equal(saved[1].generation,400);assert.equal(saved[1].totalBill,110);assert.equal(saved[1].injected,120);assert.equal(saved[1].gridImported,220);assert.equal(saved[1].billingCycle.endReading,5466);
  // Another partial picture in the same month retains unselected fields.
  await review('cycle',{endReading:5470});assert.equal(await page.inputValue('#fCycleStartReading'),'5444');assert.equal(await page.inputValue('#fCycleDue'),'2026-10-25');
  // Cancelling a target-month switch preserves both pending form and saved data.
  const before=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));accept=false;
  await review('invoice',{month:'2026-09',totalBill:99});assert.equal(await page.inputValue('#fMonth'),'2026-10');assert.equal(await page.inputValue('#fCycleEndReading'),'5470');assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),before);
  await page.locator('#ocrClose').click();accept=true;
  // A new OCR reference creates a separate month, without moving the original.
  await review('invoice',{month:'2026-11',totalBill:88});assert.equal(await page.inputValue('#fGeneration'),'');await page.locator('#monthSave').click();
  const months=await page.evaluate(()=>state.entries.map(e=>e.month));assert.deepEqual(months,['2026-09','2026-10','2026-11']);
  await page.reload();assert.equal(await page.evaluate(()=>state.entries.find(e=>e.month==='2026-11').totalBill),88);
  // Meter capture continues to preserve decimals and requires separate save.
  await page.evaluate(()=>goTo('meter'));await review('03',{reading:158.123});assert.equal(await page.inputValue('#meterImported'),'158.123');
  assert.deepEqual(errors,[]);
  console.log('PASS: cycle buttons, existing/new month OCR, save/reload, selective preservation, cancelled transfer, meter decimals, no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
