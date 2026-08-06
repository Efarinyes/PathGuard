---
id: feature-SPEC-189
title: Caregiver calm notice and last-known position when walk goes silent
type: feature
status: implementing
priority: P0
created: 2026-08-05
author: tech-lead
agents_affected:
  - frontend
  - backend
  - qa
  - android
  - ios
  - platform-integration
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Caregiver calm notice and last-known position when walk goes silent

## 1. Objectiu

Quan hi ha un passeig actiu i deixen d’arribar actualitzacions útils del pacient, el cuidador ha de veure un **missatge informatiu calm** (no alarma) i la **darrera posició coneguda** marcada de forma evident. Això cobreix l’excepcionalitat “app tancada / procés mort”, sense prometre traça completa recuperada.

El contracte aplica a **Android i iOS** (mateixa UX cuidador; la captura nativa segueix els límits de cada SO).

## 2. Context

### Decisió de producte — PD-WALK-CLOSED-IS-EXCEPTION (2026-08-05)

1. **Cas normal:** pantalla apagada / butxaca amb passeig actiu → transmissió en directe (`is_recovered=false`, traça blava). Keepalive natiu (Android SPEC-183; iOS quan es desbloqueja 182) és el camí correcte.
2. **App tancada** amb passeig actiu → **excepcionalitat**, no feature de buffer de tot el trajecte.
3. Si el passeig queda en **silenci** → missatge informatiu + darrera posició evident.
4. Cua pendent curta (flush fallit / reload des de disc) pot seguir sent taronja (SPEC-188) — **no** és l’objectiu del cas “app tancada”.
5. `is_recovered` **no** significa “has tancat l’app”.

### Restriccions operatives d’aquesta entrega (2026-08-05)

| Restricció | Implicació |
|---|---|
| **Sense rebuild natiu al dispositiu ara** | MVP = capa **PWA/Vercel** (cuidador + copy). Field natiu Android/iOS diferit fins a nou APK/IPA. |
| **UI (register / caregiver / patient) → Vercel** | Canvis de visualització han d’arribar a **`main` local i `origin/main`** per desplegar. |
| **Backend** | Python només via micromamba `tracker-env` (no system Python). Path tipic: `/Users/eduardfarinyes/micromamba/envs/tracker-env/bin/python`. |
| **Java / Android** | Només amb **Android Studio** al dispositiu/build host dedicat; no toolchain Java “de sistema” improvisat en aquesta màquina de docs. |
| **iOS** | Mateix contracte de producte; validació de camp diferida (sense iPhone / alineat SPEC-182). |

Walk **159** (2026-08-04): kill amb tot `is_recovered=false` + mapa blau — coherent amb SPEC-188 i amb aquesta decisió (no esperar taronja massiu).

### Estat MVP (2026-08-06 — Sessió D)

MVP **PWA desplegat** a `main`/`origin` (`7f4d4d5`): copy silenci + marcador `last_known` + Vitest.  
**AC-7 field natiu diferit** fins a rebuild APK/IPA (Sessió E).

## 3. Problema

1. El cuidador no té un missatge clar i calm quan el passeig deixa d’actualitzar-se (copy actual “Sense cobertura” pot confondre xarxa vs silenci del pacient).
2. La darrera posició existeix al mapa (`stale`) però no és prou **evident** com a “darrera coneguda”.
3. El producte encara arrossegava l’esperança “app tancada → traça taronja completa”, inviable de forma fiable a Android/iOS quan el procés és mort.

## 4. Impacte arquitectònic

| Capa | Canvi |
|---|---|
| **Frontend (PWA / Vercel)** | Owner del MVP: `PatientStatusCard`, marcador mapa (`CurrentPositionMarker` / icons), possiblement banner discret. Register/patient només si cal copy coherent. |
| **Backend** | Preferible **cap canvi** al MVP (reutilitzar presence 4 estats + aging SPEC-185). Només si cal event nou post-MVP. |
| **Android / iOS natiu** | **Fora del MVP** mentre no hi hagi rebuild al dispositiu. Contracte documentat: no prometre buffer total amb app morta; cua pendent curta = SPEC-188/182. |
| **Platform** | Nota al bridge contract: silenci ≠ recovered. |
| **QA** | Protocols de camp: butxaca vs kill separats; kill valida UX 189, no taronja massiu. |

## 5. Criteris d’acceptació

