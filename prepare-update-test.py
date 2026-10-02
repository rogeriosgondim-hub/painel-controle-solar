from pathlib import Path
import json,hashlib,base64,subprocess,tempfile,os
html=Path('index.html').read_text().replace('</body>','<div id="update-fixture" hidden>Atualização verificada</div></body>')
manifest=json.loads(Path('panel-update.json').read_text());manifest['revision']+=1;manifest['sha256']=hashlib.sha256(html.encode()).hexdigest()
with tempfile.TemporaryDirectory(dir=os.environ['RUNNER_TEMP']) as temporary:
 payload=Path(temporary)/'payload.json';signature=Path(temporary)/'signature.txt';payload.write_text(json.dumps(manifest,separators=(',',':')))
 subprocess.run(['java','SignPanel.java',str(payload),str(signature)],check=True)
 manifest['signedPayload']=base64.b64encode(payload.read_bytes()).decode();manifest['signature']=signature.read_text()
out=Path('android-app/app/src/androidTest/assets');out.mkdir(parents=True,exist_ok=True)
(out/'update-test.json').write_text(json.dumps({'manifest':manifest,'html':html}))
