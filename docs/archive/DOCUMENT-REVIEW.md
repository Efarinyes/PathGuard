<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# Revisió de Documents — Què conservar i què eliminar

**Data:** 2026-06-06  
**Objectiu:** Netegia del repositori, eliminant documents obsolets, duplicats o fusionats

---

## 1. Directori `/docs` — Inventari i Decisió

| Fitxer | Mida | Estat | Decisió | Motiu |
|--------|------|-------|---------|-------|
| `action-plan.md` | 22KB | **Maestre** | **CONSERVAR** | Single source of truth. Pla mestre actualitzat. |
| `phase4-detailed-plan.md` | ? | Detall fase 4 | **CONSERVAR** | Referència històrica fase 4 completada. |
| `FASE-G-POSTGRESQL-MIGRATION.md` | 9.6KB | Completada | **CONSERVAR** | Documentació migració PG, útil per futures referències. |
| `guia-proves-reals.md` | 16KB | Activa | **CONSERVAR** | Guia per proves reals amb dispositius. |
| `safari-battery-api-removal.md` | ? | Completada | **CONSERVAR** | Decisió arquitàctica important (no battery monitoring). |
| `PRIMERA-APROXIMACIO-CAP-A-BETA-ESTABLE.md` | 18KB | Històric | **CONSERVAR** | Context decisions BETA 1 (Fases B-G, E en curs). |
| `REORGANITZACIO-DASHBOARD-OWNER.md` | 7.8KB | Completada (C+D) | **CONSERVAR** | Detalls implementació fases C+D. |
| `pla-plugin-location-sync.md` | 15KB | Pla Android | **CONSERVAR** | Referència plugin natiu Android (ja implementat). |
| **NOUS:** `GPS-MAPA-BETA2-PLANNING.md` | ~15KB | Pla futur | **CONSERVAR** | Creat avui per BETA 2. |
| `auditoria-gps-mapa-qualitat.md` | 34KB | Auditoria | **CONSERVAR** | Anàlisi profunda 17 troballes, codi proposat. |
| `auditoria-pipeline-localitzacio.md` | 22KB | Auditoria | **CONSERVAR** | 18 troballes pipeline, fases P0-P3. |
| `auditoria-recuperacio-cobertura.md` | 15KB | Auditoria | **CONSERVAR** | 9 defectes sync, arquitectura WAL. |
| `auditoria-presencia-ws.md` | 18KB | Auditoria | **CONSERVAR** | WebSocket/presència, 10 troballes. |
| `guia-master-evolucio.md` | 15KB | Evolució | **REVISAR** | Pot ser redundant amb action-plan + CHANGELOG. |

**Nota:** Les 4 auditories (GPS, Pipeline, Recuperació, Presència) són complementàries i valuoses com a base de coneixement tècnic. Es conserven totes.

---

## 2. Directori Arrel (`/`) — Inventari i Decisió

| Fitxer | Mida | Estat | Decisió | Motiu |
|--------|------|-------|---------|-------|
| `CONTEXT.md` | 21KB | **Viu** | **CONSERVAR** | Context global per agents/IA. Actualitzat recentment. |
| `README.md` | 7.4KB | Bàsic | **CONSERVAR** | Visió general projecte. |
| `CHANGELOG.md` | 2.5KB | Viu | **CONSERVAR** | Historial canvis per release. |
| `ROADMAP.md` | 48KB | Detallat | **CONSERVAR** | Pla tècnic extens. Complementa action-plan. |
| `ROADMAP-TESTS.md` | 28KB | Tests | **CONSERVAR** | Estratègia testing, coverage, CI. |
| `GUIA-INSTAL-LACIO-XCODE-ANDROID.md` | 7.4KB | Setup | **CONSERVAR** | Necessari per iOS/Android development. |
| `SETUP-GUIDE.md` | 2.5KB | Setup bàsic | **FUSIONAR** | Redundant amb GUIA-INSTAL-LACIO + README. Unificar. |

