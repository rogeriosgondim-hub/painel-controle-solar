package br.com.controlesolar.residencia;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.AtomicFile;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.KeyStore;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQUEST_FILE_CHOOSER=1001, REQUEST_SAVE_FILE=1002;
    private static final String PANEL_URL="file:///android_asset/index.html";
    private static final String HOST="rogeriosgondim-hub.github.io";
    private static final String SITE="https://"+HOST+"/painel-controle-solar/";
    private static final int NATIVE_CODE=11, BUNDLED_REVISION=2800;
    private WebView webView, printView;
    private ValueCallback<Uri[]> filePathCallback;
    private byte[] pendingBytes;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private AtomicFile panelCache;
    private volatile byte[] activeHtml;
    private volatile int activeRevision=BUNDLED_REVISION;
    private volatile boolean checking=false, updateAvailable=false;
    private volatile String updateStatus="Buscando novidades…";
    private boolean ready=false;
    private long lastCheck=0;
    private final Runnable verifyReady=()->{
        if(!ready && activeHtml!=null && webView!=null){
            activeHtml=null; activeRevision=BUNDLED_REVISION; panelCache.delete();
            updateAvailable=false;updateStatus="A cópia atualizada não abriu. Usando a versão incluída no app.";
            webView.reload();
            Toast.makeText(this,updateStatus,Toast.LENGTH_LONG).show();
        }
    };

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        panelCache=new AtomicFile(new File(getFilesDir(),"solar-panel.json"));
        try{
            JSONObject cached=new JSONObject(new String(panelCache.readFully(),StandardCharsets.UTF_8));
            JSONObject manifest=verifyManifest(cached.getJSONObject("manifest"));
            int revision=manifest.getInt("revision");
            String html=cached.getString("html");
            if(revision>=BUNDLED_REVISION&&validHtml(html,manifest.getString("version"))&&sha256(html.getBytes(StandardCharsets.UTF_8)).equals(manifest.getString("sha256"))){activeHtml=html.getBytes(StandardCharsets.UTF_8);activeRevision=revision;}
        }catch(Exception ignored){}
        webView=new WebView(this);setContentView(webView);
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);settings.setAllowFileAccess(true);settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
        webView.addJavascriptInterface(new AndroidBridge(),"Android");
        webView.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                if(PANEL_URL.equals(request.getUrl().toString())&&activeHtml!=null)
                    return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(activeHtml));
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                String url=request.getUrl().toString();
                if(PANEL_URL.equals(url))return false;
                if(request.isForMainFrame()){
                    Uri uri=request.getUrl();
                    if("https".equals(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
                    return true;
                }
                return false;
            }
            @Override public void onPageFinished(WebView view,String url){handler.removeCallbacks(verifyReady);handler.postDelayed(verifyReady,20000);notifyStatus();}
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(ConsoleMessage message){
                if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR)Log.e("SolarPanel",message.message()+" (linha "+message.lineNumber()+")");return true;
            }
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(filePathCallback!=null)filePathCallback.onReceiveValue(null);
                filePathCallback=callback;
                try{startActivityForResult(params.createIntent(),REQUEST_FILE_CHOOSER);return true;}
                catch(Exception e){filePathCallback.onReceiveValue(null);filePathCallback=null;Toast.makeText(MainActivity.this,"Não foi possível abrir o seletor de arquivos.",Toast.LENGTH_LONG).show();return false;}
            }
        });
        // Keep the exact v2.6.3 origin so monthly data, Enel readings and cloud settings stay in place.
        webView.loadUrl(PANEL_URL);
        checkForUpdate();
    }
    private boolean validHtml(String html,String version){
        return html.startsWith("<!DOCTYPE html>") && html.contains("const PANEL_VERSION=\""+version+"\"")
                && html.contains("painelSolarResidencia.v1") && !html.contains("<iframe")
                && html.contains("vendor/xlsx.full.min.js");
    }
    private byte[] fetch(String path,int limit)throws Exception{
        URL url=new URL(SITE+path+"?t="+System.currentTimeMillis());
        if(!"https".equals(url.getProtocol())||!HOST.equals(url.getHost()))throw new Exception("Origem inválida");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();
        connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Cache-Control","no-cache");
        try{
            if(connection.getResponseCode()!=200)throw new Exception("Atualização indisponível");
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int count;
                while((count=in.read(buffer))!=-1){if(out.size()+count>limit)throw new Exception("Arquivo excede o limite");out.write(buffer,0,count);}
                return out.toByteArray();
            }
        }finally{connection.disconnect();}
    }
    private String sha256(byte[] bytes)throws Exception{
        StringBuilder result=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))result.append(String.format("%02x",b&255));return result.toString();
    }
    @SuppressWarnings("deprecation")
    private JSONObject verifyManifest(JSONObject wrapper)throws Exception{
        byte[] payload=Base64.decode(wrapper.getString("signedPayload"),Base64.DEFAULT);
        byte[] signature=Base64.decode(wrapper.getString("signature"),Base64.DEFAULT);
        byte[] cert=getPackageManager().getPackageInfo(getPackageName(),android.content.pm.PackageManager.GET_SIGNATURES).signatures[0].toByteArray();
        Signature verifier=Signature.getInstance("SHA256withRSA");
        verifier.initVerify(CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(cert)).getPublicKey());
        verifier.update(payload);if(!verifier.verify(signature))throw new Exception("Assinatura inválida");
        JSONObject manifest=new JSONObject(new String(payload,StandardCharsets.UTF_8));
        if(manifest.getInt("schema")!=1||manifest.getInt("minNativeVersionCode")>NATIVE_CODE)throw new Exception("Atualize o aplicativo Android");
        return manifest;
    }
    private synchronized SecretKey vaultKey()throws Exception{
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias("solar-cloud-v1")){
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder("solar-cloud-v1",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());generator.generateKey();
        }
        return (SecretKey)store.getKey("solar-cloud-v1",null);
    }
    private synchronized void checkForUpdate(){
        if(checking||isFinishing())return;lastCheck=System.currentTimeMillis();checking=true;updateStatus="Buscando novidades…";notifyStatus();
        worker.execute(()->{
            try{
                JSONObject wrapper=new JSONObject(new String(fetch("panel-update.json",16384),StandardCharsets.UTF_8));
                JSONObject manifest=verifyManifest(wrapper);
                if(manifest.getInt("schema")!=1)throw new Exception("Formato não suportado");
                if(manifest.getInt("minNativeVersionCode")>NATIVE_CODE){updateStatus="Há novidades que precisam de uma nova versão do app Android.";}
                else if(manifest.getInt("revision")<=activeRevision){updateStatus="Painel atualizado. A cópia deste aparelho funciona sem internet.";updateAvailable=false;}
                else {
                    byte[] bytes=fetch("index.html",2*1024*1024);
                    String version=manifest.getString("version"),html=new String(bytes,StandardCharsets.UTF_8);
                    if(!sha256(bytes).equals(manifest.getString("sha256"))||!validHtml(html,version))throw new Exception("Verificação do painel falhou");
                    JSONObject payload=new JSONObject();payload.put("manifest",wrapper);payload.put("html",html);
                    FileOutputStream out=null;
                    try{out=panelCache.startWrite();out.write(payload.toString().getBytes(StandardCharsets.UTF_8));panelCache.finishWrite(out);}
                    catch(Exception e){if(out!=null)panelCache.failWrite(out);throw e;}
                    updateAvailable=true;updateStatus="Painel "+version+" disponível. Toque em Aplicar atualização para usar as novidades.";
                }
            }catch(Exception e){updateStatus=updateAvailable?"Atualização já baixada. Você pode aplicá-la sem internet.":"Não foi possível consultar novidades. A cópia deste aparelho continua disponível.";}
            finally{checking=false;notifyStatus();}
        });
    }
    private void notifyStatus(){
        runOnUiThread(()->{if(webView!=null&&!isFinishing())webView.evaluateJavascript("if(typeof onPanelUpdate==='function')onPanelUpdate("+JSONObject.quote(updateStatus)+","+updateAvailable+");",null);});
    }
    private void saveDocument(String filename,byte[] bytes,String mime){
        runOnUiThread(()->{
            if(pendingBytes!=null){Toast.makeText(this,"Conclua o salvamento anterior.",Toast.LENGTH_SHORT).show();return;}
            pendingBytes=bytes;
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mime);intent.putExtra(Intent.EXTRA_TITLE,filename);
            try{startActivityForResult(intent,REQUEST_SAVE_FILE);}catch(Exception e){pendingBytes=null;Toast.makeText(this,"Não foi possível abrir o salvamento.",Toast.LENGTH_LONG).show();}
        });
    }
    public class AndroidBridge{
        @JavascriptInterface public boolean storeCloudSecrets(String json){
            try{JSONObject value=new JSONObject(json);if(value.getString("token").length()>1000||value.getString("passphrase").length()>4000)return false;
                Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,vaultKey());
                JSONObject encrypted=new JSONObject();encrypted.put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP));encrypted.put("data",Base64.encodeToString(cipher.doFinal(json.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP));
                return getSharedPreferences("solar-vault",MODE_PRIVATE).edit().putString("credentials",encrypted.toString()).commit();
            }catch(Exception e){return false;}
        }
        @JavascriptInterface public String getCloudSecrets(){
            try{String stored=getSharedPreferences("solar-vault",MODE_PRIVATE).getString("credentials",null);if(stored==null)return "{}";
                JSONObject e=new JSONObject(stored);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,vaultKey(),new GCMParameterSpec(128,Base64.decode(e.getString("iv"),Base64.DEFAULT)));
                return new String(cipher.doFinal(Base64.decode(e.getString("data"),Base64.DEFAULT)),StandardCharsets.UTF_8);
            }catch(Exception e){return "{}";}
        }
        @JavascriptInterface public void clearCloudSecrets(){getSharedPreferences("solar-vault",MODE_PRIVATE).edit().clear().commit();}
        @JavascriptInterface public void downloadText(String filename,String content,String mime){saveDocument(filename,content.getBytes(StandardCharsets.UTF_8),mime);}
        @JavascriptInterface public void downloadBase64(String filename,String base64,String mime){
            try{saveDocument(filename,Base64.decode(base64,Base64.DEFAULT),mime);}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"Arquivo inválido.",Toast.LENGTH_SHORT).show());}
        }
        @JavascriptInterface public String appInfo(){
            try{JSONObject info=new JSONObject();info.put("version",getPackageManager().getPackageInfo(getPackageName(),0).versionName);info.put("status",updateStatus);info.put("available",updateAvailable);return info.toString();}catch(Exception e){return "{}";}
        }
        @JavascriptInterface public void panelReady(String version){runOnUiThread(()->{ready=true;handler.removeCallbacks(verifyReady);Log.i("SolarPanel","Painel pronto: "+version);});}
        @JavascriptInterface public void checkUpdate(){checkForUpdate();}
        @JavascriptInterface public void applyUpdate(){
            runOnUiThread(()->{
                try{JSONObject cache=new JSONObject(new String(panelCache.readFully(),StandardCharsets.UTF_8));JSONObject manifest=verifyManifest(cache.getJSONObject("manifest"));byte[] html=cache.getString("html").getBytes(StandardCharsets.UTF_8);if(!sha256(html).equals(manifest.getString("sha256")))throw new Exception("Painel inválido");activeHtml=html;activeRevision=manifest.getInt("revision");updateAvailable=false;ready=false;updateStatus="Painel atualizado. Cópia disponível sem internet.";webView.reload();}
                catch(Exception e){Toast.makeText(MainActivity.this,"Atualização ainda não disponível.",Toast.LENGTH_SHORT).show();}
            });
        }
        @JavascriptInterface public void printHtml(String html,String title){
            runOnUiThread(()->{
                if(printView!=null)printView.destroy();printView=new WebView(MainActivity.this);
                printView.getSettings().setJavaScriptEnabled(false);
                printView.setWebViewClient(new WebViewClient(){
                    @Override public void onPageFinished(WebView view,String url){
                        PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);
                        if(manager!=null)manager.print(title,view.createPrintDocumentAdapter(title),new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape()).build());
                    }
                });
                printView.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
            });
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQUEST_FILE_CHOOSER){if(filePathCallback!=null){filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode,data));filePathCallback=null;}return;}
        if(requestCode==REQUEST_SAVE_FILE){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&pendingBytes!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                    if(out==null)throw new Exception("Destino indisponível");out.write(pendingBytes);out.flush();Toast.makeText(this,"Arquivo salvo.",Toast.LENGTH_SHORT).show();
                }catch(Exception e){Toast.makeText(this,"Falha ao salvar. Confira o espaço disponível.",Toast.LENGTH_LONG).show();}
            }
            pendingBytes=null;
        }
    }
    @Override protected void onResume(){super.onResume();if(webView!=null&&System.currentTimeMillis()-lastCheck>300000)checkForUpdate();}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);worker.shutdownNow();if(webView!=null){webView.removeJavascriptInterface("Android");webView.destroy();webView=null;}if(printView!=null)printView.destroy();super.onDestroy();}
}
