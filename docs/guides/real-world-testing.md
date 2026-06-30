# PathGuard — Real-World Testing

Guia per fer proves de camp amb dispositius reals.

## Procediment

Per al procediment detallat, carrega el skill:

> `.opencode/skills/pathguard-domain-field-testing/SKILL.md`

Aquest skill conté:
- Dispositius requerits
- 7 escenaris mínims (walk normal, pèrdua cobertura, screen-off, kill app, SOS, multi-caregiver, bateria)
- Criteris d'èxit per cada escenari
- Format de report
- Criteri "Beta Ready"

## Guia detallada (versió original)

La guia completa original (amb captures i procediment pas a pas) és a:

> [`../archive/guia-proves-reals.md`](../archive/guia-proves-reals.md)

⚠️ Aquest document està **arxivat** perquè la informació operativa ha passat al skill `pathguard-domain-field-testing.md`. Es conserva per història.

## Resum dels 7 escenaris

| # | Escenari | Dispositiu | Durada | Criteri |
|---|---|---|---|---|
| 1 | Walk normal | Pacient | 15 min | Tots els punts al mapa, ruta coherent |
| 2 | Pèrdua cobertura | Pacient | 5+5 min | `is_recovered` correcte, zero pèrdua |
| 3 | Screen-off | Pacient | 30 min | Punts seguits, caregiver veu `gps_online` |
| 4 | Kill app | Pacient | 15 min | `walkId` recuperat, walk reprèn |
| 5 | SOS | Tots dos | 5 min | So + modal < 2s |
| 6 | Multi-caregiver | 2 cuidadors | 10 min | Broadcast a tots |
| 7 | Bateria | Pacient | 1h | Consum raonable, zero pèrdua |

## Reporting

Cada prova s'ha de documentar a `docs/field-tests/<data>-<escenari>.md`:

```markdown
# Field Test: <escenari>

- Data: YYYY-MM-DD
- Dispositiu: <model> <OS>
- App: <versió>
- Resultat: ✅ / ⚠️ / ❌
- Punts enviats: N
- Punts rebuts: N
- Pèrdues: 0
- is_recovered: M/N
- Issues: <llista>
```

## Criteri "Beta Ready"

Tots els 7 escenaris han de passar amb ✅. Qualsevol ⚠️ o ❌ requereix:
- Decisió de tech-lead
- Si no tolerable: spec + fix + retest

## Sign-off

**QA** és l'única autoritat per signar "Beta Ready". Cap agent pot auto-validar.

## Referències

- Skill: `.opencode/skills/pathguard-domain-field-testing/SKILL.md`
- Detall original: [`../archive/guia-proves-reals.md`](../archive/guia-proves-reals.md)
- Piràmide de tests: `.opencode/skills/pathguard-domain-test-pyramid/SKILL.md`
