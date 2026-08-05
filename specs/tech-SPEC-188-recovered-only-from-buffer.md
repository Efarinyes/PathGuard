---
id: tech-SPEC-188
title: Correct is_recovered — only after real recovery buffer
type: tech
status: implementing
priority: P0
created: 2026-08-03
author: tech-lead
agents_affected:
  - android
  - qa
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: SPEC-186
adr: null
---

# Spec: Correct is_recovered — only after real recovery buffer

## 1. Objectiu

Corregir l’etiqueta `is_recovered` a Android perquè el cuidador vegi **taronja NOMÉS** quan el punt havia estat guardat al buffer **per recuperar-lo** i després s’ha enviat. Pantalla apagada + notificació de passeig activa + enviament OK → **viu (`false`)**.

## 2. Context

- Walk **154** (2026-08-03, Redmi, APK `e3af409`): gairebé tots els punts `is_recovered=true` amb protocol de pantalla apagada i FGS/notif OK. Informe local: `.pathguard/session-notes/INFORME-WALK-154-2026-08-03.md`.
- SPEC-186 va lligar “no foreground / MARK_BACKGROUNDED” → `addDeferred` / recovered. Això **contradiu** la semàntica de producte afinada el 2026-08-03 (PD-RECOVERED-ONLY-FROM-BUFFER).
- Nord de producte: **tranquil·litat**, no traça densa. Aturada sense desplaçament mínim → sense punt nou = **esperat** (PD-CALM-NOT-DENSE-GPS).

## 3. Problema

1. `onPointAccepted`: si `!isAppInForeground()` → `addDeferred` marca `isRecovered=true` **sense** fallada d’enviament.
2. `MARK_BACKGROUNDED` (PWA: pantalla apagada → `visibility hidden`) crida `markPendingRecoveredAndPersist()` i contamina punts pendents.
3. El keepalive pot **enviar amb èxit** batches ja etiquetats com a recovered → mapa tot taronja tot i canal OK.
4. El mapa PWA cuidador pinta fidelment la BD; no és el bug.

## 4. Impacte arquitectònic

| Capa | Canvi |
|---|---|
| **Android** | Única capa de codi: `LocationSyncForegroundService`, `LocationBuffer` (+ tests). |
| **PWA pacient** | Cap canvi funcional per defecte: `markBackgrounded` pot quedar com a avís de visibilitat **sense** efecte recovered. |
| **PWA cuidador / mapa** | Cap canvi. |
| **Bridge TS** | Cap canvi de signatura. |
| **Backend** | Cap canvi. |
| **iOS** | Fora d’abast (SPEC-182 diferit). |

**Contracte de producte (obligatori):**

| Condició | `is_recovered` |
|---|---|
| Punt nou acceptat i enviat amb flush OK (FGS actiu, amb o sense UI visible) | `false` |
| Flush HTTP ha fallat → punt tornat al buffer → enviat després | `true` |
| Cua recarregada des de disc després de mort de procés / restart → enviada | `true` |
| Pantalla apagada / `markBackgrounded` / “no foreground” **sols** | **no** canvia l’etiqueta |

**Persistència vs etiqueta:** es pot persistir la cua a disc per no perdre dades en kill **sense** marcar recovered fins que el punt compleixi una fila `true` de la taula.

Patró mapa esperat quan hi ha recuperació **real**:

`blau → taronja discontinu → blau`

## 5. Criteris d’acceptació

### AC-1 — Semàntica estreta
- [x] Cap camí de codi marca `isRecovered=true` només perquè l’app no està en foreground o ha arribat `MARK_BACKGROUNDED`.
- [x] `addDeferred` eliminat; acceptació sempre via `add` (live).

### AC-2 — Recuperació real
- [x] `onFlushFailure`: punts re-afegits al buffer tenen `isRecovered=true` i es persisteixen.
- [x] Load des de disc (`LocationBuffer` ctor / store): punts carregats tenen `isRecovered=true` abans del flush.
- [x] `onFlushSuccess` neteja estat de fallada com ara.

