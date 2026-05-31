# Reorganització del Dashboard Owner ✅ COMPLETADA (31/05/2026)

**Basada en la decisió del 31 de maig de 2026.**
**Alineada amb la filosofia PathGuard:** *calm, discreta, fiable — familiar, no clínica, no invasiva.*
**Commit:** `557ff3c` — mergejat a `develop` i `main` el 31/05/2026.

**Tots els canvis d'aquest document estan implementats i desplegats a producció.**

---

## Principi fonamental

Separació radical entre:

| Tipus | Què | On |
|-------|-----|----|
| **Acció** | Configuració del grup (SOS, codi activació, afegir cuidador) | `/caregiver/dashboard` |
| **Consulta** | Dades de passejos (historial, analytics, punts) | `/caregiver/activity` (NOU) |
| **Temps real** | Monitorització en viu (mapa, estat) | `/caregiver` |

**Filosofia:** La configuració és acció (toggle, regenerar codi, convidar). La informació és consulta (historial, tendències, punts). Separar-les evita soroll i respecta la privacitat del pacient.

---

## Abans / Després

### Drawer (3 opcions)

```
Abans (2 opcions)                   Després (3 opcions)
┌─────────────────────┐            ┌──────────────────────┐
│ Monitorització      │            │ Monitorització       │
│ Configuració del grup│           │ Configuració del grup│
│                      │            │ Activitat        ←NOU│
└─────────────────────┘            └──────────────────────┘
```

### `/caregiver` — Monitorització (només en viu)

| Element | Abans | Després |
|---------|-------|---------|
| Mapa: punts de ruta | `primary` (blau) | `primary` (blau) — igual |
| Mapa: punt actual | `primary` (blau), 14px | `success` (verd), **20px** |
| Mapa: punt offline | `warning` (ambre), 14px | `warning` (ambre), **20px** |
| "Punts de ruta" count | Al `PatientStatusCard` | ❌ Eliminat |
| "Afegir cuidador" (owner) | Al `CaregiverHeader` | ❌ Eliminat (es mou a Configuració) |
| Header / Status / SOS modal | — | ✅ Es queda igual |

### `/caregiver/dashboard` — Configuració del grup (només admin)

| Element | Abans | Després |
|---------|-------|---------|
| SOS toggle | ✅ | ✅ Es queda |
| Codi activació | ✅ | ✅ Es queda |
| Afegir cuidador | ❌ A monitorització | ✅ **Mogut aquí** |
| Historial de passejades | ✅ | ❌ **Treure** (va a Activitat) |
| Informació d'activitat | ✅ (acordió) | ❌ **Treure** (va a Activitat) |

### `/caregiver/activity` — NOVA PÀGINA (dades)

| Element | Origen |
|---------|--------|
| Historial de passejades (taula) | Traslladat de Configuració |
| Durada mitjana | Ja existeix a analytics API |
| Hores habituals de sortida | Ja existeix a analytics API |
| Freqüència 7 dies | Ja existeix a analytics API |
| Punts de ruta per passeig | Traslladat de PatientStatusCard |

---

## Canvis tècnics (per ordre d'execució)

### 1. Mapa: punt actual de diferent color i més gran

**Fitxer:** `frontend/components/CaregiverMap/CustomIcons.ts`

`PulseDotIcon` i `OfflinePulseDotIcon`:
- Canviar `COLORS.primary` → `COLORS.success` per al punt online
- Augmentar mida de 14px a 20px (o 18px)
- `iconSize` i `iconAnchor` ajustats proporcionalment

**Risc:** Molt baix (canvi purament visual, tots els tests de render passen)

### 2. Netejar monitorització (`/caregiver`)

**Fitxers:**
- `PatientStatusCard.tsx`: Treure bloc "Punts de ruta" (línies 62-67) i `routeHistory` del interface si ja no s'usa
- `CaregiverHeader.tsx`: Treure botó "Afegir cuidador" (línies 50-58) i prop `onInviteClick`
- `CaregiverDashboard/index.tsx`: Treure `isInviteModalOpen`, `InviteCaregiverModal`, i `onInviteClick` del header. Treure `routeHistory` de `PatientStatusCard` si s'ha netejat

**Risc:** Baix. `routeHistory` encara es passa al `PatientStatusCard` però només per mostrar el count. Si treiem el count, podem treure la prop.

### 3. Drawer: 3 opcions

**Fitxer:** `frontend/components/OwnerMenuDrawer.tsx`

