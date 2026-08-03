---
name: pathguard-domain-field-testing
description: >-
  Procediment de proves de camp amb dispositius reals. Carregar quan es planifica una validació field, o quan QA prepara el procediment per a un release. Use when: Preparar validació per release; Planificar proves amb dispositius; Documentar resultats de camp.
---

# Field Testing — Procediment

## Prerequisites

Read these skills first:
- `pathguard-agent-qa`

## Producte (beta)

PathGuard beta = **passejos curts** (~15–60 min): patient surt a donar una volta; caregiver veu si tot va bé i on és.

El telèfon del patient sol anar **a la butxaca** (pantalla apagada / repòs). Això és l’escenari real a validar.

### Fora d’abast per a Beta estable

- Passejos de 2h+ — fora del target de producte actual.

## Dispositius

| Rol | Dispositiu | OS | Versió |
|---|---|---|---|
| Pacient (Android) | Redmi Note (testat 2026-06-10) | Android | 13+ |
| Pacient (iOS) | iPhone 8 | iOS | 15+ |
| Pacient (iOS recent) | iPhone (recent) | iOS | 17+ |
| Pacient (PWA) | Chrome mòbil | — | latest |
| Cuidador | Ordinador (Chrome) | — | latest |
| Cuidador (PWA) | Safari mòbil | — | latest |

## Escenaris mínims (per release / Beta)

### 1. Walk normal (app activa)
**Durada:** 15 min  
**Ruta:** coneguda (5-10 punts GPS esperables)  
**Passos:**
1. Obrir `/patient` al dispositiu
2. Iniciar walk
3. Caminar la ruta (pantalla encesa o app en primer pla)
4. Aturar walk
5. Verificar punts al mapa del cuidador

**Criteri d'èxit:**
- Tots els punts al mapa
- Ruta coherent (sense zigzags evidents)
- Majoritàriament `is_recovered=false` (transmissió en viu)
- Distància acumulada raonable

### 2. Telèfon a la butxaca (repòs / screen-off) — **crític Android**
**Durada:** 20–40 min total (mínim 15 min amb pantalla apagada)  
**Passos:**
1. Iniciar walk
2. Caminar 2–3 min amb app visible
3. Apagar pantalla i posar el telèfon a la butxaca / penjat
4. Continuar el passeig
5. Encendre pantalla, aturar walk
6. Verificar BD + mapa cuidador

**Criteri d'èxit:**
- Flux de punts **continu o amb densitat acceptable** durant repòs (sense forats de molts minuts)
- Cuidador veu actualitzacions o, si hi ha retard, els punts arriben en ordre cronològic
- Cap pèrdua massiva de trams

> Prioritat producte 2026-08-01: aquest escenari importa més que qualsevol simulació de xarxa artificial.

### 3. Kill app + reobrir (passeig actiu)
**Durada:** 15 min  
**Passos:**
1. Iniciar walk
2. Swipe away (tancar app)
3. Esperar 1–2 min (telèfon en repòs)
4. Reobrir app
5. Verificar que walk continua i caregiver torna a “en línia”

**Criteri d'èxit:**
- `walkId` recuperat
- Estat cuidador: torna a en línia després de reobrir
- Punts pendents al buffer s’envien; poden ser `is_recovered=true` si s’havien persistit
- Walk reprèn sense intervenció manual extra

### 4. SOS
**Durada:** 5 min  
**Passos:**
1. Walk actiu
2. Cuidador monitoritza
3. Pacient prem SOS 3s
4. Cuidador escolta so + veu modal

**Criteri d'èxit:**
- So audible (chime càlid, no alarm)
- Modal apareix al cuidador < 2s
- Localització del SOS visible

### 5. Multi-caregiver
**Durada:** 10 min  
**Passos:**
1. 2 cuidadors al grup
2. Walk actiu
3. Verificar que tots dos reben updates

**Criteri d'èxit:**
- Broadcast arriba a tots
- Cap cuidador queda desfasat

### 6. Bateria (passeig tipic)
**Durada:** ~45–60 min (límit producte)  
**Passos:**
1. Walk amb intervals normals, majoritàriament a la butxaca
2. Mesurar consum

**Criteri d'èxit:**
- Consum raonable per a un passeig d’1h
- Cap pèrdua de punts atribuïble a bateria baixa en condicions normals

## Mètriques de reactivació (obligatori en proves butxaca / kill)

Separar sempre tres eixos (plantilla: `docs/field-tests/TEMPLATE-reactivation-metrics.md`):

| Mètrica | Què mesura | Decideix |
|---|---|---|
| **A — Densitat GPS** | Punts BD / forats >3 min | SPEC-183 keepalive si ❌ |
| **B — Estat UI** | verd / gps_online / taronja | SPEC-185 presence si taronja amb mapa OK |
| **C — Mapa** | Avança durant butxaca? | Correlació A+B |

## Reporting

Per cada prova de camp, documentar a `docs/field-tests/<data>-<escenari>.md`:

```markdown
# Field Test: <escenari>

- **Data:** YYYY-MM-DD
- **Dispositiu:** <model> <OS>
- **App:** <versió>
- **Resultat:** ✅ / ⚠️ / ❌
- **Walk ID:** <id>
- **Punts enviats:** N
- **Punts rebuts:** N
- **Pèrdues:** 0
- **is_recovered:** M/N
- **Issues trobats:**
  - <issue 1>
- **Evidència:**
  - [Screenshot/GIF/Log](path)
```

## Issues trobats a camp

Si es troba un issue, crear ticket a `specs/` i:

1. Documentar reproducció
2. Assignar agent
3. Crear spec si cal fix
4. Bloquejar release si és crític

## Criteri "Beta Ready"

Escenaris **1–4** han de passar amb ✅ (5–6 desitjables). Qualsevol ⚠️ o ❌ a 1–4 requereix:
- Decisió de tech-lead (tolerable per beta o no)
- Si no tolerable: spec + fix + retest

## Backlog producte (no gate beta actual)

Idees prioritaries post-/peri-beta (veure pla post-GPS):

1. **Keep-alive Android no invasiva** durant passeig actiu (despertar periòdic en segon pla / FGS robust davant OEM Doze).
2. **Caregiver → force location**: demanar al patient que enviï ubicació actual + flush del buffer (wake PathGuard sota demanda).

## Resources

- `docs/guides/real-world-testing.md` (guia pràctica; pot contenir històric)
- `docs/field-tests/` (reports històrics)
- `.pathguard/session-notes/PLA-POST-GPS-2026-07.md`
