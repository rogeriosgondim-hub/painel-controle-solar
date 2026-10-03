from pathlib import Path
import json,hashlib,subprocess,base64,shutil,tempfile,os
subprocess.run(['python3','prepare-ocr.py'],check=True)
public=Path('public');public.mkdir(exist_ok=True)
shutil.copyfile('index.html',public/'index.html');shutil.copytree('vendor',public/'vendor',dirs_exist_ok=True)
manifest=json.loads(Path('panel-update.json').read_text());manifest['sha256']=hashlib.sha256(Path('index.html').read_bytes()).hexdigest()
with tempfile.TemporaryDirectory(dir=os.environ['RUNNER_TEMP']) as temporary:
 payload=Path(temporary)/'payload.json';signature=Path(temporary)/'signature.txt'
 payload.write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
 subprocess.run(['java','SignPanel.java',str(payload),str(signature)],check=True)
 manifest['signedPayload']=base64.b64encode(payload.read_bytes()).decode();manifest['signature']=signature.read_text()
(public/'panel-update.json').write_text(json.dumps(manifest,indent=2)+'\n')
(public/'.nojekyll').touch()

