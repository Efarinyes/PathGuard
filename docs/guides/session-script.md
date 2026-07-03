# Guió de sessió — PathGuard

> **Per a tu, en llenguatge natural.** Serveix per obrir el dia, reprendre una pausa, o tancar la sessió sense perdre el fil. No és tècnic — és un company que t'ajuda a no perdre't.

---

## 1. Obrint el dia (o tornant d'una pausa)

En 2 minuts, en veu alta o per escrit:

> "Estic a la branca **X**. L'última cosa que vaig fer va ser **Y** (una especificació, una correcció, una lectura). El que toca fer ara és **Z** (la propera acció concreta)."

Si no recordes què és Z, mira `.pathguard/STATE.json` — allà ho diu. És un fitxer petit al root del projecte, dins la carpeta amagada `.pathguard/`. Si vols, pots obrir-lo amb l'editor.

**Si obres la sessió amb una IA** (ChatGPT, Claude, etc.), digues-li exactament:

> "Bon dia. Carrega l'skill `pathguard-core-state` i digue'm on som, quina spec estem tocant, i quin és el proper pas. No facis res més fins que jo t'ho confirmi."

**Si no saps què fer**, fes-te aquestes 3 preguntes en ordre:

1. **Estic on toca?** La consola t'ho diu: `git branch --show-current` hauria de coincidir amb el que diu `STATE.json`. Si no, t'has perdut en un canvi de branca.
2. **Tinc el working tree net?** `git status` ha de dir "nothing to commit" o canvis coneguts. Si tens canvis misteriosos, atura't.
3. **Sé quin és el proper pas?** Si no, mira `STATE.json` → `next_session_pickup`. Allà hi ha una sola frase que t'ho explica.

---

## 2. Durant la sessió

Cada vegada que canviïs de tema o compris alguna cosa nova:

> "He acabat la feina **X**. La propera és **Y**. Apunto el canvi d'estat perquè la pròxima persona (o jo demà) ho trobi."

Si toques més d'un fitxer, deixa un missatge curt al final de la sessió (5 frases màxim) amb:
- Què has fet
- Què queda pendent
- On es queda el fil

---

## 3. Quan perds el fil (la part més important)

Atura't. **No inventis.** Fes una d'aquestes quatre coses:

1. **Mira `.pathguard/STATE.json`** — el camp `next_session_pickup` et diu on vas deixar-ho.
2. **Mira `specs/000-index.md`** — quin número de spec estàvem tocant?
3. **Pregunta a la IA** — *"Carrega `pathguard-core-state` i el skill que toqui. Explica'm on som."*
4. **Si tot falla**, mira el `git log` de l'última hora per veure què s'ha tocat.

**Mai no comencis a canviar coses sense saber on ets.** Millor 5 minuts de pausa que 1 hora de feina en la direcció equivocada.

---

## 4. Quan tanques la sessió (5 minuts)

Pregunta't en ordre:

1. **Què he fet avui?** (1 frase)
2. **Què queda pendent?** (1 frase)
3. **On queda el fil?** (= pickup point)

**Actualitza `.pathguard/STATE.json`** amb:

- `last_action`: què acabes de fer
- `next_action`: què toca
- `next_session_pickup`: una sola frase que la pròxima persona (o tu) pugui llegir i entendre

Si la sessió ha creat un dubte nou, apunta'l a `specs/000-index.md` com a idea pendent o obre una spec nova.

Si has tocat branques, comprova que no tens canvis sense commit (`git status` net).

---

## 5. Frases que t'ajuden (sticky notes mentals)

- **"Estic a X. He fet Y. Toca Z."** — la frase d'obertura universal.
- **"Si no sé on soc, paro."** — la regla d'or.
- **"L'estat del projecte és al fitxer d'estat."** — on mirar primer.
- **"Una sola cosa a la vegada, ben feta."** — filosofia del projecte.
- **"Si la solució és un hack, està rebutjada."** — la regla que t'estalvia dies.

---

## 6. Quan parles amb la IA (obert o tancat)

A l'inici:

> "Hola. Carrega `pathguard-core-state` i `pathguard-core-golden-rules`. Després digue'm què proposes i per què. No escriguis codi fins que jo t'ho confirmi."

Durant:

> "Recorda: cada agent toca només el seu domini. Si la feina toca una altra capa, m'ho dius abans de continuar."

Al tancar:

> "Què hem fet? Què queda? On queda el fil? Actualitza `STATE.json` amb el pickup."

---

## 7. El mini-mapa del que hi ha (per no perdre't)

| On mirar | Què hi trobaràs |
|---|---|
| `CONTEXT.md` | Les 10 regles d'or (obre'l una vegada i ja està) |
| `.pathguard/STATE.json` | On som ara (llegeix-lo cada sessió) |
| `agents/INDEX.md` | Qui fa què (mapa d'agents) |
| `specs/000-index.md` | Quines feines hi ha obertes |
| `docs/phases/phase-status.md` | A quina fase del projecte estem |
| `ROADMAP/beta-readiness.md` | Cap a on anem |
| `docs/archive/` | El que JA NO serveix (no tocar) |
| `docs/architecture/repository-state.md` | Quin és l'estat del repositori (branques, tags) |

---

## 8. Per si de cas oblides alguna cosa

- **Branca que serveix Vercel/Render:** `main`. No tocar.
- **Branca d'integració:** `develop`. Els PR hi van aquí.
- **Branques de feature/fix:** tipus `feat/...`, `fix/...`, `refactor/...`. Es fusionen a `develop` quan estan llestes.
- **Plugins natius** (Android, iOS): es construeixen amb Android Studio i Xcode, no es despleguen via Vercel/Render.
- **Quan una cosa falla a les proves:** NO es desplega. La regla d'or és "primera la qualitat, després la release".

---

*Aquest guió és viu. Si hi trobes a millorar, edita'l. El fitxer és `docs/guides/session-script.md`.*
