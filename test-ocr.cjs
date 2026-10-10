const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('camera-ocr.js','utf8');
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,disabled:false,hidden:false,addEventListener(){},replaceChildren(){},close(){},getContext(){return {clearRect(){}}},checkValidity(){return true}});return elements.get(id)};
let selections=[],saved=0;const context={state:{entries:[]},editingMonth:null,monthLabel:v=>v,fillForm(){},console,URL,setTimeout,clearTimeout,window:{addEventListener(){}},document:{getElementById:el,addEventListener(){},querySelectorAll(){return selections}},validCycleDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d,confirm:()=>true,toast(){},updatePreview(){},setMonthPicker(v){el('fMonth').value=v},saveState(){saved++}};
vm.createContext(context);vm.runInContext(source,context);
assert.equal(context.ocrNumber('5.444'),5444);assert.equal(context.ocrNumber('507,71'),507.71);assert.equal(context.ocrMeterNumber('158.123'),158.123);
const sample={text:'ANTERIOR ATUAL\n17/08/2026 15/09/2026\n5444 5466\nMULTIPLICADOR 10\nVENCIMENTO 10/10/2026\nPROXIMA LEITURA 16/10/2026\nSETEMBRO 2026\nTOTAL A PAGAR R$ 507,71',confidence:90};
const invoice=context.parseInvoiceOcr(sample).values;assert.equal(invoice.startDate,'2026-08-17');assert.equal(invoice.endDate,'2026-09-15');assert.equal(invoice.startReading,5444);assert.equal(invoice.endReading,5466);assert.equal(invoice.multiplier,10);assert.equal(invoice.totalBill,507.71);assert.equal(invoice.month,'2026-09');assert.equal(invoice.nextReadingDate,'2026-10-16');
assert.equal((Date.parse(invoice.endDate)-Date.parse(invoice.startDate))/86400000,29);
assert.equal(context.parseMeterOcr({text:'03 158.123 kWh',confidence:90},'03').values.reading,158.123);
assert.equal(context.parseMeterOcr({text:'103 158.123 kWh'},'03').values.reading,null);
assert.equal(context.parseMeterOcr({text:'03 158.123 99999'},'03').values.reading,null);
assert.equal(context.parseMeterOcr({text:'158.123'},'03').values.reading,null);
// Numeric review inputs are already normalized by HTML; decimals must remain decimals.
vm.runInContext("ocrTarget='invoice'",context);el('ocrConfirm').checked=true;selections=[{checked:true,dataset:{ocrField:'startReading'}}];el('ocrValue-startReading').type='number';el('ocrValue-startReading').value='1.234';context.applyOcrReview();assert.equal(el('fCycleStartReading').value,1.234);assert.equal(saved,0);
// CSP covers the entire embedded signed script and permits local WASM.
const inline=html.split('<script>')[1].split('</script>')[0],hash=crypto.createHash('sha256').update(inline).digest('base64');assert(html.includes("'sha256-"+hash+"'"));assert(html.includes("'wasm-unsafe-eval'"));assert(inline.includes(source.trimEnd()));
const libHash=crypto.createHash('sha256').update(fs.readFileSync('vendor/ocr/tesseract.min.js')).digest('base64');assert(source.includes('sha256-'+libHash));new vm.Script(inline);
console.log('PASS: invoice dates/readings, multiplier, meter ambiguity/code, decimal review, no automatic persistence, signed script and pinned OCR');

const pdf=context.parseInvoicePdf('MES/ANO 09/2026\nANTERIOR ATUAL\n17/08/2026 15/09/2026\nEQUIPAMENTOS DE MEDICAO E CONSUMO NO PERIODO\nMEDIDOR DATA LEITURA LEITURA DATA LEITURA LEITURA FATOR CONSUMO\nTESTE 18/08/2026 6000.0 15/09/2026 6022.0 10.0 220.0 29\nCIP - ILUM PUB 20,15 0,00\nTOTAL A PAGAR\nCONTA R$ 123,45');assert.equal(pdf.values.month,'2026-09');assert.equal(pdf.values.startReading,6000);assert.equal(pdf.values.endReading,6022);assert.equal(pdf.values.multiplier,10);assert.equal(pdf.values.gridImported,220);assert.equal(pdf.values.cip,20.15);assert.equal(pdf.values.totalBill,123.45);assert(pdf.warnings.some(w=>w.includes('difere')));assert(!Object.hasOwn(pdf.values,'injected'));console.log('PASS: PDF columns, numeric reference, consumption, CIP and conflicting dates');
