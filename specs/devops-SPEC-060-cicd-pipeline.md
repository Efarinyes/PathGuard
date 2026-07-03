---
id: devops-SPEC-060
title: Pipeline CI/CD multi-plataforma
type: devops
status: draft
priority: P1
created: 2026-06-30
author: tech-lead
agents_affected:
  - devops
  - platform-integration
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Pipeline CI/CD multi-plataforma

## 1. Objectiu
Establir pipelines CI/CD que validin cada PR i produeixin artefactes per release: APK Android, IPA iOS, i deploy automàtic Vercel/Render.

## 2. Context
Actualment el deploy és manual:
- Vercel auto-deploy des de `main` (OK)
- Render auto-deploy des de `main` (OK)
- No hi ha CI per validar PR
- No hi ha builds APK/IPA automatitzats

## 3. Problema
- PRs poden trencar tests sense detecció
- Releases manuals són propensos a error
- No hi ha validació cross-platform en CI

## 4. Impacte arquitectònic
- **DevOps:** redacta `.github/workflows/`
- **Platform:** valida configuració secrets, signing

## 5. Criteris d'acceptació

### Pipelines
- [ ] AC-1: `.github/workflows/lint.yml` — ESLint + ruff
- [ ] AC-2: `.github/workflows/test.yml` — pytest + vitest
- [ ] AC-3: `.github/workflows/build.yml` — next build + gradle assembleDebug
- [ ] AC-4: `.github/workflows/release.yml` — APK release + IPA + GitHub Release (trigger: tag `v*`)

### Secrets
- [ ] AC-5: `MATCH_PASSWORD` (iOS), `KEYSTORE_PASS` (Android), `KEY_ALIAS`
- [ ] AC-6: Documentació a `docs/decisions/`

### Build apps natives
- [ ] AC-7: APK release signat correctament
- [ ] AC-8: IPA archive generat (signing opcional en CI)
- [ ] AC-9: Build < 10 min total

## 6. Riscos
- **R1:** Secrets exposats al log — usar `secrets.*`
- **R2:** Build massa lent — paral·lelitzar
- **R3:** Signing config errònia — validar en staging

## 7. Pla
**Branca:** `devops/SPEC-060-cicd-pipeline`

1. DevOps: crea workflows
2. Configurar secrets
3. Test amb PR de prueba
4. Validar amb tag `v0.0.0-test`
5. PR

## 8. Validació
- Pipelines s'executen correctament
- Tag crea release amb artifacts
- Sign-off DevOps

## 9. Out of scope
- Code coverage reporting
- Sentry integration (SPEC futura)
- Slack/Discord notifications

## 10. Referències
- `.opencode/skills/pathguard-domain-cicd/SKILL.md`
- `.opencode/skills/pathguard-agent-devops/SKILL.md`
