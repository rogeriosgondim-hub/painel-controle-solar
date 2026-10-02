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
  JSONObject verified=(JSONObject)method.invoke(app,wrapper);assertEquals("2.8.2",verified.getString("version"));
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
  assertEquals("\"2.8.3\"",evaluate(app,"PANEL_VERSION"));
  assertEquals(before,evaluate(app,"JSON.stringify(state)"));assertEquals("true",evaluate(app,"window.isSecureContext&&!!crypto.subtle&&typeof XLSX==='object'"));
  InstrumentationRegistry.getInstrumentation().runOnMainSync(app::finish);InstrumentationRegistry.getInstrumentation().waitForIdleSync();app=activity.launchActivity(null);
  waitFor(app,"!!document.getElementById('update-fixture')&&typeof state!=='undefined'");assertEquals(before,evaluate(app,"JSON.stringify(state)"));
  assertEquals("\"2.8.3\"",evaluate(app,"PANEL_VERSION"));
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
}
