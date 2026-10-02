import java.nio.file.*;
import java.security.*;
import java.util.Base64;
public class SignPanel {
 public static void main(String[] args)throws Exception{
  char[] password=System.getenv("ANDROID_KEYSTORE_PASSWORD").toCharArray();
  KeyStore store=KeyStore.getInstance(Path.of(System.getenv("ANDROID_KEYSTORE_PATH")).toFile(),password);
  PrivateKey key=(PrivateKey)store.getKey(System.getenv("ANDROID_KEY_ALIAS"),System.getenv("ANDROID_KEY_PASSWORD").toCharArray());
  Signature signer=Signature.getInstance("SHA256withRSA");signer.initSign(key);signer.update(Files.readAllBytes(Path.of(args[0])));
  Files.writeString(Path.of(args[1]),Base64.getEncoder().encodeToString(signer.sign()));
 }
}
