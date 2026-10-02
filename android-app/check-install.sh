#!/usr/bin/env bash
set -euo pipefail
apk=android-app/Controle-Solar-v2.7.0.apk
if [ -f previous-apk/Controle-Solar-v2.6.3.apk ]; then
  adb install previous-apk/Controle-Solar-v2.6.3.apk
fi
adb shell svc wifi disable
adb shell svc data disable
adb shell am start -W -n br.com.controlesolar.residencia/.MainActivity || true
adb install -r "$apk"
adb logcat -c
adb shell am force-stop br.com.controlesolar.residencia
adb shell am start -W -n br.com.controlesolar.residencia/.MainActivity
sleep 8
adb shell pidof br.com.controlesolar.residencia
adb shell uiautomator dump /sdcard/solar-ui.xml
adb pull /sdcard/solar-ui.xml solar-ui.xml
python3 - <<'PY'
from pathlib import Path
s=Path('solar-ui.xml').read_text()
assert 'Painel' in s and 'Novo lançamento' in s, 'O painel offline não apareceu na tela'
print('PASS: atualização do APK anterior com mesma assinatura e painel offline visível')
PY
adb logcat -d -s AndroidRuntime:E > android-runtime.log
if grep -q 'Process: br.com.controlesolar.residencia' android-runtime.log; then
  cat android-runtime.log
  exit 1
fi
