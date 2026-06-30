---
name: pathguard-state
description: |
  Retorna l'estat actual consolidat del projecte: branca, fase,
  spec activa, agent actiu, pròxima acció, bloquejos. Carregar
  A L'INICI DE TOTA SESSIÓ i abans de qualsevol canvi. Sense
  aquest skill no s'ha d'escriure codi.
triggers:
  - Inici de qualsevol sessió
  - Després d'una pausa llarga
  - Abans d'obrir una branca
  - Abans de fer un commit
  - Quan l'usuari diu "continua" o "on érem?"
agent_owner: "*"
prerequisites: []
---

# PathGuard — Estat del Projecte

Aquest skill és **la primera cosa que es carrega** quan s'arriba a una sessió. És la memòria entre sessions.

## 1. Llegeix `.pathguard/STATE.json`

Si el fitxer no existeix, copia `.pathguard/STATE.example.json` i adapta'l a la sessió actual.

## 2. Retorna en una sola resposta

- **Branca actual:** quina `git branch` està checked out
- **Agent actiu:** quin dels 8 rols està treballant
- **Spec activa:** quin `SPEC-NNN` s'està implementant
- **Estat de la spec:** draft | review | approved | implementing | validated
- **Pròxim pas concret:** què s'ha de fer a continuació
- **Bloquejos:** què impedeix avançar
- **Pickup-point:** des d'on continuarà la propera sessió

## 3. Comportament esperat

Si `STATE.json` no existeix o té `last_updated` de fa més de 24h:
- Pregunta a l'usuari: "L'última sessió va acabar a X. Continuo des d'aquí o començo de nou?"
- Si l'usuari continua, regenera `STATE.json` a partir de l'estat real (`git status`, `git log`, `specs/`, etc.)

## 4. Validació de l'estat

Comprova abans de retornar:
- [ ] `git status` és net o canvis coneguts
- [ ] La branca a `STATE.json` coincideix amb `git branch --show-current`
- [ ] La spec activa existeix a `specs/`
- [ ] El pickup-point té sentit donat l'estat

## 5. Regla d'or

> **Mai no escriuis codi sense haver carregat i validat aquest skill primer.**

Si l'estat és ambigu, pregunta. Mai no inventis.

## 6. Exemple d'output esperat

```
ESTAT PATHGUARD — Sessió 2026-06-30 10:00
─────────────────────────────────────────
Branca: feat/ios-native-layer
Agent actiu: tech-lead
Spec activa: (cap — preparant Fase 0)
Fase: Fase 0 — Estructura agents + skills
Pròxim pas: Implementar estructura .pathguard/ + skills
Bloquejos: cap
Pickup: Continuar amb SPEC-010 un cop Fase 0 validada
```
