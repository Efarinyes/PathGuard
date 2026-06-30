---
name: pathguard-sdd-review-spec
description: |
  Procediment per revisar una spec SDD. Carregar quan el
  Tech Lead avalua una spec nova o modificada.
triggers:
  - Rebre spec per revisar
  - Decidir si aprovar/rebutjar
agent_owner: tech-lead
prerequisites:
  - pathguard-sdd-create-spec
---

# SDD — Revisar una Spec

## Rol

El **Tech Lead** és l'única autoritat per revisar specs cross-capa. Per specs d'1 capa, l'agent owner pot auto-revisar.

## Checklist de revisió

### Estructura
- [ ] Títol descriptiu (verb + objecte)
- [ ] Tipus correcte (`feature` / `tech` / `integration`)
- [ ] NNN correlatiu (no xoca amb altres)
- [ ] Status `draft` (no `approved` ja)
- [ ] Priority assignada (P0/P1/P2)

### Objectiu i context
- [ ] Objectiu clar (1-2 frases)
- [ ] Context justifica "per què ara"
- [ ] Problema és concret, no solució

### Impacte
- [ ] Tots els agents afectats llistats
- [ ] Reviewer designat
- [ ] Contractes afectats identificats
- [ ] ADR referenciat si escau

### Criteris d'acceptació
- [ ] ≥3 AC
- [ ] Tots verificables (true/false)
- [ ] Cobrint happy path + ≥1 error path
- [ ] Cobrint tests + validació

### Riscos
- [ ] ≥2 riscos identificats
- [ ] Cada risc té mitigació
- [ ] Cross-capa riscos identificats

### Pla d'implementació
- [ ] Branca especificada (`<type>/SPEC-NNN-...`)
- [ ] Ordre d'agents clar
- [ ] Dependencies entre passos clares

### Pla de validació
- [ ] Tests unitaris
- [ ] Tests integration
- [ ] Tests e2e (si aplica)
- [ ] Field testing (si afecta UX o GPS)
- [ ] QA sign-off

## Decisión

| Veredicte | Acció |
|---|---|
| **Aprovada** | Status → `approved`, autor pot implementar |
| **Revisar** | Comentaris específics, autor corregeix |
| **Rebutjada** | Motiu clar, autor re-redacta o cancel·la |

## Si és cross-capa

Quan la spec toca ≥2 agents:

1. **Validar contracte** — el Tech Lead verifica que la interfície entre capes és clara
2. **Validar sequencing** — l'ordre d'implementació té sentit (no crear dependències circulars)
3. **Validar sign-off** — tots els agents han d'acceptar el seu abast

## Si requereix ADR

Si la spec implica decisió arquitectònica:

1. Demanar ADR a `docs/decisions/NNNN-...md` **abans** d'aprovar la spec
2. Status ADR: `proposed` → discussió → `accepted`/`rejected`
3. Referenciar ADR a la spec (camp `adr`)

## Output

```markdown
## Review — SPEC-NNN

**Veredicte:** Aprovada | Revisar | Rebutjada

**Comentaris:**
- ...

**Requeriments addicionals:**
- [ ] ADR-NNN
- [ ] Coordinació amb agent X

**Sign-off:** @tech-lead
```

## Errors comuns en revisar

❌ Aprovar sense verificar AC verificables
❌ Saltar cross-capa validation
❌ Aprovar spec que toca contracte sense ADR
❌ Aprovar sense pla de validació de camp
❌ Rebutjar sense motiu concret

## Recursos

- `pathguard-sdd-create-spec` (crear)
- `pathguard-sdd-implement` (següent pas)
- `.audit_archive/technical_audit.md` (criteris tècnics)
- `.audit_archive/product_audit.md` (criteris de producte)
