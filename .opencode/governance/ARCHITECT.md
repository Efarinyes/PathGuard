---
title: "Arquitectura de Governança de PathGuard"
version: "1.0.0"
status: "active"
owner: "tech-lead"
---

# Arquitectura de Governança de PathGuard

## Propòsit

Aquest document defineix l'**arquitectura del sistema de governança** del projecte PathGuard. No descriu l'arquitectura del producte (PWA, backend, plugins natius), sinó l'estructura que fa possible que agents humans i models d'intel·ligència artificial treballin de manera coordinada, traçable i alineada amb una metodologia **Specification First**.

La governança assegura que:

1. Cada canvi significatiu parteix d'una especificació clara i aprovada.
2. Cada especificació té un owner, un reviewer i un pla de validació.
3. L'estat del projecte és visible i persistent entre sessions.
4. Les decisions arquitectòniques queden documentades i accessibles.
5. El coneixement operatiu està modularitzat en skills reutilitzables.

## Visió general

El sistema de governança es basa en cinc artefactes principals:

| Artefacte | Funció | Font de veritat | Propietari |
|---|---|---|---|
| **Estat** (`.pathguard/STATE.json`) | Memòria viva de la sessió: branca, spec activa, fase, bloquejos, pickup-point | `.pathguard/STATE.json` | Tech Lead (actualització), tots els agents (lectura) |
| **Especificacions** (`specs/`) | Contractes de canvi: què es fa, per què, qui ho fa i com es valida | `specs/<type>-SPEC-NNN-*.md` | Tech Lead (catàleg i revisió), agent owner (implementació) |
| **Decisions** (`docs/decisions/`) | ADRs que justifiquen decisions arquitectòniques amb context, alternatives i conseqüències | `docs/decisions/NNNN-*.md` | Tech Lead |
| **Coneixement operatiu** (`.opencode/skills/`) | Skills modulars per rol, domini i workflow | `.opencode/skills/<categoria>/<nom>/SKILL.md` | Tech Lead |
| **Execució** (codi, branques, PRs, tests) | Implementació material de les especificacions | Git + CI/CD | Agent owner sota supervisió del reviewer |

Aquests artefactes es relacionen de la següent manera:

- L'**estat** apunta a la **spec activa**.
- La **spec** defineix el treball i pot referenciar una **decisió** (ADR).
- Els **skills** instrueixen els agents sobre com crear, revisar, implementar i validar specs.
- L'**execució** demostra que la spec s'ha complert.

## Cicle de vida d'una especificació

Tota spec passa per els següents estats:

```
draft → review → approved → implementing → validated → archived
```

| Estat | Significat | Qui hi pot passar |
|---|---|---|
| `draft` | En redacció | Agent owner o Tech Lead |
| `review` | Llista per revisió | Agent owner |
| `approved` | Aprovada, llest per implementar | Tech Lead (o reviewer designat) |
| `implementing` | En curs d'implementació | Agent owner |
| `validated` | Implementada i validada | QA + Tech Lead + reviewer |
| `archived` | Tancada, reemplaçada o cancel·lada | Tech Lead |

**Regla fonamental:** cap codi de canvi significatiu es produeix sense una spec en estat `approved` (excepte fixes trivials que no requereixen spec, segons el criteri del Tech Lead).

## Contractes i interfícies

### Les specs són contractes

Una spec no és només una descripció. És un contracte entre:

- **L'agent owner**, que es compromet a implementar-la.
- **El reviewer**, que en valida la qualitat.
- **QA**, que en verifica els criteris d'acceptació.
- **Els altres agents afectats**, que en coneixen l'impacte.

Per aquest motiu, tota spec ha de contenir:

- Objectiu clar (1-2 frases).
- Context i problema concret.
- Agents afectats.
- Criteris d'acceptació verificables.
- Pla d'implementació amb branca i ordre.
- Pla de validació (tests, field testing si aplica).
- Riscos identificats amb mitigació.

