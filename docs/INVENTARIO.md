# Inventario e decisioni sui file

La ricognizione copre i 45 file dell’archivio ricevuto, incluse le credenziali locali solo come categoria, e i due file di protezione aggiunti al primo caricamento. Le descrizioni riguardano struttura, dipendenze e persistenza; la presenza di una funzione non ne certifica tutti i percorsi operativi.

## File alla radice

- `.env` — Configurazione privata ricevuta, esclusa da Git e dai pacchetti. Non viene letta né copiata nei documenti di analisi.
- `.env.example` — Modello senza chiave: mantenere.
- `.gitignore` — Protegge configurazione privata, dipendenze e output: mantenere.
- `main.js` — Bootstrap Electron. Riscritto come coordinatore del server condiviso e degli IPC realmente disponibili; rimossi no-op e successo fittizio.
- `preload.js` — Bridge renderer. Ridotto alle capacità implementate; le vecchie API fittizie non sono esposte.
- `package.json` — Manifest npm e packaging. Mantenere, aggiungendo comandi di verifica e togliendo .env dal pacchetto.
- `README_MASTER.md` — Ora rimanda al README corrente. L’originale è in `legacy/README_MASTER.md`.

## File originali della cartella src

### agora.html

Client conversazioni classico: personaggi, cronologia, memoria e mentor. Mantenere; wrapper mentor corretto. Valutare in seguito un client condiviso con Nexus.

Posizione attuale: `src/agora.html`.

### agora_anime.html

Client Nexus: personaggi anime, cronologia e memoria propri. Mantenere finché i formati delle conversazioni non sono confrontati.

Posizione attuale: `src/agora_anime.html`.

### arte-musica.html

Sessioni, abilità, progetti creativi e coach. Mantenere; persistenza locale e tracker coach da consolidare.

Posizione attuale: `src/arte-musica.html`.

### backup.js

Esportazione/ripristino progettati per un backend SQLite assente. Archiviare; non è un backup funzionante dei dati locali attuali.

Posizione attuale: `legacy/backup.js`.

### coach-config.js

Catalogo dei coach e tracker locale. Mantenere; alcuni prompt sono anche duplicati nelle pagine.

Posizione attuale: `src/coach-config.js`.

### daily-command-center.html

Diario operativo della giornata, priorità, punteggi, briefing. Mantenere; ricorsione del salvataggio corretta. Separare il ruolo da hub e missioni.

Posizione attuale: `src/daily-command-center.html`.

### daily-missions.html

CRUD missioni, vincoli, piano AI e timeline. Mantenere; non confondere il planner generato con attività realmente eseguite.

Posizione attuale: `src/daily-missions.html`.

### dungeon.html

Interfaccia della progressione Dungeon. Mantenere in coppia con dungeon.js; valutare sovrapposizione con Life RPG.

Posizione attuale: `src/dungeon.html`.

### dungeon.js

Logica Dungeon: quest, classi, trasformazioni, boss, storia e lettura di dati degli altri moduli. Mantenere; molte regole e progressioni sono hardcoded e non costituiscono un archivio centrale.

Posizione attuale: `src/dungeon.js`.

### engineer.html

Studio tecnico, concetti, formule, reverse engineering, materiali, progetti e diario. Mantenere; adapter locale reso sincrono e cancellazione progetto corretta.

Posizione attuale: `src/engineer.html`.

### flashcards.html

Creazione carte e sessioni SM-2. Mantenere; corretta la funzione con await illegale che bloccava lo script.

Posizione attuale: `src/flashcards.html`.

### hub-calendar.html

Aggregazione calendario da Studio, missioni e LEO. Mantenere; lo schema delle sorgenti deve essere verificato prima di chiamarlo calendario unico.

Posizione attuale: `src/hub-calendar.html`.

### icon-512.png

Icona raster disponibile, usata dal desktop e dai manifest. Mantenere; sostituisce riferimenti a icone assenti.

Posizione attuale: `src/icon-512.png`.

### icon.ico

Icona Windows per finestra e installer. Mantenere.

Posizione attuale: `src/icon.ico`.

### leo_protocol_v8.html

Allenamento, timer, check-in, record, note e backup di sezione. Mantenere; alcune chiamate opzionali db.get/db.set non coincidevano neppure con il vecchio preload.

Posizione attuale: `src/leo_protocol_v8.html`.

### library_fixed.html

Libri, sessioni di lettura e progressione. Mantenere; stato completo in leo_library_v1, diverso dalla vecchia API library a record.

Posizione attuale: `src/library_fixed.html`.

### life_rpg_v2.html

Missioni, progressione, riflessioni e pianificazione settimanale. Mantenere; ha anche una propria gestione missioni da allineare all’orchestratore.

Posizione attuale: `src/life_rpg_v2.html`.

### manifest-studio.json

Metadati PWA della sezione Studio v4. Mantenere, usando soltanto icone esistenti; non garantisce da solo il funzionamento offline.

Posizione attuale: `src/manifest-studio.json`.

### manifest.json

Metadati PWA dell’hub. Mantenere; usato anche dove erano indicati manifest inesistenti.

Posizione attuale: `src/manifest.json`.

### migration.html

Interfaccia per la vecchia migrazione SQLite. Archiviare: il backend non implementava la migrazione.

Posizione attuale: `legacy/migration.html`.

### migration.js

Raccoglieva chiavi legacy e le inviava a un IPC che fingeva successo. Archiviare come riferimento dei formati, non eseguire.

Posizione attuale: `legacy/migration.js`.

