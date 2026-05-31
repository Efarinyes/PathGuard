# Fase F — Lògica adaptativa de seguiment /patient

**Data:** 2026-05-29
**Propòsit:** Document d'estudi per analitzar l'impacte dels nous intervals GPS abans d'implementar-los.
**Branca prevista:** `feat/gps-adaptive-logic`
**Estimació:** 30 minuts (canvi de 4 constants)
**Risc:** Molt baix

---

## 1. Problema detectat a les proves reals (26/05/2026)

Durant les proves reals amb un dispositiu iOS, es va observar que `/patient` envia posició GPS cada 5 segons (interval normal) o cada 2 segons (moviment ràpid). Això genera tres problemes:

| Problema | Impacte |
|---|---|
| **Invasiu** | Una traça cada 5s és granularitat de repartiment, no de tranquil·litat familiar |
| **Bateria** | El GPS actiu cada pocs segons consumeix ~15-20% de bateria en 1h de passeig |
| **Falsos offline** | Com més peticions, més probabilitat de fallar-ne una i disparar `patient_offline` |
| **Innecessari** | El cuidador es tranquil·litza sabent la zona i la ruta, no la posició exacta cada 5 segons |

**Filosofia PathGuard:** El cuidador vol saber *per on ha passat* el familiar, no *on és exactament cada 5 segons*. Reduir la freqüència GPS alinea el producte amb el seu propòsit calm i discreta.

---

## 2. Com funciona ara el tracking

El tracking es regeix per tres intervals adaptatius definits a `frontend/lib/config.ts`:

```
GPS_INTERVAL_FAST_MS   = 2000   (2s)   → moviment ràpid (>100m/min ~ 6km/h)
GPS_INTERVAL_NORMAL_MS = 5000   (5s)   → moviment normal
GPS_INTERVAL_IDLE_MS   = 15000  (15s)  → aturat (<5m/min)
GPS_MIN_DISTANCE_M     = 10     (metres) → distància mínima per enviar un punt
```

La lògica de selecció d'interval es troba a `frontend/hooks/useLocationTracking.ts:37-47`:

```typescript
const speed = estimateSpeed(lastSentPositionRef.current, latestPositionRef.current, timeDelta);
if (speed < GPS_SPEED_IDLE_THRESHOLD_M_MIN) {
  nextInterval = GPS_INTERVAL_IDLE_MS;           // Aturat
} else if (speed > 100) {                         // Ràpid (>6km/h)
  nextInterval = GPS_INTERVAL_FAST_MS;
} else {
  nextInterval = GPS_INTERVAL_NORMAL_MS;          // Normal
}
```

A més, el filtre Haversine a `useLocationTracking.ts:66-73` suprimeix punts que no superin `GPS_MIN_DISTANCE_M` metres de distància respecte a l'últim punt enviat.

---

## 3. Canvi proposat

### 3.1 Nous intervals

| Constant | Valor actual | Nou valor | Motiu |
|---|---|---|---|
| `GPS_INTERVAL_FAST_MS` | 2000 (2s) | **15000 (15s)** | Caminar ràpid no requereix traça cada 2s. 15s és suficient per veure la ruta. |
| `GPS_INTERVAL_NORMAL_MS` | 5000 (5s) | **30000 (30s)** | Cada 30s redueix un 83% les peticions sense perdre la traça general. |
| `GPS_INTERVAL_IDLE_MS` | 15000 (15s) | **120000 (2 min)** | Aturat a un bar o aparador → sense notificar cada 15s. 2 minuts és tranquil·litzador. |
| `GPS_MIN_DISTANCE_M` | 10 (metres) | **30 (metres)** | Evita punts redundants a cada aparador. Una persona camina ~20m en 15s. |

### 3.2 Arxiu a modificar

**Únic arxiu:** `frontend/lib/config.ts` (línies 18-22)

Canvi:

