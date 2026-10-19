# Materiale storico

Questi file provengono dall’importazione originale. Sono conservati per confronti e recupero della logica, non descrivono funzionalità garantite. Non sono serviti dal server e non entrano nel pacchetto desktop.

- `studio_polymath_v2.html`: variante Studio precedente; la navigazione attiva usa v4. Usa già chiavi `sv4_*`, quindi non va eseguita sul profilo corrente per confrontare dati.
- `backup.js`, `migration.html`, `migration.js`, `polylife-sqlite.js`: tentativo di integrazione SQLite senza il necessario backend `db.js`. Non eseguirli come procedura di backup o migrazione.
- `notifications.js`: vecchia pianificazione basata su un database inesistente e un backup non collegato.
- `service-worker-*.js`: worker alternativi con scope sovrapposto. I file attivi registrano ora un unico worker.
- `README_MASTER.md`: descrizione originaria con affermazioni non corrispondenti ai file importati.

Non ripristinare un file nell’app attiva soltanto perché esiste qui: verificare dipendenze, schema dati e prove di regressione. La cronologia Git conserva anche le versioni originali di `main.js`, `preload.js` e `src/server.js`.
