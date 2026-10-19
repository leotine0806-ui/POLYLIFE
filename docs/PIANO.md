# Piano di consolidamento

## 1. Base leggibile e riproducibile — questa fase

- README coerente con il comportamento attuale.
- Inventario di tutti i file importati e separazione dello storico.
- Contratto desktop senza successi fittizi.
- Correzioni dei blocchi di salvataggio e parsing osservati.
- Server condiviso, asset verificabili, lockfile e test di regressione.

Il superamento dei test di questa fase non dimostra che l’app sia già affidabile in ogni sua sezione.

## 2. Protezione dei dati — prossimo intervento

Prima di cambiare storage, progettare e realizzare un’esportazione completa delle chiavi esistenti, con metadati di origine e versione. Provare il ripristino su un profilo temporaneo, confrontando dati prima e dopo. Una copia creata non è sufficiente senza una prova di recupero.

Definire come trattare dati non validi, allegati, conversazioni e vecchie chiavi contenenti credenziali. L’importazione deve mantenere l’originale ed evitare duplicazioni se viene ripetuta. Nessun test deve scrivere sul profilo dell’app installata.

Criterio di completamento: esportazione e ripristino verificati su un campione rappresentativo, con errori visibili e nessuna cancellazione degli originali.

## 3. Modello e archivio condiviso

Definire attività, eventi, sessioni, materie, progetti e profili. Documentare i mapping delle chiavi legacy, soprattutto il significato ambiguo di `sv4_rec` e i formati delle missioni tra Life RPG e orchestratore.

Implementare una sola API di persistenza con validazione e risultati verificabili. Le modifiche devono essere atomiche dove necessario e diventare visibili alle altre viste senza dipendere da un reload manuale.

Criterio di completamento: creare/modificare/completare un’attività in una sezione, ritrovarla nelle altre e dopo riavvio, senza duplicati o risultati discordanti.

## 4. Razionalizzazione delle sezioni

- Dare ruoli distinti a hub e Command Center: ingresso e giornata operativa.
- Unificare la fonte dei dati per missioni, calendario e planner, mantenendo viste diverse dove utili.
- Separare con chiarezza profilo personale e vincoli operativi.
- Scegliere una sola fonte per XP e progressione, lasciando Life RPG e Dungeon come rappresentazioni eventuali.
- Valutare l’unificazione dei due client Agora dopo confronto di conversazioni, personaggi e memoria.
- Ridurre logica inline e stili duplicati gradualmente, dopo avere testato i comportamenti da conservare.

Queste sono decisioni proposte, non sezioni eliminate da questa fase.

## 5. Distribuzione

Valutare l’aggiornamento delle dipendenze desktop separatamente dalla migrazione dati. Verificare i pacchetti sui sistemi supportati, la configurazione esterna, il percorso del profilo e l’aggiornamento dall’installazione esistente.

Criterio di completamento: installazione e aggiornamento provati con dati di test, backup recuperabile e possibilità di tornare alla versione precedente.
