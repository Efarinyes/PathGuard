---
name: pathguard-agent-qa
description: >-
  Rol: Agent QA / Testing. Propietari de l'estratègia de proves. Defineix la piràmide, els criteris d'acceptació, els casos crítics de negoci. L'única autoritat per dir "Beta Ready". Use when: Crear o modificar tests; Validar una spec; Definir criteris d'acceptació; Proves de camp.
---

# Agent QA / Testing

## Prerequisites

Read these skills first:
- `pathguard-core-state`
- `pathguard-core-golden-rules`

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
             /E2E\         Playwright (golden path)
            /─────\        pytest golden path
           /Integr.\       pytest + Vitest (fluxos complets)
          /─────────\
         /   Unit    \     pytest + Vitest (funcions/classe)
        /─────────────\
       /  Field Tests  \   Manual al dispositiu (camp)
      ──────────────────
```

**Regla d'or:** sempre més tests unitaris que integration, sempre més integration que E2E. E2E és car i fràgil.

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
| Telèfon a la butxaca / screen-off | Crític | Manual al dispositiu (Android prioritari) |
| Kill app amb walk actiu | Crític | Manual al dispositiu |
| Persistència del buffer | Crític | Test integration + kill/reopen |
| Registre de família | Alt | Test e2e golden path |
| Activació de dispositiu | Alt | Test e2e + manual |
| Login cuidador | Alt | Test e2e |
| Owner dashboard | Alt | Test e2e |
| Mapes i rutes | Mitjà | Test e2e + visual |

### 4. Baseline actual

| Capa | Total | Passing | Skipped/Failing | Notes |
|---|---|---|---|---|
| Backend | 162 | 152 | 10 WS timing preexistents | Ignorar WS preexistents |
| Frontend | 114 | 108 | 6 skipped preexistents | Ignorar skipped |
| Android | 0 | 0 | — | Deute tècnic (SPEC-120) |
| iOS | 0 | 0 | — | Deute tècnic (SPEC-120) |

**Regla:** cap regressió. Cada PR ha de mantenir o augmentar.

### 5. Proves de camp

**Dispositius:**
- Pacient: iPhone 8 (iOS) + Redmi (Android) + PWA (Chrome/Safari mòbil)
- Cuidador: Ordinador + PWA (Chrome)

**Escenaris mínims:**

1. **Walk normal** — 15 min, ruta coneguda, verificar punts al mapa
2. **Butxaca / screen-off** — 15–30 min pantalla apagada (escenari real de producte)
3. **Kill app** — swipe away durant walk, reobrir, verificar `walkId` + estat en línia
4. **SOS** — mantenir 3s, verificar so + modal al cuidador
5. **Multi-caregiver** — 2 cuidadors al grup, verificar broadcast
6. **Bateria** — walk ~45–60 min (límit producte), verificar consum acceptable

Veure el procediment complet a `.cursor/skills/pathguard-domain-field-testing/SKILL.md`.

### 6. Validació per release

| Gate | Qui | Què |
|---|---|---|
| Lint | CI | ESLint + ruff/black |
| Unit + Integration | CI | pytest + vitest |
| Build | CI | next build + gradle assembleDebug |
| E2E golden path | CI (Playwright) | golden-path.spec.ts |
| Field test | Manual (QA) | 1 walk mínim |
| Sign-off | QA | "Beta Ready" |

QA és l'**única autoritat** per signar "Beta Ready". Cap agent pot auto-validar.

## Nivells i eines

| Nivell | Eina | Quan | Exemples |
|---|---|---|---|
| Unit (Python) | pytest | Sempre | Funcions pures, models, validation |
| Unit (TS) | Vitest | Sempre | Hooks, utilities, services |
| Integration (BE) | pytest + TestClient | Per feature | Auth flow, walk lifecycle |
| Integration (FE) | Vitest + Testing Library | Per feature | useLivePatientLocation, walkService |
| E2E (web) | Playwright | Golden path | Registre → walk → atura |
| Field | Manual | Per release | Walk real al dispositiu |

## Anatomia d'un test bo

### Unit (Python)
```python
def test_validate_coordinates_rejects_out_of_range():
    with pytest.raises(ValueError, match="Latitude out of range"):
        _validate_coordinates(91.0, 0.0)
```

### Unit (TS)
```typescript
describe('douglasPeucker', () => {
  it('returns same array when length <= 2', () => {
    expect(douglasPeucker([[0, 0], [1, 1]], 0.5)).toEqual([[0, 0], [1, 1]]);
  });
});
```

### Integration (Python)
```python
def test_start_walk_returns_walk_id(client, db, sample_patient):
    response = client.post(
        "/walks/start",
        headers={"X-Patient-Token": sample_patient.device_token},
    )
    assert response.status_code == 200
    assert "walk_id" in response.json()
```

### E2E (Playwright)
```typescript
test('registre → activar → walk end-to-end', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Crear entorn familiar');
  await page.fill('input[name="email"]', 'test@example.com');
  // ...
});
```

## Cobertura per àrea

| Àrea | Cobertura mínima |
|---|---|---|
| Auth (register, login, activate) | 100% happy path + 1 error per path |
| Walk lifecycle (start, stop, active) | 100% happy + 1 error per step |
| Location batch (idempotency, validation) | 100% happy + 3 errors |
| WebSocket (broadcast, isolation) | 100% happy + isolation |
| GPS filtering (gates) | 100% per gate (Android JUnit, iOS XCTest) |
| SOS (sound, modal) | 100% happy + 1 error |
| Owner dashboard | 100% happy (config + history) |

## Mocking strategy

| Què | Com |
|---|---|
| HTTP extern | `fetch` mock (Vitest) |
| WebSocket | mock server (msw) |
| LocalStorage | Vitest mock |
| IndexedDB | `fake-indexeddb` (ja al package.json) |
| Native plugin | mock manual (TS tipus) |
| GPS | injectable position (Vitest + custom hook) |

**Regla:** mai mockar el que vols testejar. Mockar les dependències externes.

## Tests com a documentació

Els tests han de ser **exemples vius** de com usar el codi. Si un test és difícil d'escriure, el codi probablement és difícil d'usar.

## Errors comuns

- ❌ Tests que mockegen tot (no validen res)
- ❌ Tests que passen localment però fallen en CI
- ❌ Saltar-se proves de camp "perquè els tests unitaris passen"
- ❌ Acceptance criteria vagues ("funciona correctament")
- ❌ Córrer tests contra producció (només staging o local)
- ❌ Mockar tot i no validar res
- ❌ Tests que fallen intermitentment (flake)
- ❌ Tests amb sleeps (`time.sleep(2)`)
- ❌ Tests que depenen de l'ordre d'execució
- ❌ Saltar-se field tests perquè "els unitaris passen"

## Recursos

- `.cursor/skills/pathguard-domain-field-testing/SKILL.md` (procediment camp)
- `docs/guides/real-world-testing.md` (guia pràctica)
- `.audit_archive/technical_audit.md` (test strategy)
- `frontend/tests/e2e/golden-path.spec.ts` (E2E exemplar)
- `backend/tests/test_golden_path_e2e.py` (E2E backend exemplar)
