"""Fetch pinned, digest-verified local OCR assets for web and offline Android."""
from pathlib import Path
import base64, gzip, hashlib, io, json, tarfile, urllib.request
ROOT=Path(__file__).resolve().parent
lock=json.loads((ROOT/'ocr-packages.json').read_text())
out=ROOT/'vendor/ocr';out.mkdir(parents=True,exist_ok=True)
files={'tesseract.js':['dist/tesseract.min.js','dist/worker.min.js','LICENSE.md'],
       'pdfjs-dist':['legacy/build/pdf.min.mjs','legacy/build/pdf.worker.min.mjs','LICENSE'],
       'tesseract.js-core':['tesseract-core.wasm.js','tesseract-core-simd.wasm.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','LICENSE']}
for name, paths in files.items():
    item=lock['packages'][name]
    with urllib.request.urlopen(item['url'],timeout=120) as response:data=response.read()
    algorithm,expected=item['integrity'].split('-',1)
    assert base64.b64encode(hashlib.new(algorithm,data).digest()).decode()==expected, 'Package integrity failed: '+name
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        for path in paths:
            dest='LICENSE-'+name+'.txt' if path in ('LICENSE','LICENSE.md') else Path(path).name
            asset=archive.extractfile('package/'+path).read()
            if name=='pdfjs-dist' and path.endswith('.mjs'):
                asset=(ROOT/'pdf-compat.js').read_bytes()+b'\n'+asset
            (out/dest).write_bytes(asset)
for lang,item in lock['models'].items():
    with urllib.request.urlopen(item['url'],timeout=120) as response:data=response.read()
    assert hashlib.sha256(data).hexdigest()==item['sha256'], 'Model integrity failed: '+lang
    (out/(lang+'.traineddata.gz')).write_bytes(gzip.compress(data,mtime=0))
print('Verified local OCR assets prepared')
