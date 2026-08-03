# Guia d'instal·lació — Xcode + Android Studio per a PathGuard

Guia canònica de setup d’IDEs natius (macOS). Rutes de disc extern són **específiques de màquina** — adapta-les al teu entorn.

---

## Visió general: què va on

| Component | On | Mida |
|---|---|---|
| Xcode.app | Intern (`/Applications`) | ~8 GB **obligatori aquí** |
| DerivedData, Simulators, DeviceSupport | Extern via symlinks | ~3–10 GB |
| Android Studio.app | Extern (`/Volumes/Extern_Idoia`) | ~1.5 GB |
| Android SDK | Extern (`/Volumes/Extern_Idoia/Android/sdk`) | ~3–5 GB |
| Fitxers de configuració | Intern (obligatori) | ~200 MB totals |

**Impacte al disc intern:** només Xcode.app (~8 GB) + fitxers de sistema petits.
120 GB lliures → ~110 GB lliures. Perfecte per al M4.

---

## PAS 1 — Neteja preventiva (opcional, 5 min)

Abans d'instal·lar res, pots alliberar espai:

```bash
# Cache del sistema
rm -rf ~/Library/Caches/*

# Cache de navegadors (el més gran sol ser Chrome)
rm -rf ~/Library/Caches/com.google.Chrome
rm -rf ~/Library/Caches/org.mozilla.firefox

# Esborra DerivedData si en queda d'alguna prova antiga
rm -rf ~/Library/Developer/Xcode/DerivedData
```

Pot alliberar 5–20 GB segons l'ús.

---

## PAS 2 — Instal·lar Xcode (al disc intern)

**Per què ha d'anar aquí:** Apple exigeix que Xcode.app estigui a `/Applications/`. No es pot posar a un disc extern de manera fiable.

**Mètode recomanat — Mac App Store:**

1. Obre l'App Store
2. Cerca "Xcode"
3. Descarrega (gratuït, ~8 GB de descàrrega)
4. Un cop instal·lat, esborra el fitxer `.xip` o `.dmg` temporal

**Mètode alternatiu — Apple Developer:**
- Descarrega des de `developer.apple.com/download/applications/`
- Arrossega a `/Applications/`

**Verificació:**

```bash
xcode-select --install    # Instal·la Command Line Tools si no ho fa sol
xcode-select -p           # Ha de mostrar /Applications/Xcode.app/Contents/Developer
xcrun swift --version     # Ha de funcionar
```

---

## PAS 3 — Symlinks: DerivedData + Simulators a l'extern

Movem les carpetes pesades de Xcode al disc extern i creem enllaços simbòlics.

```bash
# Atura Xcode si està obert

# Crea les carpetes a l'extern
mkdir -p /Volumes/Extern_Idoia/Xcode
mkdir -p /Volumes/Extern_Idoia/Xcode/DerivedData
mkdir -p /Volumes/Extern_Idoia/Xcode/iOS\ DeviceSupport
mkdir -p /Volumes/Extern_Idoia/Xcode/CoreSimulator

# DerivedData
cd ~/Library/Developer/Xcode
mv DerivedData /Volumes/Extern_Idoia/Xcode/DerivedData 2>/dev/null
ln -s /Volumes/Extern_Idoia/Xcode/DerivedData DerivedData

# iOS DeviceSupport
mv iOS\ DeviceSupport /Volumes/Extern_Idoia/Xcode/iOS\ DeviceSupport 2>/dev/null
ln -s /Volumes/Extern_Idoia/Xcode/iOS\ DeviceSupport iOS\ DeviceSupport

# Simuladors (CoreSimulator no és dins de Xcode/ sinó a ~/Library/Developer/)
cd ~/Library/Developer
mv CoreSimulator /Volumes/Extern_Idoia/Xcode/CoreSimulator 2>/dev/null
ln -s /Volumes/Extern_Idoia/Xcode/CoreSimulator CoreSimulator
```

**Què estalvies:** Cada runtime de simulador iOS pesa ~2–4 GB. DerivedData pot créixer fins a 10+ GB.

