---
id: feature-SPEC-030
title: Revocació de device_token (owner)
type: feature
status: draft
priority: P0
created: 2026-06-30
author: tech-lead
agents_affected:
  - backend
  - frontend
  - platform-integration
reviewer: platform-integration
blocked_by: []
replaces: null
supersedes: null
adr: pending  # ADR-0005 a redactar
---

# Spec: Revocació de device_token (owner)

## 1. Objectiu
Permetre que el **owner** d'una família pugui **revocar el `device_token`** d'un dispositiu pacient des del dashboard. Resoldre el risc de seguretat identificat a `audit_native_layer.md` (R-P0-4).

## 2. Context
El `device_token` actual:
- És permanent (UUID generat un cop)
- No expira
- No es pot revocar
- Està emmagatzemat a `localStorage` (no `Capacitor Preferences` en natiu)

Si un dispositiu es perd o el token filtra, no hi ha manera d'invalidar-lo. Per a una app de seguiment de persones vulnerables, això és inacceptable.

## 3. Problema
- Risc de seguretat: accés no autoritzat permanent
- Impossibilitat de revocar des del dashboard
- Emmagatzematge inadequat en natiu (localStorage en comptes de Capacitor Preferences)

## 4. Impacte arquitectònic

- **Backend:** nova columna `device_token_revoked_at: DateTime?` al model `Patient`, nou endpoint owner-only, validació a `get_patient_from_device_token`
- **Frontend:** nova UI al dashboard owner per revocar, substitució de `localStorage` per `Capacitor Preferences` en natiu
- **Platform Integration:** decisió sobre l'emmagatzematge de tokens
- **ADR pendent:** ADR-0005 — Tokens a `Capacitor Preferences` (no `localStorage`)

## 5. Criteris d'acceptació

### Backend
- [ ] AC-1: Model `Patient` té `device_token_revoked_at: DateTime?` (nullable)
- [ ] AC-2: Migració Alembic (o `Base.metadata.create_all` per dev) afegeix la columna
- [ ] AC-3: Endpoint `POST /patient/{id}/revoke-device` (owner-only, 403 si no owner)
- [ ] AC-4: Endpoint `POST /patient/{id}/regenerate-device` (owner-only, genera nou token, revoca l'antic)
- [ ] AC-5: `get_patient_from_device_token` retorna 401 si `device_token_revoked_at IS NOT NULL`
- [ ] AC-6: Tests pytest per cada cas (5-6 tests)

### Frontend
- [ ] AC-7: UI al dashboard owner: "Revocar dispositiu" i "Regenerar token"
- [ ] AC-8: Confirmació modal (no destructible sense confirm)
- [ ] AC-9: Toast/feedback després de l'acció
- [ ] AC-10: `useAppState` emmagatzema a `Capacitor Preferences` (no `localStorage`) en natiu
- [ ] AC-11: Fallback a `localStorage` en web (PWA)

### Platform
- [ ] AC-12: Contracte TS actualitzat (`LocationSync` no canvia, però `useAppState` sí)
- [ ] AC-13: ADR-0005 redactat i sign-off

### Tests
- [ ] AC-14: Token revocat retorna 401 (e2e)
- [ ] AC-15: Regeneració produeix nou token vàlid
- [ ] AC-16: Tests Vitest per la UI

## 6. Riscos identificats
- **R1:** Un cuidador no-owner intenta revocar (403) — bona UX d'error
- **R2:** Migració trenca dades existents — `nullable=True`, sense default
- **R3:** Si es revoca durant un walk actiu, el pacient perdrà accés — UX warning
- **R4:** Canvi de `localStorage` a `Capacitor Preferences` pot perdre tokens existents — migració suau (read amb fallback)
- **R5:** No hi ha tests E2E per revocació — cal afegir

## 7. Pla d'implementació

**Branca:** `feat/SPEC-030-device-token-revocation`

**Ordre:**
1. **Tech Lead:** redacta ADR-0005 (decisió emmagatzematge)
2. **Backend:** branca `feat/SPEC-030-backend-revocation` (pot ser paral·lel)
   - Model + migració
   - Endpoints
   - Tests pytest
3. **Frontend:** branca `feat/SPEC-030-frontend-ui`
   - UI dashboard
   - Substitució localStorage → Capacitor Preferences
   - Tests Vitest
4. **Platform Integration:** actualitza skill `pathguard-bridge-contract.md`
5. **QA:** e2e test + field test
6. **PRs** ordenats a develop

## 8. Pla de validació
- **Tests unit (BE):** pytest per cada cas (6 tests)
- **Tests unit (FE):** Vitest per UI
- **Tests e2e:** owner revoca → cuidador intenta usar → 401
- **Field test:** owner revoca des de mòbil, pacient intenta walk, falla amb error clar
- **Cross-capa:** verificació que la UI i el backend parlen correctament

## 9. Out of scope
- Audit log de revocacions (post-beta)
- Notificació push al pacient quan es revoca (post-beta)
- Re-autenticació automàtica (post-beta)
- Suport multi-device (post-beta)

## 10. Referències
- `audit_native_layer.md` secció 4 (R-P0-4)
- `.pathguard/skills/_domain/pathguard-backend-models.md`
- `.pathguard/skills/_domain/pathguard-capacitor-config.md`
- `.pathguard/skills/_domain/pathguard-bridge-contract.md`

---

**Notes:**
- Aquesta spec és de **seguretat**, no de funcionalitat nova. La prioritat P0 és perquè és un risc actiu.
- L'ADR-0005 és bloquejant — cal decidir emmagatzematge abans d'implementar.
- La migració de `localStorage` a `Capacitor Preferences` ha de ser **backward compatible** (llegir primer, escriure després).