### notifications.js

Nel codice originale leggeva un database sempre nullo e pianificava backup impossibili. Originale archiviato; versione attiva limitata a due promemoria generici.

Posizione attuale: `src/notifications.js`.

### onboarding.html

Raccoglie nome, obiettivi, materie e primo libro. Mantenere; il primo libro viene ora salvato nello stato locale di Library, senza duplicarlo ripetendo il wizard.

Posizione attuale: `src/onboarding.html`.

### operating-profile.html

Vincoli orari, scuola, blocchi e minimi non negoziabili. Mantenere, distinto dal profilo di onboarding.

Posizione attuale: `src/operating-profile.html`.

### polylife-gamification.js

Catalogo abilità, livelli, XP e stato globale con fallback locale. Mantenere; XP globali, pending XP e progressioni dei moduli non sono ancora una sola fonte.

Posizione attuale: `src/polylife-gamification.js`.

### polylife-sqlite.js

Helper e tentativi di migrazione verso API SQLite non implementate. Archiviare e scollegare dall’hub.

Posizione attuale: `legacy/polylife-sqlite.js`.

### polylife-widget.js

Widget condiviso con conteggi missioni, flashcard, streak e stato backup. Mantenere; le sorgenti dei conteggi vanno validate.

Posizione attuale: `src/polylife-widget.js`.

### polymath_os_v9.html

Hub principale, navigazione, riepiloghi, aggregazioni e AI. Mantenere; rimosse chiave duplicata di navigazione e migrazioni scollegate.

Posizione attuale: `src/polymath_os_v9.html`.

### recovery-center.html

Registro cause, recupero e collegamenti alla coda Studio. Mantenere; due rappresentazioni dei dati necessitano di mapping esplicito.

Posizione attuale: `src/recovery-center.html`.

### server.js

In origine duplicava parte del server in main.js. Mantenere una sola implementazione condivisa, usata anche dall’anteprima browser.

Posizione attuale: `src/server.js`.

### service-worker-leo.js

Worker di passaggio con scope sovrapposto agli altri. Archiviare; registrazioni aggiornate al worker unico.

Posizione attuale: `legacy/service-worker-leo.js`.

### service-worker-library.js

Worker di passaggio con scope sovrapposto agli altri. Archiviare; registrazioni aggiornate al worker unico.

Posizione attuale: `legacy/service-worker-library.js`.

### service-worker-rpg.js

Worker di passaggio con scope sovrapposto agli altri. Archiviare; registrazioni aggiornate al worker unico.

Posizione attuale: `legacy/service-worker-rpg.js`.

### service-worker-studio.js

Cache alternativa che poteva eliminare le cache degli altri moduli. Archiviare; registrazioni aggiornate al worker unico.

Posizione attuale: `legacy/service-worker-studio.js`.

### service-worker.js

In origine cache di pagine e richieste senza distinzione sufficiente. Mantenere come worker unico senza fetch handler; pulisce solo cache storiche riconoscibili.

Posizione attuale: `src/service-worker.js`.

### settings.html

Configurazione, test AI/notifiche e stato archiviazione. Mantenere; stato reale, backup disabilitato e notifiche controllate senza finti successi.

Posizione attuale: `src/settings.html`.

### spaced-repetition.js

Algoritmo SM-2 puro richiamato tramite IPC desktop. Mantenere; restano implementazioni di fallback nei client da uniformare in seguito.

Posizione attuale: `src/spaced-repetition.js`.

### studio-planner.html

Verifiche, piani di studio AI, attività completate e calendario. Mantenere; allineare modelli a Studio e calendario condiviso.

Posizione attuale: `src/studio-planner.html`.

### studio_polymath_v2.html

Versione alternativa non raggiunta dalla navigazione attiva, con molte funzioni in comune con v4. Archiviare; non sostituire v4 senza confronto dei dati.

Posizione attuale: `legacy/studio_polymath_v2.html`.

### studio_polymath_v4.html

Versione Studio attiva: attività, appunti/allegati, voti, verifiche, AI, flashcard e recupero. Mantenere come sola versione Studio nel pacchetto.

Posizione attuale: `src/studio_polymath_v4.html`.

## Aggiunte di questa fase

- `README.md`: ingresso alla documentazione, setup e limiti reali.
- `config.js`: configurazione unica per desktop e browser.
- `package-lock.json`: versioni risolte per installazioni ripetibili.
- `.gitattributes`: terminatori di riga uniformi e asset binari.
- `docs/ARCHITETTURA.md`: flussi, dati, correzioni e limiti.
- `docs/INVENTARIO.md`: questo inventario.
- `docs/PIANO.md`: ordine di lavoro e criteri di completamento.
- `legacy/README.md`: regole per consultare lo storico.
- `scripts/check-project.js`: controllo sintassi e riferimenti degli asset.
- `test/`: regressioni mirate e test del server; non usano dati reali o una chiave AI.
- `.github/workflows/verify.yml`: controlli su push e pull request.

## Cosa eliminare e cosa preservare

Dal runtime sono stati tolti i no-op del database, i successi fittizi di backup/migrazione e la duplicazione del server. Il codice storico separato non è eseguibile attraverso il server pubblico. I moduli funzionali rimangono: accorparli ora senza definire i dati rischierebbe di perdere comportamenti utili.

Le varianti archiviate non sono prove di funzionalità mancante da ripristinare automaticamente. Per le eliminazioni definitive basta la cronologia Git; questa prima fase conserva invece copie esplicite per rendere il confronto facile.
