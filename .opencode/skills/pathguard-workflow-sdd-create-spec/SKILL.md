---
name: pathguard-workflow-sdd-create-spec
description: |
  Procediment per crear una nova spec SDD. Carregar quan
  s'inicia una feature, refactor, o canvi cross-capa.
metadata:
  triggers:
    - "vull afegir X"
    - "cal canviar Y"
    - Iniciar qualsevol tasca que toqui ≥2 capes
  agent_owner: tech-lead
  prerequisites:
    - pathguard-state
    - pathguard-golden-rules
---

# SDD — Crear una Spec

## Quan crear una spec

- Nova funcionalitat visible
- Refactor significatiu
- Canvi cross-capa (≥2 agents)
- Decisió arquitectònica (implica ADR)

NO cal spec per:
- Bug fix trivial
- Canvi cosmètic
- Update de dependència

## Format de fitxer

`specs/<type>-SPEC-NNN-kebab-case-titol.md`

- `<type>` ∈ {`feature`, `tech`, `integration`}
- `NNN` és correlatiu (3 dígits)
- Títol en kebab-case

## Template

```markdown
---
id: <type>-SPEC-NNN
title: <títol curt>
type: <feature|tech|integration>
status: draft
priority: <P0|P1|P2>
created: YYYY-MM-DD
author: <agent o persona>
agents_affected:
  - <agent-1>
  - <agent-2>
reviewer: <agent-revisor>
blocked_by: []
replaces: <path/old.md>  # opcional
supersedes: <SPEC-NNN>    # opcional
adr: <ADR-NNN>            # opcional
---

# Spec: <títol>

## 1. Objectiu
[1-2 frases: què volem aconseguir]

## 2. Context
[per què ara, quin problema resol, referència a issues/audits]

## 3. Problema
[descripció concreta, no solució]

## 4. Impacte arquitectònic
[quins agents afectats, quins contractes es toquen]

## 5. Criteris d'acceptació
- [ ] AC-1: <verificable>
- [ ] AC-2: <verificable>
- [ ] AC-3: <verificable>

## 6. Riscos identificats
- R1: <descripció> — <mitigació>
- R2: <descripció> — <mitigació>

## 7. Pla d'implementació
1. Branca: `<type>/SPEC-NNN-kebab-case`
2. Pas 1: <agent 1> fa <X>
3. Pas 2: <agent 2> fa <Y>
4. Pas 3: QA valida
5. Merge a develop → main

## 8. Pla de validació
- Tests unitaris: <quins>
- Tests integration: <quins>
- Tests e2e: <quins>
- Validació de camp: <quins dispositius/escenaris>
- QA sign-off: <criteris>

## 9. Out of scope
- <què NO s'inclou>
- <deute tècnic relacionat però diferent>

## 10. Referències
- <ADR>
- <audit>
- <codi relacionat>
```

## Procés

1. **Carregar** `pathguard-state` (saber on som)
2. **Llegir** `specs/000-index.md` (trobar NNN disponible)
3. **Redactar** la spec seguint el template
4. **Actualitzar** `specs/000-index.md` afegint l'entrada
5. **Guardar** a `specs/<type>-SPEC-NNN-...md`
6. **Notificar** al Tech Lead per revisió
7. **Esperar** estat `approved` abans d'implementar

## Bona spec vs mala spec

### Bona
- Objectiu clar (1 frase)
- AC verificables
- Riscos identificats
- Pla d'implementació ordenat

### Dolenta
- "Volem millorar el codi" (objectiu vague)
- AC: "Funciona correctament" (no verificable)
- Sense pla d'implementació
- Sense reviewer

## Validació prèvia

Abans d'enviar al Tech Lead, comprova:

- [ ] Títol és un verb + objecte ("Restore Android plugin", no "Android fix")
- [ ] NNN és correlatiu (comprovar `000-index.md`)
- [ ] Tipus és correcte (`feature` per funcionalitat, `tech` per refactor, `integration` per multi-capa)
- [ ] Status inicial és `draft`
- [ ] Priority és P0/P1/P2
- [ ] Tots els agents afectats estan llistats
- [ ] Reviewer és designat
- [ ] Tots els AC són verificables (poden ser `true`/`false`)
- [ ] Pla d'implementació té branca i ordre
- [ ] Pla de validació té tests + field

## Recursos

- `specs/000-index.md` (catàleg)
- `.opencode/skills/pathguard-core-conventions/SKILL.md` (convencions)
- `.opencode/skills/pathguard-workflow-sdd-review-spec/SKILL.md` (següent pas)
