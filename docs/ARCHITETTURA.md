# Architettura osservata e direzione

Ricognizione del codice importato il 19 ottobre 2026. È una lettura statica dei file e dei flussi di persistenza, accompagnata da controlli sintattici, test mirati e prove di navigazione. Non equivale a una certificazione di tutte le funzioni.

## Flusso attuale

`main.js` legge `config.js`, avvia `src/server.js` sull’interfaccia locale e apre l’hub in Electron. `preload.js` espone spaced repetition e notifiche attraverso IPC. Il processo principale verifica l’origine del chiamante.

L’anteprima browser usa lo stesso server. Le pagine sono documenti separati con CSS e JavaScript inline, non componenti di un’unica applicazione. Navigare tra sezioni ricrea lo stato in memoria.

Il proxy `/api/chat` converte la richiesta delle sezioni nel formato Groq e conserva il formato di risposta `{content:[{text}]}` usato dai client. Errori HTTP, risposte vuote, JSON malformato e timeout hanno stato di errore, senza fingere una risposta riuscita. Alcuni client devono ancora mostrare il dettaglio dell’errore restituito dal proxy.

## Dove sono i dati

L’unità di condivisione attuale è l’origine del browser: protocollo, host e porta, dentro un determinato profilo Chromium. Due sezioni sulla stessa origine possono leggere le stesse chiavi; l’app installata, la copia di sviluppo e un browser esterno hanno profili differenti.

I principali gruppi di dati osservati sono:

- `sv4_*`: dati Studio. Attenzione: `sv4_rec` è usato anche come coda di recupero, mentre alcuni aggregatori lo trattano come registro delle sessioni. Il significato va chiarito prima della migrazione.
- `polylife_flashcards_v1`: flashcard condivise da Studio, Engineer e pagina flashcard.
- `polylife_recovery_v1`: registro Recovery, con collegamenti alla coda Studio.
- `polylife_profile`: profilo di onboarding; diverso da `polylife_operating_profile_v1`, che contiene vincoli e pianificazione. Non unirli copiando semplicemente un oggetto sull’altro.
- `polylife_daily_missions_v1`, `polylife_orchestrator_plan_v1`, `polylife_daily_overrides_v2`: missioni, piano e variazioni giornaliere.
- `polylife_daily_command_v1`: stato giornaliero del Command Center.
- `leo_library_v1`: stato Library, comprensivo di libri, log e progressione.
- `leo_rpg_state_v2`, `leo_reflect_draft`: stato RPG e bozze di riflessione.
- `leo_checkin`, `leo_pr`, `leo_milestones`, `leo_notes` e chiavi settimanali: LEO Protocol.
- `eng_*_v3`: raccolte Engineer, separate per tipo di contenuto.
- `polylife_arte_musica_v1`: creatività.
- `agora_*` e chiavi Nexus: conversazioni, memoria e personaggi; sono dati personali, non asset da includere nel repository.
- `polylife_global_gamification_v1`, `polylife_pending_xp` e stato Dungeon: progressione globale e locale, ancora parzialmente sovrapposte.
- `polylife_coach_analytics`: log locale delle interazioni con i coach, distinto dalle vecchie API analytics mai implementate.

L’hub ascolta eventi `storage` e ricarica periodicamente i riepiloghi. Non c’è un sistema di transazioni tra chiavi: due pagine possono riscrivere una copia vecchia e perdere modifiche concorrenti. Alcune funzioni ignorano errori di lettura/scrittura e mostrano stati predefiniti; questa limitazione non è risolta globalmente.

## Perché l’app sembrava non attendibile

Il vecchio `preload.js` esponeva `window.db`, ma `main.js` rispondeva alle chiamate con `null`, `[]`, `{}` o nulla. Le viste che trovavano questa API saltavano il ripiego su dati locali. Alcuni salvataggi terminavano senza errore pur non scrivendo niente.

Il vecchio backup restituiva successo con zero record senza creare un file. Le notifiche erano collegate a un getter che restituiva sempre `null`. Il README presentava invece SQLite come fonte unica e dichiarava test non presenti.

In questa fase il contratto viene reso coerente con il codice: nessun database o backup fittizio esposto; le pagine usano i propri percorsi locali. È una correzione del comportamento, non la realizzazione dell’archivio futuro.

## Correzioni circoscritte di questa fase

- Command Center: eliminata la ricorsione del salvataggio, sostituita da una scrittura locale effettiva.
- Engineer: adapter locale sincrono coerente con i consumatori; la cancellazione progetto salva l’array modificato.
- Agora: il wrapper mentor conserva la funzione di invio originale, invece di richiamare sé stesso per effetto dell’hoisting.
- Flashcard: `saveCard` è asincrona; prima conteneva `await` in una funzione normale e impediva il parsing dell’intero script. La vista di ripasso è visibile già all’apertura.
- Onboarding: il primo libro entra nello stato realmente letto da Library; ripetere il wizard non duplica lo stesso titolo.
- Server: implementazione unica, errori AI espliciti, limite al corpo della richiesta, timeout, blocco dei percorsi privati e ascolto solo locale.
- Cache: un solo service worker, nessun salvataggio delle risposte API e nessun ripiego silenzioso su vecchie versioni HTML.
- Asset: manifest e icone riferiscono file presenti.
- Ambiente: lockfile, configurazione senza segreti incorporati, isolamento del profilo di sviluppo e controlli ripetibili.

## Direzione proposta

Un solo archivio persistente dovrà essere la fonte di verità per attività, eventi, profilo e registrazioni. Le viste devono derivare i riepiloghi da queste entità, anziché ricostruirle da copie in formati incompatibili.

La scelta dello storage richiede prima la definizione delle entità e la lettura di esportazioni reali. L’eventuale scelta di SQLite non basta da sola: servono mapping, transazioni, gestione errori, versioni dello schema e migrazioni reversibili. Non è stata aggiunta una dipendenza SQLite come sostituto di questo lavoro.

Il primo dominio da unificare proposto è attività/calendario: missione, evento e sessione svolta devono rimanere entità distinguibili, collegate da identificatori stabili. Gamification e coach devono osservare eventi confermati, senza inventare dati mancanti.
