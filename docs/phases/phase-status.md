# PathGuard — Estat per fase

**Última actualització:** 2026-08-03  
**Font operativa del dia a dia:** `.pathguard/STATE.json` (no aquest fitxer).  
**Història:** [`../EVOLUTION.md`](../EVOLUTION.md) · snapshot antic: [`../archive/phase-status-2026-06-30.md`](../archive/phase-status-2026-06-30.md)

---

## On som ara

| Eix | Estat |
|---|---|
| Producte | Pre-beta externa — PWA + Android al carrer; iOS diferit |
| Integració | `main` = `develop` = origin |
| Plugin GPS Android | SPEC-188 mergejada — **field AC-6 pendent** |
| Specs actives | 180, 182 (diferit), 183, 185, 187, 188 — veure `specs/000-index.md` |
| Target versió | `v2.7.0-beta.1` |

---

## Capes (resum)

| Capa | Estat |
|---|---|
| Backend (FastAPI / Postgres) | Estable en prod (Render + Supabase) |
| Frontend PWA (cuidador) | Estable (Vercel) |
| Android LocationSync | Operatiu; semàntica `is_recovered` via SPEC-188; camp pendent |
| iOS LocationSync | Diferit (SPEC-182) — sense dispositiu de prova ara |
| Governança (skills / SDD) | Cursor (migrat des d’OpenCode 2026-07-30) |

---

## Fases històriques (tancades)

Les fases numerades antigues (beta blockers, activació, polish, owner dashboard, PostgreSQL, primer Capacitor Android, etc.) estan **completades** o absorbides. El detall narratiu és a `EVOLUTION.md`; el llistat congelat de juny 2026 és a l’arxiu enllaçat amunt.

**Cancel·lat (mantingut):** Fase distància de passeig — no aporta tranquil·litat familiar.

---

## Proper focus

1. Field test post–SPEC-188 (`is_recovered` només des del buffer real).  
2. Tancar / validar 185, 187, 183 amb el mateix camp quan es pugui.  
3. iOS (182) quan hi hagi iPhone.  
4. Backlog conscient (CI, i18n, tests natius) — no a `specs/` arrel.

Quan canviï de fase de veritat, actualitza **STATE.json** primer; després una línia aquí.