### AC-1 — Copy calm amb passeig actiu en silenci
- [x] Amb passeig actiu i presence `limbo`: text informatiu del tipus “Passeig actiu — esperant actualització…”.
- [x] Amb passeig actiu i presence `offline` (edat darrera ubicació > llindar existent, p.ex. 300s): text del tipus “Sense actualitzacions des de fa X — darrera posició coneguda” (o equivalent calm en català).
- [x] No s’introdueix UI d’alarma / SOS per aquest estat.

### AC-2 — Darrera posició evident al mapa
- [x] Quan l’estat és silenci (`limbo`/`offline` o confidence `stale`), el marcador de posició actual es distingeix clarament del mode “en viu” (sense pols viu engañós).
- [x] La traça ja dibuixada es manté; no s’exigeixen segments `is_recovered=true` nous pel sol fet del silenci.

### AC-3 — Recuperació automàtica
- [x] Quan tornen punts WS/HTTP, la UI torna a l’estat normal sense acció del cuidador. *(presence + `resolveMarkerConfidence` es re-deriven; sense estat enganxat de silenci)*

### AC-4 — Contracte cross-platform (docs + comportament esperat)
- [x] Android i iOS comparteixen la mateixa semàntica de producte a aquesta spec i a SPEC-180/188.
- [x] Documentat: app realment tancada / procés mort → forats acceptats; no traça completa recuperada.

### AC-5 — Desplegament Vercel
- [x] Canvis UI mergejats a `main` i pushejats a `origin/main` (deploy Vercel) — `7f4d4d5`.
- [ ] Verificació visual a `https://path-guard-orpin.vercel.app` (cuidador) — **smoke humà** (obert).

### AC-6 — Tests
- [x] Vitest: copy/estat silenci + mode marcador darrera coneguda.
- [x] Sense regressió baseline frontend (**141 pass / 6 skipped** a 2026-08-06; skipped preexistents).

### AC-7 — Field (DIFERIT — Sessió E)
- [ ] Android: kill voluntari amb passeig actiu → missatge + darrera posició; **no** gate de `is_recovered=true` massiu.
- [ ] iOS: mateix criteri quan hi hagi dispositiu (alineat SPEC-182).
- [ ] Fins aleshores: validació MVP = PWA cuidador amb silenci simulat (edat de punt / presence) + smoke amb APK/IPA actual si el silenci ja es produeix.

> **Nota Sessió D:** AC-7 resta obert a propòsit. El MVP PWA es considera tancat per paper; el camp natiu no bloqueja el tancament de sessions A–D.

## 6. Riscos

- **R1:** Confondre “Sense cobertura” amb xarxa del cuidador — mitigació: copy centrat en “sense actualitzacions” / “darrera posició”.
- **R2:** Aturada sense moviment (MIN_DISTANCE) sembla silenci — mitigació: PD-CALM-NOT-DENSE-GPS; copy no ha de dir “app tancada” si no ho sabem; basar-se en edat sense afirmar la causa.
- **R3:** Sense APK nou, no validem kill al Redmi amb capa 188+ — mitigació: AC-7 diferit; MVP Vercel primer.
- **R4:** Canvi de labels sense tocar backend pot divergir de snapshot — mitigació: mapar només UI sobre els 4 estats ja existents.

## 7. Pla d’implementació

**Branca de treball UI:** `feat/SPEC-189-caregiver-walk-silence` des de `main` (deploy Vercel exigeix arribar a `main`).

**Ordre d’alt nivell:** veure §11 (sessions curtes). Resum:

1. Docs/PD a `main` (fet: `31c28e0`).
2. Frontend MVP per sessions A–C → `main` + Vercel.
3. Tancament paper (D); field natiu (E) quan hi hagi binari.
4. Backend només si cal (micromamba `tracker-env`).

## 8. Pla de validació

- Vitest frontend (AC-6).
- Smoke Vercel cuidador (AC-5).
- Field Android/iOS (AC-7) quan el dispositiu es pugui actualitzar.
- No regressió: `cd frontend && npm test`; si backend:  
  `cd backend && /Users/eduardfarinyes/micromamba/envs/tracker-env/bin/python -m pytest tests/ -v`

## 9. Out of scope

- Rebuild APK/IPA en aquesta iteració.
- Senyal natiu explícit `onTaskRemoved` / “walk_interrupted” (post-MVP).
- SPEC-184 force location.
- Canviar semàntica SPEC-188 (`is_recovered` només buffer real).
- Prometre buffer total amb app tancada.