**Nota:** `~/Library/Developer/Xcode/UserData` (preferències, temes, snippets) és petit (~50 MB) i és millor deixar-lo a l'intern per velocitat.

---

## PAS 4 — Instal·lar Android Studio al disc extern

```bash
# 1. Descarrega Android Studio des de developer.android.com/studio
#    (fitxer .dmg, ~1.5 GB)

# 2. Obre el .dmg i arrossega Android Studio.app a:
/Volumes/Extern_Idoia/Android Studio.app

# 3. Primer llançament DES de l'extern:
open /Volumes/Extern_Idoia/Android\ Studio.app

# 4. Quan et pregunti "Import Android Studio settings from...",
#    selecciona "Do not import settings" (és net)
```

**Important:** Al primer inici, Android Studio et demanarà on posar el SDK.
Selecciona:

```
Set SDK path to: /Volumes/Extern_Idoia/Android/sdk
```

La configuració es pot canviar des de:
`Preferences → Appearance & Behavior → System Settings → Android SDK`

---

## PAS 5 — Android SDK mínim per a PathGuard

Al SDK Manager (dins Android Studio), instal·la **només**:

| Component | Necessitat | Mida |
|---|---|---|
| Android SDK Platform 35 (o 34) | Per compilar l'app | ~500 MB |
| Android SDK Build-Tools (última estable) | Eines de compilació | ~200 MB |
| Android SDK Platform-Tools (adb) | Per connectar dispositiu | ~15 MB |
| Android Emulator / System Images | ❌ No cal (proves en dispositiu real) | 0 |

**Mida total SDK:** ~3–5 GB, tot a l'extern.

**Per a què serveix cadascun:**

- **Platform 35:** SDK que necessita Capacitor per compilar l'app Android
- **Build-Tools:** eines de compilació (aapt, dx, etc.)
- **Platform-Tools:** `adb` per connectar el mòbil per USB

---

## PAS 6 — Verificació amb Capacitor (opcional)

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init PathGuard com.pathguard.app

# Proves de compilació
npx cap add ios       # Ha de generar ios/App/...
npx cap add android   # Ha de generar android/...

# Si tot funciona, descarta els canvis:
git checkout -- .
```

---

## Desinstal·lació neta — tornar a l'estat original

### Desinstal·lar Xcode

```bash
# 1. Esborrar l'app
sudo rm -rf /Applications/Xcode.app

# 2. Esborrar configuració i caches
rm -rf ~/Library/Developer
rm -rf ~/Library/Caches/com.apple.dt.Xcode
rm -rf ~/Library/Preferences/com.apple.dt.Xcode.plist
rm -rf ~/Library/Preferences/com.apple.dt.Xcode.*

# 3. Esborrar Command Line Tools
sudo rm -rf /Library/Developer/CommandLineTools

# 4. Esborrar symlinks i carpetes a l'extern (opcional)
rm -rf /Volumes/Extern_Idoia/Xcode

# 5. Reset xcode-select
sudo xcode-select --reset
```

### Desinstal·lar Android Studio

```bash
# 1. Esborrar l'app (de l'extern)
rm -rf /Volumes/Extern_Idoia/Android\ Studio.app

# 2. Esborrar config (tot a l'intern)
rm -rf ~/Library/Android
rm -rf ~/AndroidStudioProjects
rm -rf ~/.android
rm -rf ~/Library/Preferences/com.google.android.studio.plist
rm -rf ~/Library/Preferences/com.android.*
rm -rf ~/Library/Caches/Google/AndroidStudio*
rm -rf ~/Library/Logs/Google/AndroidStudio*
rm -rf ~/Library/Application\ Support/Google/AndroidStudio*

