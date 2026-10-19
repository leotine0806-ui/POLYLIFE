/**
 * Polylife — Spaced Repetition (SM-2) (P1)
 *
 * Implementazione dell'algoritmo SuperMemo SM-2.
 * Aggiunge alle flashcard i campi:
 *   - easiness_factor   (default 2.5, min 1.3)
 *   - interval          (giorni fino alla prossima revisione)
 *   - repetitions       (numero di volte che la card è stata rivista correttamente)
 *   - next_review_date  (ISO date string)
 *   - last_reviewed     (ISO date string)
 *
 * Uso nel renderer (preload expone window.sr):
 *   const result = window.sr.review(card, quality);  // quality: 0-5
 *   window.sr.getDueCards(allCards);                  // card da ripassare oggi
 *
 * quality:
 *   0 = blackout completo
 *   1 = sbagliata, ma la risposta era riconoscibile
 *   2 = sbagliata, ma ricordavi la risposta corretta
 *   3 = corretta con difficoltà
 *   4 = corretta con piccola esitazione
 *   5 = risposta perfetta
 */

/**
 * Calcola il prossimo stato SM-2 di una flashcard.
 * @param {object} card - la flashcard (con campi SM-2 opzionali)
 * @param {number} quality - voto 0-5
 * @returns {object} - nuovi valori SM-2 da applicare alla card
 */
function reviewCard(card, quality) {
  if (quality < 0 || quality > 5) throw new RangeError('quality deve essere 0-5');

  // Valori iniziali per carte nuove
  let ef          = card.easiness_factor  ?? 2.5;
  let interval    = card.interval         ?? 1;
  let repetitions = card.repetitions      ?? 0;

  if (quality >= 3) {
    // Risposta corretta
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    repetitions++;
  } else {
    // Risposta errata — ricomincia
    repetitions = 0;
    interval = 1;
  }

  // Aggiornamento easiness factor
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const today = new Date();
  const nextReview = new Date(today);
  nextReview.setDate(today.getDate() + interval);

  return {
    easiness_factor:  Math.round(ef * 1000) / 1000,
    interval,
    repetitions,
    next_review_date: nextReview.toISOString().slice(0, 10),
    last_reviewed:    today.toISOString().slice(0, 10)
  };
}

/**
 * Filtra le card che vanno riviste oggi o prima.
 * @param {Array} cards - tutte le flashcard
 * @returns {Array} - card in scadenza
 */
function getDueCards(cards) {
  const today = new Date().toISOString().slice(0, 10);
  return cards.filter(c => {
    if (!c.next_review_date) return true; // nuova → da rivedere subito
    return c.next_review_date <= today;
  });
}

/**
 * Statistiche SM-2 su un set di card.
 */
function getStats(cards) {
  if (!cards.length) return { total: 0, due: 0, new: 0, mature: 0, avgEF: 0 };

  const due   = getDueCards(cards).length;
  const newC  = cards.filter(c => !c.next_review_date).length;
  const mature= cards.filter(c => (c.interval ?? 0) >= 21).length;
  const avgEF = cards.reduce((s, c) => s + (c.easiness_factor ?? 2.5), 0) / cards.length;

  return {
    total:  cards.length,
    due,
    new:    newC,
    mature,
    avgEF:  Math.round(avgEF * 100) / 100
  };
}

/**
 * Ordina le card per priorità di revisione:
 * 1. overdue (scadute da più giorni)
 * 2. due today
 * 3. nuove
 * 4. prossimamente
 */
function sortByPriority(cards) {
  const today = new Date().toISOString().slice(0, 10);
  return [...cards].sort((a, b) => {
    const aDate = a.next_review_date || '0000-00-00';
    const bDate = b.next_review_date || '0000-00-00';
    return aDate.localeCompare(bDate);
  });
}

/**
 * Suggerisce un messaggio motivazionale in base alla qualità.
 */
function qualityMessage(quality) {
  const msgs = [
    '❌ Non ci siamo — ricominciamo da capo.',
    '😓 Difficile, ma ci sei quasi.',
    '😐 Quasi! Ci vuole ancora un po\'.',
    '✅ Bene! Un po\' di sforzo ma ce l\'hai fatta.',
    '⚡ Ottimo! Risposta solida.',
    '🔥 Perfetto! Stai dominando questa card.'
  ];
  return msgs[quality] || '';
}

module.exports = { reviewCard, getDueCards, getStats, sortByPriority, qualityMessage };
