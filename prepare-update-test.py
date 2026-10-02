from pathlib import Path
import json,hashlib,base64,subprocess,tempfile,os,re
manifest=json.loads(Path('panel-update.json').read_text())
old_version=manifest['version'];parts=old_version.split('.');parts[-1]=str(int(parts[-1])+1);manifest['version']='.'.join(parts)
html=Path('index.html').read_text().replace(old_version,manifest['version'])
prefix,suffix=html.rsplit('</body>',1);html=prefix+'<div id="update-fixture" hidden>Atualização verificada</div></body>'+suffix
digest=base64.b64encode(hashlib.sha256(html.split('<script>')[1].split('</script>')[0].encode()).digest()).decode()
html=re.sub(r"(script-src 'self' 'sha256-)[A-Za-z0-9+/=]+",lambda match:match[1]+digest,html,count=1)
manifest['revision']+=1;manifest['sha256']=hashlib.sha256(html.encode()).hexdigest()
with tempfile.TemporaryDirectory(dir=os.environ['RUNNER_TEMP']) as temporary:
 payload=Path(temporary)/'payload.json';signature=Path(temporary)/'signature.txt';payload.write_text(json.dumps(manifest,separators=(',',':')))
 subprocess.run(['java','SignPanel.java',str(payload),str(signature)],check=True)
 manifest['signedPayload']=base64.b64encode(payload.read_bytes()).decode();manifest['signature']=signature.read_text()
out=Path('android-app/app/src/androidTest/assets');out.mkdir(parents=True,exist_ok=True)
(out/'update-test.json').write_text(json.dumps({'manifest':manifest,'html':html}))
