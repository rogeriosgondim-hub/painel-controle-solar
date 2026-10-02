#!/usr/bin/env bash
set -euo pipefail
apk=android-app/Controle-Solar-v2.7.0.apk
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb shell input keyevent 82
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
adb shell screencap -p /sdcard/solar-screen.png
adb pull /sdcard/solar-screen.png solar-screen.png
adb logcat -d -s SolarPanel:I chromium:E AndroidRuntime:E > panel-runtime.log
cat solar-ui.xml
cat panel-runtime.log
python3 - <<'PY'
from pathlib import Path
s=Path('solar-ui.xml').read_text()
logs=Path('panel-runtime.log').read_text()
assert 'Painel pronto: 2.7.0' in logs, 'O painel offline não concluiu sua inicialização'
assert 'android.webkit.WebView' in s, 'A tela WebView não está visível'
print('PASS: atualização do APK anterior com mesma assinatura e painel offline visível')
PY
adb logcat -d -s AndroidRuntime:E > android-runtime.log
if grep -q 'Process: br.com.controlesolar.residencia' android-runtime.log; then
  cat android-runtime.log
  exit 1
fi
