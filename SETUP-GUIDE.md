# PathGuard — Guia de configuració per a col·laboradors

Aquesta guia explica com posar en marxa el projecte PathGuard per fer proves contra el desplegament existent (Vercel + Render + Supabase). **No cal backend local, ni base de dades, ni variables d'entorn.**

## Requisits

- **Android Studio** (Koala 2024 o superior)
- **Git**
- **Node.js 18+** i **npm** (només per `npm install` + `npx cap sync`)
- **Dispositiu Android físic** amb depuració USB habilitada

## Clonar i preparar

```bash
git clone git@github.com:Efarinyes/PathGuard.git
cd PathGuard/frontend
npm install
npx cap sync android
```

> `npm install` instal·la les dependències i enllaça el plugin local `@pathguard/location-sync`.
> `npx cap sync android` copia el codi del plugin al projecte Android i actualitza el bridge de Capacitor.

## Obrir i executar a Android Studio

1. **Obre Android Studio**
2. `File > Open` → selecciona `PathGuard/frontend/android`
3. Espera que Gradle sincronitzi (pot trigar 1-2 minuts la primera vegada)
4. Connecta el dispositiu Android per USB amb depuració habilitada
5. `Run > Run 'app'` (o `Shift+F10`)

L'APK apunta automàticament a `https://path-guard-orpin.vercel.app` (configurat a `capacitor.config.ts`).

## Què testejar

- **Registre d'entorn familiar** — crear grup + activar dispositiu
- **Passeig en temps real** — iniciar passeig al dispositiu patient i veure'l en directe al caregiver (un altre dispositiu o ordinador)
- **Connexions simultànies** — diversos caregivers + patient alhora per provar robustesa
- **SOS** — provar l'activació i recepció d'alerta
- **Reconnexió** — tancar i obrir l'app, verificar que el token persisteix i que es manté la sessió

## Notes importants

- No cal Python, micromamba, backend local ni base de dades
- No cal modificar cap variable d'entorn
- El plugin `@pathguard/location-sync` es sincronitza automàticament amb `npx cap sync`
- L'app funciona contra el desplegament de producció (Vercel + Render + Supabase)

## Resolució de problemes

| Problema | Solució |
|---|---|
| Gradle sync fail | Assegura't d'haver executat `npx cap sync android` abans d'obrir Android Studio |
| Plugin no trobat | Executa `npm install` des de `frontend/`, no des de l'arrel del projecte |
| Error de connexió | Comprova que el dispositiu té accés a internet |
| "App not installed" | Desinstal·la la versió anterior al dispositiu abans de fer Run |
| Error de compilació | `Build > Clean Project` i després `Build > Rebuild Project` |
