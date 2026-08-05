# PathGuard — Evolució

Cronologia narrativa del producte i del projecte, de la concepció fins al present.
No substitueix l’estat operatiu (`.pathguard/STATE.json`) ni el catàleg de specs (`specs/000-index.md`).

**Última actualització:** 2026-08-05

---

## Pròleg

PathGuard és una app de tranquil·litat familiar: un familiar gran surt a passejar; un cuidador veu on és, en temps real, sense alarmisme ni panòptica. Ha de ser **calmada**, **discreta** i **fiable** — no una app d’esport, ni de delivery, ni de navegació.

Aquesta història explica com vam arribar d’una idea web a una PWA + capa nativa Capacitor, i quines batalles (GPS, presència, `is_recovered`) ens han ensenyat què vol dir “fiable” al carrer.

---

## 1. Concepció — per què existeix

El problema no era “més mètriques”. Era **reduir l’angoixa** del cuidador quan algú gran surt a caminar, sense convertir el pacient en un objecte vigilat.

Decisions de producte que van marcar el to des del primer dia:

- Una pantalla de pacient amb **poc botons** (idealment un).
- El cuidador veu el passeig i el mapa; no cal un dashboard clínic.
- Distància recorreguda i altres mètriques “esportives” es van descartar més endavant: el que importa és *va sortir?*, *quant?,* *per on?*

El repositori neix l’abril de 2026 com a monorepo (backend FastAPI + frontend Next.js), amb proves d’integració i E2E des de molt aviat: la intenció ja era construir per validar, no només per demo.

---

## 2. Primera PWA — web primer, límits al descobert

Abril–maig 2026: PathGuard es consolida com a **PWA**.

Apareixen els pilars que encara avui defineixen el producte:

- Grups familiars, rols (owner / caregiver / patient) i activació de dispositiu pacient.
- WebSockets amb estat per grup i rehidratació en reconnect.
- Cua offline (IndexedDB) i sincronització quan torna la xarxa.
- Mapa en viu al cuidador, historial de passeigs, SOS discret.

La beta `v2.0.0-beta.1` (maig) deixa la PWA més dura: service worker, pàgina offline, capa de serveis al backend, i ja el concepte de punts **recuperats** (`is_recovered`) dibuixats en ambre al mapa.

**Entrebanc:** el navegador no és un sistema de localització en background. A iOS especialment, i a Android amb pantalles apagades i OEMs agressius, “funciona al Chrome amb la pantalla encesa” no equival a “funciona a la butxaca durant una hora”. Les proves reals de maig ho van deixar clar: el pacient necessita natiu; el cuidador pot continuar sent PWA.

També es va cancel·lar la “fase distància” (maig): no resolia tranquil·litat, només afegia soroll.

---

## 3. Salt natiu — Capacitor i LocationSync

Decisió (ADR-0002): **Capacitor**, no React Native ni Flutter. Una base Next.js; plugin custom **LocationSync** (Java a Android, Swift a iOS); bridge TypeScript tipat.

Arquitectura de producte:

| Rol | Forma |
|---|---|
| Pacient | App Capacitor (GPS background, FGS a Android) |
| Cuidador | PWA (mapa, historial; sense GPS background) |

Maig–juny: migració PostgreSQL en producció, enduriment del dashboard owner, i primers sprints Android (permisos, flush periòdic, buffer, histeresi, filtre de distància mínima). Juny tanca una capa Android “provisional” validada al camp, amb deute i auditories encara obertes.

Final de juny / 1 de juliol: **Fase 0 de governança** — agents, skills, specs SDD, ADRs. El projecte deixa de ser només codi: passa a ser un sistema amb rols (Tech Lead, Backend, Frontend, Android, iOS, Platform, QA, DevOps). El 30 de juliol aquesta governança migra d’OpenCode a **Cursor** (històric a `archive/opencode-governance-2026-07-30`).

ADR-0004 (juny): **una sola font de GPS** al natiu — el plugin LocationSync; mai dos modes competint.

---

## 4. GPS i vida al carrer — estiu 2026

Juliol és el mes del carrer: Redmi, butxaca, Doze, OEMs, permisos.

Arriben (i es mergegen) peces que encara avui són el llindar de “passeig seriós”:

- **iOS:** plugin LocationSync, correcció de `is_recovered`, reachability natiu (`NWPathMonitor`) perquè el WebSocket es torni a enganxar quan canvia la xarxa, monitor de xarxa global (no només durant tracking).
- **Android:** foreground service més robust (Doze, wake locks, `walkId` als punts, permisos de background), i després el fix dur: deixar d’exigir `ACCESS_BACKGROUND_LOCATION` com a gate quan el permís “mentre s’usa” ja permetia avançar — sense això el tracking no arrencava en condicions reals (`4b1c9eb`, 31 juliol).
- **Backend / mapa:** quan el pacient puja lots per HTTP (sense WS viu), el cuidador ha de veure presència i traça; d’aquí SPEC-170 i, més tard, “presència honesta” (SPEC-185) i aging al frontend perquè el limbo no s’enganxi.

Lliçó d’aquesta etapa: el camp mana més que el simulador. Protocols de prova es van netejar (per exemple, **mode avió** va sortir dels gates de beta: no representava el cas d’ús). I una altra lliçó de producte: si el pacient s’atura sense desplaçament mínim, **no hi ha punt nou** — densitat baixa no és bug; és calma.