### AC-3 — Pantalla apagada = viu si s’envia
- [x] Amb FGS/notif actius i flush OK, punts acceptats amb UI no visible s’envien amb `is_recovered=false`.
- [x] `MARK_BACKGROUNDED` / `MARK_FOREGROUNDED` no-op respecte recovered.

### AC-4 — Kill / process death (persistència útil)
- [x] `onTaskRemoved` / `onDestroy` criden `persist()` sense flip recovered; al restart el ctor marca `true`.
- [x] Separar persist-for-safety vs label-as-recovered.

### AC-5 — Tests JUnit
- [x] Tests SPEC-188 a `LocationBufferTest` (sense deferred-on-background).

### AC-6 — Field (Redmi, protocol walk 154) — actualitzat 2026-08-05
- [ ] Passeig amb pantalla apagada la major part del temps, notif ON, aturades normals: **majoria** de punts `is_recovered=false` mentre hi ha enviament OK.
- [ ] Taronja només en trams amb recuperació real (flush fallit o restart amb cua), no per apagar pantalla.
- [ ] Aturada sense desplaçament → sense punts nous = OK (no és fallada).
- [ ] **Kill / app tancada NO és gate d’aquest AC.** És excepcionalitat de producte (PD-WALK-CLOSED-IS-EXCEPTION): missatge + darrera posició → **SPEC-189**. No s’exigeix `is_recovered=true` massiu després d’un kill.
- [ ] Field natiu diferit mentre no es pugui rebuild APK al dispositiu; validació UX de silenci via SPEC-189 (Vercel).

### AC-7 — Docs / SPEC-186
- [x] SPEC-186 marcada `superseded` per SPEC-188.
- [x] `specs/000-index.md` actualitzat.
- [x] Nota a SPEC-180 alineada amb PD-RECOVERED-ONLY-FROM-BUFFER.

## 6. Riscos

- **R1:** Persistir sense recovered pot deixar cues a disc amb `false` que al reload es marquen `true` — **desitjat** (reload = recuperació).
- **R2:** Kill sense persist → pèrdua de punts — mitigació: persistir cua en `onTaskRemoved`/`onDestroy` **sense** exigir recovered fins al reload.
- **R3:** Confondre keepalive (183) amb semàntica recovered — keepalive només envia/desperta; **no** etiqueta.

## 7. Pla d’implementació

**Branca:** `fix/SPEC-188-recovered-only-from-buffer` des de `develop`/`main` (`e3af409`+)

1. **Tech Lead:** aquesta SPEC → aprovació usuari.
2. **Agent Android:** canviar `LocationSyncForegroundService` + `LocationBuffer`; ajustar JUnit.
3. **QA:** revisar AC-5/AC-6.
4. Merge → APK → field protocol walk 154.
5. Actualitzar INFORME/STATE locals després del field.

## 8. Pla de validació

- JUnit `LocationBufferTest` (+ casos nous AC-5).
- Field Redmi AC-6.
- Sense canvi de contracte bridge; baseline frontend/backend intacte.

## 9. Out of scope

- iOS (SPEC-182).
- Canvis al mapa cuidador / presence UI.
- SPEC-184.
- Canviar filtres de desplaçament mínim (aturades sense punt = esperat).
- Ampliar keepalive (183) més enllà del mínim ja mergejat, llevat que el field AC-6 falli per enviament amb moviment real.

## 10. Referències

- Informe: `.pathguard/session-notes/INFORME-WALK-154-2026-08-03.md` (local, no Git)
- SPEC-186 (superseded), SPEC-181, SPEC-180, SPEC-183
- PD-RECOVERED-ONLY-FROM-BUFFER, PD-CALM-NOT-DENSE-GPS
- Codi: `LocationSyncForegroundService.java`, `LocationBuffer.java`, `useOfflineRecovery.ts` (només context)
