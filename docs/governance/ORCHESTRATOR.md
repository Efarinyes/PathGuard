---
title: "Orquestració de Sessió i Agents"
version: "1.1.0"
status: "active"
owner: "tech-lead"
---

# Orquestració de Sessió i Agents

## Propòsit

Aquest document defineix el **comportament permanent de l'orquestrador** del projecte PathGuard. L'orquestrador no és un rol separat: és el procés que qualsevol agent ha de seguir per coordinar el seu propi treball, delegar correctament als skills i mantenir la coherència del projecte.

L'objectiu és assegurar que:

- Cada sessió comença des de l'estat real del projecte.
- Cap implementació s'inicia sense context, especificació i pla.
- Els components existents es reutilitzen abans de crear-ne de nous.
- Cada resultat es valida abans de considerar-se finalitzat.
- L'entropia del projecte es redueix contínuament, no s'acumula.

## Rol de l'orquestrador

L'orquestrador és la funció que **coordina el treball dins d'una sessió**:

- Quan el rol actiu és el **Tech Lead**, l'orquestrador coordina tasques cross-capa, assigna agents i resol conflictes.
- Quan el rol actiu és un agent especialitzat, l'orquestrador garanteix que aquest agent completa el procés d'inicialització, reutilitza el que ja existeix, planifica abans de implementar i valida abans de lliurar.
- L'orquestrador sempre consulta `.pathguard/STATE.json`, els specs i la documentació de governança abans de prendre decisions operatives.

## Procés d'inicialització obligatòria

Abans de començar qualsevol tasca, tot agent ha de seguir el procés descrit a `AGENTS.md` > "Inicialització obligatòria dels agents". En resum:

1. Llegir la documentació de governança en l'ordre establert.
2. Comprendre el context del projecte (`CONTEXT.md`, `.pathguard/STATE.json`).
3. Localitzar i revisar els specs relacionats.
4. Identificar els skills implicats.
5. Verificar que es pot reutilitzar abans de crear.
6. Planificar les tasques i decidir la seqüència d'execució.

**Regla d'or:** cap implementació pot començar sense haver completat aquest procés.

## Cicle d'orquestració

El treball d'una sessió segueix aquest cicle:

```
Inicialitzar → Entendre → Planificar → Delegar → Implementar → Validar → Lliurar
```

| Fase | Què fa l'orquestrador | Entregable |
|---|---|---|
| **Inicialitzar** | Carrega `pathguard-core-state` i valida `STATE.json`. | Sessió situada a la branca i spec correctes. |
| **Entendre** | Llegeix la governança, el context i el spec actiu. | Comprensió del problema i l'abast. |
| **Planificar** | Defineix les tasques, l'ordre i els criteris d'èxit. | Pla concret abans d'escriure codi. |
| **Delegar** | Selecciona els skills adequats per cada tasca. | Skills carregats i entesos. |
| **Implementar** | Executa el treball seguint el pla i les convencions. | Canvis coherents amb l'arquitectura. |
| **Validar** | Verifica tests, revisa coherència i comprova l'estat. | Resultat acceptable o llista de correccions. |
| **Lliurar** | Actualitza `STATE.json`, fa commit/PR i deixa pickup-point. | Estat consistent per a la següent sessió. |

## Presa de decisions

L'orquestrador ha de decidir **qui decideix** en cada situació:

| Situació | Qui decideix | Com |
|---|---|---|
| Canvi dins del domini de l'agent actiu | L'agent actiu | Seguint el spec i els skills del rol. |
| Tasca cross-capa o conflicte entre agents | Tech Lead | Amb spec d'integració i, si cal, ADR. |
| Decisió arquitectònica | Tech Lead | Redactant o actualitzant una ADR a `docs/decisions/`. |
| Canvi de rol, spec o branca activa | Tech Lead | Actualitzant `.pathguard/STATE.json`. |
| Dubte o ambigüitat | L'agent actiu | Escalant al Tech Lead o preguntant a l'usuari. |

## Planificació abans de la implementació

Abans d'escriure codi, l'orquestrador ha de respondre aquestes preguntes:

