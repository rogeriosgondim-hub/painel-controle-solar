// PDF.js uses these APIs in both the page and its worker. Older Android WebViews
// already support module workers, but need the standard Promise helpers.
if(!Promise.withResolvers)Object.defineProperty(Promise,'withResolvers',{configurable:true,writable:true,value:function(){let resolve,reject;const promise=new this((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}});
if(!Promise.try)Object.defineProperty(Promise,'try',{configurable:true,writable:true,value:function(callback,...args){return new this(resolve=>resolve(callback(...args)));}});
// ReadableStream async iteration arrived after the WebView shipped with Android 13.
if(typeof ReadableStream!=='undefined'&&!ReadableStream.prototype[Symbol.asyncIterator])Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{configurable:true,writable:true,value:async function*(){const reader=this.getReader();let complete=false;try{while(true){const next=await reader.read();if(next.done){complete=true;return;}yield next.value;}}finally{try{if(!complete)await reader.cancel();}finally{reader.releaseLock();}}}});

// Billing-month guard: the panel's operational month follows the invoice due date.
// The utility's original MÊS/ANO is preserved as an explanatory warning when it differs.
window.addEventListener('DOMContentLoaded',()=>{
 const formatMonth=value=>{if(!/^\d{4}-\d{2}$/.test(value||''))return value||'';const [y,m]=value.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));};
 const normalizeBillingResult=result=>{
  if(!result?.values)return result;const v=result.values,warnings=result.warnings||(result.warnings=[]),sourceMonth=v.month||null;
  if(!v.dueDate&&result.text&&typeof ocrNormalize==='function'&&typeof ocrDates==='function'){
   const lines=ocrNormalize(result.text).split(/\r?\n/);
   for(let i=0;i<lines.length;i++)if(/VENCIMENTO/.test(lines[i])){const dates=ocrDates(lines.slice(i,i+4).join('\n'));if(dates.length){v.dueDate=dates[0].value;break;}}
  }
  if(v.dueDate){
   const billingMonth=v.dueDate.slice(0,7);
   if(sourceMonth&&sourceMonth!==billingMonth&&!warnings.some(x=>x.includes('Referência Enel detectada'))){
    warnings.push('Referência Enel detectada: '+formatMonth(sourceMonth)+'. Para o painel, o lançamento será registrado em '+formatMonth(billingMonth)+' porque o vencimento é '+v.dueDate.split('-').reverse().join('/')+'.');
   }
   v.utilityReferenceMonth=sourceMonth;v.month=billingMonth;
  }else{
   if(sourceMonth&&!warnings.some(x=>x.includes('Vencimento não identificado'))){warnings.push('Vencimento não identificado. A referência Enel '+formatMonth(sourceMonth)+' não será usada automaticamente como mês do lançamento; confira a data de vencimento antes de aplicar.');}
   delete v.month;
  }
  return result;
 };
 if(typeof parseInvoiceOcr==='function'){
  const original=parseInvoiceOcr;parseInvoiceOcr=function(data){return normalizeBillingResult(original(data));};
 }
 if(typeof parseInvoicePdf==='function'){
  const original=parseInvoicePdf;parseInvoicePdf=function(text,blocks=[]){return normalizeBillingResult(original(text,blocks));};
 }
 if(typeof ocrFields!=='undefined'&&Array.isArray(ocrFields)&&ocrFields[0]?.key==='month')ocrFields[0].label='Mês do lançamento (pelo vencimento)';
 const apply=document.getElementById('ocrApply');
 if(apply)apply.addEventListener('click',event=>{
  if(!(typeof ocrInvoiceTarget==='function'&&ocrInvoiceTarget()))return;
  const due=document.getElementById('ocrValue-dueDate'),dueCheck=document.getElementById('ocrCheck-dueDate');
  if(!due?.value||!dueCheck?.checked){event.preventDefault();event.stopImmediatePropagation();if(typeof ocrSetStatus==='function')ocrSetStatus('Informe e confira o vencimento da fatura antes de aplicar. O mês do lançamento será definido por essa data.');}
 },true);
});