---

## 5. Presència i mapa — juliol–agost

El mapa del cuidador no és només GPS: és **confiança**.

Quan el WebSocket del pacient mor però els punts continuen pujant per HTTP, cal dir la veritat: el pacient està actiu per dades, no per socket. Quan la darrera evidència envelleix, el UI ha d’envellir també — si no, el cuidador viu en un limbo verd etern.

Aquest fil (WS vs HTTP, aging, broadcast de `patient_status`) corre en paral·lel amb el buffer persistent cross-platform (umbrella SPEC-180) i la validació iOS diferida (SPEC-182: sense iPhone a mà, Android-first).

---

## 6. La batalla d’`is_recovered` — agost 2026

`is_recovered` havia de significar: *aquest punt va passar pel buffer de recuperació* (flush fallit, o reload des de disc després de mort de procés). Al mapa, traça ambre = “vam recuperar”, no “pantalla apagada”.

La realitat va ser més bruta:

1. **Walk 151 i abans:** gaps i semàntica incompleta a Android.
2. **SPEC-181:** histeresi i override del flag — millora mecànica.
3. **SPEC-186 + 183 + 187:** buffer diferit quan “no foreground”, keepalive del passeig, notificació FGS visible a la pantalla de bloqueig. El walk **154** (3 agost, ~60 min, pantalla apagada, notif ON) va sortir **taronja de cap a peus**: gairebé tot `is_recovered=true`.
4. El diagnòstic correcte no va ser “l’app estava morta”, sinó **semàntica invertida**: 186 tractava “background / pantalla apagada” com a recovered. Això contradia el producte.
5. **Decisió de producte (PD-RECOVERED-ONLY-FROM-BUFFER):** `true` **només** si el punt havia estat al buffer per recuperar-lo. Pantalla apagada ≠ recovered.
6. **SPEC-188** substitueix 186: s’elimina el deferred-on-background; el reload des de disc i el re-cua després de flush fallit són els únics camins a `true`. Mergejat a `main` (`f896660`). Queda el **field AC-6**: un passeig post-188 amb informe.

Lliçó: una spec “correcta” al paper pot ser un bug de producte al carrer. El mapa taronja del 154 va ser el millor test d’acceptació que teníem — i ens va forçar a reescriure la regla.

---

## 7. Avui — on som (2026-08-05)

**Codi en producció / integració:** `main` = `develop` = origin (fins al merge d’aquesta higiene). Darrer canvi natiu recovered: `f896660` (SPEC-188). Frontend Vercel, backend Render, BD Supabase.

**Decisió de producte (2026-08-05) — PD-WALK-CLOSED-IS-EXCEPTION:**  
App tancada amb passeig actiu = **excepcionalitat**. No es promet traça completa en taronja. El cuidador ha de veure missatge calm + darrera posició (**SPEC-189**). Butxaca amb passeig actiu = directe (blau). `is_recovered` només buffer real (188).

**Restriccions de sessió:** sense rebuild natiu al dispositiu ara; UX 189 via Vercel/`main`; backend amb micromamba `tracker-env`; Java només via Android Studio quan toqui natiu.

**Specs vives a l’arrel** (la resta a `specs/archive/`):

| Spec | Per què encara importa |
|---|---|
| 189 | MVP cuidador: silenci → copy + darrera posició (Vercel); camp natiu diferit |
| 188 | Field AC-6 butxaca (kill → 189) |
| 187 | Notificació FGS (smoke OK; tancar formalment) |
| 185 | Presència HTTP honesta — field; UX silenci → 189 |
| 183 | Keepalive — revisió després del field butxaca |
| 182 | iOS buffer — **diferit** |
| 180 | Umbrella; promesa “app tancada = recovered complet” retirada |

**Higiene recent:** arrel neta (R1a); specs magres (R2). El que és història viu a `docs/archive/` i `specs/archive/`, no al primer pla de l’explorador.

**Obert a la cartera (no bloqueja el MVP 189):**

- UX “petició de trucada” més calmada (no SOS alarmista) — pla local a session-notes.
- iOS (182) + field kill 189 quan hi hagi dispositiu/binari.
- CI/CD, i18n, tests natius — backlog conscient, no P0 fals.

El producte encara apunta a **beta externa** (`v2.7.0-beta.1` com a target de roadmap): PWA + Android usable al carrer, iOS a remolc, procediments de camp honestos.

---

## Apèndix — On viu cada veritat

| Pregunta | On mirar |
|---|---|
| On som *ara* (branca, bloqueig, proper pas)? | `.pathguard/STATE.json` + skill `pathguard-core-state` |
| Quines specs estan obertes? | `specs/000-index.md` |
| Specs fetes / backlog? | `specs/archive/` |
| Per què Capacitor / una sola font GPS / …? | `docs/decisions/` (ADRs) |
| Com arrencar o desplegar? | `docs/guides/`, `README.md` |
| Instruccions per agents? | `AGENTS.md`, `CONTEXT.md`, `.cursor/skills/` |
| Roadmap beta? | `ROADMAP/beta-readiness.md` |
| Canvis versionats? | `CHANGELOG.md` (parcial; aquesta evolució cobreix el fil narratiu) |
| Documents antics? | `docs/archive/` — només lectura |

---

*Fi de la cronologia viva. Quan tanqui el field SPEC-188 o un canvi de fase gran, afegeix un capítol — no reescriguis tot el passat.*
