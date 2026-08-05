---
id: feature-SPEC-189
title: Caregiver calm notice and last-known position when walk goes silent
type: feature
status: approved
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
- [ ] Amb passeig actiu i presence `limbo`: text informatiu del tipus “Passeig actiu — esperant actualització…”.
- [ ] Amb passeig actiu i presence `offline` (edat darrera ubicació > llindar existent, p.ex. 300s): text del tipus “Sense actualitzacions des de fa X — darrera posició coneguda” (o equivalent calm en català).
- [ ] No s’introdueix UI d’alarma / SOS per aquest estat.

### AC-2 — Darrera posició evident al mapa
- [ ] Quan l’estat és silenci (`limbo`/`offline` o confidence `stale`), el marcador de posició actual es distingeix clarament del mode “en viu” (sense pols viu engañós).
- [ ] La traça ja dibuixada es manté; no s’exigeixen segments `is_recovered=true` nous pel sol fet del silenci.

### AC-3 — Recuperació automàtica
- [ ] Quan tornen punts WS/HTTP, la UI torna a l’estat normal sense acció del cuidador.

### AC-4 — Contracte cross-platform (docs + comportament esperat)
- [ ] Android i iOS comparteixen la mateixa semàntica de producte a aquesta spec i a SPEC-180/188.
- [ ] Documentat: app realment tancada / procés mort → forats acceptats; no traça completa recuperada.

### AC-5 — Desplegament Vercel
- [ ] Canvis UI mergejats a `main` i pushejats a `origin/main` (deploy Vercel).
- [ ] Verificació visual a `https://path-guard-orpin.vercel.app` (cuidador).

### AC-6 — Tests
- [ ] Vitest: copy/estat silenci + mode marcador darrera coneguda.
- [ ] Sense regressió baseline frontend (108/108 + skipped preexistents).

### AC-7 — Field (quan hi hagi binari natiu actualitzat)
- [ ] Android: kill voluntari amb passeig actiu → missatge + darrera posició; **no** gate de `is_recovered=true` massiu.
- [ ] iOS: mateix criteri quan hi hagi dispositiu (alineat SPEC-182).
- [ ] Fins aleshores: validació MVP = PWA cuidador amb silenci simulat (edat de punt / presence) + smoke amb APK/IPA actual si el silenci ja es produeix.

## 6. Riscos

- **R1:** Confondre “Sense cobertura” amb xarxa del cuidador — mitigació: copy centrat en “sense actualitzacions” / “darrera posició”.
- **R2:** Aturada sense moviment (MIN_DISTANCE) sembla silenci — mitigació: PD-CALM-NOT-DENSE-GPS; copy no ha de dir “app tancada” si no ho sabem; basar-se en edat sense afirmar la causa.
- **R3:** Sense APK nou, no validem kill al Redmi amb capa 188+ — mitigació: AC-7 diferit; MVP Vercel primer.
- **R4:** Canvi de labels sense tocar backend pot divergir de snapshot — mitigació: mapar només UI sobre els 4 estats ja existents.

## 7. Pla d’implementació

**Branca de treball UI:** `feat/SPEC-189-caregiver-walk-silence` des de `main` (deploy Vercel exigeix arribar a `main`).

**Ordre:**

1. **Tech Lead (aquesta entrega docs):** PD + SPEC-189 + alineació 180/188/185 → branca `docs/SPEC-189-walk-closed-exception` → merge `main`.
2. **Frontend:** AC-1..AC-3, AC-5, AC-6 (Vitest). Python/Java no calen.
3. **Backend:** només si el MVP descobreix forat de presence (aleshores micromamba `tracker-env` + pytest).
4. **QA:** validació Vercel; field natiu quan hi hagi build.
5. **Android / iOS / Platform:** cap canvi de codi al MVP; actualitzar notes de contracte quan es toqui natiu més endavant.

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
