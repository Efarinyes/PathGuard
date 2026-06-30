---
name: pathguard-golden-rules
description: |
  Les 10 regles d'or no negociables del projecte. Apliquen a TOT
  el codi escrit. Són enforced, no aspiracionals. Carregar
  sempre que hi hagi dubtes sobre què és acceptable.
metadata:
  triggers:
    - Abans d'escriure codi
    - En revisió de PR
    - Quan es considera una excepció
    - Quan algú proposa "només aquest cop..."
  agent_owner: "*"
  prerequisites: []
---

# PathGuard — Golden Rules

Aquestes regles són **obligatòries** i apliquen a **cada línia de codi** del projecte. No s'accepten violacions encara que "funcioni".

## 1. SOLID + CleanCode + SRP
- **Una sola raó de canvi:** cada funció, classe, component i mòdul ha de tenir exactament una raó per canviar.
- **Obert/Tancat:** estendre comportament per composició, no modificant codi existent.
- **Liskov, ISP, DIP:** les abstraccions han de ser estables i mínimes.

## 2. Zero `fetch()` en components
Totes les crides a API passen per la capa `services/`. Cap excepció. Si cal una nova API, crea primer el mètode al servei.

## 3. No prop drilling
Si passes dades per 3+ nivells de components, usa context, hooks o composició. No `props` en cascada.

## 4. Extract, don't expand
Quan un component fa 3+ coses, extreu sub-components. No afegeixis responsabilitats a un component existent.

## 5. No dead code
Codi eliminat no pot deixar imports, referències o blocs comentats enrere. Si elimines, neteja tot el rastre.

## 6. No module-level mutable state
Estat mutable a nivell de mòdul prohibit. Usa instàncies de classe, React state o context.

## 7. No `any` en TypeScript
TypeScript estricte. Si el tipus és incert, usa `unknown` amb type guards.

## 8. No `console.log` en producció
Backend: usa `logger.info()`, `logger.warning()`, `logger.error()`. Frontend: logging estructurat o elimina.

## 9. No hacks o quick fixes
Si la solució sembla un hack, està rebutjada. Resol l'arrel. Cap "de moment...", "temporalment...", "TODO: revisar".

## 10. Arquitectura sobre velocitat
- **Claredat sobre enginy:** codi llegible > codi "optimitzat" però il·legible.
- **Testejable primer:** si una peça és difícil de testejar, el seu disseny és incorrecte.
- **Explícit sobre implícit:** prefereix imports explícits, tipus explícits, estats explícits.

## Regles específiques de PathGuard

A més de les 10 generals, PathGuard té:

- **No `tailwind.config.js`** — tokens a `globals.css/@theme`
- **No hex hardcoded** — usa tokens semàntics (`primary`, `success`, `danger`, etc.)
- **No `print()` en backend** — sempre `logger`
- **No oblidis `is_owner` checks** als nous endpoints
- **No `console.log` a producció** (ja cobert per la regla 8)
- **No commits sense tests** — 152/152 backend, 108/108 frontend com a baseline
- **No coverage loss metrics** — explícitament prohibit per audit de producte (PD-7)
- **No llenguatge clínic/empresarial** a la UI — seguir filosofia "calm, discreet, reliable"

## Què fer davant d'un conflicte

1. Si la regla X sembla contradir la regla Y, la regla més específica guanya.
2. Si cap regla s'aplica, pregunta al Tech Lead.
3. Si el Tech Lead aprova una excepció, **documenta-la a un ADR** (`docs/decisions/NNNN-...md`).

## Validació

Aquestes regles s'enforcen via:
- Code review (humà o agent)
- Tests (regressió)
- ADR per a qualsevol desviació
- Regla 0: "Violar-les és motiu de rework immediat, encara que 'funcioni'."
