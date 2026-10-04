from pathlib import Path
import json,hashlib,subprocess,base64,shutil,tempfile,os

subprocess.run(['python3','prepare-ocr.py'],check=True)
public=Path('public');public.mkdir(exist_ok=True)

# Keep the billing-month correction inside the signed HTML consumed by both
# GitHub Pages and the Android app's in-app panel updater.
billing_fix=r'''(()=>{
 const formatMonth=value=>{if(!/^\d{4}-\d{2}$/.test(value||''))return value||'';const [y,m]=value.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));};
 const normalizeBillingResult=result=>{
  if(!result||!result.values)return result;
  const v=result.values,warnings=result.warnings||(result.warnings=[]),sourceMonth=v.month||null;
  if(!v.dueDate&&result.text&&typeof ocrNormalize==='function'&&typeof ocrDates==='function'){
   const lines=ocrNormalize(result.text).split(/\r?\n/);
   for(let i=0;i<lines.length;i++)if(/VENCIMENTO/.test(lines[i])){const dates=ocrDates(lines.slice(i,i+4).join('\n'));if(dates.length){v.dueDate=dates[0].value;break;}}
  }
  if(v.dueDate){
   const billingMonth=v.dueDate.slice(0,7);
   if(sourceMonth&&sourceMonth!==billingMonth&&!warnings.some(x=>x.includes('Referência Enel detectada'))){
    warnings.push('Referência Enel detectada: '+formatMonth(sourceMonth)+'. Para o painel, o lançamento será registrado em '+formatMonth(billingMonth)+' porque o vencimento é '+v.dueDate.split('-').reverse().join('/')+'.');
   }
   v.utilityReferenceMonth=sourceMonth;
   v.month=billingMonth;
  }else{
   if(sourceMonth&&!warnings.some(x=>x.includes('Vencimento não identificado'))){
    warnings.push('Vencimento não identificado. A referência Enel '+formatMonth(sourceMonth)+' não será usada automaticamente como mês do lançamento; confira a data de vencimento antes de aplicar.');
   }
   delete v.month;
  }
  return result;
 };
 if(typeof parseInvoiceOcr==='function'){
  const original=parseInvoiceOcr;
  parseInvoiceOcr=function(data){return normalizeBillingResult(original(data));};
 }
 if(typeof parseInvoicePdf==='function'){
  const original=parseInvoicePdf;
  parseInvoicePdf=function(text,blocks=[]){return normalizeBillingResult(original(text,blocks));};
 }
 if(typeof ocrFields!=='undefined'&&Array.isArray(ocrFields)&&ocrFields[0]&&ocrFields[0].key==='month')ocrFields[0].label='Mês do lançamento (pelo vencimento)';
 const apply=document.getElementById('ocrApply');
 if(apply)apply.addEventListener('click',event=>{
  if(!(typeof ocrInvoiceTarget==='function'&&ocrInvoiceTarget()))return;
  const due=document.getElementById('ocrValue-dueDate'),dueCheck=document.getElementById('ocrCheck-dueDate');
  if(!due||!due.value||!dueCheck||!dueCheck.checked){
   event.preventDefault();event.stopImmediatePropagation();
   if(typeof ocrSetStatus==='function')ocrSetStatus('Informe e confira o vencimento da fatura antes de aplicar. O mês do lançamento será definido por essa data.');
  }
 },true);
})();'''

html=Path('index.html').read_text(encoding='utf-8')
if 'billing-month-release-21105' not in html:
 script_hash=base64.b64encode(hashlib.sha256(billing_fix.encode('utf-8')).digest()).decode()
 html=html.replace("script-src 'self'",f"script-src 'self' 'sha256-{script_hash}'",1)
 body_close=html.rfind('</body>')
 if body_close<0:
  raise RuntimeError('Fechamento </body> não encontrado no index.html')
 injected="<script data-fix=\"billing-month-release-21105\">"+billing_fix+"</script>\n"
 html=html[:body_close]+injected+html[body_close:]
(public/'index.html').write_text(html,encoding='utf-8')
shutil.copytree('vendor',public/'vendor',dirs_exist_ok=True)

manifest=json.loads(Path('panel-update.json').read_text())
manifest['sha256']=hashlib.sha256((public/'index.html').read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(dir=os.environ['RUNNER_TEMP']) as temporary:
 payload=Path(temporary)/'payload.json';signature=Path(temporary)/'signature.txt'
 payload.write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
 subprocess.run(['java','SignPanel.java',str(payload),str(signature)],check=True)
 manifest['signedPayload']=base64.b64encode(payload.read_bytes()).decode();manifest['signature']=signature.read_text()
(public/'panel-update.json').write_text(json.dumps(manifest,indent=2)+'\n')
(public/'.nojekyll').touch()
