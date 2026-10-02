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
  JSONObject verified=(JSONObject)method.invoke(app,wrapper);assertEquals("2.8.0",verified.getString("version"));
  wrapper.put("signedPayload",Base64.encodeToString("{\"schema\":1}".getBytes(StandardCharsets.UTF_8),Base64.NO_WRAP));
  try{method.invoke(app,wrapper);fail("Tampered signature accepted");}catch(InvocationTargetException expected){assertNotNull(expected.getCause());}
 }
}
