/**
 * PolyLife — Global Gamification Engine v1.0
 * ═══════════════════════════════════════════
 * Sistema centralizzato di XP, skill, livelli, badge e achievement.
 * Ogni skill parte da zero. Ogni XP nasce da un'azione reale.
 * NO XP gratis. NO progressione fittizia.
 *
 * Livelli: 1–1000 (Initiate → Ascendant Master)
 * Integrazione: window.db (SQLite) con fallback localStorage
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// 1. CLASSI DI PROGRESSIONE (livelli 0–1000)
//    Livello 0 = nessuna azione eseguita. Si parte da UNRANKED.
// ══════════════════════════════════════════════════════════════════════════════

const PROGRESSION_CLASSES = [
  { min: 0,    max: 0,    name: 'UNRANKED',          color: '#374151' },  // 0 XP, nessuna azione
  { min: 1,    max: 50,   name: 'INITIATE',          color: '#6b7280' },
  { min: 51,   max: 150,  name: 'APPRENTICE',        color: '#10b981' },
  { min: 151,  max: 300,  name: 'ADEPT',             color: '#3b82f6' },
  { min: 301,  max: 500,  name: 'EXPERT',            color: '#8b5cf6' },
  { min: 501,  max: 700,  name: 'MASTER',            color: '#f59e0b' },
  { min: 701,  max: 850,  name: 'GRANDMASTER',       color: '#ef4444' },
  { min: 851,  max: 950,  name: 'LEGENDARY',         color: '#ec4899' },
  { min: 951,  max: 999,  name: 'MYTHIC',            color: '#00d4ff' },
  { min: 1000, max: 1000, name: 'ASCENDANT MASTER',  color: '#ffffff' },
];

/**
 * Calcola la classe di progressione per un dato livello.
 * @param {number} level  0–1000
 * @returns {{ name: string, color: string }}
 */
