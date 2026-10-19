# PolyLife

Applicazione personale desktop per organizzare studio, attività quotidiane, lettura, allenamento e progetti. Le sezioni sono pagine HTML servite da un server locale dentro Electron. Alcune funzioni usano Groq per generare risposte AI.

Il progetto è in fase di consolidamento. La versione dichiarata nel pacchetto è `2.0.0`; il nome dell’archivio originale, `PolyLife_v13_Fixed`, non è una versione verificata del software.

## Stato reale

- Le sezioni attive salvano principalmente in `localStorage`, nel profilo Chromium dell’app. Non c’è un database SQLite operativo.
- Alcune sezioni leggono le stesse chiavi e l’hub riceve eventi `storage`, ma non esiste ancora una sincronizzazione completa o tra dispositivi.
- Il backup globale e il ripristino globale non sono implementati. Studio, Library, Life RPG e LEO hanno esportazioni proprie, con copertura diversa.
- I promemoria desktop sono generici, alle 07:00 e alle 20:00 secondo l’orario del computer, mentre l’app è aperta. Non analizzano le attività salvate.
- L’AI richiede una chiave Groq e una connessione Internet. L’interfaccia usa anche risorse esterne, tra cui font e Three.js: il funzionamento offline completo non è garantito.

Le vecchie dichiarazioni su SQLite, migrazione completata e «61/61 test» non descrivono questo codice. Il documento originario rimane in `legacy/` come riferimento storico.

## Avvio per lo sviluppo

Serve Node.js 20 o successivo e npm. Il lockfile registra le versioni effettivamente risolte.

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

La copia di `.env` serve soltanto se non ne hai già uno. Configura le variabili necessarie:

```dotenv
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
PORT=2008
```

Senza chiave puoi usare le funzioni locali; le richieste AI restituiscono un errore esplicito. Il modello deve essere disponibile sul tuo account Groq. Non inserire chiavi nel codice o nei commit.

Se npm segnala che lo script di installazione di Electron è bloccato, autorizza lo script del pacchetto `electron` tramite il meccanismo previsto dalla tua versione di npm, poi esegui `npm rebuild electron`. Non è necessario installare `better-sqlite3`.

In sviluppo Electron usa il profilo `Polylife-dev` nella cartella dati applicazioni del sistema, separato dall’app installata. I dati già presenti nell’app installata non vengono importati automaticamente. I test automatici usano dati temporanei o simulati.

La porta deve rimanere stabile per ritrovare lo stesso `localStorage`: cambiando host o porta cambia l’origine dei dati. Se la porta è occupata, l’avvio mostra un errore anziché collegarsi silenziosamente a un’altra istanza.

## Anteprima nel browser

```powershell
npm run dev:web
```

Apri `http://localhost:2008`, oppure la porta configurata. Questa modalità condivide il server con Electron, ma usa il profilo del browser: i dati sono separati. Non espone le API desktop per notifiche e spaced repetition; le flashcard hanno un algoritmo locale di ripiego.

## Sezioni mantenute

- **Hub:** ingresso, riepiloghi e navigazione.
- **Command Center, missioni, calendario e planner:** giornata, attività e pianificazione; le sovrapposizioni vanno ancora razionalizzate.
- **Studio v4, flashcard e Recovery Center:** studio, appunti, ripasso e recupero.
- **Library:** libri e lettura.
- **LEO Protocol:** allenamento e check-in.
- **Life RPG e Dungeon:** progressione e rappresentazione dei risultati.
- **Engineer e Arte & Musica:** progetti tecnici e creativi.
- **Agora e Agora Anime:** conversazioni con personaggi; rimangono due esperienze distinte.
- **Profilo operativo, onboarding e impostazioni:** preferenze, vincoli e configurazione.

L’inventario motivato di tutti i file originali è in [docs/INVENTARIO.md](docs/INVENTARIO.md). La separazione tra codice attivo e storico evita di confondere versioni alternative durante lo sviluppo.

## Struttura

```text
main.js                 Avvio e finestra Electron, IPC reali
preload.js              Bridge limitato alle funzioni implementate
config.js               Configurazione comune e validazione porta
src/server.js           Server HTTP condiviso e proxy Groq
src/*.html              Sezioni attive
src/*.js                Logica renderer, notifiche e algoritmo SM-2
src/service-worker.js   Worker unico, senza cache offline
docs/                   Architettura, inventario e piano
legacy/                 Codice storico non servito e non incluso nel pacchetto
scripts/                Verifica statica del progetto
test/                   Test di regressione e del server
```

## Verifiche

```powershell
npm run check
npm test
npm run verify
```

`check` controlla sintassi JavaScript, script inline, JSON e riferimenti statici agli asset HTML. I test verificano salvataggi coinvolti nelle correzioni, contratto del preload, cache e risposte del server, usando un servizio AI simulato. Non certificano tutti i percorsi dell’interfaccia, le risposte del modello o le funzionalità ancora da implementare. La CI esegue gli stessi controlli su Windows.

## Pacchetti desktop

```powershell
npm run build:win
npm run build:mac
npm run build:linux
```

Le configurazioni di packaging esistono, ma i tre sistemi richiedono verifica separata. Il pacchetto include il codice attivo e le dipendenze di produzione; esclude `.env`, `legacy/`, test e documentazione. Nell’app distribuita, la configurazione esterna viene cercata in `%APPDATA%/polylife/.env` su Windows, oppure in `$HOME/polylife/.env` se `APPDATA` non esiste. Le variabili già impostate nel processo hanno precedenza.

Questa fase non aggiorna né sostituisce l’app già installata sul computer.

## Prossimo lavoro

La priorità è un archivio unico con importazione verificata dei dati esistenti, backup completo e prova di ripristino. Seguiranno sincronizzazione delle viste e semplificazione delle sezioni. [Architettura](docs/ARCHITETTURA.md) e [piano di consolidamento](docs/PIANO.md) descrivono i problemi ancora aperti e i criteri per procedere.
