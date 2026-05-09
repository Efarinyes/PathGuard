# Pla de Implementació: Sistema de Registre Multi-Cuidador amb Invitacions

**Versió:** Beta 2.0
**Estat:** ✅ COMPLETAT (Fases 1-5)
**Save Point:** `v2.0.0-beta.2`

## Proper Pas: Fase 6 - Caregiver Dashboard

## Resum del Flux

| Pas | Actor | Acció |
|-----|-------|-------|
| 1 | Owner | Registra grup (com ara) → es crea owner + pacient |
| 2 | Owner | Genera codi invitació (vinculat a correu) |
| 3 | Sistema | Simula enviament (mostra codi) |
| 4 | Nou cuidador | Rep codi per fora de l'app, introdueix a /caregiver + contrasenya |
| 5 | Sistema | Valida codi + crea compte vinculat |

---

## Convencions

- **Branch**: `feature/multi-caregiver-invitations`
- **Commits curts**: Cada endpoint/feature petit separadament
- **Tests primers**: Abans de continuar, verificar que funciona

---

## Fase 1: Model de Dades ✅ COMPLETAT

### 1.1 [x] Crear model InvitationCode

### 1.2 [x] Afegir camp is_owner a User

### 1.3 [x] Executar migració (No aplica - SQLite)

---

## Fase 2: Backend - Endpoints d'Invitació ✅ COMPLETAT

### 2.1 [x] Endpoint POST /auth/generate-invitation

### 2.2 [x] Endpoint POST /auth/accept-invitation

### 2.3 [x] Endpoint GET /auth/check-invitation/{code}

### 2.4 [x] Modificar /auth/register (retorna is_owner)

---

## Fase 3: Landing Page ✅ COMPLETAT

### 3.1 [x] Crear nova Landing Page

### 3.2 [x] Modificar redirect de /register

---

## Fase 6: Caregiver Dashboard ⏳ PROPER

### 6.1 [ ] Mostrar nom del pacient
- Obtenir `patient.name` des del endpoint de grup
- Mostrar: "Seguint a [Nom del Pacient]"

### 6.2 [ ] Mostrar nombre de watchers
- Rebre des de WebSocket `{type: "watchers_update", count: N}`
- Mostrar: "X cuidadors seguint ara"

### 6.3 [ ] Secció Invitar Cuidador (només owner)
- Botó "Convida cuidador"
- Modal: introduir correu → generar codi → mostrar codi generat

---

## Fase 7: Patient Page ⏳ PROPER

### 7.1 [ ] Mostrar who is watching
- Quan hi ha walk actiu, mostrar: "X cuidador(s) seguint el teu passeig"

---

## Fase 8: Tests Integrats

### 8.1 [ ] Test: Registre grup + pacient

### 8.2 [ ] Test: Generar codi invitació (com owner)

### 8.3 [ ] Test: Acceptar invitació (com nou cuidador)

### 8.4 [ ] Test: WebSocket watchers update

---

## Comandes de Test

```bash
# Backend
cd backend
micromamba activate tracker-env
pytest tests/integration/test_registration.py -v

# Frontend
cd frontend
npm run test
npm run lint
```

---

## Ordre de Commit Recomanat

| # | Commit | Descripció |
|---|--------|------------|
| 1 | feat: add InvitationCode model | Nou model DB |
| 2 | feat: add is_owner to User model | Camp boolean |
| 3 | feat: add generate-invitation endpoint | API per owner |
| 4 | feat: add accept-invitation endpoint | API per nou usuari |
| 5 | feat: add check-invitation endpoint | Validar codi |
| 6 | feat: modify register to return group_code | Resposta extendida |
| 7 | feat: create landing page | Nova pàgina inicial |
| 8 | feat: modify LoginForm with invitation code | Suport codi |
| 9 | feat: add watchers to WebSocket | Seguiment de cuidadors |
| 10 | feat: show patient name in caregiver dashboard | UI |
| 11 | feat: show watchers count in UI | UI |
| 12 | feat: add invite caregiver modal (owner) | UI |
| 13 | feat: show watchers in patient page | UI |
| 14 | tests: add invitation integration tests | Test coverage |

---

## Notes

- **Simulació correu**: Per ara, el backend farà `print(codi)` o logger.info
- **Seguretat**: Codis de 6 caràcters = ~2.1 bilions de combinacions
- **Durada codi**: 24 hores per defecte

---

*Document generat per a PathGuard v2.5.0 - Multi-Caregiver System*