---

## 3. Directori `.audit_archive/` — Inventari i Decisió

| Fitxer | Mida | Estat | Decisió | Motiu |
|--------|------|-------|---------|-------|
| `product_audit.md` | 12KB | Base | **CONSERVAR** | 7 PD + 3 PR, referència producte. |
| `technical_audit.md` | 12KB | Base | **CONSERVAR** | 3 AR + 3 TD, referència tècnica. |
| `modification-registre-patient.md` | 4.6KB | Històric | **CONSERVAR** | Context canvis model Patient. |
| `REFLEXIO-SUPABASE-TABLEPLUS-BACKEND-DEPLOY.md` | 9.2KB | Històric | **ELIMINAR** | Reflexió personal, no document de projecte. |

---

## 4. Accions concretes

### 4.1 Eliminar (1 fitxer)
```bash
rm /Users/eduardfarinyes/Desktop/PathGuard-project/.audit_archive/REFLEXIO-SUPABASE-TABLEPLUS-BACKEND-DEPLOY.md
```

### 4.2 Fusionar (1 parell)
- `SETUP-GUIDE.md` → integrar contingut rellevant a `GUIA-INSTAL-LACIO-ANDROID.md` i `README.md`
- Eliminar `SETUP-GUIDE.md` després

### 4.3 Revisar (1 fitxer)
- `guia-master-evolucio.md`: llegir i decidir si afegir parts úniques a `action-plan.md` o `ROADMAP.md`, després eliminar.

---

## 5. Resum d'espai alliberat (estimació)

| Acció | Fitxers | Mida approx |
|-------|---------|-------------|
| Eliminar | 1 | ~9 KB |
| Fusionar | 1 → 0 | ~2 KB |
| Revisar/Eliminar possible | 1 | ~15 KB |
| **Total net** | | **~26 KB** (minor, principalment netegia conceptual) |

---

## 6. Estructura final proposada `/docs`

```
docs/
├── action-plan.md                    # MASTER PLAN (single source of truth)
├── phase4-detailed-plan.md           # Detall fase 4 (històric)
├── FASE-G-POSTGRESQL-MIGRATION.md    # Migració PG (referència)
├── guia-proves-reals.md              # Guia proves dispositius reals
├── safari-battery-api-removal.md     # Decisió: no battery monitoring
├── PRIMERA-APROXIMACIO-CAP-A-BETA-ESTABLE.md  # Context BETA 1
├── REORGANITZACIO-DASHBOARD-OWNER.md # Fases C+D (referència)
├── pla-plugin-location-sync.md       # Plugin Android (referència)
├── GPS-MAPA-BETA2-PLANNING.md        # Pla BETA 2 (NOU)
├── auditoria-gps-mapa-qualitat.md    # Auditoria GPS/Mapa (tècnic)
├── auditoria-pipeline-localitzacio.md # Auditoria Pipeline (tècnic)
├── auditoria-recuperacio-cobertura.md # Auditoria Sync (tècnic)
├── auditoria-presencia-ws.md         # Auditoria WS/Presència (tècnic)
└── mapes/                            # Captures pantalla (assets)
```

---

## 7. Estructura final proposada arrel

```
/PathGuard-project/
├── CONTEXT.md                 # Context agents (actualitzat)
├── README.md                  # Visió general
├── CHANGELOG.md               # Historial releases
├── ROADMAP.md                 # Pla tècnic extens
├── ROADMAP-TESTS.md           # Testing strategy
├── GUIA-INSTAL-LACIO-ANDROID.md  # Setup iOS/Android (fusionat SETUP-GUIDE)
├── .audit_archive/
│   ├── product_audit.md
│   ├── technical_audit.md
│   └── modification-registre-patient.md
├── docs/                      # (veure estructura anterior)
├── backend/
├── frontend/
└── plugins/
```

---

*Document generat per netegia repositori. Executar accions en propera sessió.*