### Les ADRs són contractes d'arquitectura

Quan una spec implica una decisió arquitectònica (triar una tecnologia, canviar un contracte entre capes, modificar un patró), cal una ADR. Cada ADR conté:

1. **Context**: per què cal decidir.
2. **Decision**: què s'ha decidit.
3. **Consequences**: impacte positiu i negatiu.
4. **Status**: `proposed`, `accepted`, `deprecated`, `superseded`.

### L'estat és un contracte de sessió

`.pathguard/STATE.json` és l'única font de veritat sobre:

- Quina branca està activa.
- Quina spec s'està implementant.
- Quins bloquejos hi ha.
- Quin és el següent pas concret (pickup-point).

Cap agent ha d'ignorar aquest estat abans de començar a treballar.

## Capes de responsabilitat

### 1. Tech Lead

- Decideix quan una spec passa de `review` a `approved`.
- Crea i manté ADRs.
- Coordina tasques cross-capa.
- Manté `.pathguard/STATE.json`, `agents/INDEX.md` i `docs/phases/phase-status.md`.
- No implementa funcionalitat del producte.

### 2. Agents especialitzats

- Cada agent (frontend, backend, android, ios, platform, qa, devops) és propietari del seu domini.
- Carrega els skills corresponents abans d'actuar.
- Implementa només les specs del seu domini (o les assignades com a owner).
- Demana escalat quan una tasca toca fora del seu abast.

### 3. QA

- És l'única autoritat per declarar "Beta Ready" o donar sign-off de validació.
- Defineix els criteris de validació de camp.
- Pot rebutjar una spec implementada si no compleix els AC.

## Principis d'integritat

1. **Single source of truth**: l'estat del projecte viu a `.pathguard/STATE.json`; el catàleg de specs a `specs/000-index.md`; els agents i skills a `agents/INDEX.md`.
2. **No duplicació**: si un procediment ja està documentat a un skill, la governança l'enllaça en lloc de repetir-lo.
3. **Referències explícites**: cada spec pot referenciar ADRs, auditories, issues, codi o altres specs.
4. **Estat actualitzat**: quan una sessió acaba, s'ha de deixar `.pathguard/STATE.json` reflectint l'estat real.
5. **Traçabilitat**: tot canvi ha de poder vincular-se a una spec, un commit i una prova.

## Extensibilitat

El sistema de governança està dissenyat per créixer:

- **Nous agents**: afegir un nou rol requereix crear el seu skill a `.opencode/skills/`, actualitzar `agents/INDEX.md` i, si escau, definir-ne les responsabilitats a `MODEL_ROLES.md`.
- **Nous dominis**: afegir un nou àmbit tècnic requereix un skill de domini i, si és transversal, una ADR.
- **Nous workflows**: quan aparegui un nou procés (per exemple, hotfixes en producció), es crea un skill de workflow i s'actualitza `EXECUTION.md`.

## Relació amb els skills existents

Aquest document no substitueix els skills. Els complementa i en defineix l'arquitectura. Consulteu:

- `pathguard-core-state` per iniciar una sessió.
- `pathguard-core-golden-rules` per les regles no negociables.
- `pathguard-core-conventions` per branques, commits, IDs i idioma.
- `pathguard-workflow-sdd-create-spec`, `pathguard-workflow-sdd-review-spec`, `pathguard-workflow-sdd-implement`, `pathguard-workflow-sdd-validate` per al cicle de vida de les specs.
- `pathguard-agent-tech-lead` per al rol de coordinació.

## Referències

- `CONTEXT.md` — Regles d'or i estructura del projecte.
- `agents/INDEX.md` — Mapa d'agents i skills.
- `specs/000-index.md` — Catàleg de specs.
- `docs/decisions/` — ADRs existents.
- `.pathguard/STATE.json` — Estat actual del projecte.
