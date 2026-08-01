---
name: pathguard-workflow-session-close
description: >-
  Tanca una sessió PathGuard actualitzant .pathguard/STATE.json amb pickup per
  la propera sessió. Use when: L'usuari diu "tancar sessió", "tanca sessió",
  "session close", "actualitza STATE", "on som demà", o invoca explícitament
  pathguard-workflow-session-close al final d'una feina.
disable-model-invocation: true
---

# Session Close — Actualitzar STATE.json

Skill simètric a `pathguard-core-state` (inici) → aquest skill (final).

**No commitejar** `.pathguard/STATE.json` (gitignored). Només escriure el fitxer local.

## Prerequisites

1. Llegeix `.pathguard/STATE.json` (estat anterior).
2. Si no existeix, copia `.pathguard/STATE.example.json` i adapta.

## Invocació (usuari)

Qualsevol d'aquestes frases disparen aquest skill:

- «Tancar sessió» / «Tanca la sessió»
- «Actualitza STATE.json»
- «pathguard-workflow-session-close»

## Workflow (executar en ordre)

### 1. Recollir fets objectius

```bash
git branch --show-current
git log -1 --oneline
git status --short
git branch -a   # només si la sessió ha tocat branques
```

Opcional si la sessió ha desplegat: confirmar `last_deploy_main` amb l'usuari o `git log origin/main -1`.

### 2. Sintetitzar des de la conversa

Extreure (no inventar):

| Camp | Font |
|---|---|
| Què s'ha fet | commits, merges, field tests, docs, decisions |
| Què queda pendent | tasques no acabades, specs en curs |
| Decisions de producte | semàntica, prioritats, aparcats |
| Proper pas concret | 1 acció + invocació si existeix al pla |

Si falta info crítica per `next_action`, pregunta **una** cosa abans d'escriure.

### 3. Actualitzar STATE.json

**Preservar** sense canvis innecessaris: `bootstrap`, `test_commands`, `conventions`, `version`.

**Actualitzar sempre:**

| Camp | Valor |
|---|---|
| `last_updated` | ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`) |
| `session.status` | `"closed"` |
| `session.closed_at` | mateix timestamp |
| `session.active_agent` | `null` |
| `session.active_spec` | `null` (o SPEC en curs si sessió interrompuda a mitja implementació) |
| `session.active_branch` | branca actual de git |
| `session.last_action` | Resum sessió tancada (1–3 frases, fets verificables) |
| `session.next_action` | Proper pas + invocació entre cometes si aplica |
| `session.blocked_by` | Només bloquejos reals; `[]` si cap |
| `project.current_branch` | branca git actual |
| `project.phase` | Fase del pla o milestone actual |
| `branches.commit` | hash HEAD de main (o develop si divergeix — documentar) |
| `branches.active_work` | Llista branques rellevants amb commit |
| `next_session_pickup` | Bloc complet (plantilla §Pickup) |

**Actualitzar si ha canviat la sessió:**

- `project.deployed_env.last_deploy_main`
- `active_specs` (màx. 3–5 rellevants; no duplicar tot el catàleg)
- `open_issues_from_audit` (status / next_step)
- `field_test_latest` (si hi ha hagut prova de camp)
- `branches.deleted_*` (només si s'han esborrat branques)

### 4. Escriure fitxer

Escriu `.pathguard/STATE.json` amb JSON vàlid (indent 2 espais).

Opcional: si la sessió ha canviat el pla operatiu, actualitza també `.pathguard/session-notes/PLA-POST-GPS-2026-07.md` (gitignored).

### 5. Resposta a l'usuari

Retorna **sempre** aquest format (català):

```markdown
## Sessió tancada — PathGuard

| Camp | Valor |
|---|---|
| **Commit** | `<hash>` — `<missatge curt>` |
| **Branca** | `<branch>` |
| **Fase** | `<fase actual>` |
| **Fet avui** | `<1 línia>` |
| **Proper pas** | `<acció concreta>` |
| **Invocació** | «<frase pickup>» |

STATE.json actualitzat. Propera sessió: carregar `pathguard-core-state`.
```

No demanar confirmació extra si l'usuari ja ha invocat el tancament.

## Plantilla — `next_session_pickup`

Copia i omple (substituir `…`):

```text
PICKUP SESSIÓ SEGÜENT — PathGuard (YYYY-MM-DD+)

══════════════════════════════════════════
ON SOM
══════════════════════════════════════════
• Branca: … (= main/develop si aplica, commit …)
• Fase completada: …
• Fase actual / següent: …
• Producció: Vercel+Render des de main; APK cal rebuild manual si natiu

══════════════════════════════════════════
FET EN LA DARRERA SESSIÓ
══════════════════════════════════════════
• …

══════════════════════════════════════════
PROPER PAS
══════════════════════════════════════════
→ …
  Branca: … (si aplica)
  Spec: SPEC-NNN (si aplica)
  Agent: … (+ skill …)
  Invocació: «…»

══════════════════════════════════════════
PARAL·LEL OPCIONAL
══════════════════════════════════════════
→ … (humà / no bloquejant) — o «Cap»

══════════════════════════════════════════
REFERÈNCIES
══════════════════════════════════════════
• Pla: .pathguard/session-notes/PLA-POST-GPS-2026-07.md
• Catàleg: specs/000-index.md
• …

══════════════════════════════════════════
PRIMERA ACCIÓ AGENT (propera sessió)
══════════════════════════════════════════
1. Carregar pathguard-core-state
2. git branch --show-current
3. Confirmar prioritat amb usuari si cal
```

## Regles

1. **Mai inventar** commits, walk IDs o estats de specs — verificar amb git i fitxers.
2. **Mai commitejar** STATE.json.
3. Si `main` ≠ `develop`, documentar-ho explícitament a `branches` i `next_session_pickup`.
4. `blocked_by` buit per defecte; només bloquejos que impedeixin avançar.
5. Mantenir simetria: inici = `pathguard-core-state`, final = aquest skill.

## Relació amb altres skills

| Moment | Skill |
|---|---|
| Inici sessió | `pathguard-core-state` |
| Fi sessió | `pathguard-workflow-session-close` (aquest) |
| Commit codi | `pathguard-workflow-commit` |
| Branques | `pathguard-workflow-branching` |