## 10. Referències

- PD-WALK-CLOSED-IS-EXCEPTION (STATE / EVOLUTION 2026-08-05)
- SPEC-185 (presence honesta), SPEC-188 (recovered), SPEC-180 (umbrella), SPEC-183 (keepalive), SPEC-182 (iOS diferit)
- Walk 154, 159
- `frontend/components/CaregiverDashboard/PatientStatusCard.tsx`
- `frontend/components/CaregiverMap/CurrentPositionMarker.tsx`
- `frontend/lib/derivePresenceStatus.ts`
- `docs/field-tests/TEMPLATE-reactivation-metrics.md`

## 11. Pla d’execució per sessions curtes

> **Font de veritat per reprendre després de tancar el xat.**  
> Actualitzar l’estat `[ ]` / `[x]` en tancar cada sessió.  
> Pickup operatiu local: `.pathguard/STATE.json` (gitignored) — ha d’apuntar a la **propera** sessió d’aquesta taula.

**Constraints (totes les sessions):** sense rebuild natiu al dispositiu fins a E; UI → `main`+`origin/main` (Vercel); backend = micromamba `tracker-env`; Java = només Android Studio; contracte Android **i** iOS.

| Sessió | Estat | Objectiu | Sortida (Definition of Done) |
|---|---|---|---|
| **0 — Docs** | [x] | PD + SPEC-189 + alineació 180/185/188 | `31c28e0` a `main`=`develop`=`origin` |
| **A — Copy** | [x] | Text calm `limbo`/`offline` a `PatientStatusCard`; sense ping en silenci | Commit a `feat/SPEC-189-caregiver-walk-silence` (`fa2c18f`) |
| **B — Mapa** | [x] | Marcador **darrera posició coneguda** evident (`CurrentPositionMarker` / `CustomIcons`); sense pols “en viu” engañós en silenci/`stale` | Commit a la mateixa feat; **aturar** |
| **C — Tests + Vercel** | [x] | Vitest AC-6; merge feat → `main`; push `origin/main` (+ `develop`); smoke cuidador a Vercel | UI en producció Vercel; **aturar** |
| **D — Paper** | [x] | Marcar ACs MVP d’aquesta spec; actualitzar `STATE` / EVOLUTION si cal; deixar AC-7 field obert | Spec reflecteix MVP fet; **aturar** |
| **E — Camp** | [ ] | Quan hi hagi APK/IPA: butxaca (188 AC-6) + kill (189 AC-7); iOS quan hi hagi iPhone | Informes de camp; tancar AC-7 |

### Detall per sessió (checklist)

#### Sessió A — Copy cuidador ✅
- [x] Branca `feat/SPEC-189-caregiver-walk-silence`
- [x] `limbo` → esperant actualització
- [x] `offline` → sense actualitzacions (+ timeAgo) — darrera posició coneguda
- [x] Sense `animate-ping` en silenci
- [x] Commit

#### Sessió B — Darrera posició al mapa ✅
- [x] Skills: `pathguard-core-state`, `pathguard-agent-frontend`, `pathguard-core-golden-rules`
- [x] Mode visual “darrera coneguda” quan `limbo`/`offline` o confidence `stale` (`last_known`)
- [x] Distingible de `live` / `gps_online` (sense pols viu engañós; anell estàtic + punt ple ambre)
- [x] Traça existent intacta; no exigir `is_recovered` pel silenci
- [x] Commit; **no** merge a `main` encara

#### Sessió C — Tests + desplegament ✅
- [x] Vitest per copy/estat i marcador (AC-6)
- [x] `npm test` baseline OK
- [x] Merge → `main` + `develop` + push `origin`
- [ ] Smoke: https://path-guard-orpin.vercel.app (cuidador) — verificar després del deploy
- [x] Actualitzar aquesta taula (C = `[x]`)

#### Sessió D — Tancament paper MVP ✅
- [x] Marcar AC-1..AC-4, AC-5 (push), AC-6 com a fets
- [x] Deixar AC-7 / field explícitament diferit (Sessió E)
- [x] `STATE.json` pickup → Sessió E / smoke Vercel humà
- [x] Commit docs