function getProgressionClass(level) {
  if (level <= 0) return PROGRESSION_CLASSES[0]; // UNRANKED
  const cls = PROGRESSION_CLASSES.find(c => level >= c.min && level <= c.max);
  return cls || PROGRESSION_CLASSES[1]; // fallback INITIATE
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. FORMULA XP (scala fino al livello 1000)
// ══════════════════════════════════════════════════════════════════════════════
//
// Curva di crescita: esponenziale moderata con plateaux per evitare grinding
// infinito nei livelli bassi e scoraggiamento nei livelli alti.
//
// Formula base: XP_per_livello(L) = floor(50 * L^1.6)
// XP cumulativi: XP_totali(L) = sum(i=1..L) of floor(50 * i^1.6)
//
// Livello 1:    50 XP
// Livello 10:   ~1.994 XP/liv (tot ~7.950)
// Livello 50:   ~20.691 XP/liv (tot ~600k)
// Livello 100:  ~63.096 XP/liv (tot ~3.2M)
// Livello 500:  ~681.000 XP/liv (tot ~240M)
// Livello 1000: ~2.512.000 XP/liv (tot ~1.4B)

// ══════════════════════════════════════════════════════════════════════════════
// 2. FORMULA XP (scala 0–1000)
// ══════════════════════════════════════════════════════════════════════════════
//
// Livello 0  = 0 XP (stato iniziale, UNRANKED — nessuna azione eseguita)
// Livello 1  = 50 XP  (prima soglia reale)
// Livello 10 = ~7.950 XP cumulativi
// Livello 50 = ~600k XP
// Livello 100= ~3.2M XP
// Livello 1000= ~1.4B XP
//
// Formula per XP necessari per salire DAL livello L al livello L+1:
//   xpPerLevel(L) = floor(50 * (L+1)^1.6)
//
// XP cumulativi per RAGGIUNGERE il livello L:
//   xpForLevel(0) = 0
//   xpForLevel(1) = 50
//   xpForLevel(L) = sum(i=0..L-1) of floor(50 * (i+1)^1.6)

const _XP_TABLE_CACHE = {};

/**
 * XP cumulativi necessari per RAGGIUNGERE il livello `level`.
 * xpForLevel(0) = 0  → livello 0 = stato iniziale, zero azioni
 * xpForLevel(1) = 50 → ci vuole almeno 1 azione reale per uscire da UNRANKED
 */
function xpForLevel(level) {
  if (level <= 0) return 0;
  if (_XP_TABLE_CACHE[level] != null) return _XP_TABLE_CACHE[level];
  let total = 0;
  for (let l = 0; l < level; l++) {
    total += Math.floor(50 * Math.pow(l + 1, 1.6));
  }
  _XP_TABLE_CACHE[level] = total;
  return total;
}

/**
 * XP necessari per salire DAL livello `level` al livello successivo.
 */
function xpNeededForNextLevel(level) {
  return Math.floor(50 * Math.pow(level + 1, 1.6));
}

/**
 * Converte XP assoluti in livello corrente (0–1000).
 * 0 XP → livello 0 (UNRANKED)
 * 50 XP → livello 1 (INITIATE)
 */
function xpToLevel(xp) {
  if (xp <= 0) return 0;                          // ← FIX CORE: 0 XP = livello 0
  if (xp < xpForLevel(1)) return 0;               // sotto la soglia del livello 1
  let level = 0;
  while (level < 1000 && xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/**
 * Dati completi di progressione per una skill.
 * Con 0 XP → level=0, pct=0%, tutto a zero. Nessuna progressione precompilata.
 * @param {number} xp  XP totali accumulati nella skill
 */
function getSkillProgress(xp) {
  const xpSafe = Math.max(0, xp || 0);
  const level  = xpToLevel(xpSafe);           // 0 se xp < 50
  const cls    = getProgressionClass(level);

  if (level === 0) {
    // Stato iniziale: mostra progress verso il livello 1
    const need = xpForLevel(1);               // 50 XP per raggiungere il livello 1
    const pct  = need > 0 ? Math.min(99, Math.round((xpSafe / need) * 100)) : 0;
    return { xp: xpSafe, level: 0, className: cls.name, color: cls.color,
             pct, prog: xpSafe, need, next: need };
  }

  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const prog = xpSafe - base;
  const need = next - base;
  const pct  = need > 0 ? Math.min(100, Math.round((prog / need) * 100)) : 100;
  return { xp: xpSafe, level, className: cls.name, color: cls.color, pct, prog, need, next };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. SKILL GLOBALI — 9 CATEGORIE
// Tutte partono da: xp=0, level=0, progressione=0%, classe=UNRANKED.
// Nessun valore preimpostato. Nessuna progressione fittizia.
// Livello 1 si raggiunge solo dopo la prima azione reale (50 XP).
// ══════════════════════════════════════════════════════════════════════════════

const GLOBAL_SKILLS = [
  // ── MIND ──────────────────────────────────────────────────────────────────
  {
    id: 'focus',
    name: 'FOCUS',
    category: 'Mind',
    icon: '🎯',
    color: '#4f8cff',
    description: 'Capacità di mantenere l\'attenzione profonda su un singolo compito eliminando le distrazioni.',
    benefit: 'Deep work più produttivo. Sessioni di studio di qualità superiore. Meno tempo sprecato.',
    actions: [
      { label: 'Sessione studio 30+ min senza distrazioni', xp: 15 },
      { label: 'Sessione studio 60+ min senza distrazioni', xp: 25 },
      { label: 'Sessione deep work documentata', xp: 20 },
      { label: 'Completare una verifica/esame', xp: 40 },
      { label: 'Appunti completi per tutte le ore', xp: 10 },
    ],
    milestones: [
      { level: 10,  title: 'CURIOSO',       desc: 'Primo focus sostenuto oltre i 30 minuti.' },
      { level: 50,  title: 'CONCENTRATO',   desc: 'Capacità di ignorare le distrazioni abituali.' },
      { level: 100, title: 'STUDIOSO',      desc: 'Il focus è diventato un\'abitudine.' },
      { level: 200, title: 'DEEP WORKER',   desc: 'Sessioni da 90+ minuti senza sforzo.' },
      { level: 300, title: 'POLIMATA',      desc: 'Attenzione selettiva a livello da professionista.' },
      { level: 500, title: 'ARCHITETTO',    desc: 'Capacità di pianificare e completare progetti complessi.' },
      { level: 700, title: 'MAESTRO',       desc: 'Focus da atleta agonistico.' },
      { level: 850, title: 'LEGGENDA',      desc: 'Livello di concentrazione da Nobel.' },
      { level: 1000, title: 'ASCENDANT',    desc: 'Il focus è la tua identità.' },
    ],
  },
  {
    id: 'memory',
    name: 'MEMORIA',
    category: 'Mind',
    icon: '🧠',
    color: '#38bdf8',
    description: 'Capacità di encoding, consolidamento e retrieval delle informazioni apprese.',
    benefit: 'Ritenzione superiore. Studio più efficiente. Connessioni tra concetti distanti.',
    actions: [
      { label: 'Sessione flashcard completata (10+ card)', xp: 10 },
      { label: 'Sessione flashcard completata (30+ card)', xp: 20 },
      { label: 'Review con spaced repetition', xp: 15 },
      { label: 'Creare set di flashcard (20+ card)', xp: 20 },
      { label: 'Argomento debole recuperato', xp: 25 },
    ],
    milestones: [
      { level: 10,  title: 'REGISTRATORE', desc: 'Primi pattern di encoding attivo.' },
      { level: 50,  title: 'ARCHIVISTA',   desc: 'Sistema di retrieval che funziona.' },
      { level: 100, title: 'MNEMONISTA',   desc: 'La memoria è diventata un sistema.' },
      { level: 300, title: 'POLIMATA',     desc: 'Connessioni tra domini diversi.' },
      { level: 500, title: 'EIDETIC',      desc: 'Recall quasi totale del materiale studiato.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Memoria da campione mondiale.' },
    ],
  },
  {
    id: 'analysis',
    name: 'ANALISI',
    category: 'Mind',
    icon: '🔬',
    color: '#22d3ee',
    description: 'Capacità di scomporre problemi complessi in componenti elementari e ragionare su di essi.',
    benefit: 'Problem solving più rapido. Identificazione delle cause radice. Decisioni migliori.',
    actions: [
      { label: 'Challenge ingegneristica completata', xp: 25 },
      { label: 'Challenge completata con score > 70%', xp: 40 },
      { label: 'Concept tecnico documentato', xp: 15 },
      { label: 'Formula derivata e applicata', xp: 20 },
      { label: 'Problema complesso scomposto e risolto', xp: 30 },
    ],
    milestones: [
      { level: 10,  title: 'OSSERVATORE',  desc: 'Inizi a vedere i pattern.' },
      { level: 50,  title: 'DETECTIVE',    desc: 'Trovi le cause che altri ignorano.' },
      { level: 100, title: 'ANALISTA',     desc: 'Struttura mentale da ingegnere.' },
      { level: 300, title: 'STRATEGA',     desc: 'Sistemi complessi diventano trasparenti.' },
      { level: 500, title: 'ARCHITETTO',   desc: 'Progetti sistemi che funzionano.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Pensiero sistemico totale.' },
    ],
  },

  // ── BODY ──────────────────────────────────────────────────────────────────
  {
    id: 'strength',
    name: 'FORZA',
    category: 'Body',
    icon: '💪',
    color: '#ef4444',
    description: 'Forza muscolare assoluta e capacità di generare potenza. Il fondamento fisico.',
    benefit: 'Performance atletica superiore. Postura. Metabolismo. Autostima concreta.',
    actions: [
      { label: 'Sessione palestra completata', xp: 20 },
      { label: 'Sessione con new PR (Personal Record)', xp: 40 },
      { label: '50 push-up + 100 squat completati', xp: 15 },
      { label: 'Allenamento upper body documentato', xp: 20 },
      { label: 'Test forza massima (1RM)', xp: 30 },
    ],
    milestones: [
      { level: 10,  title: 'PRINCIPIANTE', desc: 'Corpo che inizia a rispondere.' },
      { level: 50,  title: 'ATLETA',       desc: 'Forza base solida.' },
      { level: 100, title: 'GUERRIERO',    desc: 'Capacità fisiche evidenti.' },
      { level: 200, title: 'FORGIATO',     desc: 'La disciplina fisica è identità.' },
      { level: 500, title: 'IRON',         desc: 'Forza da competizione.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Potenza fisica al limite umano.' },
    ],
  },
  {
    id: 'endurance',
    name: 'RESISTENZA',
    category: 'Body',
    icon: '🫁',
    color: '#f97316',
    description: 'Capacità aerobica e anaerobica. Resistere quando gli altri si fermano.',
    benefit: 'Energia prolungata. Recupero più rapido. Mente più lucida per più tempo.',
    actions: [
      { label: 'Sessione cardio 20+ min completata', xp: 15 },
      { label: 'Sessione beach volley completata', xp: 20 },
      { label: 'Allenamento resistenza documentato', xp: 20 },
      { label: 'Sessione circuito HIIT', xp: 25 },
    ],
    milestones: [
      { level: 10,  title: 'CORRIDORE',    desc: 'Inizi a gestire lo sforzo prolungato.' },
      { level: 50,  title: 'ATLETA',       desc: 'Resistenza base consolidata.' },
      { level: 100, title: 'MACCHINA',     desc: 'Non ti fermi quando ti stanca.' },
      { level: 500, title: 'LEGGENDA',     desc: 'Resistenza da atleta d\'élite.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Resistenza al limite umano.' },
    ],
  },
  {
    id: 'flexibility',
    name: 'MOBILITÀ',
    category: 'Body',
    icon: '🧘',
    color: '#fb923c',
    description: 'Range di movimento articolare e qualità del tessuto muscolare. Performance nascosta.',
    benefit: 'Prevenzione infortuni. Salti più alti. Recupero più veloce.',
    actions: [
      { label: 'Sessione stretching 15+ min', xp: 10 },
      { label: 'Sessione mobilità specifica completata', xp: 15 },
      { label: 'Stretching post-allenamento', xp: 8 },
    ],
    milestones: [
      { level: 10,  title: 'RIGIDO',       desc: 'Inizi a muoverti meglio.' },
      { level: 50,  title: 'AGILE',        desc: 'Mobilità funzionale raggiunta.' },
      { level: 100, title: 'FLUIDO',       desc: 'Movimento da atleta.' },
      { level: 500, title: 'MAESTRO',      desc: 'Mobilità da ginnasta.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Controllo totale del corpo.' },
    ],
  },

  // ── KNOWLEDGE ──────────────────────────────────────────────────────────────
  {
    id: 'deep_reading',
    name: 'LETTURA PROFONDA',
    category: 'Knowledge',
    icon: '📚',
    color: '#a78bfa',
    description: 'Capacità di leggere con comprensione profonda, attenzione critica e ritenzione attiva.',
    benefit: 'Conoscenza che resta. Connessioni interdisciplinari. Vocabolario e pensiero più ricchi.',
    actions: [
      { label: 'Sessione lettura 20+ pagine', xp: 10 },
      { label: 'Sessione lettura 50+ pagine', xp: 20 },
      { label: 'Libro completato (qualsiasi)', xp: 50 },
      { label: 'Libro completato + riflessione scritta', xp: 80 },
      { label: 'Review concetti chiave libro', xp: 20 },
    ],
    milestones: [
      { level: 10,  title: 'LETTORE',      desc: 'Abitudine di lettura iniziata.' },
      { level: 50,  title: 'BIBLIOFILO',   desc: 'La lettura è parte della routine.' },
      { level: 100, title: 'STUDIOSO',     desc: 'Lettura attiva e critica consolidata.' },
      { level: 200, title: 'POLIMATA',     desc: 'Connessioni tra libri e domini.' },
      { level: 500, title: 'ILLUMINATO',   desc: 'Lettura da accademico.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'La conoscenza libraria ti definisce.' },
    ],
  },
  {
    id: 'critical_thinking',
    name: 'PENSIERO CRITICO',
    category: 'Knowledge',
    icon: '🔭',
    color: '#8b5cf6',
    description: 'Capacità di valutare argomentazioni, identificare bias e costruire ragionamenti solidi.',
    benefit: 'Decisioni migliori. Resistenza alla manipolazione. Scrittura e comunicazione più potenti.',
    actions: [
      { label: 'Riflessione scritta completata', xp: 15 },
      { label: 'Analisi critica di un testo/articolo', xp: 20 },
      { label: 'Journal entry con argomento strutturato', xp: 15 },
      { label: 'Debate o discussione documentata', xp: 25 },
    ],
    milestones: [
      { level: 10,  title: 'SCETTICO',     desc: 'Inizi a fare domande.' },
      { level: 50,  title: 'ANALISTA',     desc: 'Trovi le falle negli argomenti.' },
      { level: 100, title: 'CRITICO',      desc: 'Ragionamento sistematico.' },
      { level: 500, title: 'FILOSOFO',     desc: 'Pensiero da Socrate.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Mente impossibile da ingannare.' },
    ],
  },

  // ── ENGINEERING ────────────────────────────────────────────────────────────
  {
    id: 'engineering',
    name: 'INGEGNERIA',
    category: 'Engineering',
    icon: '⚙️',
    color: '#00d4ff',
    description: 'Capacità di progettare, costruire e ottimizzare sistemi fisici e digitali.',
    benefit: 'Trasformare idee in realtà. Problem solving tecnico. Pensiero da ingegnere.',
    actions: [
      { label: 'Challenge ingegneristica completata', xp: 25 },
      { label: 'Challenge con score > 70%', xp: 40 },
      { label: 'Concept tecnico documentato', xp: 15 },
      { label: 'Formula derivata e applicata', xp: 20 },
      { label: 'Report re-engineering completato', xp: 30 },
      { label: 'Project milestone raggiunta', xp: 35 },
    ],
    milestones: [
      { level: 10,  title: 'TINKERER',     desc: 'Primi progetti che funzionano.' },
      { level: 50,  title: 'BUILDER',      desc: 'Sistemi funzionanti costruiti.' },
      { level: 100, title: 'ENGINEER',     desc: 'Pensiero da ingegnere consolidato.' },
      { level: 300, title: 'ARCHITECT',    desc: 'Sistemi complessi progettati.' },
      { level: 500, title: 'INNOVATOR',    desc: 'Soluzioni originali documentate.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Ingegneria al limite dell\'innovazione.' },
    ],
  },
  {
    id: 'coding',
    name: 'CODING',
    category: 'Engineering',
    icon: '💻',
    color: '#4f8cff',
    description: 'Capacità di scrivere codice pulito, strutturato e funzionante.',
    benefit: 'Superpotere digitale. Automazione. Costruire strumenti dal nulla.',
    actions: [
      { label: 'Sessione coding 30+ min', xp: 15 },
      { label: 'Feature completata e funzionante', xp: 30 },
      { label: 'Bug risolto e documentato', xp: 20 },
      { label: 'Progetto pubblicato/deployato', xp: 60 },
      { label: 'Documentazione scritta', xp: 15 },
    ],
    milestones: [
      { level: 10,  title: 'CODER',        desc: 'Il codice funziona.' },
      { level: 50,  title: 'DEVELOPER',    desc: 'Progetti completi pubblicati.' },
      { level: 100, title: 'ENGINEER',     desc: 'Architettura pulita.' },
      { level: 300, title: 'BUILDER',      desc: 'Prodotti usati da altri.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Il codice è il tuo linguaggio.' },
    ],
  },

  // ── BUSINESS ───────────────────────────────────────────────────────────────
  {
    id: 'business',
    name: 'BUSINESS',
    category: 'Business',
    icon: '📈',
    color: '#8b5cf6',
    description: 'Capacità di identificare opportunità, costruire offerte e generare valore economico.',
    benefit: 'Autonomia finanziaria. Capacità di monetizzare le competenze. Mentalità imprenditoriale.',
    actions: [
      { label: 'Idea validata con feedback reale', xp: 30 },
      { label: 'Offerta creata e documentata', xp: 35 },
      { label: 'Contatto con potenziale cliente', xp: 25 },
      { label: 'Analisi di mercato completata', xp: 20 },
      { label: 'Prima vendita realizzata', xp: 100 },
    ],
    milestones: [
      { level: 10,  title: 'IDEATORE',     desc: 'Prime idee validate.' },
      { level: 50,  title: 'IMPRENDITORE', desc: 'Offerta reale nel mercato.' },
      { level: 100, title: 'BUILDER',      desc: 'Business che funziona.' },
      { level: 500, title: 'STRATEGIST',   desc: 'Sistema di business scalabile.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Imprenditoria come seconda natura.' },
    ],
  },
  {
    id: 'finance',
    name: 'FINANCE',
    category: 'Business',
    icon: '💹',
    color: '#10b981',
    description: 'Comprensione dei mercati finanziari, risk management e asset allocation.',
    benefit: 'Capitale protetto. Decisioni finanziarie lucide. Indipendenza economica.',
    actions: [
      { label: 'Analisi di mercato documentata', xp: 20 },
      { label: 'Trade con setup documentato', xp: 25 },
      { label: 'Risk management applicato', xp: 20 },
      { label: 'Post-mortem trade scritto', xp: 30 },
    ],
    milestones: [
      { level: 10,  title: 'TRADER',       desc: 'Comprendi i mercati.' },
      { level: 50,  title: 'ANALISTA',     desc: 'Setup documentati e seguiti.' },
      { level: 100, title: 'STRATEGIST',   desc: 'Risk management consolidato.' },
      { level: 500, title: 'INVESTOR',     desc: 'Mentalità da long-term.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Finanza come strumento di libertà.' },
    ],
  },

  // ── CREATIVITY ─────────────────────────────────────────────────────────────
  {
    id: 'creativity',
    name: 'CREATIVITÀ',
    category: 'Creativity',
    icon: '💡',
    color: '#ec4899',
    description: 'Capacità di generare idee originali, connettere concetti distanti e produrre output creativi.',
    benefit: 'Problem solving laterale. Differenziazione. Output che nessun altro produce.',
    actions: [
      { label: 'Sessione brainstorming documentata', xp: 15 },
      { label: 'Progetto creativo completato', xp: 40 },
      { label: 'Output pubblicato (post, video, design)', xp: 35 },
      { label: 'Connessione interdisciplinare documentata', xp: 20 },
    ],
    milestones: [
      { level: 10,  title: 'CURIOSO',      desc: 'Prime idee originali.' },
      { level: 50,  title: 'CREATIVO',     desc: 'Output creativi regolari.' },
      { level: 100, title: 'INNOVATORE',   desc: 'Stile riconoscibile.' },
      { level: 500, title: 'VISIONARIO',   desc: 'Idee che cambiano contesti.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Creatività come forza primaria.' },
    ],
  },

  // ── DISCIPLINE ─────────────────────────────────────────────────────────────
  {
    id: 'discipline',
    name: 'DISCIPLINA',
    category: 'Discipline',
    icon: '⚡',
    color: '#fbbf24',
    description: 'Capacità di agire coerentemente con i propri obiettivi, indipendentemente dall\'umore.',
    benefit: 'Risultati composti. Identità coerente. La libertà che viene dal controllo di sé.',
    actions: [
      { label: 'Missione giornaliera completata', xp: 5 },
      { label: 'Giornata al 100% missioni completate', xp: 30 },
      { label: 'Streak 7 giorni', xp: 50 },
      { label: 'Streak 30 giorni', xp: 150 },
      { label: 'Riflessione serale completata', xp: 15 },
      { label: 'Doccia fredda', xp: 8 },
      { label: 'Routine mattutina completata', xp: 10 },
    ],
    milestones: [
      { level: 10,  title: 'REGOLARE',     desc: '7 giorni consecutivi completati.' },
      { level: 50,  title: 'COSTANTE',     desc: 'Routine che non si rompe facilmente.' },
      { level: 100, title: 'INCROLLABILE', desc: 'La disciplina è più forte dell\'umore.' },
      { level: 200, title: 'STOICO',       desc: 'Nessuna scusa valida.' },
      { level: 500, title: 'GUERRIERO',    desc: 'La disciplina è la tua identità.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Il controllo totale di sé.' },
    ],
  },
  {
    id: 'consistency',
    name: 'COSTANZA',
    category: 'Discipline',
    icon: '📅',
    color: '#a3e635',
    description: 'Non 100% una volta — 80% ogni giorno. La costanza batte sempre il picco isolato.',
    benefit: 'Crescita composta. Risultati che si accumulano. Progressi visibili.',
    actions: [
      { label: 'Streak 3 giorni', xp: 10 },
      { label: 'Streak 7 giorni', xp: 30 },
      { label: 'Streak 14 giorni', xp: 60 },
      { label: 'Streak 30 giorni', xp: 150 },
      { label: 'Streak 100 giorni', xp: 500 },
      { label: 'Tracking giornata completato', xp: 5 },
    ],
    milestones: [
      { level: 10,  title: 'INIZIA',       desc: 'Prima settimana senza buco.' },
      { level: 50,  title: 'ABITUDINE',    desc: 'Un mese di costanza.' },
      { level: 100, title: 'SISTEMA',      desc: 'La costanza è automatica.' },
      { level: 500, title: 'LEGGENDA',     desc: 'Anni di costanza documentata.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'La costanza è chi sei.' },
    ],
  },

  // ── RECOVERY ───────────────────────────────────────────────────────────────
  {
    id: 'recovery',
    name: 'RECUPERO',
    category: 'Recovery',
    icon: '⚡',
    color: '#fbbf24',
    description: 'Capacità di recuperare fisicamente e mentalmente. I campioni crescono nel recupero.',
    benefit: 'Prestazioni sostenibili. Prevenzione burnout. Progressi a lungo termine.',
    actions: [
      { label: 'Sonno 7+ ore documentato', xp: 10 },
      { label: 'Routine notturna completata', xp: 12 },
      { label: 'A letto entro le 23:00', xp: 8 },
      { label: 'Recovery day rispettato', xp: 15 },
      { label: 'Meditazione/NSDR completata', xp: 12 },
    ],
    milestones: [
      { level: 10,  title: 'RIPOSATO',     desc: 'Sonno regolare instaurato.' },
      { level: 50,  title: 'RIGENERATO',   desc: 'Recovery come priorità.' },
      { level: 100, title: 'DEEP SLEEPER', desc: 'Routine notturna solida.' },
      { level: 300, title: 'BIO-HACKER',   desc: 'Ottimizzazione del recupero.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Recovery da atleta olimpico.' },
    ],
  },
  {
    id: 'health',
    name: 'SALUTE',
    category: 'Recovery',
    icon: '🌿',
    color: '#10b981',
    description: 'Nutrizione, idratazione, skincare. Il corpo è una macchina biologica di precisione.',
    benefit: 'Energia costante. Performance cognitiva. Longevità.',
    actions: [
      { label: 'Colazione sana completata', xp: 5 },
      { label: 'Pranzo nutriente', xp: 5 },
      { label: 'Cena sana', xp: 5 },
      { label: 'Idratazione giornaliera (2L+)', xp: 5 },
      { label: 'Skincare mattutina + serale', xp: 4 },
      { label: 'Settimana di nutrizione perfetta', xp: 50 },
    ],
    milestones: [
      { level: 10,  title: 'CONSAPEVOLE',  desc: 'Attenzione alla nutrizione.' },
      { level: 50,  title: 'OTTIMIZZATO',  desc: 'Routine salutare consolidata.' },
      { level: 100, title: 'BIO-HACKER',   desc: 'Il corpo come strumento di performance.' },
      { level: 500, title: 'PEAK HUMAN',   desc: 'Salute ottimizzata al massimo.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Longevità da atleta olimpico.' },
    ],
  },

  // ── SOCIAL ─────────────────────────────────────────────────────────────────
  {
    id: 'communication',
    name: 'COMUNICAZIONE',
    category: 'Social',
    icon: '🗣️',
    color: '#f59e0b',
    description: 'Capacità di esprimere idee con chiarezza, persuadere e connettersi con gli altri.',
    benefit: 'Leadership. Networking. Capacità di vendere idee e sé stessi.',
    actions: [
      { label: 'Conversazione significativa documentata', xp: 10 },
      { label: 'Presentazione completata', xp: 30 },
      { label: 'Feedback ricevuto e applicato', xp: 20 },
      { label: 'Contatto professionale stabilito', xp: 25 },
    ],
    milestones: [
      { level: 10,  title: 'COMUNICATORE', desc: 'Idee espresse chiaramente.' },
      { level: 50,  title: 'PERSUASORE',   desc: 'Influenza misurabile.' },
      { level: 100, title: 'LEADER',       desc: 'Gli altri ti seguono.' },
      { level: 500, title: 'ORATORE',      desc: 'Comunicazione da professionista.' },
      { level: 1000, title: 'ASCENDANT',   desc: 'Il linguaggio è la tua arma.' },
    ],
  },
];

// Mappa rapida per lookup: skill_id → skill definition
const SKILLS_MAP = Object.fromEntries(GLOBAL_SKILLS.map(s => [s.id, s]));

// ══════════════════════════════════════════════════════════════════════════════
// 4. ACHIEVEMENT GLOBALI
// ══════════════════════════════════════════════════════════════════════════════

const ACHIEVEMENTS = [
  // ── PRIME AZIONI ────────────────────────────────────────────────────────────
  { id: 'first_session',   name: 'PRIMO PASSO',         desc: 'Completa la tua prima sessione in qualsiasi modulo.',      req: { type: 'action', action: 'any_session', count: 1 },       icon: '🌱', rarity: 'common'    },
  { id: 'first_book',      name: 'PRIMO LIBRO',          desc: 'Completa il tuo primo libro nella Library.',              req: { type: 'action', action: 'book_complete', count: 1 },      icon: '📖', rarity: 'common'    },
  { id: 'first_pr',        name: 'PRIMA PR',             desc: 'Registra il tuo primo Personal Record.',                  req: { type: 'action', action: 'pr_set', count: 1 },             icon: '🏆', rarity: 'common'    },
  { id: 'first_ai',        name: 'PRIMO CONSIGLIO AI',   desc: 'Usa l\'AI per la prima volta.',                           req: { type: 'action', action: 'ai_interaction', count: 1 },    icon: '🤖', rarity: 'common'    },
  { id: 'first_reflection',name: 'PRIMA RIFLESSIONE',    desc: 'Scrivi la tua prima riflessione giornaliera.',            req: { type: 'action', action: 'reflection', count: 1 },         icon: '📓', rarity: 'common'    },

  // ── XP MILESTONE ────────────────────────────────────────────────────────────
  { id: 'xp_100',   name: 'CENTURIA',          desc: 'Raggiungi 100 XP totali.',        req: { type: 'xp', amount: 100 },      icon: '⚡', rarity: 'common'   },
  { id: 'xp_1000',  name: 'PRIMA MILLE',       desc: 'Raggiungi 1.000 XP totali.',      req: { type: 'xp', amount: 1000 },     icon: '💫', rarity: 'uncommon' },
  { id: 'xp_10k',   name: 'DIECIMILA',         desc: 'Raggiungi 10.000 XP totali.',     req: { type: 'xp', amount: 10000 },    icon: '🌟', rarity: 'rare'     },
  { id: 'xp_100k',  name: 'CENTOMILA',         desc: 'Raggiungi 100.000 XP totali.',    req: { type: 'xp', amount: 100000 },   icon: '🔥', rarity: 'epic'     },
  { id: 'xp_1m',    name: 'MILIONARIO DI XP',  desc: 'Raggiungi 1.000.000 XP totali.', req: { type: 'xp', amount: 1000000 },  icon: '👑', rarity: 'legendary'},

  // ── STREAK ──────────────────────────────────────────────────────────────────
  { id: 'streak_3',   name: '3 GIORNI',           desc: 'Streak di 3 giorni consecutivi.',   req: { type: 'streak', days: 3 },   icon: '🔗', rarity: 'common'    },
  { id: 'streak_7',   name: 'UNA SETTIMANA',       desc: 'Streak di 7 giorni consecutivi.',   req: { type: 'streak', days: 7 },   icon: '📅', rarity: 'uncommon'  },
  { id: 'streak_30',  name: 'UN MESE SOLIDO',      desc: 'Streak di 30 giorni consecutivi.',  req: { type: 'streak', days: 30 },  icon: '🏅', rarity: 'rare'      },
  { id: 'streak_100', name: 'CENTO GIORNI',        desc: 'Streak di 100 giorni consecutivi.', req: { type: 'streak', days: 100 }, icon: '⭐', rarity: 'epic'      },
  { id: 'streak_365', name: 'UN ANNO INTERO',      desc: 'Streak di 365 giorni consecutivi.', req: { type: 'streak', days: 365 }, icon: '🌠', rarity: 'legendary' },

  // ── LIVELLI GLOBALI ──────────────────────────────────────────────────────────
  { id: 'global_lvl_10',   name: 'INITIATE',          desc: 'Raggiungi il livello globale 10.',   req: { type: 'level', level: 10 },   icon: '🌿', rarity: 'common'    },
  { id: 'global_lvl_50',   name: 'APPRENTICE',         desc: 'Raggiungi il livello globale 50.',   req: { type: 'level', level: 50 },   icon: '🔵', rarity: 'uncommon'  },
  { id: 'global_lvl_100',  name: 'ADEPT',              desc: 'Raggiungi il livello globale 100.',  req: { type: 'level', level: 100 },  icon: '🔷', rarity: 'rare'      },
  { id: 'global_lvl_300',  name: 'EXPERT',             desc: 'Raggiungi il livello globale 300.',  req: { type: 'level', level: 300 },  icon: '💎', rarity: 'epic'      },
  { id: 'global_lvl_500',  name: 'MASTER',             desc: 'Raggiungi il livello globale 500.',  req: { type: 'level', level: 500 },  icon: '🔮', rarity: 'epic'      },
  { id: 'global_lvl_1000', name: 'ASCENDANT MASTER',   desc: 'Il vertice assoluto del sistema.',   req: { type: 'level', level: 1000 }, icon: '✨', rarity: 'legendary' },

  // ── SKILL SPECIFICHE ─────────────────────────────────────────────────────────
  { id: 'skill_lvl_50_any',  name: 'PRIMO SPECIALIST',  desc: 'Porta qualsiasi skill al livello 50.',   req: { type: 'skill_level', level: 50,  count: 1 }, icon: '🎖️', rarity: 'uncommon' },
  { id: 'skill_lvl_100_any', name: 'PRIMO ESPERTO',     desc: 'Porta qualsiasi skill al livello 100.',  req: { type: 'skill_level', level: 100, count: 1 }, icon: '🥇', rarity: 'rare'     },
  { id: 'skill_lvl_500_any', name: 'PRIMO MASTER',      desc: 'Porta qualsiasi skill al livello 500.',  req: { type: 'skill_level', level: 500, count: 1 }, icon: '🏆', rarity: 'epic'     },
  { id: 'skill_mastered',    name: 'ASCENDED',          desc: 'Porta qualsiasi skill al livello 1000.', req: { type: 'skill_level', level: 1000, count: 1 },icon: '⚡', rarity: 'legendary'},

  // ── POLIMATA ─────────────────────────────────────────────────────────────────
  { id: 'polymath_3cats',  name: 'MULTI-DOMAIN',    desc: 'Raggiungi livello 10+ in 3 categorie diverse.',    req: { type: 'categories', count: 3, level: 10  }, icon: '🌐', rarity: 'rare'      },
  { id: 'polymath_5cats',  name: 'POLYMATHIC',      desc: 'Raggiungi livello 10+ in 5 categorie diverse.',    req: { type: 'categories', count: 5, level: 10  }, icon: '🌍', rarity: 'epic'      },
  { id: 'polymath_all',    name: 'TRUE POLYMATH',   desc: 'Raggiungi livello 10+ in tutte le categorie.',     req: { type: 'categories', count: 9, level: 10  }, icon: '🌌', rarity: 'legendary' },

  // ── MODULI SPECIFICI ──────────────────────────────────────────────────────────
  { id: 'books_5',    name: 'BOOKWORM',       desc: 'Completa 5 libri.',     req: { type: 'action', action: 'book_complete', count: 5 },   icon: '📚', rarity: 'uncommon' },
  { id: 'books_25',   name: 'BIBLIOFILO',     desc: 'Completa 25 libri.',    req: { type: 'action', action: 'book_complete', count: 25 },  icon: '📖', rarity: 'rare'     },
  { id: 'books_100',  name: 'BIBLIOTECARIO',  desc: 'Completa 100 libri.',   req: { type: 'action', action: 'book_complete', count: 100 }, icon: '🏛️', rarity: 'legendary'},
  { id: 'gym_50',     name: 'REGOLARE',       desc: 'Completa 50 sessioni in palestra.',  req: { type: 'action', action: 'gym_session', count: 50 },  icon: '💪', rarity: 'rare'     },
  { id: 'gym_200',    name: 'ATLETA',         desc: 'Completa 200 sessioni in palestra.', req: { type: 'action', action: 'gym_session', count: 200 }, icon: '🏋️', rarity: 'epic'     },
  { id: 'study_100',  name: 'STUDIOSO',       desc: 'Completa 100 sessioni di studio.',   req: { type: 'action', action: 'study_session', count: 100 },icon: '🎓', rarity: 'rare'     },
];

// ══════════════════════════════════════════════════════════════════════════════
// 5. STATO GLOBALE — valori di default
//    Tutte le skill a xp=0, level=0, classe=UNRANKED.
//    Nessun achievement sbloccato. Nessuna progressione fittizia.
//    Il livello 1 si raggiunge solo dopo la prima azione reale (50 XP).
// ══════════════════════════════════════════════════════════════════════════════

function createDefaultGlobalState() {
  const skills = {};
  GLOBAL_SKILLS.forEach(s => { skills[s.id] = 0; });  // TUTTE a zero XP, livello 0
  return {
    version: 1,
    skills,                          // skill_id → xp (sempre ≥ 0)
    totalXp: 0,                      // globale: 0 finché non si fa la prima azione
    achievements: {},                // vuoto: nessun achievement di default
    actionCounts: {},                // vuoto: nessuna azione tracciata di default
    streak: 0,
    lastStreakDate: null,
    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. PERSISTENCE (SQLite via window.db, fallback localStorage)
// ══════════════════════════════════════════════════════════════════════════════

const GLOBAL_STATE_KEY = 'polylife_global_gamification_v1';

async function loadGlobalState() {
  try {
    if (window.db?.gamification?.getState) {
      const data = await window.db.gamification.getState();
      if (data) return _migrateState(data);
    }
    const raw = localStorage.getItem(GLOBAL_STATE_KEY);
    if (raw) {
      const parsed = _migrateState(JSON.parse(raw));
      if (window.db?.gamification?.saveState) await window.db.gamification.saveState(parsed);
      return parsed;
    }
  } catch (e) { console.warn('[Gamification] loadGlobalState error:', e); }
  return createDefaultGlobalState();
}

async function saveGlobalState(state) {
  try {
    if (window.db?.gamification?.saveState) {
      await window.db.gamification.saveState(state);
      return;
    }
    localStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('[Gamification] saveGlobalState error:', e); }
}

/** Assicura backward compat se lo schema evolve */
function _migrateState(s) {
  if (!s) return createDefaultGlobalState();
  // Assicura tutte le skill esistano (a zero se nuove)
  GLOBAL_SKILLS.forEach(sk => {
    if (s.skills[sk.id] == null) s.skills[sk.id] = 0;
  });
  // Assicura totalXp coerente — usa == null per non sovrascrivere totalXp=0 legittimo
  if (s.totalXp == null) {
    s.totalXp = Object.values(s.skills).reduce((a, b) => a + b, 0);
  }
  if (!s.achievements)  s.achievements  = {};
  if (!s.actionCounts)  s.actionCounts  = {};
  // Rimuovi achievement sbloccati senza requisito reale (sanitize su load)
  // — non tocchiamo quelli legittimamente guadagnati
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. API PUBBLICA
// ══════════════════════════════════════════════════════════════════════════════

let _state = null;  // Stato in memoria (caricato async all'init)
let _listeners = [];

const PolyLifeGamification = {

  // ── Init ───────────────────────────────────────────────────────────────────
  async init() {
    _state = await loadGlobalState();
    this._emitUpdate();
    return _state;
  },

  // ── Award XP a una skill ────────────────────────────────────────────────────
  // Chiamata da tutti i moduli quando un'azione reale viene completata.
  async awardXP(skillId, amount, opts = {}) {
    if (!_state) await this.init();
    if (!SKILLS_MAP[skillId]) {
      console.warn(`[Gamification] skill sconosciuta: ${skillId}`);
      return null;
    }
    if (!amount || amount <= 0) return null;

    const prevLevel = xpToLevel(_state.skills[skillId] || 0);
    _state.skills[skillId] = (_state.skills[skillId] || 0) + amount;
    _state.totalXp = (_state.totalXp || 0) + amount;
    const newLevel = xpToLevel(_state.skills[skillId]);

    // Traccia azione per achievement
    if (opts.action) {
      _state.actionCounts[opts.action] = (_state.actionCounts[opts.action] || 0) + 1;
    }

    // Controlla achievement
    const unlocked = this._checkAchievements();

    // Emetti eventi analytics
    if (window.analytics?.track) {
      window.analytics.track('skill_xp_gained', skillId, amount, { total: _state.skills[skillId] }).catch(() => {});
      if (newLevel > prevLevel) {
        window.analytics.track('level_up', skillId, newLevel, { prev: prevLevel }).catch(() => {});
      }
      unlocked.forEach(ach => {
        window.analytics.track('achievement_unlocked', skillId, null, { achievement: ach.id }).catch(() => {});
      });
    }

    await saveGlobalState(_state);
    this._emitUpdate();

    return {
      skill: SKILLS_MAP[skillId],
      xpGained: amount,
      xpTotal: _state.skills[skillId],
      prevLevel,
      newLevel,
      levelUp: newLevel > prevLevel,
      progress: getSkillProgress(_state.skills[skillId]),
      unlockedAchievements: unlocked,
    };
  },

  // ── Incrementa contatore azione (senza XP) ──────────────────────────────────
  async trackAction(action, count = 1) {
    if (!_state) await this.init();
    _state.actionCounts[action] = (_state.actionCounts[action] || 0) + count;
    const unlocked = this._checkAchievements();
    await saveGlobalState(_state);
    this._emitUpdate();
    return unlocked;
  },

  // ── Aggiorna streak ──────────────────────────────────────────────────────────
  async updateStreak(currentStreak) {
    if (!_state) await this.init();
    _state.streak = currentStreak;
    _state.lastStreakDate = new Date().toISOString().slice(0, 10);
    const unlocked = this._checkAchievements();
    if (window.analytics?.track) {
      window.analytics.track('streak_updated', 'discipline', currentStreak, null).catch(() => {});
    }
    await saveGlobalState(_state);
    this._emitUpdate();
    return unlocked;
  },

  // ── Getters ──────────────────────────────────────────────────────────────────
  getSkillXP(skillId)       { return _state?.skills[skillId] || 0; },
  getSkillLevel(skillId)    { return xpToLevel(this.getSkillXP(skillId)); },  // 0 se nessuna azione
  getSkillProgress(skillId) { return getSkillProgress(this.getSkillXP(skillId)); },
  getTotalXP()              { return _state?.totalXp ?? 0; },
  getGlobalLevel()          { return xpToLevel(this.getTotalXP()); },          // 0 se nessuna azione
  getGlobalProgress()       { return getSkillProgress(this.getTotalXP()); },
  getState()                { return _state; },
  getAllSkills()             { return GLOBAL_SKILLS; },
  getAchievements()         { return ACHIEVEMENTS; },
  getUnlockedAchievements() {
    if (!_state) return [];
    return ACHIEVEMENTS.filter(a => _state.achievements[a.id]).map(a => ({
      ...a, unlockedAt: _state.achievements[a.id].unlockedAt
    }));
  },

  // ── Hard reset (TUTTE le skill a zero) ──────────────────────────────────────
  async hardReset() {
    _state = createDefaultGlobalState();
    await saveGlobalState(_state);
    this._emitUpdate();
    console.info('[Gamification] Hard reset completato. Tutte le skill a zero.');
    return _state;
  },

  // ── Subscribe a update ────────────────────────────────────────────────────────
  subscribe(fn) { _listeners.push(fn); },
  _emitUpdate() { _listeners.forEach(fn => { try { fn(_state); } catch (_) {} }); },

  // ── Check achievement ─────────────────────────────────────────────────────────
  _checkAchievements() {
    if (!_state) return [];
    const unlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (_state.achievements[ach.id]) continue; // già sbloccato
      let met = false;
      const { req } = ach;
      switch (req.type) {
        case 'xp':
          // XP reali > 0 richiesti (non triggera con totalXp=0)
          met = (_state.totalXp || 0) > 0 && (_state.totalXp || 0) >= req.amount;
          break;
        case 'level': {
          // Livello globale deve essere >= req.level E > 0 (mai sblocca con 0 azioni)
          const globalLvl = xpToLevel(_state.totalXp || 0);
          met = globalLvl > 0 && globalLvl >= req.level;
          break;
        }
        case 'streak':
          // Streak deve essere > 0 (mai triggera al lancio)
          met = (_state.streak || 0) > 0 && (_state.streak || 0) >= req.days;
          break;
        case 'action':
          // Azione deve essere stata eseguita almeno una volta
          met = (_state.actionCounts[req.action] || 0) >= req.count;
          break;
        case 'skill_level': {
          // Skill deve avere livello >= req.level E > 0
          const skillsAtLevel = GLOBAL_SKILLS.filter(s => {
            const lvl = xpToLevel(_state.skills[s.id] || 0);
            return lvl > 0 && lvl >= req.level;
          });
          met = skillsAtLevel.length >= (req.count || 1);
          break;
        }
        case 'categories': {
          // Categorie con almeno una skill al livello req.level > 0
          const cats = {};
          GLOBAL_SKILLS.forEach(s => {
            const lvl = xpToLevel(_state.skills[s.id] || 0);
            if (lvl > 0 && lvl >= req.level) cats[s.category] = true;
          });
          met = Object.keys(cats).length >= req.count;
          break;
        }
      }
      if (met) {
        _state.achievements[ach.id] = { unlockedAt: new Date().toISOString() };
        unlocked.push(ach);
      }
    }
    return unlocked;
  },

  // ── Utility esposte ──────────────────────────────────────────────────────────
  xpToLevel,
  getSkillProgress,
  getProgressionClass,
  xpNeededForNextLevel,
  xpForLevel,
  SKILLS_MAP,
  GLOBAL_SKILLS,
  ACHIEVEMENTS,
  PROGRESSION_CLASSES,
};

// Esponi globalmente
window.PolyGamification = PolyLifeGamification;

// Auto-init (non bloccante)
PolyLifeGamification.init().catch(e => console.warn('[Gamification] init error:', e));
