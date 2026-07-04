---
title: "Reorganització del Coneixement"
version: "1.0.0"
status: "active"
owner: "tech-lead"
---

# Reorganització del Coneixement

## Propòsit

Aquest document defineix com es reestructura el coneixement del projecte (skills, specs, ADRs, índexs) quan el projecte evoluciona. La reorganització no ha de suposar pèrdua d'historial ni trencar les referències entre documents.

## Quan reorganitzar

Es recomana una reorganització quan es produeix algun d'aquests escenaris:

- **Nou rol o agent**: apareix un nou rol tècnic que requereix skills propis.
- **Nou domini transversal**: una àrea tècnica creix fins al punt de necessitar el seu propi skill de domini.
- **Canvi arquitectònic major**: una decisió arquitectònica modifica l'estructura de capes.
- **Acumulació de deute documental**: índexs desactualitzats, specs obsoletes, skills duplicats.
- **Release major**: abans d'una release `MAJOR`, es revisa la governança per assegurar-ne la coherència.
- **Fusió o divisió de specs**: una spec esdevé massa gran o queda fragmentada.

## Principis de reorganització

1. **Preservar l'historial**: no esborrar documents; arxivar-los.
2. **No trencar referències**: si un document es mou, deixar una rèplica o redirecció i actualitzar tots els enllaços.
3. **Immutabilitat d'IDs**: els identificadors de specs (`SPEC-NNN`) i ADRs (`ADR-NNN`) no es reutilitzen ni es renumereixen.
4. **Actualitzar índexs**: qualsevol canvi ha de reflectir-se a `specs/000-index.md`, `agents/INDEX.md` i `docs/INDEX.md`.
5. **Validar després de reorganitzar**: comprovar que els enllaços funcionen i que l'estat del projecte segueix sent coherent.

## Reorganització d'skills

### Afegir un nou skill

1. Definir `name`, `description`, `triggers`, `agent_owner` i `prerequisites` al frontmatter.
2. Crear el fitxer a `.opencode/skills/<categoria>/<nom>/SKILL.md`.
3. Actualitzar `agents/INDEX.md`.
4. Si introdueix un nou rol, actualitzar `MODEL_ROLES.md`.
5. Notificar a tots els agents que el poden necessitar.

### Dividir un skill existent

Quan un skill creix massa:

1. Identificar les seccions que mereixen skill propi.
2. Crear els nous skills amb frontmatter propi.
3. Arxivar el skill original o reduir-lo a una introducció que enllaci els nous.
4. Actualitzar `agents/INDEX.md` i els `prerequisites` dels skills afectats.
5. Actualitzar `MODEL_ROLES.md` si cal.

### Fusionar skills

Quan dos skills són redundants:

1. Triar el skill que quedarà com a principal.
2. Integrar el contingut rellevant del skill secundari.
3. Arxivar el skill secundari amb una capçalera que indiqui la fusió.
4. Actualitzar `agents/INDEX.md` i els `prerequisites`.

### Arxivar un skill

1. Moure el fitxer a `.opencode/skills/archive/` (o afegir una capçalera d'arxivat).
2. Actualitzar `agents/INDEX.md` marcant-lo com a històric.
3. Revisar que cap skill actiu el tingui com a prerequisite.

## Reorganització de specs

### Immutabilitat d'IDs

Els IDs de specs (`feature-SPEC-NNN`, `tech-SPEC-NNN`, `integration-SPEC-NNN`) són immutables. Si una spec queda obsoleta:

- Es marca com a `archived`.
- Es pot indicar `supersedes: <SPEC-NNN>` si una altra spec la substitueix.
- No es reutilitza el número.

### Dividir una spec

Si una spec és massa gran:

1. Crear specs filles amb nous IDs.
2. A la spec original, afegir `status: archived` i una nota que enllaci les filles.
3. Actualitzar `specs/000-index.md`.
4. Actualitzar `.pathguard/STATE.json` si la spec original era l'activa.

### Fusionar specs

Si dues specs són redundants:

1. Triar la spec principal (normalment la més recent o la més completa).
2. Integrar els criteris d'acceptació i el context de la secundària.
3. Arxivar la secundària amb `supersedes: <SPEC-NNN-principal>`.
4. Actualitzar `specs/000-index.md`.

## Reorganització de documents i ADRs

### Moure documents

Quan un document canvia de ubicació:

1. Moure el fitxer a la nova carpeta.
2. Actualitzar `docs/INDEX.md`.
3. Si hi ha enllaços entrants des de specs, skills o ADRs, actualitzar-los.
4. Opcionalment, deixar un fitxer stub a la ubicació antiga amb un enllaç a la nova.

### Arxivar ADRs

Una ADR pot quedar obsoleta:

- Si encara és vàlida però històrica: `status: deprecated`.
- Si una altra ADR la substitueix: `status: superseded` amb referència a la nova.
- S'arxiva físicament a `docs/archive/` mantenint l'enllaç a `docs/INDEX.md`.

## Procediment de reorganització

1. **Detectar la necessitat**: Tech Lead o agent identifica el problema.
2. **Planificar**: definir què es mou, arxiva o crea; identificar referències afectades.
3. **Revisar**: Tech Lead valida el pla.
4. **Executar**: aplicar els canvis amb commits clars (`docs:` o `refactor:`).
5. **Validar**:
   - Tots els enllaços interns són correctes.
   - `agents/INDEX.md`, `specs/000-index.md` i `docs/INDEX.md` estan actualitzats.
   - `.pathguard/STATE.json` no queda inconsistent.
   - No hi ha referències a documents arxivats des de documents actius.
6. **Comunicar**: informar els agents afectats dels canvis.

## Riscos i mitigacions

| Risc | Mitigació |
|---|---|
| Enllaços trencats | Revisar tots els `.md` del projecte amb una cerca després de moure fitxers |
| Estat inconsistent | Actualitzar `STATE.json` com a part del procés |
| Pèrdua d'historial | No esborrar; arxivar sempre |
| Confusió entre agents | Comunicar els canvis i actualitzar els skills que hi fan referència |

## Referències

- `ARCHITECT.md` — Arquitectura de governança.
- `PERIODIC_REVIEW.md` — Revisions periòdiques que poden detectar la necessitat de reorganitzar.
- `agents/INDEX.md` — Índex de skills.
- `specs/000-index.md` — Catàleg de specs.
- `docs/INDEX.md` — Índex de documentació.