Afegir una tercera opció "Activitat" amb icona (ex: `BarChart3` de lucide-react o un SVG inline). Les tres opcions:

| Posició | Label | Icona | Ruta |
|---------|-------|-------|------|
| 1 | Monitorització | `MapPin` | `/caregiver` |
| 2 | Configuració del grup | `Sliders` (o `Settings`) | `/caregiver/dashboard` |
| 3 | Activitat | `BarChart3` (o `Activity`) | `/caregiver/activity` |

**Risc:** Baix. `isOnDashboard` passa a ser lògica de ruta activa per a 3 rutes.

### 4. Crear pàgina `/caregiver/activity`

**Fitxer:** `frontend/app/caregiver/activity/page.tsx` (NOU)

Reutilitzar components existents:
- `CaregiverHeader` (amb `onInviteClick={null}` o sense el botó)
- `CaregiverWalkHistory` (taula de passejos — ja existeix)
- `CaregiverAnalytics` (però sense acordió — mostrar targetes sempre)
- `WalkDetailModal` (detall de passeig amb mapa)

L'estructura serà similar a la secció "Informació d'activitat" del dashboard actual, però:
- Sense acordió (tot visible)
- Sense botó "Veure historial" (ja som a la pàgina d'activitat)
- Afegir comptador de punts de ruta per passeig (opcional)

**Nota:** La pàgina ha d'estar protegida per `is_owner` igual que el dashboard.

### 5. Netejar dashboard (`/caregiver/dashboard`)

**Fitxer:** `frontend/app/caregiver/dashboard/page.tsx`

- Eliminar secció "Historial de passejades" (línies 118-126)
- Eliminar secció "Informació d'activitat" (línies 128-141)
- Eliminar `useCaregiverAnalytics` i `useState(isAnalyticsOpen)`
- Eliminar imports de `CaregiverWalkHistory`, `CaregiverAnalytics`
- **Afegir** botó/component "Afegir cuidador" (pot ser un botó dins de "Dispositiu del familiar" o una secció nova)

### 6. CaregiverAnalytics sense acordió

**Fitxer:** `frontend/components/CaregiverDashboard/CaregiverAnalytics.tsx`

Si es reutilitza a `/caregiver/activity`:
- Treure `isExtraInfoOpen`, `onToggleInfo`, el botó d'acordió
- Render de les 3 targetes directament (sense condicional `isExtraInfoOpen`)
- Simplificar props: només `analytics`

O creem un component nou `ActivityAnalytics` per a la pàgina d'activitat.

---

## Resum de fitxers

| Acció | Fitxer |
|-------|--------|
| 🔧 Modificar | `frontend/components/CaregiverMap/CustomIcons.ts` |
| 🔧 Modificar | `frontend/components/CaregiverDashboard/PatientStatusCard.tsx` |
| 🔧 Modificar | `frontend/components/CaregiverDashboard/CaregiverHeader.tsx` |
| 🔧 Modificar | `frontend/components/CaregiverDashboard/index.tsx` |
| 🔧 Modificar | `frontend/components/OwnerMenuDrawer.tsx` |
| 🔧 Modificar | `frontend/app/caregiver/dashboard/page.tsx` |
| 🔧 Modificar (o nou) | `frontend/components/CaregiverDashboard/CaregiverAnalytics.tsx` |
| 🆕 Crear | `frontend/app/caregiver/activity/page.tsx` |
| ❌ Eliminar (o deixar) | `frontend/components/CaregiverDashboard/CaregiverDashboardLayout.tsx` (revisar) |

---

## Cobertura de tests

| Àrea | Tests | Verificació |
|------|-------|-------------|
| Mapa (CustomIcons) | Visual | Verificar build |
| Drawer | — | Verificar rutes correctes |
| Pàgina activity | Render test | Verificar que carrega sense error |
| Dashboard netejat | — | Verificar que no trenca |

---

## Riscos i mitigacions

| Risc | Prob. | Impacte | Mitigació |
|------|-------|---------|-----------|
| Ruptura de rutes si `RoleGuard` no protegeix `/caregiver/activity` | Baixa | Alt | Afegir owner guard a la nova pàgina |
| `routeHistory` referenciat en altres llocs | Baixa | Mitjà | Grepejar abans d'eliminar props |
| Tests de snapshot fallen per canvis visuals | Mitjana | Baix | Acceptar canvis als snapshots |
| `npm run build --webpack` falla per imports residuals | Baixa | Mitjà | Grepejar imports morts |
