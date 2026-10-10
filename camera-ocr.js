// Camera and OCR keep images/text only in memory; only reviewed fields reach the normal forms.
let ocrTarget=null,ocrMode=null,ocrToken=0,ocrBusy=false,ocrStream=null,ocrWorkerPromise=null,ocrTimer=null,ocrLoadPromise=null,ocrLastResult=null,ocrLastFrame=null,ocrStableKey='',ocrStableCount=0,ocrOriginal=null,ocrImage=null,ocrSelection=null,ocrDrag=null;
const ocrFields=[
 {key:'month',label:'Referência da fatura',type:'month'},
 {key:'startDate',label:'Início do ciclo — data anterior',type:'date',id:'fCycleStart'},
 {key:'startReading',label:'Leitura anterior',type:'number',id:'fCycleStartReading'},
 {key:'endDate',label:'Fechamento efetivo — data atual',type:'date',id:'fCycleEnd'},
 {key:'endReading',label:'Leitura atual',type:'number',id:'fCycleEndReading'},
 {key:'multiplier',label:'Multiplicador da fatura',type:'number',id:'fCycleMultiplier'},
 {key:'dueDate',label:'Vencimento',type:'date',id:'fCycleDue'},
 {key:'nextReadingDate',label:'Próximo fechamento previsto',type:'date',id:'fCycleNext'},
 {key:'totalBill',label:'Conta total (R$)',type:'number',id:'fBill'},
 {key:'gridImported',label:'Consumo da rede (kWh)',type:'number',id:'fGrid'},
 {key:'cip',label:'Iluminação pública — CIP (R$)',type:'number',id:'fCip'}
];
function ocrInvoiceTarget(){return ocrTarget==='invoice'||ocrTarget==='cycle';}
function ocrReviewFields(){return ocrTarget==='cycle'?ocrFields.filter(field=>!['totalBill','gridImported','cip'].includes(field.key)):ocrFields;}
function ocrNormalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function ocrNumber(text){
 const s=String(text||'').trim().replace(/\s/g,'');if(!/^\d+(?:[.,]\d+)*$/.test(s))return null;
 let clean=s;if(s.includes(','))clean=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))clean=s.replace(/\./g,'');
 const value=Number(clean);return Number.isFinite(value)&&value>=0&&value<=1e9?value:null;
}
function ocrMeterNumber(text){const s=String(text||'').trim().replace(/\s/g,'');if(!/^\d+(?:[.,]\d{1,3})?$/.test(s))return null;const value=Number(s.replace(',','.'));return Number.isFinite(value)&&value>=0&&value<=1e9?value:null;}
function ocrDates(text){
 const found=[];for(const match of String(text||'').matchAll(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(20\d{2}|\d{2})\b/g)){const year=match[3].length===2?'20'+match[3]:match[3];const date=year+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');if(validCycleDate(date))found.push({value:date,index:match.index,text:match[0]});}return found;
}
function ocrWords(data){const result=[];for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[])if(word.text&&word.bbox)result.push({...word,lineText:line.text||''});return result;}
function ocrAnchorDate(words,label){
 const anchors=words.filter(w=>label.test(ocrNormalize(w.text)));let best=null;
 for(const anchor of anchors){const h=Math.max(10,anchor.bbox.y1-anchor.bbox.y0),cx=(anchor.bbox.x0+anchor.bbox.x1)/2;
  for(const word of words){const date=ocrDates(word.text)[0];if(!date)continue;const dy=word.bbox.y0-anchor.bbox.y0,dx=Math.abs((word.bbox.x0+word.bbox.x1)/2-cx);
   if(dy< -h||dy>h*10||dx>h*12)continue;const score=Math.abs(dy)+dx*.7;if(!best||score<best.score)best={value:date.value,word,score};
  }
 }return best;
}
function ocrReadingBelow(words,date){
 if(!date)return null;const b=date.word.bbox,h=Math.max(10,b.y1-b.y0),cx=(b.x0+b.x1)/2;let best=null;
 for(const w of words){if(ocrDates(w.text).length||!/^\d{3,}(?:[.,]\d+)*$/.test(w.text.trim()))continue;const value=ocrNumber(w.text);if(value==null)continue;const dy=w.bbox.y0-b.y1,dx=Math.abs((w.bbox.x0+w.bbox.x1)/2-cx);if(dy< -h*.4||dy>h*9||dx>Math.max(h*6,(b.x1-b.x0)*.7))continue;const score=Math.max(0,dy)+dx*.9;if(!best||score<best.score)best={value,score};}return best?.value??null;
}
function parseInvoiceOcr(data){
 const text=data.text||'',norm=ocrNormalize(text),words=ocrWords(data),values={},warnings=[];
 const start=ocrAnchorDate(words,/^ANTERIOR$/),end=ocrAnchorDate(words,/^ATUAL$/),due=ocrAnchorDate(words,/^VENCIMENTO$/),next=ocrAnchorDate(words,/^(PROXIMA|PROXIMO)$/);
 if(start)values.startDate=start.value;if(end)values.endDate=end.value;if(due)values.dueDate=due.value;if(next)values.nextReadingDate=next.value;
 const previous=ocrReadingBelow(words,start),current=ocrReadingBelow(words,end);if(previous!=null)values.startReading=previous;if(current!=null)values.endReading=current;
 // Text fallback handles flat exports and close-up photos of the reading table.
 const lines=norm.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  if(/ANTERIOR/.test(lines[i])&&/ATUAL/.test(lines[i])){
   for(let j=i+1;j<Math.min(lines.length,i+5);j++){const ds=ocrDates(lines[j]);if(ds.length>=2){values.startDate??=ds[0].value;values.endDate??=ds[1].value;
    for(let k=j+1;k<Math.min(lines.length,j+5);k++){if(ocrDates(lines[k]).length)continue;const nums=(lines[k].match(/\b\d{3,}(?:[.,]\d+)*\b/g)||[]).map(ocrNumber).filter(v=>v!=null);if(nums.length>=2){values.startReading??=nums[0];values.endReading??=nums[1];break;}}break;
   }}
  }
  for(const [key,label] of [['dueDate',/VENCIMENTO/],['nextReadingDate',/PROXIM[AO].*(LEITURA|FECHAMENTO)/]])if(label.test(lines[i])){
   const dates=ocrDates(lines.slice(i,i+3).join('\n'));if(dates.length)values[key]??=dates[0].value;
  }
 }
 const multiplier=norm.match(/MULTIPLICADOR\s*[:=]?\s*(\d+(?:[.,]\d+)?)/);if(multiplier){const factor=ocrNumber(multiplier[1]);if(factor>0&&factor<=1e6)values.multiplier=factor;}
 const months=['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];const month=norm.match(new RegExp('('+months.join('|')+')\\s*(?:DE\\s*)?(20\\d{2})'));if(month)values.month=month[2]+'-'+String(months.indexOf(month[1])+1).padStart(2,'0');
 const bill=norm.match(/TOTAL\s+A\s+PAGAR[^\d]{0,30}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/);if(bill)values.totalBill=ocrNumber(bill[1]);
 if(values.startDate&&values.endDate&&values.endDate<=values.startDate){delete values.startDate;delete values.endDate;warnings.push('As datas reconhecidas não formam um ciclo válido. Confira e preencha manualmente.');}
 if(values.startReading!=null&&values.endReading!=null&&values.endReading<values.startReading){delete values.startReading;delete values.endReading;warnings.push('As leituras reconhecidas estão em ordem incompatível. Confira na fatura.');}
 if(values.nextReadingDate&&values.nextReadingDate<=(values.endDate||values.startDate||'')){delete values.nextReadingDate;warnings.push('A próxima leitura precisa ser conferida na fatura.');}
 if(values.multiplier==null)warnings.push('Multiplicador não identificado. Confira o fator na fatura antes de calcular o consumo; ele não será presumido pelo reconhecimento.');
 return {values,warnings,text,confidence:data.confidence||0};
}
function parseMeterOcr(data,target){
 const text=data.text||'',norm=ocrNormalize(text),words=ocrWords(data),codes=[...new Set((norm.match(/\b(?:103|03)\b/g)||[]))];let candidates=[];
 if(words.length)for(const w of words){const t=w.text.trim(),value=ocrMeterNumber(t);if(value==null||/^(03|103)$/.test(t)||ocrDates(w.lineText).length)continue;const digits=t.replace(/\D/g,'').length;if(digits<3&&!/KWH/.test(ocrNormalize(w.lineText)))continue;const area=(w.bbox.x1-w.bbox.x0)*(w.bbox.y1-w.bbox.y0),unit=/KWH/.test(ocrNormalize(w.lineText));candidates.push({value,text:t,score:area*(unit?4:1),confidence:w.confidence||0});}
 if(!candidates.length){const withoutDates=norm.replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g,'');for(const m of withoutDates.matchAll(/\b\d{3,}(?:[.,]\d{1,3})?\b/g)){if(m[0]==='103')continue;const value=ocrMeterNumber(m[0]);if(value!=null)candidates.push({value,text:m[0],score:1,confidence:data.confidence||0});}}
 candidates=candidates.sort((a,b)=>b.score-a.score).filter((x,i,all)=>all.findIndex(y=>y.value===x.value)===i).slice(0,5);
 const unambiguous=candidates.length===1||candidates.length>1&&candidates[0].score>candidates[1].score*1.7;
 const warnings=[];if(codes.length!==1)warnings.push('O código do visor não foi identificado com segurança. Confira se a imagem mostra '+target+'.');else if(codes[0]!==target)warnings.push('A imagem parece mostrar o código '+codes[0]+', mas você escolheu '+target+'. Não misture as duas leituras; capture o código correto se necessário.');
 if(!unambiguous)warnings.push('Há números diferentes ou nenhuma leitura clara. Recorte somente o visor ou informe o total após conferir.');
 return {values:{reading:unambiguous&&codes.length===1&&codes[0]===target?candidates[0].value:null},warnings,text,codes,candidates,confidence:data.confidence||0};
}
function ocrSetStatus(message){document.getElementById('ocrStatus').textContent=message;}
function ocrStopStream(){clearTimeout(ocrTimer);ocrTimer=null;if(ocrStream){ocrStream.getTracks().forEach(track=>track.stop());ocrStream=null;}const video=document.getElementById('ocrVideo');video.srcObject=null;video.hidden=true;document.getElementById('ocrReadFrame').hidden=true;document.getElementById('ocrFinishLive').hidden=true;}
function closeOcr(){ocrToken++;ocrStopStream();if(ocrWorkerPromise){ocrWorkerPromise.then(w=>w.terminate()).catch(()=>{});ocrWorkerPromise=null;}ocrBusy=false;ocrLastResult=null;ocrLastFrame=null;ocrOriginal=null;ocrImage=null;ocrSelection=null;ocrDrag=null;document.getElementById('ocrCanvas').getContext('2d').clearRect(0,0,document.getElementById('ocrCanvas').width,document.getElementById('ocrCanvas').height);document.getElementById('ocrReview').replaceChildren();document.getElementById('ocrText').textContent='';document.getElementById('ocrDialog').close();}
function prepareOcr(target,mode){
 closeOcr();ocrTarget=target;ocrMode=mode;ocrStableKey='';ocrStableCount=0;const dialog=document.getElementById('ocrDialog');
 document.getElementById('ocrTitle').textContent=target==='cycle'?'Reconhecer fechamento do ciclo':target==='invoice'?'Reconhecer fatura':'Reconhecer código '+target;
 document.getElementById('ocrHint').textContent=ocrInvoiceTarget()?'Mantenha a fatura iluminada e sem reflexos. Para datas e leituras, aproxime o quadro Anterior/Atual. Você pode usar mais de uma foto da mesma fatura, sem substituir os campos não reconhecidos.':'Enquadre apenas o visor com o código '+target+' e o total acumulado. Aguarde a alternância do visor e confira as casas decimais.';
 document.getElementById('ocrWarnings').textContent='';document.getElementById('ocrConfirm').checked=false;document.getElementById('ocrConfirmationLabel').hidden=true;document.getElementById('ocrTextDetails').hidden=true;document.getElementById('ocrApply').disabled=true;
 for(const id of ['ocrCanvas','ocrVideo','ocrReadFrame','ocrFinishLive','ocrCrop','ocrRotate','ocrReset','ocrRetry'])document.getElementById(id).hidden=true;
 ocrSetStatus(mode==='live'?'Solicitando acesso à câmera…':'Selecione ou capture uma imagem.');dialog.showModal();return ocrToken;
}
function openOcr(target,mode){
 if(!['invoice','cycle','03','103'].includes(target))return;prepareOcr(target,mode);
 if(mode==='live')startOcrLive();else document.getElementById(mode==='pdf'?'ocrPdfInput':mode==='photo'?'ocrCameraInput':'ocrFileInput').click();
}
// PDF text is grouped by page coordinates, avoiding column-order errors in invoices.
function invoicePdfLines(items){
 const rows=[];for(const item of items){if(!item.str?.trim())continue;const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2.5);if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
 return rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')).join('\n');
}
function parseInvoicePdf(text,blocks=[]){
 text=text.replace(/\b\d{1,2}\s*[\/.-]\s*\d{1,2}\s*[\/.-]\s*\d{2}\b(?!\d)/g,'');
 const result=parseInvoiceOcr({text,blocks,confidence:100}),v=result.values,n=ocrNormalize(text),lines=n.split('\n');
 // The current reference is taken only beside MÊS/ANO, never from invoice due dates.
 for(let i=0;i<lines.length;i++)if(/MES\s*\/\s*ANO/.test(lines[i])){const m=lines.slice(i,i+4).join(' ').match(/\b(0[1-9]|1[0-2])\s*\/\s*(20\d{2})\b/);if(m){v.month=m[2]+'-'+m[1];break;}}
 for(let i=0;i<lines.length;i++)if(/EQUIPAMENTOS DE MEDICAO/.test(lines[i])){
  for(const line of lines.slice(i+1,i+6)){const dates=ocrDates(line);if(dates.length<2)continue;
   const first=line.slice(dates[0].index+dates[0].text.length,dates[1].index).match(/\b\d+(?:[.,]\d+)?\b/),tail=line.slice(dates[1].index+dates[1].text.length).match(/\b\d+(?:[.,]\d+)?\b/g)||[];
   if(first&&tail.length>=3){v.startReading=ocrNumber(first[0]);v.endReading=ocrNumber(tail[0]);v.multiplier=ocrNumber(tail[1]);v.gridImported=ocrNumber(tail[2]);
    if(v.startDate&&v.startDate!==dates[0].value)result.warnings.push('A data anterior do cabeçalho ('+v.startDate.split('-').reverse().join('/')+') difere da tabela de medição ('+dates[0].text+'). Confira qual usar antes de salvar.');
    v.startDate??=dates[0].value;v.endDate??=dates[1].value;
    if(v.endReading<v.startReading||v.multiplier<=0){delete v.startReading;delete v.endReading;delete v.multiplier;delete v.gridImported;result.warnings.push('A tabela de medição precisa ser conferida.');}
    else if(Math.abs((v.endReading-v.startReading)*v.multiplier-v.gridImported)>.1)result.warnings.push('O consumo informado difere do cálculo das leituras e do multiplicador. Confira na fatura.');
    break;
   }
  }break;
 }
 const cip=n.match(/\bCIP\b[^\n]*?\s(\d{1,3}(?:\.\d{3})*,\d{2})\b/);if(cip)v.cip=ocrNumber(cip[1]);
 for(let i=0;i<lines.length;i++)if(/TOTAL\s+A\s+PAGAR/.test(lines[i])){const amount=lines.slice(i,i+4).join(' ').match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\b/);if(amount){v.totalBill=ocrNumber(amount[1]);break;}}
 if(v.multiplier!=null)result.warnings=result.warnings.filter(w=>!w.startsWith('Multiplicador não identificado.'));
 return result;
}
async function readOcrPdf(file){
 const token=ocrToken;let doc=null,task=null;ocrBusy=true;refreshOcrApply();
 try{
  if(file.size>20*1024*1024)throw new Error('Selecione um PDF de até 20 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,1024)).indexOf('%PDF-')<0)throw new Error('O arquivo não é um PDF válido.');
  ocrSetStatus('Abrindo PDF neste aparelho…');
  const pdf=await import(new URL('vendor/ocr/pdf.min.mjs',location.href).href);if(token!==ocrToken)return;
  pdf.GlobalWorkerOptions.workerSrc=new URL('vendor/ocr/pdf.worker.min.mjs',location.href).href;
  task=pdf.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true});doc=await task.promise;if(token!==ocrToken)return;
  if(doc.numPages>10)throw new Error('Use um PDF com até 10 páginas, contendo apenas uma fatura.');
  let text='',scanned=false,blocks=[];
  for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
   if(token!==ocrToken)return;ocrSetStatus('Lendo página '+pageNumber+' de '+doc.numPages+'…');const page=await doc.getPage(pageNumber),content=await page.getTextContent();let pageText=invoicePdfLines(content.items);
   if(pageNumber===1){const height=page.getViewport({scale:1}).height;blocks=[{paragraphs:[{lines:content.items.filter(i=>i.str?.trim()).map(i=>{const tokens=i.str.trim().split(/\s+/),width=i.width/tokens.length;return {text:i.str,words:tokens.map((word,k)=>({text:word,bbox:{x0:(i.transform[4]+k*width)*4,x1:(i.transform[4]+(k+1)*width)*4,y0:(height-i.transform[5]-Math.abs(i.transform[3]))*4,y1:(height-i.transform[5])*4}}))};})}]}];}
   if(pageText.replace(/\s/g,'').length<80){
    scanned=true;const original=page.getViewport({scale:1}),scale=Math.min(2.5,2200/Math.max(original.width,original.height)),viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(token!==ocrToken)return;
    const worker=await getOcrWorker();if(token!==ocrToken)return;await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});const recognized=await worker.recognize(canvas,{}, {text:true});pageText=recognized.data.text;canvas.width=canvas.height=0;
   }
   text+=pageText+'\n';page.cleanup();
  }
  if(token!==ocrToken)return;const result=parseInvoicePdf(text,blocks);if(scanned)result.warnings.push('Este PDF contém páginas digitalizadas: confira os valores reconhecidos na imagem.');
  ocrLastResult=result;ocrBusy=false;renderOcrReview(result);ocrSetStatus('PDF lido. Confira os campos, aplique e depois salve o mês.');
 }catch(error){if(token===ocrToken){ocrBusy=false;ocrSetStatus(error?.name==='PasswordException'?'O PDF está protegido por senha. Use uma cópia sem proteção.':'Não foi possível ler o PDF. '+(error.message||'Tente novamente.'));}}
 finally{if(task)await task.destroy().catch(()=>{});if(token===ocrToken){ocrBusy=false;refreshOcrApply();}}
}
function loadOcrLibrary(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!ocrLoadPromise)ocrLoadPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/ocr/tesseract.min.js';script.integrity='sha256-EP/3hIQGd1nEMCigKnLXbQuQ6xcwK7I7WKnsVBC8kos=';script.crossOrigin='anonymous';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('Reconhecimento indisponível.'));script.onerror=()=>{script.remove();ocrLoadPromise=null;reject(new Error('Não foi possível carregar o leitor. No navegador, conecte-se para a primeira leitura; no app, instale a versão Android 2.10.0.'));};document.head.appendChild(script);});return ocrLoadPromise;
}
async function getOcrWorker(){
 if(!ocrWorkerPromise)ocrWorkerPromise=(async()=>{
  const T=await loadOcrLibrary(),base=new URL('vendor/ocr/',location.href).href;
  return new Promise((resolve,reject)=>{
   let settled=false;const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
   const timer=setTimeout(()=>fail(new Error('O leitor demorou para iniciar. Feche esta tela e tente novamente.')),90000);
   const task=T.createWorker('por+eng',1,{workerPath:base+'worker.min.js',corePath:base.replace(/\/$/,''),langPath:base.replace(/\/$/,''),workerBlobURL:false,gzip:!window.Android,cacheMethod:'write',errorHandler:error=>fail(new Error(String(error))),logger:m=>{if(!ocrBusy)return;const labels={'loading tesseract core':'Preparando reconhecimento','initializing tesseract':'Preparando reconhecimento','loading language traineddata':'Carregando leitura em português','initializing api':'Preparando leitor','recognizing text':'Reconhecendo imagem'};if(labels[m.status])ocrSetStatus(labels[m.status]+'… '+Math.round((m.progress||0)*100)+'%');}});
   task.then(worker=>{clearTimeout(timer);if(settled){worker.terminate();return;}settled=true;resolve(worker);},fail);
  });
 })();
 try{return await ocrWorkerPromise;}catch(error){ocrWorkerPromise=null;throw error;}
}
function ocrCopyCanvas(source){const c=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(source.width,source.height));c.width=Math.round(source.width*scale);c.height=Math.round(source.height*scale);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;}
function drawOcrPhoto(){const canvas=document.getElementById('ocrCanvas');if(!ocrImage)return;canvas.width=ocrImage.width;canvas.height=ocrImage.height;const ctx=canvas.getContext('2d');ctx.drawImage(ocrImage,0,0);if(ocrSelection){const r=ocrSelection;ctx.strokeStyle='#1684d6';ctx.lineWidth=Math.max(3,canvas.width/300);ctx.strokeRect(r.x,r.y,r.w,r.h);}canvas.hidden=false;}
async function decodeOcrPhoto(file){
 // Some Android document pickers provide valid JPEG bytes but unusable blob URLs.
 // Try browser decoders independently; preserve orientation when supported.
 let bitmap=null;
 if(typeof createImageBitmap==='function'){
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
  catch(_){try{bitmap=await createImageBitmap(file);}catch(__){}}
 }
 if(bitmap){
  try{
   if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>50000000)throw new Error('A foto tem resolução excessiva ou inválida.');
   const c=document.createElement('canvas'),s=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
   c.width=Math.max(1,Math.round(bitmap.width*s));c.height=Math.max(1,Math.round(bitmap.height*s));
   c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);return c;
  }finally{bitmap.close();}
 }
 const loadImage=src=>new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Falha na decodificação da imagem.'));img.src=src;
 });
 let photo=null,objectUrl=null;
 try{
  objectUrl=URL.createObjectURL(file);
  try{photo=await loadImage(objectUrl);}catch(_){}
 }finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}
 if(!photo){
  // Data URL fallback also supports content-provider blobs rejected by WebView.
  if(typeof FileReader==='undefined')throw new Error('Não foi possível acessar a foto selecionada.');
  const src=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler os dados da foto.'));reader.readAsDataURL(file);
  });
  try{photo=await loadImage(src);}catch(_){throw new Error('Não foi possível decodificar a foto selecionada. Abra-a na Galeria e salve uma cópia JPG antes de tentar novamente.');}
 }
 const width=photo.naturalWidth,height=photo.naturalHeight;
 if(!width||!height||width*height>50000000)throw new Error('A foto tem resolução excessiva ou inválida.');
 const c=document.createElement('canvas'),s=Math.min(1,2200/Math.max(width,height));
 c.width=Math.max(1,Math.round(width*s));c.height=Math.max(1,Math.round(height*s));
 c.getContext('2d').drawImage(photo,0,0,c.width,c.height);return c;
}
async function readOcrPhoto(file){
 const token=ocrToken;if(!file)return;if(file.size>20*1024*1024){ocrSetStatus('A imagem é muito grande. Escolha uma foto de até 20 MB.');return;}
 try{
  if(file.type&&!/^image\//.test(file.type))throw new Error('Selecione uma foto JPEG ou PNG.');
  ocrSetStatus('Abrindo fotografia…');
  const c=await decodeOcrPhoto(file);
  if(token!==ocrToken)return;
  ocrOriginal=c;ocrImage=ocrCopyCanvas(c);drawOcrPhoto();
  for(const id of ['ocrCrop','ocrRotate','ocrReset','ocrRetry'])document.getElementById(id).hidden=false;
  if(window.Android?.clearCapturedPhoto)Android.clearCapturedPhoto();
  await recognizeOcrImage(ocrImage,token,false);
 }catch(error){if(token===ocrToken)ocrSetStatus(error?.message||'Não foi possível abrir a imagem. Salve uma cópia JPG ou PNG e tente novamente.');}
}
// Vector 4 LCD: assess the left register and right seven-segment reading separately.
// Results remain suggestions until the user checks the actual photo and confirms.
async function recognizeVector4Display(worker,image,target,token){
 const variants=[];
 // Relative LCD positions for a close-up or full meter portrait (not a generic invoice).
 const crops=image.height>image.width*1.25?
  [[.15,.30,.70,.17],[.19,.32,.65,.14]]:
  [[.13,.20,.76,.48],[.16,.24,.70,.40]];
 for(const [x,y,w,h] of crops){
  const display=document.createElement('canvas');
  display.width=Math.max(1,Math.round(image.width*w));display.height=Math.max(1,Math.round(image.height*h));
  const ctx=display.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,image.width*x,image.height*y,image.width*w,image.height*h,0,0,display.width,display.height);
  for(const enhanced of [false,true]){
   const part=document.createElement('canvas');part.width=display.width;part.height=display.height;
   const pc=part.getContext('2d');pc.filter=enhanced?'grayscale(1) contrast(1.9) brightness(1.15)':'none';pc.drawImage(display,0,0);
   // Read register and reading separately to avoid serial numbers and nameplate text.
   const regions=[[0,.34],[.38,.62]],texts=[];
   for(const [offset,width] of regions){
    const cut=document.createElement('canvas');cut.width=Math.max(1,Math.round(part.width*width));cut.height=part.height;
    cut.getContext('2d').drawImage(part,part.width*offset,0,part.width*width,part.height,0,0,cut.width,cut.height);
    await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789'});
    const answer=await worker.recognize(cut,{}, {text:true});
    if(token!==ocrToken)return null;
    texts.push(String(answer.data.text||'').replace(/\D/g,''));
   }
   // Reject partial code matches and unexpected lengths; never infer a decimal separator.
   if(texts[0]===target&&/^\d{4,6}$/.test(texts[1])){
    variants.push({reading:Number(texts[1]),raw:texts[1]});
   }
  }
 }
 const counts=new Map();
 for(const v of variants)counts.set(v.reading,(counts.get(v.reading)||0)+1);
 const agreed=[...counts.entries()].filter(([_,n])=>n>=2);
 if(agreed.length!==1)return null;
 return {reading:agreed[0][0],raw:variants.find(v=>v.reading===agreed[0][0]).raw};
}
async function recognizeOcrImage(image,token,live){
 if(ocrBusy||token!==ocrToken)return null;ocrBusy=true;document.getElementById('ocrApply').disabled=true;ocrSetStatus('Preparando reconhecimento…');
 try{const worker=await getOcrWorker();if(token!==ocrToken)return null;await worker.setParameters({tessedit_pageseg_mode:live&&!ocrInvoiceTarget()?'6':'11',preserve_interword_spaces:'1'});const {data}=await worker.recognize(image,{}, {text:true,blocks:true});if(token!==ocrToken)return null;let result=ocrInvoiceTarget()?parseInvoiceOcr(data):parseMeterOcr(data,ocrTarget);
  // On meter photos, retry using the display area rather than labels and serials.
  // Never silently accept a reading without the correct 03/103 code.
  if(!ocrInvoiceTarget()&&result.values.reading==null&&!live){
   const areas=[[.08,.18,.84,.32],[.06,.12,.88,.43]];
   const guesses=[];
   for(const [x,y,w,h] of areas){
    const part=document.createElement('canvas');part.width=Math.round(image.width*w);part.height=Math.round(image.height*h);
    if(!part.width||!part.height)continue;
    const context=part.getContext('2d');context.drawImage(image,image.width*x,image.height*y,image.width*w,image.height*h,0,0,part.width,part.height);
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',tessedit_char_whitelist:'0123456789.,KkWwHh '});
    const attempt=await worker.recognize(part,{}, {text:true,blocks:true});
    if(token!==ocrToken)return null;
    const parsed=parseMeterOcr(attempt.data,ocrTarget);
    if(parsed.values.reading!=null)guesses.push(parsed);
   }
   if(guesses.length===2&&guesses[0].values.reading===guesses[1].values.reading){
    result=guesses[0];result.warnings.push('Leitura sugerida pelo recorte automático. Confirme os números no visor original.');
   }else if(guesses.length){
    result.warnings.push('Foram encontrados números no visor, mas a leitura não foi consistente entre as regiões. Recorte o visor e confira manualmente.');
    result.candidates=[...result.candidates,...guesses.flatMap(g=>g.candidates)].slice(0,6);
   }
   await worker.setParameters({tessedit_char_whitelist:''});
  }
  if(!ocrInvoiceTarget()&&!live&&result.values.reading==null){
   try{
    const vector=await recognizeVector4Display(worker,image,ocrTarget,token);
    if(token!==ocrToken)return null;
    if(vector){
     result.values.reading=vector.reading;
     result.warnings.push('Sugestão obtida do visor digital ('+vector.raw+'). Confira o código e cada dígito antes de transferir.');
     result.codes=[ocrTarget];
    }
   }catch(_vectorError){
    result.warnings.push('Leitura especializada indisponível. Confira o visor e preencha manualmente.');
   }finally{await worker.setParameters({tessedit_char_whitelist:''});}
  }
  ocrLastResult=result;ocrLastFrame=ocrCopyCanvas(image);
  if(!live)renderOcrReview(result);else{const value=ocrInvoiceTarget()?Object.keys(result.values).length+' campo(s) identificado(s)':result.values.reading==null?'Enquadre somente o visor':String(result.values.reading);ocrSetStatus('Câmera ao vivo: '+value+'. Mantenha a imagem estável.');}
  return result;
 }catch(error){if(token===ocrToken){ocrStopStream();ocrSetStatus(error.message||'Não foi possível reconhecer a imagem. Tente novamente com melhor iluminação.');}return null;}
 finally{if(token===ocrToken){ocrBusy=false;refreshOcrApply();}}
}
function renderOcrReview(result){
 const box=document.getElementById('ocrReview');box.replaceChildren();document.getElementById('ocrWarnings').textContent=result.warnings.join(' ');document.getElementById('ocrText').textContent=result.text;document.getElementById('ocrTextDetails').hidden=false;
 const fields=ocrInvoiceTarget()?ocrReviewFields():[{key:'reading',label:'Total acumulado do código '+ocrTarget+' (kWh)',type:'number'}];
 for(const field of fields){const row=document.createElement('div');row.className='ocr-review-row';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.ocrField=field.key;checkbox.id='ocrCheck-'+field.key;checkbox.checked=result.values[field.key]!=null;checkbox.setAttribute('aria-label','Usar '+field.label);const label=document.createElement('label');label.htmlFor='ocrValue-'+field.key;label.textContent=field.label;const input=document.createElement('input');input.id='ocrValue-'+field.key;input.type=field.type;input.value=result.values[field.key]??'';if(field.type==='number'){input.min=field.key==='multiplier'?'0.001':'0';input.step='0.001';input.max=field.key==='multiplier'?'1000000':'1000000000';}input.addEventListener('input',()=>{checkbox.checked=input.value!=='';refreshOcrApply();});checkbox.addEventListener('change',refreshOcrApply);row.append(checkbox,label,input);box.appendChild(row);}
 if(!ocrInvoiceTarget()&&result.candidates?.length>1){const p=document.createElement('p');p.className='cycle-help';p.textContent='Números encontrados: '+result.candidates.map(x=>x.text).join(' · ')+'. Confira qual é o total acumulado do visor.';box.appendChild(p);}
 document.getElementById('ocrConfirmationText').textContent=ocrInvoiceTarget()?'Conferi os campos marcados na fatura, incluindo as leituras, casas decimais e o multiplicador.':'Conferi na foto o código '+ocrTarget+' e o total acumulado, incluindo as casas decimais.';
 document.getElementById('ocrConfirmationLabel').hidden=false;document.getElementById('ocrConfirm').checked=false;ocrSetStatus(Object.keys(result.values).some(k=>result.values[k]!=null)?'Confira os campos marcados. Você pode corrigir qualquer valor antes de usar.':'Não foi possível identificar os campos com segurança. Recorte a área desejada ou preencha após conferir a imagem.');refreshOcrApply();
}
function refreshOcrApply(){const selected=[...document.querySelectorAll('[data-ocr-field]')].some(x=>x.checked);document.getElementById('ocrApply').disabled=ocrBusy||Boolean(ocrStream)||!selected||!document.getElementById('ocrConfirm').checked;}
function applyOcrReview(){
 if(!document.getElementById('ocrConfirm').checked||ocrBusy||ocrStream)return;const selected={};for(const check of document.querySelectorAll('[data-ocr-field]')){if(!check.checked)continue;const input=document.getElementById('ocrValue-'+check.dataset.ocrField);if(!input.value||!input.checkValidity()){input.reportValidity();return;}selected[check.dataset.ocrField]=input.type==='number'?Number(input.value):input.value;if(selected[check.dataset.ocrField]==null){ocrSetStatus('Confira os valores marcados.');return;}}
 if(!Object.keys(selected).length)return;
 const target=ocrTarget,isInvoice=ocrInvoiceTarget();
 const month=isInvoice?(selected.month||document.getElementById('fMonth').value):null;
 const existing=isInvoice?state.entries.find(entry=>entry.month===month):null;
 const switchContext=isInvoice&&(month!==document.getElementById('fMonth').value||(existing&&editingMonth!==month)||(editingMonth&&editingMonth!==month));
 if(switchContext){
  const message=existing?'Já existe um lançamento de '+monthLabel(month)+'. Carregar esse mês e aplicar somente os campos marcados? Os demais dados salvos desse mês serão preservados.':'A fatura é de '+monthLabel(month)+'. Abrir um novo lançamento para esse mês e aplicar os campos marcados? O mês anterior não será alterado.';
  if(!confirm(message+' Alterações ainda não salvas no formulário atual serão descartadas.'))return;
 }else{
  let changesExisting=false;
  for(const [key,value] of Object.entries(selected)){const field=ocrFields.find(x=>x.key===key),id=isInvoice?field?.id:target==='03'?'meterImported':'meterInjected';const old=key==='month'?document.getElementById('fMonth').value:id?document.getElementById(id).value:'';if(old!==''&&String(old)!==String(value))changesExisting=true;}
  if(changesExisting&&!confirm('Substituir somente os campos marcados pelos valores conferidos? Os demais campos serão mantidos.'))return;
 }
 if(isInvoice){
  if(switchContext)fillForm(existing||null);
  setMonthPicker(month);
  for(const field of ocrReviewFields())if(field.id&&Object.hasOwn(selected,field.key))document.getElementById(field.id).value=selected[field.key];
  updatePreview();
 }else document.getElementById(target==='03'?'meterImported':'meterInjected').value=selected.reading;
 const message=isInvoice?(editingMonth===month?'Dados transferidos para '+monthLabel(month)+'. Confira e toque em Salvar alterações.':'Dados transferidos para '+monthLabel(month)+'. Confira e toque em Salvar mês.'):'Dados transferidos. Confira e toque em Salvar leitura.';
 closeOcr();toast(message);
}
async function startOcrLive(){
 const token=ocrToken;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera ao vivo indisponível aqui. Use Fotografar ou Selecionar foto.');if(window.Android&&typeof Android.cameraSupport!=='function')throw new Error('Para usar a câmera ao vivo no app, instale o Android 2.10.0 por cima da versão atual.');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});if(token!==ocrToken){stream.getTracks().forEach(t=>t.stop());return;}ocrStream=stream;const video=document.getElementById('ocrVideo');video.srcObject=stream;video.hidden=false;await video.play();document.getElementById('ocrReadFrame').hidden=false;document.getElementById('ocrFinishLive').hidden=false;ocrSetStatus('Aponte para a área desejada. Duas leituras iguais serão apresentadas para conferência.');ocrTimer=setTimeout(()=>scanOcrLive(token),1000);
 }catch(error){if(token===ocrToken){ocrStopStream();ocrSetStatus(error.name==='NotAllowedError'?'A câmera não foi autorizada. Permita o acesso nas configurações ou use Fotografar/Selecionar foto.':error.message||'Não foi possível abrir a câmera. Use Fotografar ou Selecionar foto.');}}
}
async function scanOcrLive(token){
 if(!ocrStream||token!==ocrToken)return;if(ocrBusy){ocrTimer=setTimeout(()=>scanOcrLive(token),1000);return;}const video=document.getElementById('ocrVideo');if(!video.videoWidth){ocrTimer=setTimeout(()=>scanOcrLive(token),1000);return;}
 const c=document.createElement('canvas');const scale=Math.min(1,2000/Math.max(video.videoWidth,video.videoHeight));c.width=Math.round(video.videoWidth*scale);c.height=Math.round(video.videoHeight*scale);c.getContext('2d').drawImage(video,0,0,c.width,c.height);
 const result=await recognizeOcrImage(c,token,true);if(!ocrStream||token!==ocrToken)return;
 if(result){const v=result.values;const complete=ocrInvoiceTarget()?v.startDate&&v.endDate&&v.startReading!=null&&v.endReading!=null: v.reading!=null&&result.codes?.length===1&&result.codes[0]===ocrTarget;const key=complete&&result.confidence>=60?JSON.stringify(ocrInvoiceTarget()?[v.startDate,v.endDate,v.startReading,v.endReading]:[ocrTarget,v.reading]):'';ocrStableCount=key&&key===ocrStableKey?ocrStableCount+1:key?1:0;ocrStableKey=key;
  if(ocrStableCount>=2){ocrOriginal=c;ocrImage=ocrCopyCanvas(c);ocrStopStream();drawOcrPhoto();for(const id of ['ocrCrop','ocrRotate','ocrReset','ocrRetry'])document.getElementById(id).hidden=false;renderOcrReview(result);return;}
 }ocrTimer=setTimeout(()=>scanOcrLive(token),3000);
}
function finishOcrLive(){if(ocrBusy){ocrSetStatus('Aguarde o reconhecimento atual ou feche para cancelar.');return;}if(!ocrLastResult){ocrSetStatus('Aguarde uma leitura ou toque em Ler quadro agora.');return;}if(ocrLastFrame){ocrOriginal=ocrCopyCanvas(ocrLastFrame);ocrImage=ocrCopyCanvas(ocrLastFrame);}ocrStopStream();drawOcrPhoto();for(const id of ['ocrCrop','ocrRotate','ocrReset','ocrRetry'])document.getElementById(id).hidden=false;renderOcrReview(ocrLastResult);}
function ocrPoint(event){const c=document.getElementById('ocrCanvas'),r=c.getBoundingClientRect();return {x:Math.max(0,Math.min(c.width,(event.clientX-r.left)*c.width/r.width)),y:Math.max(0,Math.min(c.height,(event.clientY-r.top)*c.height/r.height))};}
document.addEventListener('click',event=>{const button=event.target.closest('[data-ocr]');if(button)openOcr(button.dataset.ocr,button.dataset.ocrMode);});
for(const id of ['ocrCameraInput','ocrFileInput'])document.getElementById(id).addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)readOcrPhoto(file);else closeOcr();});
document.getElementById('ocrPdfInput').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)readOcrPdf(file);else closeOcr();});
document.getElementById('ocrClose').addEventListener('click',closeOcr);document.getElementById('ocrDialog').addEventListener('cancel',event=>{event.preventDefault();closeOcr();});document.getElementById('ocrConfirm').addEventListener('change',refreshOcrApply);document.getElementById('ocrApply').addEventListener('click',applyOcrReview);
document.getElementById('ocrRetry').addEventListener('click',()=>{if(ocrImage&&!ocrBusy)recognizeOcrImage(ocrImage,ocrToken,false);});
document.getElementById('ocrReadFrame').addEventListener('click',()=>{clearTimeout(ocrTimer);scanOcrLive(ocrToken);});document.getElementById('ocrFinishLive').addEventListener('click',finishOcrLive);
document.getElementById('ocrRotate').addEventListener('click',()=>{if(!ocrImage||ocrBusy)return;const c=document.createElement('canvas');c.width=ocrImage.height;c.height=ocrImage.width;const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(Math.PI/2);ctx.drawImage(ocrImage,-ocrImage.width/2,-ocrImage.height/2);ocrImage=c;ocrSelection=null;drawOcrPhoto();});
document.getElementById('ocrReset').addEventListener('click',()=>{if(ocrOriginal&&!ocrBusy){ocrImage=ocrCopyCanvas(ocrOriginal);ocrSelection=null;drawOcrPhoto();}});
document.getElementById('ocrCrop').addEventListener('click',()=>{if(ocrBusy)return;if(!ocrSelection||ocrSelection.w<30||ocrSelection.h<30){ocrSetStatus('Arraste na foto para selecionar a área do visor ou do quadro de leituras.');return;}const r=ocrSelection,c=document.createElement('canvas');c.width=Math.round(r.w);c.height=Math.round(r.h);c.getContext('2d').drawImage(ocrImage,r.x,r.y,r.w,r.h,0,0,c.width,c.height);ocrImage=c;ocrSelection=null;drawOcrPhoto();recognizeOcrImage(c,ocrToken,false);});
const ocrCanvas=document.getElementById('ocrCanvas');ocrCanvas.addEventListener('pointerdown',event=>{if(ocrBusy||!ocrImage)return;ocrDrag=ocrPoint(event);ocrSelection=null;ocrCanvas.setPointerCapture(event.pointerId);});ocrCanvas.addEventListener('pointermove',event=>{if(!ocrDrag)return;const p=ocrPoint(event);ocrSelection={x:Math.min(p.x,ocrDrag.x),y:Math.min(p.y,ocrDrag.y),w:Math.abs(p.x-ocrDrag.x),h:Math.abs(p.y-ocrDrag.y)};drawOcrPhoto();});ocrCanvas.addEventListener('pointerup',()=>{ocrDrag=null;});ocrCanvas.addEventListener('pointercancel',()=>{ocrDrag=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ocrStream){ocrStopStream();ocrSetStatus('Câmera encerrada ao sair da tela. Abra novamente para continuar.');}});window.addEventListener('pagehide',()=>{ocrStopStream();});
