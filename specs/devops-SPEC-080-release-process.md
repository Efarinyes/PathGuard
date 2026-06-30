---
id: devops-SPEC-080
title: Tag-driven release + artifacts + secrets
type: devops
status: draft
priority: P1
created: 2026-06-30
author: tech-lead
agents_affected:
  - devops
  - tech-lead
reviewer: tech-lead
blocked_by:
  - SPEC-060
replaces: null
supersedes: null
adr: null
---

# Spec: Tag-driven release + artifacts + secrets

## 1. Objectiu
Establir el flux de release basat en tags semver: tag `v*` → pipeline → APK/IPA → GitHub Release amb CHANGELOG.

## 2. Context
Actualment no hi ha flux de release definit. Es fan builds manuals quan cal.

## 3. Problema
- Builds manuals propensos a error
- No hi ha traçabilitat de què conté cada versió
- CHANGELOG no es genera automàticament

## 4. Impacte
- **DevOps:** implementa pipeline release
- **Tech Lead:** sign-off + CHANGELOG manual

## 5. Criteris d'acceptació
- [ ] AC-1: Tag `v*.*.*` activa pipeline release
- [ ] AC-2: Pipeline produeix APK + IPA + SHA256
- [ ] AC-3: GitHub Release creat amb CHANGELOG
- [ ] AC-4: Artifacts penjats al release
- [ ] AC-5: Documentat a `docs/guides/release-process.md`

## 6. Riscos
- **R1:** Tag mal format activa pipeline — validar regex
- **R2:** Secrets no configurats — bloqueig
- **R3:** Build triga massa — paral·lelitzar

## 7. Pla
**Branca:** `devops/SPEC-080-release-process`

1. DevOps: implementa pipeline
2. Tech Lead: redacta CHANGELOG template
3. Test amb tag `v0.0.0-test`
4. Documentar

## 8. Validació
- Tag produeix release correcte
- CHANGELOG generat
- Sign-off DevOps + Tech Lead

## 9. Out of scope
- Auto-publish a Play Console / App Store Connect (manual)
- Canary releases (post-beta)

## 10. Referències
- SPEC-060 (CI/CD)
- `.opencode/skills/pathguard-domain-cicd/SKILL.md`