```diff
- export const GPS_MIN_DISTANCE_M = 10;
+ export const GPS_MIN_DISTANCE_M = 30;

- export const GPS_INTERVAL_IDLE_MS = 15000;
+ export const GPS_INTERVAL_IDLE_MS = 120000;

- export const GPS_INTERVAL_NORMAL_MS = 5000;
+ export const GPS_INTERVAL_NORMAL_MS = 30000;

- export const GPS_INTERVAL_FAST_MS = 2000;
+ export const GPS_INTERVAL_FAST_MS = 15000;
```

La resta del codi (`useLocationTracking.ts`, `PatientWalkController`, `locationService`) **no es toca**. Les constants s'importen per nom, i la lògica adaptativa funciona igual.

### 3.3 NO es modifica

| Fitxer | Motiu |
|---|---|
| `frontend/hooks/useLocationTracking.ts` | La lògica adaptativa és correcta. Només canvien els valors. |
| `frontend/hooks/useWalkSession.ts` | No té res a veure amb intervals GPS. |
| `frontend/services/locationService.ts` | El batching (5 punts / 5s) és independent de la freqüència de captura. |
| `frontend/lib/config.ts` (altres constants) | `WS_HEARTBEAT_INTERVAL_MS`, `BATCH_*`, etc. no es toquen. |
| Backend | Cap canvi. El backend rep menys punts, però la lògica és idèntica. |

---

## 4. Impacte esperat

### 4.1 Peticions al backend

| Escenari | Abans | Després | Reducció |
|---|---|---|---|
| Passeig normal (5km/h, 1h) | ~720 peticions (cada 5s) | ~120 peticions (cada 30s) | **83%** |
| Passeig ràpid (6km/h, 30min) | ~900 peticions (cada 2s) | ~120 peticions (cada 15s) | **87%** |
| Aturat (15min) | ~60 peticions (cada 15s) | ~7 peticions (cada 2min) | **88%** |

### 4.2 Bateria del dispositiu mòbil

| Mètrica | Abans | Després |
|---|---|---|
| Consum en 1h de passeig | ~15-20% | ~5-8% |
| Peticions GPS/hora (normal) | ~720 | ~120 |
| Peticions GPS/hora (aturat) | ~240 | ~30 |
| Càrrega CPU (menys wake locks) | Alta | Reduïda ~80% |

### 4.3 Mapa del cuidador

**La traça general és idèntica.** El cuidador veu per on ha passat el familiar igual que abans. La diferència és:

- **Abans:** 1 punt cada 5m aproximadament (a 5km/h, 5s = ~7m)
- **Després:** 1 punt cada ~40m (a 5km/h, 30s = ~42m)

Per a un passeig de 3 km, abans es mostraven ~430 punts, després ~75 punts. El camí dibuixat és el mateix, però amb menys punts redundants.

**Filosofia PathGuard:** Una traça cada 30s és tranquil·litzadora. Una traça cada 5s és vigilància.

### 4.4 No cal canviar res al backend

El backend ja està preparat per rebre menys punts. No hi ha cap validació de freqüència mínima. Les úniques validacions són:

- `Location.timestamp` no pot ser futur (`location_service.py`)
- `Location.client_id` per deduplicació (UUID únic per punt)
- Integrity check a `stop_walk()` (ordre cronològic)

---

## 5. Tests

### 5.1 Test unitari (vitest)

Verificar que les constants es carreguen correctament des de `config.ts`:

```typescript
import { GPS_INTERVAL_FAST_MS, GPS_INTERVAL_NORMAL_MS, GPS_INTERVAL_IDLE_MS, GPS_MIN_DISTANCE_M } from '@/lib/config';

describe('GPS config constants', () => {
  it('should have relaxed intervals', () => {
    expect(GPS_INTERVAL_FAST_MS).toBe(15000);
    expect(GPS_INTERVAL_NORMAL_MS).toBe(30000);
    expect(GPS_INTERVAL_IDLE_MS).toBe(120000);
    expect(GPS_MIN_DISTANCE_M).toBe(30);
  });
});
```

