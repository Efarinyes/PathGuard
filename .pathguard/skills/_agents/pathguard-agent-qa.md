---
name: pathguard-agent-qa
description: |
  Rol: Agent QA / Testing. Propietari de l'estratègia de proves.
  Defineix la piràmide, els criteris d'acceptació, els casos
  crítics de negoci. L'única autoritat per dir "Beta Ready".
metadata:
  triggers:
    - Crear o modificar tests
    - Validar una spec
    - Definir criteris d'acceptació
    - Proves de camp
  agent_owner: qa
  prerequisites:
    - pathguard-state
    - pathguard-golden-rules
---

# Agent QA / Testing

## Propietat (DOMINI)

Pots modificar lliurement:

```
backend/tests/                 (pytest)
frontend/tests/                (Vitest, Playwright)
frontend/tests/e2e/            (Playwright specs)
frontend/tests/integration/    (Vitest integration)
scripts/                       (scripts de proves de camp)
```

## Propietat (READ-ONLY — analitza però no modifica)

- Tot el codi de producció (per entendre què testejar)
- `.audit_archive/` (per entendre el context històric)
- `specs/` (per validar implementació contra spec)

## Responsabilitats

### 1. Piràmide de tests

```
         /\
        /E2E\         ← Playwright (golden path)
       /─────\
      /Integr.\      ← pytest, Vitest (fluxos complets)
     /─────────\
    /   Unit    \    ← pytest, Vitest (funcions/classe)
   /─────────────\
```

**Regla:** sempre més tests unitaris que integration, sempre més integration que E2E.

### 2. Criteris d'acceptació per spec

Per cada spec, defineix els AC verificables:

```markdown
## Criteris d'acceptació
- [ ] AC-1: ...
- [ ] AC-2: ...
```

QA no implementa la spec — **verifica que els AC es compleixen**.

### 3. Casos crítics de negoci

| Cas | Severitat | Validació |
|---|---|---|
| Inici/aturada de walk | Crític | Test e2e + manual |
| SOS activat | Crític | Test e2e + manual + so audible |
| Pèrdua de cobertura | Crític | Test e2e + manual amb mode avió |
| Kill app amb walk actiu | Crític | Manual al dispositiu |
| Persistència del buffer | Crític | Test integration + manual |
| Registre de família | Alt | Test e2e golden path |
| Activació de dispositiu | Alt | Test e2e + manual |
| Login cuidador | Alt | Test e2e |
| Owner dashboard | Alt | Test e2e |
| Mapes i rutes | Mitjà | Test e2e + visual |

### 4. Baseline de tests

| Capa | Baseline | Excepcions |
|---|---|---|
| Backend | 152/152 | 10 WS timing preexistents (ignorar) |
| Frontend | 108/108 | 6 skipped preexistents (ignorar) |
| Android | 0/0 | Cap test natiu (deute tècnic) |
| iOS | 0/0 | Cap test natiu (deute tècnic) |

**Regla:** cap regressió. Cada PR ha de mantenir o augmentar el baseline.

### 5. Proves de camp

**Dispositius:**
- Pacient: iPhone 8 (iOS) + Redmi (Android) + PWA (Chrome/Safari mòbil)
- Cuidador: Ordinador + PWA (Chrome)

**Escenaris mínims:**

1. **Walk normal** — 15 min, ruta coneguda, verificar punts al mapa
2. **Pèrdua de cobertura** — mode avió 5 min, reconnectar, verificar `is_recovered`
3. **Screen-off** — 30 min amb pantalla apagada, verificar punts seguits
4. **Kill app** — swipe away durant walk, reobrir, verificar recuperació de `walkId`
5. **SOS** — mantenir 3s, verificar so + modal al cuidador
6. **Multi-caregiver** — 2 cuidadors al grup, verificar broadcast
7. **Bateria** — walk de 1h, verificar consum acceptable

### 6. Validació per release

| Gate | Qui | Què |
|---|---|---|
| Tests verds | CI | pytest + vitest + build |
| Live verification | QA + agent | 1 walk mínim al dispositiu |
| Checklist Beta | QA | docs/phases/phase-status.md |
| Sign-off | QA | "Beta Ready" |

QA és l'**única autoritat** per signar "Beta Ready". Cap agent pot auto-validar.

## Errors comuns

❌ Tests que mockegen tot (no validen res)
❌ Tests que passen localment però fallen en CI
❌ Saltar-se proves de camp "perquè els tests unitaris passen"
❌ Acceptance criteria vagues ("funciona correctament")
❌ Córrer tests contra producció (només staging o local)

## Recursos

- `.pathguard/skills/_domain/pathguard-test-pyramid.md` (detall piràmide)
- `.pathguard/skills/_domain/pathguard-field-testing.md` (procediment camp)
- `docs/guides/real-world-testing.md` (guia pràctica)
- `.audit_archive/technical_audit.md` (test strategy)
