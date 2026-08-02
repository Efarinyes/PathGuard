---
id: tech-SPEC-183
title: Android FGS walk keepalive (flush + stale GPS probe)
type: tech
status: implementing
priority: P0
created: 2026-08-01
author: tech-lead
agents_affected:
  - android
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Android FGS walk keepalive

## 1. Objectiu

Durant un passeig actiu a Android, el Foreground Service ha de mantenir de forma **no invasiva** (sense UI al patient) el flush HTTP i, si cal, una sonda GPS quan fa massa estona sense punts acceptats — independent del WebView.

## 2. Context

Pla de reactivació PathGuard (2026-08-01): el patient porta el telèfon a la butxaca en passejos ≤~1h. Walk 144 va mostrar forats GPS de 7–8 min en repòs. El WebView es suspèn; el FGS ja existeix amb flush ~30s i WakeLock, però OEM/Doze pot rarejar l’adquisició.

**Prioritat:** patient auto keep-alive. Caregiver force (SPEC-184) aparcat post-beta.

**Decisió 2026-08-02:** implementar **mínim** junt amb SPEC-186/187 (branca `fix/SPEC-186-187-android-buffer-notif-keepalive`) sense esperar Metric A — complementa el buffer diferit. Field Metric A segueix sent el gate de validació, no el de començar a codificar.

## 3. Problema

1. Flush i GPS depenen massa del flux “passiu” de FusedLocation; en repòs pot haver-hi forats llargs.
2. `markBackgrounded` no canvia política (flag sense lectors útils després de SPEC-181).
3. No hi ha sonda “si fa X s sense punt, demana one-shot”.

## 4. Impacte arquitectònic

Només Android plugin:

- `LocationSyncForegroundService.java` — scheduler keep-alive
- `LocationAcquirer.java` — opcional `requestSingleUpdate` / equivalent
- Tests JUnit si s’extreu lògica de “stale”

**No tocar:** bridge TS (excepte si cal `flushNow` local — preferible mètode intern al FGS), caregiver UI, iOS, FCM.

## 5. Criteris d’acceptació

### AC-1 — Scope walk-only
- [x] Keep-alive només actiu entre `START` i `STOP` del FGS (walk actiu).
- [x] Cap notificació / vibració / Activity nova.

### AC-2 — Flush periòdic natiu
- [x] Flush del buffer almenys cada ≤60s mentre el servei corre (`KEEP_ALIVE_INTERVAL_SECONDS = 30`).

### AC-3 — Stale GPS probe
- [x] Si no s’ha acceptat cap punt en `STALE_GPS_THRESHOLD_MS` (90s) durant walk actiu, `getCurrentLocation` one-shot.
- [x] Constant explícita al FGS / política a `LocationAcquirer.shouldRequestFreshFix`.

### AC-4 — Stop net
- [x] `STOP` cancel·la timers i allibera WakeLock com ara.

### AC-5 — Tests
- [x] JUnit `test_staleGpsPolicy_thresholds` a `LocationBufferTest`.

### AC-6 — Field
- [ ] Redmi, 30–45 min butxaca: Metric A ✅ o millora mesurable vs walk 144.
- [ ] Consum bateria raonable per passeig ≤1h.

## 6. Riscos

- **R1:** OEM mata FGS igualment — mitigació: documentar excepció bateria; no blocker “always” permission.
- **R2:** Probe massa freqüent → bateria — mitigació: threshold ≥90s, només walk actiu.
- **R3:** Confondre amb fer verd el WS — fora d’abast (veure SPEC-185).

## 7. Pla d’implementació

**Branca:** `fix/SPEC-186-187-android-buffer-notif-keepalive` des de `develop` (inclou 183 mínim)

1. Agent Android: constants + timer/ stale probe al FGS / Acquirer.
2. Tests JUnit.
3. Field test amb plantilla de mètriques.
4. Tech Lead: merge.

## 8. Pla de validació

- JUnit + `assembleDebug`
- Field Metric A (TEMPLATE-reactivation-metrics)
- Sense regressió SPEC-181 (`is_recovered`)

## 9. Out of scope

- Caregiver force location (SPEC-184)
- iOS keepalive (només si camp iOS falla)
- Reconnect WS des de natiu
- Mode avió

## 10. Referències

- Pla: wake_and_force_location (Cursor plan 2026-08-01)
- `specs/tech-SPEC-150-android-foreground-robustness.md`
- `specs/tech-SPEC-181-android-recovered-flag.md`
- `docs/field-tests/TEMPLATE-reactivation-metrics.md`
