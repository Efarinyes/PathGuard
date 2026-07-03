---
name: pathguard-domain-field-testing
description: |
  Procediment de proves de camp amb dispositius reals. Carregar
  quan es planifica una validació field, o quan QA prepara
  el procediment per a un release.
metadata:
  triggers:
    - Preparar validació per release
    - Planificar proves amb dispositius
    - Documentar resultats de camp
  agent_owner: qa
  prerequisites:
    - pathguard-agent-qa
    - pathguard-test-pyramid
---

# Field Testing — Procediment

## Dispositius

| Rol | Dispositiu | OS | Versió |
|---|---|---|---|
| Pacient (Android) | Redmi Note (testat 2026-06-10) | Android | 13+ |
| Pacient (iOS) | iPhone 8 | iOS | 15+ |
| Pacient (iOS recent) | iPhone (recent) | iOS | 17+ |
| Pacient (PWA) | Chrome mòbil | — | latest |
| Cuidador | Ordinador (Chrome) | — | latest |
| Cuidador (PWA) | Safari mòbil | — | latest |

## Escenaris mínims (per release)

### 1. Walk normal
**Durada:** 15 min
**Ruta:** coneguda (5-10 punts GPS esperables)
**Passos:**
1. Obrir `/patient` al dispositiu
2. Iniciar walk
3. Caminar la ruta
4. Aturar walk
5. Verificar punts al mapa del cuidador

**Criteri d'èxit:**
- Tots els punts al mapa
- Ruta coherent (sense zigzags evidents)
- Zero `is_recovered` (tot live)
- Distància acumulada raonable

### 2. Pèrdua de cobertura
**Durada:** 5 min offline + 5 min recovery
**Passos:**
1. Iniciar walk
2. Caminar 5 min
3. Activar mode avió 5 min
4. Desactivar mode avió
5. Caminar 5 min més
6. Aturar walk

**Criteri d'èxit:**
- Punts offline marcats `is_recovered=true`
- Segment recovered pintat discontinu al mapa
- Zero pèrdua de punts
- Total de punts ≈ 12-15 min de walk

### 3. Screen-off (Doze / background)
**Durada:** 30 min
**Passos:**
1. Iniciar walk
2. Apagar pantalla
3. Caminar 30 min amb pantalla apagada
4. Encendre pantalla
5. Aturar walk

**Criteri d'èxit:**
- Punts seguits durant screen-off
- Cuidador veu actualitzacions en temps real (si WS viu)
- Si WS mor, caregiver veu `gps_online` (no `offline`)

### 4. Kill app (swipe away)
**Durada:** 15 min
**Passos:**
1. Iniciar walk
2. Swipe away (tancar app)
3. Caminar 2 min
4. Reobrir app
5. Verificar que walk continua

**Criteri d'èxit:**
- `walkId` recuperat
- Punts enviats durant kill
- App reconnecta automàticament
- Walk reprèn sense intervenció

### 5. SOS
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

### 6. Multi-caregiver
**Durada:** 10 min
**Passos:**
1. 2 cuidadors al grup
2. Walk actiu
3. Verificar que tots dos reben updates

**Criteri d'èxit:**
- Broadcast arriba a tots
- Cap cuidador queda desfasat

### 7. Bateria (walk llarg)
**Durada:** 1h
**Passos:**
1. Walk 1h amb intervals adaptatius
2. Mesurar consum

**Criteri d'èxit:**
- Consum raonable (< 5% per 30 min)
- Cap pèrdua de punts per bateria

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
  - <issue 2>
- **Evidència:**
  - [Screenshot/GIF/Log](path)
```

## Issues trobats a camp

Si es troba un issue, crear ticket a `specs/` (format `bug-NNN-...`) i:

1. Documentar reproducció
2. Assignar agent
3. Crear spec si cal fix
4. Bloquejar release si és crític

## Criteri "Beta Ready"

Tots els 7 escenaris han de passar amb ✅. Qualsevol ⚠️ o ❌ requereix:
- Decisió de tech-lead (tolerable per beta o no)
- Si no tolerable: spec + fix + retest

## Resources

- `docs/guides/real-world-testing.md` (guia pràctica)
- `docs/field-tests/` (reports històrics)
- `audit_native_layer.md` (issues coneguts)