#### Sessió E — Field (diferit fins a binari natiu)
- [ ] Android: butxaca → majoria `is_recovered=false` (188)
- [ ] Android: kill → missatge + darrera posició; forats OK; no taronja massiu (189)
- [ ] iOS: mateix contracte quan hi hagi dispositiu (182)
- [ ] Plantilla: `docs/field-tests/TEMPLATE-reactivation-metrics.md`

### Com reprendre en una sessió nova

1. Llegir `.cursor/skills/pathguard-core-state/SKILL.md` + `.pathguard/STATE.json`
2. Obrir **aquesta secció §11** i fer la primera fila `[ ]`
3. `git branch --show-current` → `main` després de C; Sessió E quan hi hagi binari
4. En tancar: actualitzar §11 + `STATE.next_action` / `next_session_pickup`

## 12. Paritat Android ↔ iOS (pla abans de tancar sessió 2026-08-06)

> **Objectiu:** el cuidador ha de viure **la mateixa història** tant si el pacient porta Android com iPhone.  
> La UI del cuidador (aquesta SPEC) ja és compartida (Vercel). El que falta és alinear el **plugin iOS** amb les decisions de producte ja tancades a Android.

### Què ja és igual (no cal tocar)

| Peça | On |
|---|---|
| Textos de silenci + marcador darrera posició | PWA cuidador (Vercel) — sessions A–D |
| Contracte de producte (butxaca = viu; app tancada = excepció; recovered només cua real) | PD-WALK-CLOSED + SPEC-188 + aquesta SPEC |
| Buffer iOS: reload de disc / flush fallit → `isRecovered=true` | Codi ja present (`LocationBuffer.swift`) — **cal validar** amb 182 |

### Diferències reals (iOS vs Android avui)

| Tema | Android (ara) | iOS (ara) | Què fer |
|---|---|---|---|
| Permís d’ubicació de producte | “Mentre s’usa” n’hi ha prou (FGS) | Demana “when in use”, però **escala sol a “sempre”** als 20 punts (`maybeEscalateToAlways`) | **Treure o desactivar** l’auto-escalat a Always (calma PathGuard) |
| Keepalive / forats a la butxaca | SPEC-183 (flush + sonda) | Flush periòdic ~30s; sense sonda stale com 183 | Si el camp iOS mostra forats → valorar keepalive iOS (spec nova o ampliar 183) |
| App tancada | Excepció + UX 189; no traça completa | Igual a producte; “while in use” no captura amb app morta | Documentar + camp (no prometre recovered massiu) |
| Tests natius buffer | JUnit (188) | XCTest pendent | SPEC-182 |
| Camp | Redmi disponible | Sense iPhone ara | Diferit |

### Sessions curtes quan hi hagi iPhone / Xcode

| Sessió | Què | Spec / skill | Sortida |
|---|---|---|---|
| **iOS-1** | Desactivar auto-escalat a “sempre”; deixar “mentre s’usa” com a defecte de producte; build Xcode | SPEC-182 (+ nota producte) · `pathguard-agent-ios` | Commit; IPA de prova |
| **iOS-2** | XCTest buffer (reload / flush fail / punt nou no recovered) — paritat 188 | SPEC-182 AC-1 | Tests verds |
| **iOS-3** | Revisar persistència en background / kill (cua pendent curta) | SPEC-182 AC-2 | Cua real → recovered; forats OK |
| **iOS-4** | Camp: butxaca + silenci cuidador (189) + kill (excepció) | SPEC-182 + 189 AC-7 · `pathguard-domain-field-testing` | Informe; tancar AC-7 iOS |
| **iOS-5** (només si cal) | Keepalive / forats GPS com 183 | Spec nova o ampliació | Només si iOS-4 falla per forats amb moviment |

### Ordre obligatori

1. **No** reobrir “app tancada = tot taronja” a iOS.  
2. Primer **iOS-1** (permisos calm) abans del camp.  
3. SPEC-182 s’ha d’**actualitzar** perquè els AC antics (“sempre” com a camí feliç / recovered després de cada reobertura) **no** contradiguin PD-WALK-CLOSED i SPEC-188.  
4. Cuidador: cap canvi extra — ja és multiplataforma.

### Invocació propera (quan hi hagi dispositiu)

«Anem amb iOS-1 — paritat permisos»  
o  
«Anem amb la sessió E» (camp Android) si el Redmi va primer.

**Skills:** `pathguard-core-state` → SPEC-189 §12 + SPEC-182 → `pathguard-agent-ios` → `pathguard-core-golden-rules`.

