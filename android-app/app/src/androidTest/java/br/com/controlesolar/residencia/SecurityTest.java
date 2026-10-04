package br.com.controlesolar.residencia;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;
import android.content.Context;
import android.util.Base64;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Field;
import android.webkit.WebView;
import android.util.AtomicFile;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
public class SecurityTest {
 @Rule public ActivityTestRule<MainActivity> activity=new ActivityTestRule<>(MainActivity.class);
 @Test public void credentialsAreEncryptedAndRestored()throws Exception{
  MainActivity app=activity.getActivity();MainActivity.AndroidBridge bridge=app.new AndroidBridge();
  String secret="{\"token\":\"mock-test-token\",\"passphrase\":\"mock-test-password\"}";
  assertTrue(bridge.storeCloudSecrets(secret));
  String persisted=app.getSharedPreferences("solar-vault",Context.MODE_PRIVATE).getString("credentials","");
  assertFalse(persisted.contains("mock-test-token"));assertFalse(persisted.contains("mock-test-password"));
  assertEquals(secret,bridge.getCloudSecrets());bridge.clearCloudSecrets();assertEquals("{}",bridge.getCloudSecrets());
 }
 @Test public void panelSignatureAcceptsTrustedAndRejectsTamperedPayload()throws Exception{
  MainActivity app=activity.getActivity();
  String text=new String(InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("signed-test.json").readAllBytes(),StandardCharsets.UTF_8);
  JSONObject wrapper=new JSONObject(text);Method method=MainActivity.class.getDeclaredMethod("verifyManifest",JSONObject.class);method.setAccessible(true);
  JSONObject verified=(JSONObject)method.invoke(app,wrapper);waitFor(app,"typeof PANEL_VERSION!=='undefined'");assertEquals(JSONObject.quote(verified.getString("version")),evaluate(app,"PANEL_VERSION"));
  wrapper.put("signedPayload",Base64.encodeToString("{\"schema\":1}".getBytes(StandardCharsets.UTF_8),Base64.NO_WRAP));
  try{method.invoke(app,wrapper);fail("Tampered signature accepted");}catch(InvocationTargetException expected){assertNotNull(expected.getCause());}
 }
 private WebView view(MainActivity app)throws Exception{Field field=MainActivity.class.getDeclaredField("webView");field.setAccessible(true);return (WebView)field.get(app);}
 private String evaluate(MainActivity app,String code)throws Exception{
  CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();WebView web=view(app);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(code,value->{result.set(value);done.countDown();}));
  assertTrue("JavaScript response timeout",done.await(5,TimeUnit.SECONDS));return result.get();
 }
 private void waitFor(MainActivity app,String code)throws Exception{for(int i=0;i<60;i++){if("true".equals(evaluate(app,code)))return;Thread.sleep(200);}fail("Condition not reached: "+code);}
 @Test public void signedPanelReallyReplacesScreenAndRetainsRecordsAfterReopen()throws Exception{
  MainActivity app=activity.getActivity();waitFor(app,"typeof state!=='undefined'");
  evaluate(app,"state.parameters.uc='123456';state.entries=[{month:'2026-10',generation:321,gridImported:100,injected:200,creditsUsed:0,creditBalance:300,totalBill:120,cip:20,extras:0}];state.meter.readings=[{id:'test-reading',at:'2026-10-02T13:00',period:'extra',imported:158,injected:212,note:'teste'}];saveState();JSON.stringify(state)");
  String before=evaluate(app,"JSON.stringify(state)");
  String fixture=new String(InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("update-test.json").readAllBytes(),StandardCharsets.UTF_8);
  Field field=MainActivity.class.getDeclaredField("panelCache");field.setAccessible(true);AtomicFile cache=(AtomicFile)field.get(app);FileOutputStream out=cache.startWrite();out.write(fixture.getBytes(StandardCharsets.UTF_8));cache.finishWrite(out);
  app.new AndroidBridge().applyUpdate();waitFor(app,"!!document.getElementById('update-fixture')&&typeof state!=='undefined'");
  assertEquals(JSONObject.quote(new JSONObject(fixture).getJSONObject("manifest").getString("version")),evaluate(app,"PANEL_VERSION"));
  assertEquals(before,evaluate(app,"JSON.stringify(state)"));assertEquals("true",evaluate(app,"window.isSecureContext&&!!crypto.subtle&&typeof XLSX==='object'"));
  InstrumentationRegistry.getInstrumentation().runOnMainSync(app::finish);InstrumentationRegistry.getInstrumentation().waitForIdleSync();app=activity.launchActivity(null);
  waitFor(app,"!!document.getElementById('update-fixture')&&typeof state!=='undefined'");assertEquals(before,evaluate(app,"JSON.stringify(state)"));
  assertEquals(JSONObject.quote(new JSONObject(fixture).getJSONObject("manifest").getString("version")),evaluate(app,"PANEL_VERSION"));
 }
 @Test public void migratesOriginalFileStorageAndCredentialsWithoutDeletingRecords()throws Exception{
  MainActivity app=activity.getActivity();waitFor(app,"typeof state!=='undefined'");
  String json=evaluate(app,"(()=>{const x=JSON.parse(JSON.stringify(state));x.parameters.uc='654321';x.entries=[{month:'2026-10',generation:312,gridImported:100,injected:200,creditsUsed:0,creditBalance:300,totalBill:120,cip:20,extras:0}];return JSON.stringify(x)})()");
  evaluate(app,"['painelSolarResidencia.v1','painelSolarCloud.v2','painelSolarCloudMeta.v2'].forEach(key=>localStorage.removeItem(key))");
  WebView web=view(app);InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{web.getSettings().setAllowFileAccess(true);web.loadUrl("file:///android_asset/index.html");});
  waitFor(app,"location.href==='file:///android_asset/index.html'");
  evaluate(app,"localStorage.setItem('painelSolarResidencia.v1',"+json+");localStorage.setItem('painelSolarCloud.v2',JSON.stringify({owner:'mock',repo:'mock',branch:'cloud-sync',path:'cloud-data.enc.json',token:'migration-test-token',passphrase:'migration-test-password',autoSync:false}))");
  app.getSharedPreferences("solar-migration",Context.MODE_PRIVATE).edit().clear().commit();Field legacy=MainActivity.class.getDeclaredField("legacyMode");legacy.setAccessible(true);legacy.setBoolean(app,true);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(web::reload);
  waitFor(app,"location.href==='https://appassets.androidplatform.net/assets/index.html'&&typeof state!=='undefined'&&state.parameters.uc==='654321'");
  assertEquals("312",evaluate(app,"state.entries[0].generation"));waitFor(app,"!JSON.parse(localStorage.getItem('painelSolarCloud.v2')).token");
  assertEquals("migration-test-token",new JSONObject(app.new AndroidBridge().getCloudSecrets()).getString("token"));
  assertFalse(app.getSharedPreferences("solar-migration",Context.MODE_PRIVATE).contains("snapshot"));
 }

 @Test public void offlineOcrLoadsWasmAndRecognizesMeterWithoutSaving()throws Exception{
  MainActivity app=activity.getActivity();waitFor(app,"typeof parseMeterOcr==='function'");
  String before=evaluate(app,"JSON.stringify(state)");
  evaluate(app,"window.ocrTestDone=false;window.ocrTestResult=null;window.ocrTestError=null;(async()=>{try{const c=document.createElement('canvas');c.width=900;c.height=240;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,240);x.fillStyle='black';x.font='64px sans-serif';x.fillText('03 158.123 kWh',30,140);const w=await getOcrWorker();await w.setParameters({tessedit_pageseg_mode:'6'});const r=await w.recognize(c,{}, {text:true,blocks:true});window.ocrTestResult=parseMeterOcr(r.data,'03');await w.terminate();ocrWorkerPromise=null;}catch(e){window.ocrTestError=String(e)}finally{window.ocrTestDone=true}})();true");
  boolean done=false;for(int i=0;i<180;i++){if("true".equals(evaluate(app,"window.ocrTestDone"))){done=true;break;}Thread.sleep(500);}
  assertTrue("Offline OCR timeout: "+evaluate(app,"window.ocrTestError"),done);
  assertEquals("null",evaluate(app,"window.ocrTestError"));
  assertEquals("158.123",evaluate(app,"window.ocrTestResult.values.reading"));
  assertEquals(before,evaluate(app,"JSON.stringify(state)"));
  assertTrue(app.new AndroidBridge().cameraSupport());
 }
 @Test public void offlinePdfReadsLocalInvoiceWithoutSaving()throws Exception{
  MainActivity app=activity.getActivity();waitFor(app,"typeof readOcrPdf==='function'");String before=evaluate(app,"JSON.stringify(state)");
  evaluate(app,"window.pdfTestDone=false;window.pdfTestError=null;(async()=>{try{const pdf=await import('./vendor/ocr/pdf.min.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('vendor/ocr/pdf.worker.min.mjs',location.href).href;const bytes=Uint8Array.from(atob('JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA2MDAgODAwIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMDA0MDIxNjAxLTA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMDA0MDIxNjAxLTA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyNTQKPj4Kc3RyZWFtCkdhc0pNWiJhQHElIzRMPWBCU0hYOHVYLFdrPVw8JkVKcVlXNHJka00qbG5vNnFsX2tzTCg6bSQkUDI3b1VgW09KcVk5Y1ZZLyNoMEhucz5AY1g/TTBURiFuY1tFaidIJlVJNyIvIlZOODBKWzdlXTxQb0YpTD90S3I1ITppMDtGNzdGK05PK0JjM2gnRilQYD1SZ2VgL1VGIVdtUUReYTBaP0RYWHBcOGdYMzJPLUtJRWZeOy84dTk6X21rVWwoYz5DS2VHOysjW3InXHFuaENXKydWYGxBXyNDVW0yLSR0VEptYWBwLjRBIWIwVWwucXJVUjJoIU9yWUldRH4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NTQzMjI2MjgyNzk2ZGQ3NzliMGQ2OGM2MzYzMGZlZWI+PDU0MzIyNjI4Mjc5NmRkNzc5YjBkNjhjNjM2MzBmZWViPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMTI0CiUlRU9GCg=='),c=>c.charCodeAt(0));const task=pdf.getDocument({data:bytes,isEvalSupported:false,disableFontFace:true});const doc=await task.promise;const page=await doc.getPage(1);const content=await page.getTextContent();window.pdfTestResult=parseInvoicePdf(invoicePdfLines(content.items));await task.destroy();}catch(e){window.pdfTestError=String(e)}finally{window.pdfTestDone=true}})();true");
  boolean done=false;for(int i=0;i<120;i++){if("true".equals(evaluate(app,"window.pdfTestDone"))){done=true;break;}Thread.sleep(500);}
  assertTrue("Offline PDF timeout: "+evaluate(app,"window.pdfTestError"),done);assertEquals("null",evaluate(app,"window.pdfTestError"));assertEquals("123.45",evaluate(app,"window.pdfTestResult.values.totalBill"));assertEquals("6000",evaluate(app,"window.pdfTestResult.values.startReading"));assertEquals(before,evaluate(app,"JSON.stringify(state)"));
 }

}