# 3. Esborrar SDK + projectes de l'extern (opcional)
rm -rf /Volumes/Extern_Idoia/Android
rm -rf /Volumes/Extern_Idoia/AndroidStudioProjects
```

### Verificació de neteja

```bash
# No ha de mostrar res (o només "not found"):
xcode-select -p
xcrun swift --version
which adb
ls ~/Library/Developer 2>/dev/null
ls /Applications/Xcode.app 2>/dev/null
```

---

## Resum d'espai

| | Abans | Després |
|---|---|---|
| **Intern ocupat** | ~125 GB | ~133 GB (+8 GB Xcode.app) |
| **Intern lliure** | ~120 GB | ~112 GB |
| **Extern ocupat** | ~4.8 GB | ~10–15 GB |
| **Extern lliure** | ~926 GB | ~915 GB |

---

## Notes finals

1. **Xcode NO pot anar a l'extern.** És una limitació d'Apple. Però amb els symlinks, tot el pes gros (simuladors, DerivedData, DeviceSupport) sí que va a l'extern.
2. **Android Studio i SDK van tots a l'extern** sense cap problema.
3. **Velocitat:** USB 3.0 a 130 MB/s és suficient per a SDKs i DerivedData. Per al simulador iOS, millor fer-lo servir a l'intern (CoreSimulator symlinkat pot notar-se una mica, però funcional). Proves en dispositiu real no tenen penalització.
4. **Disc HFS+ Journaled** funciona perfectament. Si algun dia el reformates, APFS és lleugerament millor per a fitxers petits, però no cal.
5. **M4 amb 16 GB RAM** és suficient per a tot — Xcode + Android Studio + navegador sense problemes.

---

*Document creat el 01/06/2026 per a ús personal.*

---

## APÈNDIX — Guia ràpida per a col·laboradors (testejar contra desplegament)

Aquesta secció és una fusió del contingut de `SETUP-GUIDE.md` per a col·laboradors que només necessiten testejar l'app contra el desplegament de producció (Vercel + Render + Supabase) sense configurar backend local.

### Requisits mínims

- **Android Studio** (Koala 2024 o superior)
- **Git**
- **Node.js 18+** i **npm** (només per `npm install` + `npx cap sync`)
- **Dispositiu Android físic** amb depuració USB habilitada

### Clonar i preparar

```bash
git clone git@github.com:Efarinyes/PathGuard.git
cd PathGuard/frontend
npm install
npx cap sync android
```

> `npm install` instal·la les dependències i enllaça el plugin local `@pathguard/location-sync`.
> `npx cap sync android` copia el codi del plugin al projecte Android i actualitza el bridge de Capacitor.

### Obrir i executar a Android Studio

1. **Obre Android Studio**
2. `File > Open` → selecciona `PathGuard/frontend/android`
3. Espera que Gradle sincronitzi (pot trigar 1-2 minuts la primera vegada)
4. Connecta el dispositiu Android per USB amb depuració habilitada
5. `Run > Run 'app'` (o `Shift+F10`)

L'APK apunta automàticament a `https://path-guard-orpin.vercel.app` (configurat a `capacitor.config.ts`).

### Què testejar

- **Registre d'entorn familiar** — crear grup + activar dispositiu
- **Passeig en temps real** — iniciar passeig al dispositiu patient i veure'l en directe al caregiver (un altre dispositiu o ordinador)
- **Connexions simultànies** — diversos caregivers + patient alhora per provar robustesa
- **SOS** — provar l'activació i recepció d'alerta
- **Reconnexió** — tancar i obrir l'app, verificar que el token persisteix i que es manté la sessió

### Notes importants

- No cal Python, micromamba, backend local ni base de dades
- No cal modificar cap variable d'entorn
- El plugin `@pathguard/location-sync` es sincronitza automàticament amb `npx cap sync`
- L'app funciona contra el desplegament de producció (Vercel + Render + Supabase)

### Resolució de problemes

| Problema | Solució |
|---|---|
| Gradle sync fail | Assegura't d'haver executat `npx cap sync android` abans d'obrir Android Studio |
| Plugin no trobat | Executa `npm install` des de `frontend/`, no des de l'arrel del projecte |
| Error de connexió | Comprova que el dispositiu té accés a internet |
| "App not installed" | Desinstal·la la versió anterior al dispositiu abans de fer Run |
| Error de compilació | `Build > Clean Project` i després `Build > Rebuild Project` |

---

*Document actualitzat el 07/06/2026 amb fusió de SETUP-GUIDE.md*
