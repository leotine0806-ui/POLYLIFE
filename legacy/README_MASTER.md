# PolyLife — Ultimate OS Master Final
**Data build:** 2026-05-16  
**Versione:** Ultimate Master Final (merge Build1 + Build2 + Build3)  
**QA Score:** 61/61 test — 100% ✅

---

## Installazione rapida

```bash
npm install        # installa dipendenze + electron-rebuild automatico
npm start          # avvia l'app
```

Verifica nel log: `✓ Database SQLite inizializzato`

---

## Struttura

```
PolyLife_Ultimate_OS_Master_Final/
├── main.js                    # Electron main process (Bootstrap + IPC)
├── preload.js                 # Context bridge (window.db, window.electronAPI)
├── package.json               # Deps + postinstall: electron-rebuild
└── src/
    ├── db.js                  # SQLite layer (unica fonte di verità)
    ├── backup.js              # Backup/restore SQLite
    ├── notifications.js       # Scheduler notifiche
    ├── spaced-repetition.js   # Algoritmo SM-2 flashcard
    ├── polymath_os_v9.html    # Hub principale
    ├── onboarding.html        # Wizard primo avvio
    ├── daily-missions.html    # Central Mission Orchestrator v2
    ├── daily-command-center.html  # Daily Commander (SQLite-first)
    ├── recovery-center.html   # Recovery Center
    ├── arte-musica.html       # Arte & Musica
    ├── engineer.html          # Engineer
    ├── library_fixed.html     # Library
    ├── life_rpg_v2.html       # Life RPG
    ├── operating-profile.html # Operating Profile
    ├── polylife-widget.js     # Widget gamification
    └── ...
```

---

## Fix applicati (da Build1)

| Bug | Status |
|-----|--------|
| Onboarding loop infinito | ✅ RISOLTO — `bootstrapDone`, check `=== 'true'` esatto |
| `persistCommandState()` ricorsione | ✅ RISOLTO — rimossa chiamata ricorsiva |
| `APP_PATHS.recovery` duplicato | ✅ RISOLTO — chiave unica |
| `better-sqlite3` senza rebuild | ✅ RISOLTO — `postinstall: electron-rebuild` |
| `onboarding_done` non scritto in SQLite | ✅ RISOLTO — IPC lazy `getDB()` + verifica post-write |

---

## Architettura dati (da Build2)

- **SQLite** = fonte primaria per tutti i moduli
- **localStorage** = solo fallback legacy / cache temporanea / migrazione
- **Pattern:** `window.db.[modulo].[metodo]()` → fallback localStorage → graceful skip

---

## Central Mission Orchestrator v2 (da Build3)

Il `daily-missions.html` aggrega task da **11 moduli** in tempo reale:

| Modulo | Sorgente |
|--------|---------|
| Daily Missions | `window.db.dailyMissions` |
| Studio | `window.db.study.getBlob('state')` |
| Life RPG | `window.db.rpg.getState()` |
| LEO Protocol | `window.db.leo.getCheckin()` |
| Recovery Center | `window.db.recovery.getAll()` |
| Library | `window.db.libraryState.get()` |
| Engineer | `window.db.engineer.getState()` |
| Arte & Musica | `window.db.creativity.getState()` |
| Daily Command Center | `window.db.commandCenter.getState()` |
| Operating Profile | in-memory `operatingProfile` |
| Hub Calendar | localStorage `polylife_hub_calendar_v1` |

---

## Dipendenze

```json
{
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "dotenv": "^16.4.5",
    "node-schedule": "^2.1.1"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.2",
    "electron": "^31.0.0",
    "electron-builder": "^24.0.0"
  }
}
```

---

*PolyLife — Il tuo sistema operativo personale unificato.*
