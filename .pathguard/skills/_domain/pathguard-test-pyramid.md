---
name: pathguard-test-pyramid
description: |
  Piràmide de tests i estratègia de testing. Carregar quan
  es crea o modifica un test, o quan es planifica cobertura.
triggers:
  - Crear o modificar test
  - Definir cobertura per feature
  - Decidir entre unit/integration/e2e
  - Validar gates de release
agent_owner: qa
prerequisites:
  - pathguard-agent-qa
---

# Test Pyramid — PathGuard

## Piràmide

```
              /\
             /E2E\         Playwright (golden path)
            /─────\        pytest golden path
           /Integr.\       pytest + Vitest (flows complets)
          /─────────\
         /   Unit    \     pytest + Vitest (funcions/classe)
        /─────────────\
       /  Field Tests  \   Manual al dispositiu (camp)
      ──────────────────
```

**Regla d'or:** sempre més tests unitaris que integration, sempre més integration que E2E. E2E és car i fràgil.

## Nivells i eines

| Nivell | Eina | Quan | Exemples |
|---|---|---|---|
| Unit (Python) | pytest | Sempre | Funcions pures, models, validation |
| Unit (TS) | Vitest | Sempre | Hooks, utilities, services |
| Integration (BE) | pytest + TestClient | Per feature | Auth flow, walk lifecycle |
| Integration (FE) | Vitest + Testing Library | Per feature | useLivePatientLocation, walkService |
| E2E (web) | Playwright | Golden path | Registre → walk → atura |
| Field | Manual | Per release | Walk real al dispositiu |

## Baseline actual

| Capa | Total | Passing | Skipped/Failing | Notes |
|---|---|---|---|---|
| Backend | 162 | 152 | 10 WS timing preexistents | Ignorar WS preexistents |
| Frontend | 114 | 108 | 6 skipped preexistents | Ignorar skipped |
| Android | 0 | 0 | — | Deute tècnic (SPEC-120) |
| iOS | 0 | 0 | — | Deute tècnic (SPEC-120) |

**Regla:** cap regressió. Cada PR ha de mantenir o augmentar.

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
|---|---|
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

## Tests per release

| Gate | Qui | Què |
|---|---|---|
| Lint | CI | ESLint + ruff/black |
| Unit + Integration | CI | pytest + vitest |
| Build | CI | next build + gradle assembleDebug |
| E2E golden path | CI (Playwright) | golden-path.spec.ts |
| Field test | Manual (QA) | 1 walk mínim |
| Sign-off | QA | "Beta Ready" |

## Tests com a documentació

Els tests han de ser **exemples vius** de com usar el codi. Si un test és difícil d'escriure, el codi probablement és difícil d'usar.

## Errors comuns

❌ Mockar tot i no validar res
❌ Tests que fallen intermitentment (flake)
❌ Tests amb sleeps (`time.sleep(2)`)
❌ Tests que depenen de l'ordre d'execució
❌ Acceptance criteria vagues
❌ Saltar-se field tests perquè "els unitaris passen"

## Recursos

- `.pathguard/skills/_domain/pathguard-field-testing.md` (procediment camp)
- `frontend/tests/e2e/golden-path.spec.ts` (E2E exemplar)
- `backend/tests/test_golden_path_e2e.py` (E2E backend exemplar)