### 5.2 Test d'integració (backend)

Iniciar un passeig → enviar punts GPS cada 30s simulats → aturar → verificar que el nombre de punts rebuts és coherent amb l'interval:

```python
async def test_gps_interval_reduced():
    # Iniciar walk
    walk_id = await walk_service.start_walk_with_broadcast(...)
    # Enviar 3 punts amb intervals de 30s
    for i in range(3):
        await location_service.add_location(...)
        await asyncio.sleep(0.01)  # No cal esperar 30s reals
    # Aturar
    result = await walk_service.stop_walk_with_broadcast(...)
    assert result["location_count"] == 3
```

### 5.3 Test manual (prova real)

1. Instal·lar PWA al mòbil (o obrir `/patient` al navegador del mòbil)
2. Iniciar passeig
3. Caminar 10 minuts
4. Verificar al dashboard del cuidador que la ruta es visible i no té buits anormals
5. Verificar que el nombre de punts és ~20 (no ~120)

---

## 6. Instal·lacions necessàries

**No calen instal·lacions addicionals.** El canvi és només de constants a `frontend/lib/config.ts`. Les eines necessàries ja estan disponibles:

| Eina | Ja disponible? |
|---|---|
| `npm test` (vitest) | ✅ Sí |
| `npm run build --webpack` | ✅ Sí |
| Navegador per proves manuals | ✅ Sí |
| Dispositiu mòbil per prova real | ✅ Sí |

Si es vol fer prova amb cobertura de tests ampliada, es pot instal·lar:

```bash
cd frontend && npm install --save-dev @testing-library/react @testing-library/jest-dom
# Ja hauria d'estar instal·lat si els tests existents funcionen
```

---

## 7. Riscos i mitigacions

| Risc | Probabilitat | Mitigació |
|---|---|---|
| El mapa del cuidador mostra menys punts i sembla "buit" | Baixa | La traça es connecta amb línies rectes entre punts. El resultat visual és el mateix. |
| Retard en detectar que el pacient ha començat a caminar | Molt baixa | La primera traça arriba com a màxim als 30s. Acceptable. |
| El filtre Haversine (30m) elimina massa punts en carrers amb corbes tancades | Mitjana | Provar en zona urbana amb corbes. Si cal, ajustar a 20m. |

---

## 8. Plan d'implementació

### Pas 1: Crear branca
```bash
git checkout -b feat/gps-adaptive-logic develop
```

### Pas 2: Modificar 4 constants
Editar `frontend/lib/config.ts` línies 18-22.

### Pas 3: Crear test unitari
Afegir test a `frontend/hooks/__tests__/` o al fitxer de test existent de `config`.

### Pas 4: Verificar build
```bash
cd frontend && npm run build --webpack && npm test
```

### Pas 5: Merge a develop (tests)
```bash
git add -A && git commit -m "feat: relax GPS intervals to align with PathGuard philosophy"
git checkout develop && git merge feat/gps-adaptive-logic
git branch -d feat/gps-adaptive-logic
```

### Pas 6: Merge a main (desplegament)
```bash
git checkout main && git merge develop
git push origin main
```

### Pas 7: Vercel desplega automàticament
Vercel té el projecte configurat per desplegar des de la branca `main` (configuració al dashboard de Vercel, no al repositori). El desplegament és automàtic en pujar a `main`.

---

## 9. Conclusió

Aquest canvi és el més ràpid i d'impacte més alt de les 6 fases previstes. Redueix la càrrega del backend un 80%, allarga la bateria del mòbil del pacient, i alinea el producte amb la filosofia PathGuard. El risc és mínim perquè només canvien 4 valors numèrics en un sol fitxer, i la lògica adaptativa roman idèntica.

**Frase clau per al commit:** *"Menys punts, més tranquil·litat."*
