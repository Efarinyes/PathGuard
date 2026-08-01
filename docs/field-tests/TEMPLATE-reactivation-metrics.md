# Field Test: Reactivation metrics (butxaca / kill-reopen)

Use this template for beta walks that decide **SPEC-183** (GPS keepalive) vs **SPEC-185** (honest HTTP presence).  
**Do not use airplane mode.**

- **Data:** YYYY-MM-DD
- **Dispositiu:** <model> <OS>
- **APK / commit:** <hash>
- **Walk ID:** <id>
- **Durada total:** <min>
- **Minuts a la butxaca / screen-off:** <min>
- **Kill + reobrir:** sí / no

---

## Metric A — Densitat GPS (BD / mapa)

| Interval | Punts esperats (aprox.) | Punts observats | Forats > 3 min |
|---|---|---|---|
| App visible (inici) | | | |
| Butxaca / screen-off | | | |
| Després de reobrir | | | |
| **Total walk** | | | |

**Verdict A:** ✅ densitat OK · ⚠️ forats lleus · ❌ forats greus (→ prioritzar SPEC-183)

Notes:
-

---

## Metric B — Estat UI cuidador (presència)

Registrar timestamps aproximats:

| Moment | Indicador | Label | Latència percebuda |
|---|---|---|---|
| Walk inici | verd / altre | | |
| Pantalla apagada (t+2 min) | | | |
| Pantalla apagada (t+10 min) | | | |
| Kill app | | | |
| Reobrir app | | | |

Estats esperats:
- `online` (verd) — WS patient viu
- `gps_online` (blau primary) — sense WS, HTTP recent (<60s)
- `limbo` / `offline` (taronja) — sense WS ni HTTP recent

**Verdict B:** ✅ coherent amb GPS · ⚠️ taronja mentre mapa avança (→ SPEC-185) · ❌ engancat

Notes:
-

---

## Metric C — Mapa cuidador

| Pregunta | Sí / No |
|---|---|
| El mapa avança durant butxaca? | |
| El mapa avança mentre l’indicador és taronja? | |
| Després de reobrir, la ruta és coherent? | |

**Verdict C:** ✅ · ⚠️ · ❌

---

## Decisió (segons pla reactivació)

| Combinació | Acció |
|---|---|
| A OK, B taronja amb C avançant | **SPEC-185** (presència HTTP) — no cal wake agressiu |
| A forats greus | **SPEC-183** (Android FGS keepalive) |
| A+B fallada malgrat 183 | Valorar **SPEC-184** force caregiver (post-beta) |

**Decisió d’aquesta prova:**
-

## is_recovered (opcional)

- Punts `false` (viu): _
- Punts `true` (buffer): _
- Coherent amb kill/buffer? sí / no / N/A
