# Pla de Implementació: Sistema de Registre Multi-Cuidador amb Invitacions

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

## Fase 1: Model de Dades

### 1.1 [ ] Crear model InvitationCode

**Fitxer**: `backend/app/db/models/invitation.py`

```python
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base.base_class import Base

class InvitationCode(Base):
    __tablename__ = "invitation_code"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(6), unique=True, index=True, nullable=False)
    email = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey("family_group.id"), nullable=False)
    used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.utcnow())

    group = relationship("Group")
    creator = relationship("User")
```

### 1.2 [ ] Afegir camp is_owner a User

**Fitxer**: `backend/app/api/users/models.py`

```python
# Afegir camp:
is_owner = Column(Boolean, default=False, nullable=False)
```

### 1.3 [ ] Executar migració

```bash
cd backend && micromamba activate tracker-env
alembic revision --autogenerate -m "Add invitation_code and is_owner"
alembic upgrade head
```

---

## Fase 2: Backend - Endpoints d'Invitació

### 2.1 [ ] Endpoint POST /auth/generate-invitation

**Ubicació**: `backend/app/api/auth/routers.py`

- **Dependència**: `get_current_caregiver` (comprovar que és owner)
- **Request**: `{ "email": "nou@correu.com" }`
- **Lògica**:
  1. Verificar que `user.is_owner == True`
  2. Verificar que `email` no existeix a User
  3. Generar codi aleatori (6 caràcters, majúscules + números)
  4. Crear `InvitationCode` amb `expires_at = now() + 24h`
  5. **Simulació**: Loguejar el codi generat (per ara)
  6. Retornar `{ "code": "ABC123", "expires_in": 86400 }`

### 2.2 [ ] Endpoint POST /auth/accept-invitation

- **Request**: `{ "code": "ABC123", "password": "contrasenya" }`
- **Lògica**:
  1. Buscar `InvitationCode` per `code`
  2. Verificar: no `used`, no `expired`, correu vàlid
  3. Crear User amb email del codi + password
  4. Marcar codi com `used = True`
  5. Retornar JWT

### 2.3 [ ] Endpoint GET /auth/check-invitation/{code}

- **Retorna**: `{ "valid": true/false, "email": "x@x.com", "group_name": "Familia X" }`

### 2.4 [ ] Modificar /auth/register (existent)

- **Retornar**: `{ ..., "group_code": "XXXXXX", "is_owner": true }`
- Afegir a la resposta el `group_code` (per si es vol compartir manualment)

---

## Fase 3: Landing Page

### 3.1 [ ] Crear nova Landing Page

**Fitxer**: `frontend/app/page.tsx`

```tsx
// Botons:
// 1. "Crear entorn familiar" → /register
// 2. "Accedir com a cuidador" → /caregiver
```

### 3.2 [ ] Modificar redirect de /register

- Si ja té sessió → anar a landing o /patient segons rol

---

## Fase 4: Login Form amb Suport Codi

### 4.1 [ ] Modificar LoginForm

**Fitxer**: `frontend/components/LoginForm/index.tsx`

- Afegir opció "No tens compte? Demana invitació"
- Obrir formulari-inline:
  - Camp correu
  - Camp codi invitació
  - Camp contrasenya
- Envia a API nova

### 4.2 [ ] Test: Registrar usuari via codi

---

## Fase 5: WebSocket - Watchers

### 5.1 [ ] Modificar WS Manager

**Fitxer**: `backend/app/api/ws_manager.py`

- Afegir: `watchers: Dict[int, Set[int]]`  # group_id -> set of user_ids
- On connect: afegir a watchers si ve amb token
- On disconnect: treure de watchers
- Broadcast: `{ type: "watchers_update", count: N }`

### 5.2 [ ] Modificar useWebSocket

**Fitxer**: `frontend/hooks/useWebSocket.ts`

- Escoltar `watchers_update`
- Retornar `{ watchersCount, watchersNames }`

---

## Fase 6: Caregiver Dashboard

### 6.1 [ ] Mostrar nom del pacient

- Obtenir `patient.name` des del endpoint de grup
- Mostrar: "Seguint a [Nom del Pacient]"

### 6.2 [ ] Mostrar nombre de watchers

- Rebre des de WebSocket
- Mostrar: "X cuidadors seguint ara"

### 6.3 [ ] Secció Invitar Cuidador (només owner)

- Botó "Convida cuidador"
- Modal: introduir correu → generar codi → mostrar codi generat

---

## Fase 7: Patient Page

### 7.1 [ ] Mostrar who is watching

- Quan hi ha walk actiu, mostrar: "X cuidador(s) seguint el teu passeig"
- (No el nom del cuidador, només quantitat - com l'usuari va dir "Pacient no veu el nom del cuidador, només el seu")

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