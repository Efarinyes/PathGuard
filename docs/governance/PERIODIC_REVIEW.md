---
title: "Revisió Periòdica de Governança"
version: "1.0.0"
status: "active"
owner: "tech-lead"
---

# Revisió Periòdica de Governança

## Propòsit

Aquest document defineix els cicles de revisió periòdica del projecte PathGuard. L'objectiu és assegurar que la governança, les especificacions, l'estat i la documentació estiguin alineats amb la realitat del projecte.

## Cicles de revisió

Es defineixen tres cicles de revisió:

| Cicle | Freqüència | Objectiu | Participants |
|---|---|---|---|
| **Standup d'estat** | Cada sessió | Validar branca, spec activa i bloquejos | Agent actiu + Tech Lead si hi ha dubtes |
| **Revisió setmanal** | Setmanal (o cada 5-7 sessions) | Revisar specs actives, bloquejos i riscos | Tech Lead + agents implicats |
| **Revisió de milestone** | Al final de cada fase/major release | Revisar governança completa i arxivar el que toqui | Tech Lead + QA + agents clau |

## 1. Standup d'estat (cada sessió)

### Agenda

1. Llegir `.pathguard/STATE.json`.
2. Validar `git branch --show-current` i `git status`.
3. Confirmar la spec activa i l'agent actiu.
4. Identificar bloquejos.
5. Definir l'objectiu de la sessió.

### Durada màxima

5 minuts.

## 2. Revisió setmanal

### Agenda

1. **Estat del projecte**
   - Branca activa, specs en curs, bloquejos.
   - Milestone i fase actual.

2. **Specs actives**
   - Per cada spec en estat `draft`, `review`, `approved` o `implementing`:
     - Queda clara l'objectiu?
     - Els criteris d'acceptació són verificables?
     - Hi ha algun bloqueig no documentat?
     - Cal reassignar l'agent owner?

3. **Bloquejos i riscos**
   - Revisar `STATE.json > blocked_by`.
   - Decidir accions per desbloquejar.
   - Actualitzar severitat si cal.

4. **Decisions pendents**
   - Revisar ADRs en estat `proposed`.
   - Decidir si calen noves ADRs.

5. **Accions derivades**
   - Crear tasques concretes amb responsable i data.
   - Actualitzar `STATE.json` si cal.

### Durada prevista

15-30 minuts.

## 3. Revisió de milestone

### Agenda

1. **Validació de la fase**
   - Revisar `docs/phases/phase-status.md`.
   - Confirmar que els objectius de la fase s'han assolit.

2. **Revisió de specs**
   - Totes les specs de la fase han passat a `validated` o `archived`?
   - Hi ha specs bloquejades que cal reportar?

3. **Revisió de documentació**
   - `CONTEXT.md` encara és precís?
   - `agents/INDEX.md` reflecteix els skills actuals?
   - `specs/000-index.md` està actualitzat?
   - `docs/INDEX.md` està al dia?

4. **Revisió de governança**
   - `ARCHITECT.md`, `ORCHESTRATOR.md`, `AUDIT.md`, `EXECUTION.md`, `REORGANIZATION.md`, `PERIODIC_REVIEW.md` i `MODEL_ROLES.md` encara són vàlids?
   - Cal reorganitzar skills o documents?

5. **Riscos residuals**
   - Revisar `ROADMAP/beta-readiness.md`.
   - Actualitzar probabilitat i impacte.

6. **Sign-off**
   - QA valida si el milestone és "Beta Ready".
   - Tech Lead valida la governança.

### Durada prevista

1-2 hores.

## Checklist de salut de governança

- [ ] `.pathguard/STATE.json` reflecteix l'estat real.
- [ ] La branca activa és correcta.
- [ ] La spec activa existeix i està ben definida.
- [ ] `specs/000-index.md` inclou totes les specs actives.
- [ ] No hi ha specs en estat `approved` sense implementar des de fa massa temps.
- [ ] Totes les ADRs tenen estat clar (`proposed`, `accepted`, `deprecated`, `superseded`).
- [ ] `agents/INDEX.md` inclou tots els skills actius.
- [ ] No hi ha skills duplicats o obsolets.
- [ ] `docs/INDEX.md` apunta als documents correctes.
- [ ] No hi ha enllaços trencats entre documents.
- [ ] Els bloquejos estan documentats amb acció clara.
- [ ] Els tests baseline es mantenen verds.

## Accions derivades

Després de cada revisió, s'han de documentar les accions:

- Accions immediates: qui les fa i abans de quan.
- Decisions arquitectòniques: si cal ADR.
- Necessitat de reorganització: veure `REORGANIZATION.md`.
- Actualitzacions d'estat: reflectir a `.pathguard/STATE.json`.

## Arxivament de conclusions

Les conclusions de les revisions de milestone es poden arxivar a `docs/reviews/YYYY-MM-DD-milestone-review.md`. Aquests documents són només lectura un cop tancats.

## Referències

- `ARCHITECT.md` — Arquitectura de governança.
- `REORGANIZATION.md` — Com reorganitzar coneixement si la revisió ho detecta.
- `AUDIT.md` — Criteris d'auditoria.
- `pathguard-core-state` — Skill d'inici de sessió.
