# Dev sans câble — Oh-Matilda (remplace `<device-id>` par ton serial `adb devices`)

> `tauri android dev` en HMR via Wi-Fi uniquement. L'APK debug `app-universal-debug.apk` (120 MB) est figé ; ce guide garde le **live reload** sans USB après l'install initiale.

> Note repo public : les serials device de l'auteur ont été caviardés (`<device-id>`). Ne commite jamais ton propre serial.

## Prérequis
- Même Wi-Fi PC ↔ téléphone (obligatoire HMR `vite.config.ts:8` `TAURI_DEV_HOST`, `docs/PLAN-mobile.md:6`)
- Débogage USB déjà autorisé une fois (`adb devices` affiche `<device-id> device`)

## Cas SM-A520F (Android 8) — pas de « Jumeler avec code » (Android 11+)

### 1. Passer adbd en TCP (une fois en USB)
```bash
adb devices
adb shell getprop ro.build.version.release   # 8.x = pas de wireless pairing
adb tcpip 5555
adb shell ip addr show wlan0 | grep "inet "  # ex: 192.168.1.42/24
```

### 2. Débrancher le câble et se connecter en Wi-Fi
```bash
# Débrancher le câble maintenant
adb connect 192.168.1.42:5555
adb devices  # doit afficher 192.168.1.42:5555 device
```

### 3. Lancer HMR sans fil
```bash
hostname -I  # IP PC ex: 192.168.1.10
# Optionnel si besoin de forcer l'hôte (vite.config.ts:8) :
TAURI_DEV_HOST=192.168.1.10 npm run tauri android dev
# sinon simplement :
npm run tauri android dev
```
Le WebView charge `http://<IP_PC>:1420` + HMR `ws://<IP_PC>:1421`. Plus besoin du câble.

### 4. Vérifier (via Wi-Fi)
```bash
adb devices
adb logcat -s SafeArea | grep push    # top=24.0
adb exec-out screencap -p > /tmp/phone.png
```

### 5. Repasser en USB / couper
```bash
adb disconnect 192.168.1.42:5555
adb usb           # adbd repasse en USB
# reboot téléphone = tcpip retombe, refaire étape 1
```

## Cas Android 11+ (si tu changes de téléphone)
```bash
# Sur téléphone : Paramètres > Options développeur > Débogage sans fil > Jumeler avec code
adb pair 192.168.1.42:xxxxx xxxxxx   # ip:port + code affiché
adb connect 192.168.1.42:yyyyy       # port de connexion (différent du pair)
adb devices
npm run tauri android dev
```

## Alternative sans HMR (APK figé)
```bash
npx tauri android build --debug --apk --target aarch64   # 40-60s
# sortie : src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk (120 MB)
cd src-tauri/gen/android/app/build/outputs/apk/universal/debug
python3 -m http.server 8000
# sur téléphone même Wi-Fi : http://<IP_PC>:8000/app-universal-debug.apk → Installer
```

## Dépannage
- `adb: unable to connect` → même Wi-Fi ? `ping 192.168.1.42` ; refaire `adb tcpip 5555` en USB.
- `TAURI_DEV_HOST` non pris → `hostname -I` change (DHCP) ; relancer avec la bonne IP.
- `offline` après reboot → normal, refaire étape 1 (tcpip ne survit pas au reboot sur Android 8).
- `gradle` lock `Blocking waiting for file lock` → `pkill -f "tauri android dev"` avant `tauri android build`.