1. **Què s'ha de fer?** — descrit per la spec o, si no existeix, crear-la.
2. **Per què?** — problema arrel, no només símptoma.
3. **Qui ho fa?** — agent owner i reviewer.
4. **Com es validarà?** — tests, field testing, revisió de codi.
5. **Quins riscos té?** — bloquejos potencials i mitigacions.
6. **Quin és l'ordre correcte?** — dependències entre capes o agents.
7. **Quina branca?** — segons les convencions de `pathguard-core-conventions`.

Si no es pot respondre a aquestes preguntes, la tasca no està preparada per implementar-se.

## Reutilització abans de crear

L'orquestrador ha de comprovar sistemàticament si ja existeix el que necessita:

- **Especificació similar** a `specs/`.
- **Component, hook o servei equivalent** al frontend.
- **Endpoint, model o servei equivalent** al backend.
- **Funció nativa equivalent** als plugins Android o iOS.
- **Skill existent** que cobreixi el domini o workflow.
- **ADR existent** que resolgui una decisió similar.

Només si no existeix una solució adequada es crea un component, spec, skill o ADR nou.

## Delegació als skills

Els skills viuen a `.cursor/skills/` i són el mecanisme de delegació de l'orquestrador:

- L'orquestrador **identifica** quins skills són rellevants per a la tasca actual.
- L'orquestrador **carrega** els skills en l'ordre correcte: core → rol → domini → workflow.
- L'orquestrador **no invoca skills sense haver analitzat prèviament** el context, el spec i els artefactes de governança.
- L'orquestrador **evita duplicar** al document de governança allò que ja està en un skill; en lloc d'això, hi fa referència.

Veure `AGENTS.md` per al mapa de skills i `agents/INDEX.md` per a la llista completa.

## Validació obligatòria

Cap resultat es considera finalitzat fins que no s'ha validat:

1. **Cobertura de la spec:** els criteris d'acceptació estan complets.
2. **Tests baseline:** backend, frontend i builds natius mantenen els seus baselines.
3. **Coherència arquitectònica:** els canvis respecten `ARCHITECT.md`, `MODEL_ROLES.md` i les ADRs.
4. **Qualitat de codi:** sense `any`, `console.log`, URLs hardcoded, hex hardcoded ni hacks.
5. **Estat del projecte:** `STATE.json` reflecteix la nova realitat.
6. **Documentació:** specs, ADRs i governança actualitzats si escau.

Si la validació falla, l'orquestrador no accepta el resultat i planifica les correccions.

## Preservació de la coherència arquitectònica

L'orquestrador ha de protegir l'arquitectura del projecte:

- **No permetre** que un agent toqui fora del seu domini sense coordinació.
- **Garantir** que els contractes entre capes (bridge, API, models) romanen coherents.
- **Assegurar** que una decisió arquitectònica quedi reflectida en una ADR.
- **Mantenir** l'alineació entre `AGENTS.md`, `ARCHITECT.md`, `MODEL_ROLES.md` i aquest document.

## Reducció contínua de l'entropia

L'orquestrador no només afegeix funcionalitat; també ha de reduir la complexitat:

- **Eliminar duplicació** de codi, documentació o especificacions.
- **Refactoritzar** quan una responsabilitat s'ha tornat massa gran.
- **Arxivar** specs, skills o documentació obsoleta en lloc de deixar-la dispersa.
- **Actualitzar** índexos i referències quan es reestructura el projecte.
- **Fer revisions periòdiques** de l'estat del projecte per detectar deute tècnic aviat.

## Estat compartit i handoff

`.pathguard/STATE.json` és la memòria compartida entre sessions. L'orquestrador l'actualitza:

- Al final de cada sessió, amb `last_action`, `next_action` i `next_session_pickup`.
- Quan canvia l'agent actiu, la spec activa o la branca activa.
- Quan apareix o es resol un bloqueig.

Quan un agent lliura la sessió a un altre, el handoff ha de deixar el projecte en un punt estable i documentar el següent pas concret.

## Referències

- `AGENTS.md` — Punt d'entrada per a qualsevol agent i procés d'inicialització obligatòria.
- `ARCHITECT.md` — Arquitectura de la governança i cicle de vida de les specs.
- `MODEL_ROLES.md` — Definició dels rols dels agents i els seus límits.
- `CONTEXT.md` — Regles d'or i estructura del projecte.
- `agents/INDEX.md` — Mapa pràctic de skills.
- `.pathguard/STATE.json` — Estat actual del projecte.
