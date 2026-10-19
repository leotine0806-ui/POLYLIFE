/**
 * DUNGEON OS v2 — ANIME POWER FANTASY ENGINE
 * ═══════════════════════════════════════════
 * Solo Leveling × Dragon Ball × Naruto × HxH × Overlord
 * Protagonista: TU.
 * Ogni azione reale in PolyLife = potere reale nel Dungeon.
 */
'use strict';

// ══════════════════════════════════════════════════
// 0. UTILITIES
// ══════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)||'null'); } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} }
};
function showToast(msg,dur=3200){const t=$('dungeon-toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function battleFlash(){const f=$('battle-flash');f.classList.add('hit');setTimeout(()=>f.classList.remove('hit'),220);}
function levelUpFlash(){const f=$('levelup-flash');f.classList.add('show');setTimeout(()=>f.classList.remove('show'),2500);}
function fmtNum(n){if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(Math.round(n));}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

// ── XP / Level formula (mirrors gamification.js) ──
function xpForLevel(lv){if(lv<=0)return 0;let t=0;for(let i=0;i<lv;i++)t+=Math.floor(50*Math.pow(i+1,1.6));return t;}
function xpToLevel(xp){let lv=0;while(xpForLevel(lv+1)<=xp)lv++;return lv;}
function lvProgress(xp){const lv=xpToLevel(xp),base=xpForLevel(lv),next=xpForLevel(lv+1);return{lv,pct:lv===0?0:Math.round(((xp-base)/(next-base))*100)};}

// ══════════════════════════════════════════════════
// 1. STORAGE KEYS
// ══════════════════════════════════════════════════
const KEYS = {
  dungeon:        'polylife_dungeon_v2',
  inventory:      'polylife_dungeon_inventory',
  story:          'polylife_dungeon_story',
  titles:         'polylife_dungeon_titles',
  army:           'polylife_dungeon_army',
  transforms:     'polylife_dungeon_transformations',
  // read-only source keys:
  gamif:          'polylife_global_gamification_v1',
  missions:       'polylife_daily_missions_v1',
  recovery:       'polylife_recovery_v1',
  profile:        'polylife_operating_profile_v1',
};

function loadDungeon(){return ls.get(KEYS.dungeon)||{version:2,defeatedBosses:[],activeWorld:'forest',characterClass:'polymath',questsCompleted:[],questsLastReset:null,createdAt:new Date().toISOString()};}
function saveDungeon(s){ls.set(KEYS.dungeon,s);}
function loadStory(){return ls.get(KEYS.story)||{currentChapter:0,unlockedChapters:[0]};}
function saveStory(s){ls.set(KEYS.story,s);}

// ══════════════════════════════════════════════════
// 2. DATA LOADER — legge tutti i moduli PolyLife
// ══════════════════════════════════════════════════
function loadPolyData(){
  const gamif   = ls.get(KEYS.gamif)  || {skills:{},totalXp:0,streak:0,achievements:{}};
  const missions = ls.get(KEYS.missions)||[];
  const recovery = ls.get(KEYS.recovery)||[];
  const profile  = ls.get(KEYS.profile)||null;

  const totalXp    = gamif.totalXp || Object.values(gamif.skills||{}).reduce((a,b)=>a+b,0)||0;
  const globalLevel= xpToLevel(totalXp);
  const streak     = gamif.streak||0;
  const skills     = gamif.skills||{};

  const today = new Date().toDateString();
  const todayDone = missions.filter(m=>{
    const d=m.completedAt||m.doneAt||m.date||'';
    return new Date(d).toDateString()===today&&(m.completed||m.done);
  }).length;
  const totalDone  = missions.filter(m=>m.completed||m.done).length;

  let recovScore=0;
  if(recovery.length){const rec=recovery.slice(-14);recovScore=Math.round(rec.reduce((s,r)=>s+(r.score||r.total||0),0)/rec.length);}

  return {gamif,totalXp,globalLevel,streak,skills,profile,missions,todayDone,totalDone,recovery,recovScore};
}

// ══════════════════════════════════════════════════
// 3. POWER SYSTEM — 8 tipi di energia
// ══════════════════════════════════════════════════
const POWERS = [
  {id:'mana',        name:'MANA',            icon:'🔷', color:'#00e5ff', tag:'ARCANE',
   source:'focus',   desc:'Energia arcana che alimenta ogni tecnica mentale. Sale con lo studio profondo.',
   formula: s=>Math.round((xpToLevel(s.focus||0)*12)+((s.deep_reading||0)*0.008))},
  {id:'ki',          name:'KI',              icon:'🔥', color:'#ff4500', tag:'BODY',
   source:'strength',desc:'Forza vitale emanata dal corpo allenato. Cresce con ogni sessione fisica.',
   formula: s=>Math.round((xpToLevel(s.strength||0)*10)+(xpToLevel(s.endurance||0)*8))},
  {id:'chakra',      name:'CHAKRA',          icon:'☯',  color:'#c77dff', tag:'SPIRIT',
   source:'recovery',desc:'Equilibrio tra corpo e mente. Si rigenera con il recovery e la mobilità.',
   formula: s=>Math.round((xpToLevel(s.flexibility||0)*9)+(xpToLevel(s.recovery||0)*11))},
  {id:'aura',        name:'AURA',            icon:'✨', color:'#ffd700', tag:'PRESENCE',
   source:'leadership',desc:"Emanazione del potere che opprime i nemici. Cresce con leadership e comunicazione.",
   formula: s=>Math.round((xpToLevel(s.leadership||0)*15)+(xpToLevel(s.communication||0)*10))},
  {id:'shadow',      name:'SHADOW ENERGY',   icon:'🌑', color:'#7b2fff', tag:'MONARCH',
   source:'discipline',desc:"L'energia oscura dei Monarchi. Si accumula con la disciplina assoluta.",
   formula: (s,data)=>Math.round((data.streak*50)+(xpToLevel(s.discipline||0)*20))},
  {id:'intelligence',name:'INTELLIGENCE',    icon:'🧬', color:'#00ff88', tag:'SCIENCE',
   source:'analysis', desc:"Potenza computazionale dell'intelletto. Massimizzata da analisi e coding.",
   formula: s=>Math.round((xpToLevel(s.analysis||0)*14)+(xpToLevel(s.coding||0)*12)+(xpToLevel(s.engineering||0)*10))},
  {id:'willpower',   name:'WILLPOWER',       icon:'⚡', color:'#ff006e', tag:'RESOLVE',
   source:'critical_thinking',desc:"La volontà che non si piega. Ogni missione completata la fortifica.",
   formula: (s,data)=>Math.round(data.totalDone*8+(xpToLevel(s.critical_thinking||0)*15))},
  {id:'leadership_p',name:'LEADERSHIP',      icon:'👑', color:'#ffaa00', tag:'COMMANDER',
   source:'business', desc:"Il potere di guidare eserciti e sistemi. Strategia e business lo amplificano.",
   formula: s=>Math.round((xpToLevel(s.business||0)*13)+(xpToLevel(s.leadership||0)*18))},
];

function computePowerLevel(data){
  const s=data.skills;
  return POWERS.reduce((sum,p)=>sum+p.formula(s,data),0);
}

// ══════════════════════════════════════════════════
// 4. TRANSFORMATIONS — 6 forme anime
// ══════════════════════════════════════════════════
const TRANSFORMATIONS = [
  {
    id:'base',name:'FORMA BASE',icon:'🧑‍💻',color:'#00e5ff',
    subtitle:'Il Punto di Partenza',
    flavor:'"Ogni leggenda inizia da qui. Il potenziale è già dentro di te."',
    requirements:[],
    always:true,
    powerMult:1.0,
  },
  {
    id:'awakened',name:'AWAKENED',icon:'⚡',color:'#c77dff',
    subtitle:'Il Risveglio',
    flavor:'"Qualcosa si è rotto dentro di te. Non era un limite — era un guscio."',
    requirements:[
      {key:'level',  label:'Livello Globale 10+', threshold:10},
      {key:'streak', label:'Streak 7 giorni',      threshold:7},
      {key:'missions',label:'30 Missioni Totali',  threshold:30},
    ],
    powerMult:1.5,
  },
  {
    id:'ascendant',name:'ASCENDANT',icon:'🌟',color:'#ffd700',
    subtitle:'L\'Ascesa',
    flavor:'"Non sei più chi eri. Ogni cellula del tuo essere è stata riscritta dalla disciplina."',
    requirements:[
      {key:'level',  label:'Livello Globale 30+', threshold:30},
      {key:'streak', label:'Streak 30 giorni',    threshold:30},
      {key:'skill',  skill:'focus',label:'Focus Lv.50+',threshold:50},
      {key:'skill',  skill:'strength',label:'Forza Lv.40+',threshold:40},
    ],
    powerMult:3.0,
  },
  {
    id:'monarch',name:'MONARCH',icon:'👑',color:'#ff0040',
    subtitle:'Il Monarca delle Ombre',
    flavor:'"I re non chiedono il permesso. Il tuo esercito si inchina. Il mondo ti appartiene."',
    requirements:[
      {key:'level',  label:'Livello Globale 60+', threshold:60},
      {key:'streak', label:'Streak 60 giorni',    threshold:60},
      {key:'bosses', label:'5+ Boss Sconfitti',   threshold:5},
      {key:'skill',  skill:'discipline',label:'Disciplina Lv.80+',threshold:80},
    ],
    powerMult:10.0,
  },
  {
    id:'cosmic_engineer',name:'COSMIC ENGINEER',icon:'🔬',color:'#00ff88',
    subtitle:'L\'Ingegnere Cosmico',
    flavor:'"Senku aveva 10 miliardi di neuroni. Tu li stai allenando uno ad uno."',
    requirements:[
      {key:'level',  label:'Livello Globale 80+', threshold:80},
      {key:'skill',  skill:'coding',label:'Coding Lv.100+',threshold:100},
      {key:'skill',  skill:'engineering',label:'Ingegneria Lv.80+',threshold:80},
      {key:'skill',  skill:'analysis',label:'Analisi Lv.80+',threshold:80},
    ],
    powerMult:25.0,
  },
  {
    id:'galactic_architect',name:'GALACTIC ARCHITECT',icon:'🌌',color:'#7b2fff',
    subtitle:'La Forma Finale',
    flavor:'"Non esiste più un limite superiore. Tu sei il limite."',
    requirements:[
      {key:'level',  label:'Livello Globale 100+',threshold:100},
      {key:'streak', label:'Streak 100 giorni',   threshold:100},
      {key:'bosses', label:'Tutti i Boss Sconfitti',threshold:8},
      {key:'skill',  skill:'focus',   label:'Focus Lv.100+',   threshold:100},
      {key:'skill',  skill:'strength',label:'Forza Lv.100+',   threshold:100},
      {key:'skill',  skill:'coding',  label:'Coding Lv.100+',  threshold:100},
    ],
    powerMult:100.0,
  },
];

function getActiveTransformation(data,dungeonState){
  const defeated=dungeonState.defeatedBosses||[];
  let active=TRANSFORMATIONS[0];
  for(const tf of TRANSFORMATIONS){
    if(tf.always)continue;
    const ok=tf.requirements.every(r=>{
      if(r.key==='level')   return data.globalLevel>=r.threshold;
      if(r.key==='streak')  return data.streak>=r.threshold;
      if(r.key==='missions')return data.totalDone>=r.threshold;
      if(r.key==='bosses')  return defeated.length>=r.threshold;
      if(r.key==='skill')   return xpToLevel(data.skills[r.skill]||0)>=r.threshold;
      return false;
    });
    if(ok)active=tf;
  }
  return active;
}

function checkTransformReq(r,data,dungeonState){
  const defeated=dungeonState.defeatedBosses||[];
  let cur=0,needed=r.threshold||0;
  if(r.key==='level')   {cur=data.globalLevel;}
  else if(r.key==='streak')  {cur=data.streak;}
  else if(r.key==='missions'){cur=data.totalDone;}
  else if(r.key==='bosses')  {cur=defeated.length;}
  else if(r.key==='skill')   {cur=xpToLevel(data.skills[r.skill]||0);}
  return{cur,needed,pct:Math.min(100,needed>0?Math.round((cur/needed)*100):100),met:cur>=needed};
}

// ══════════════════════════════════════════════════
// 5. SPECIAL TECHNIQUES
// ══════════════════════════════════════════════════
const TECHNIQUES = [
  {id:'focus_burst',   name:'FOCUS BURST',         icon:'🎯', color:'#00e5ff', type:'MENTAL',
   desc:'Concentrazione totale per 90 minuti. Il rumore del mondo cessa di esistere.',
   power: data=>Math.round(xpToLevel(data.skills.focus||0)*15+data.globalLevel*5),
   cost:'50 MANA',
   unlock:{key:'skill',skill:'focus',threshold:10}},
  {id:'deep_work_domain',name:'DEEP WORK DOMAIN',  icon:'🌀', color:'#c77dff', type:'DOMAIN',
   desc:'Un dominio che piega la realtà. Chiunque vi entri è costretto a produrre al massimo.',
   power: data=>Math.round(xpToLevel(data.skills.focus||0)*25+xpToLevel(data.skills.analysis||0)*20),
   cost:'200 MANA + 100 WILLPOWER',
   unlock:{key:'level',threshold:25}},
  {id:'recovery_regen',name:'RECOVERY REGENERATION',icon:'💚',color:'#00ff88', type:'SUPPORT',
   desc:'Il corpo si ripara durante il sonno. Ogni sessione di recovery moltiplica il recupero.',
   power: data=>Math.round((data.recovScore||0)*30+xpToLevel(data.skills.recovery||0)*20),
   cost:'80 CHAKRA',
   unlock:{key:'skill',skill:'recovery',threshold:5}},
  {id:'strategic_vision',name:'STRATEGIC VISION',  icon:'🔭', color:'#ffd700', type:'INSIGHT',
   desc:"Vedi 10 mosse avanti. Ogni problema diventa un pattern familiare.",
   power: data=>Math.round(xpToLevel(data.skills.critical_thinking||0)*22+xpToLevel(data.skills.analysis||0)*18),
   cost:'120 INTELLIGENCE',
   unlock:{key:'skill',skill:'critical_thinking',threshold:20}},
  {id:'hyper_analysis',name:'HYPER ANALYSIS',      icon:'🧬', color:'#00ff88', type:'SCIENCE',
   desc:'Processa 1000 variabili simultaneamente. Nessun sistema ti è oscuro.',
   power: data=>Math.round(xpToLevel(data.skills.analysis||0)*30+xpToLevel(data.skills.coding||0)*25),
   cost:'300 INTELLIGENCE',
   unlock:{key:'level',threshold:40}},
  {id:'limit_break',   name:'LIMIT BREAK',         icon:'💥', color:'#ff0040', type:'ULTIMATE',
   desc:"Rompi il tuo massimo attuale. Ogni limite infranto raddoppia il potenziale futuro.",
   power: data=>computePowerLevel(data)*2,
   cost:'ALL POWERS',
   unlock:{key:'bosses',threshold:3}},
  {id:'shadow_army',   name:'SHADOW ARMY SUMMON',  icon:'🌑', color:'#7b2fff', type:'MONARCH',
   desc:'Evoca l\'esercito delle ombre. Ogni unità combatte con la tua intelligenza.',
   power: data=>computeArmySize(data)*100,
   cost:'500 SHADOW ENERGY',
   unlock:{key:'streak',threshold:30}},
  {id:'senku_protocol',name:'SENKU PROTOCOL',      icon:'⚗️', color:'#00ff88', type:'SCIENCE',
   desc:"10 miliardi di neuroni attivati in simultanea. Science is the power of truth!",
   power: data=>Math.round(xpToLevel(data.skills.engineering||0)*40+xpToLevel(data.skills.coding||0)*35),
   cost:'400 INTELLIGENCE + 200 MANA',
   unlock:{key:'skill',skill:'engineering',threshold:50}},
];

function isTechUnlocked(tech,data,dungeonState){
  const u=tech.unlock;
  if(!u)return true;
  const defeated=dungeonState.defeatedBosses||[];
  if(u.key==='level')   return data.globalLevel>=u.threshold;
  if(u.key==='streak')  return data.streak>=u.threshold;
  if(u.key==='skill')   return xpToLevel(data.skills[u.skill]||0)>=u.threshold;
  if(u.key==='bosses')  return defeated.length>=u.threshold;
  return false;
}

// ══════════════════════════════════════════════════
// 6. SUMMON / ARMY SYSTEM
// ══════════════════════════════════════════════════
const SUMMONS = [
  {id:'shadow_soldiers',name:'SOLDATI OMBRA',  icon:'🗡️', color:'#7b2fff',
   desc:'Soldati evocati dalla disciplina assoluta.',
   formula:(data,ds)=>Math.floor(data.streak*10+(ds.defeatedBosses||[]).length*50),
   unlock:{key:'streak',threshold:7}},
  {id:'ai_agents',      name:'AGENTI IA',      icon:'🤖', color:'#00e5ff',
   desc:'Costrutti digitali alimentati dall\'intelligenza artificiale.',
   formula:(data)=>Math.floor(xpToLevel(data.skills.coding||0)*5+xpToLevel(data.skills.engineering||0)*4),
   unlock:{key:'skill',skill:'coding',threshold:20}},
  {id:'science_constructs',name:'COSTRUTTI SCIENTIFICI',icon:'⚗️',color:'#00ff88',
   desc:"Macchine e sistemi autonomi progettati dall'ingegnere.",
   formula:(data)=>Math.floor(xpToLevel(data.skills.engineering||0)*6+xpToLevel(data.skills.analysis||0)*4),
   unlock:{key:'skill',skill:'engineering',threshold:30}},
  {id:'drone_fleet',    name:'FLOTTA DRONI',   icon:'🛸', color:'#ffd700',
   desc:'Flotta autonoma coordinata dalla visione strategica.',
   formula:(data)=>Math.floor(xpToLevel(data.skills.leadership||0)*8+xpToLevel(data.skills.business||0)*5),
   unlock:{key:'skill',skill:'leadership',threshold:25}},
];

function computeArmySize(data){
  const ds=loadDungeon();
  return SUMMONS.reduce((sum,s)=>{
    const locked=s.unlock&&(()=>{
      const u=s.unlock;
      if(u.key==='streak')return data.streak<u.threshold;
      if(u.key==='skill') return xpToLevel(data.skills[u.skill]||0)<u.threshold;
      return false;
    })();
    return sum+(locked?0:s.formula(data,ds));
  },0);
}

// ══════════════════════════════════════════════════
// 7. DIMENSIONS / WORLDS
// ══════════════════════════════════════════════════
const WORLDS = [
  {id:'forest',   name:'FORESTA DELLA DISCIPLINA', icon:'🌲', color:'#10b981', x:'18%',y:'60%',
   unlockLv:0,  desc:'Il luogo del Risveglio. Disciplina e abitudine forgiando le fondamenta.',
   dungeons:[
     {id:'habit-cave',name:'Caverna delle Abitudini',skill:'discipline',diff:'easy', color:'#10b981'},
     {id:'focus-trail',name:'Sentiero del Focus',    skill:'focus',     diff:'normal',color:'#00e5ff'},
     {id:'body-dojo',  name:'Dojo del Corpo',        skill:'strength',  diff:'normal',color:'#ef4444'},
   ]},
  {id:'academy',  name:'ACCADEMIA DELLA CONOSCENZA',icon:'🏛️',color:'#c77dff',x:'58%',y:'18%',
   unlockLv:15, desc:'Torri di sapere ancestrale. Ogni libro è un portale dimensionale.',
   dungeons:[
     {id:'reading-spire',name:'Guglia della Lettura',    skill:'deep_reading',     diff:'normal',  color:'#a78bfa'},
     {id:'memory-labyrinth',name:'Labirinto della Memoria',skill:'memory',          diff:'hard',    color:'#38bdf8'},
     {id:'critical-vault',name:'Vault del Pensiero Critico',skill:'critical_thinking',diff:'hard', color:'#8b5cf6'},
   ]},
  {id:'citadel',  name:'CITTADELLA DELL\'INGEGNERIA',icon:'⚙️', color:'#00e5ff', x:'80%',y:'45%',
   unlockLv:30, desc:"La fucina dell'Ingegnere Cosmico. Sistemi e codice trasformano il reale.",
   dungeons:[
     {id:'code-nexus',  name:'Nexus del Codice',   skill:'coding',      diff:'hard',     color:'#4f8cff'},
     {id:'engine-core', name:'Core dell\'Ingegneria',skill:'engineering',diff:'nightmare',color:'#00e5ff'},
     {id:'algo-maze',   name:'Labirinto degli Algoritmi',skill:'analysis',diff:'hard',   color:'#22d3ee'},
   ]},
  {id:'space',    name:'DOMINIO SPAZIALE',          icon:'🚀', color:'#ffd700', x:'40%',y:'75%',
   unlockLv:50, desc:'Oltre l\'atmosfera. Qui le leggi ordinarie non valgono.',
   dungeons:[
     {id:'orbital-base',name:'Base Orbitale',      skill:'leadership',  diff:'nightmare',color:'#ffd700'},
     {id:'nebula-lab',  name:'Laboratorio Nebulare',skill:'engineering', diff:'legendary',color:'#ff7733'},
   ]},
  {id:'war_room', name:'SALA DI GUERRA STRATEGICA', icon:'🎯', color:'#ff4500', x:'22%',y:'28%',
   unlockLv:40, desc:'Dove si decidono le battaglie prima che inizino. Strategia pura.',
   dungeons:[
     {id:'strategy-throne',name:'Trono della Strategia',skill:'critical_thinking',diff:'nightmare',color:'#ff4500'},
     {id:'comms-arena',    name:'Arena della Comunicazione',skill:'communication',diff:'hard',     color:'#f59e0b'},
   ]},
  {id:'nexus',    name:'GALACTIC NEXUS',             icon:'🌌', color:'#7b2fff', x:'50%',y:'45%',
   unlockLv:100,desc:'Il centro di tutto. Solo il Galactic Architect può abitarlo.',
   dungeons:[
     {id:'polymath-singularity',name:'Singolarità del Polimata',skill:'all',diff:'legendary',color:'#7b2fff'},
   ]},
];

// ══════════════════════════════════════════════════
// 8. CINEMATIC BOSSES — 8 nemici epici
// ══════════════════════════════════════════════════
const BOSSES = [
  {id:'procrastination',name:'PROCRASTINATIO',  title:'Signore del Tempo Sprecato',    icon:'💤',
   color:'#6b7280',world:'forest',
   lore:'Si nutre di ogni "lo faccio domani". Più attendi, più cresce. La sua arma è il comfort.',
   deathQuote:'"Non... può essere... avevi tutte le scuse giuste..."',
   weaknesses:['discipline','focus'],
   requirements:[{key:'missions',label:'10 Missioni Completate',threshold:10},{key:'streak',label:'Streak 5 giorni',threshold:5}],
   reward:{relic:'dawn_bell',xp:200}},
  {id:'chaos',name:'ENTROPIA, IL DISORDINE',    title:'Divoratore di Sistemi',          icon:'🌀',
   color:'#ec4899',world:'academy',
   lore:'Non distrugge — dissolve. Ogni sistema ordinato lo attira come un magnete. È l\'entropia fatta essere.',
   deathQuote:'"Il tuo ordine è un\'anomalia... l\'universo correggerà..."',
   weaknesses:['analysis','engineering'],
   requirements:[{key:'level',label:'Livello 15+',threshold:15},{key:'skill',skill:'analysis',label:'Analisi Lv.20+',threshold:20}],
   reward:{relic:'order_crystal',xp:400}},
  {id:'weakness',name:'FRAGILITAS',             title:'Signora della Debolezza Fisica', icon:'🫀',
   color:'#ef4444',world:'forest',
   lore:'Sorta da ogni allenamento saltato. Ogni giorno senza movimento le dona forza. Odia il sudore.',
   deathQuote:'"Come... il tuo corpo... non è più il mio territorio..."',
   weaknesses:['strength','endurance'],
   requirements:[{key:'skill',skill:'strength',label:'Forza Lv.25+',threshold:25},{key:'streak',label:'Streak 10 giorni',threshold:10}],
   reward:{relic:'iron_heart',xp:500}},
  {id:'ignorance',name:'NESCIENTIA',            title:'Regina delle Lacune Cognitive',  icon:'📴',
   color:'#a78bfa',world:'academy',
   lore:'Si nutre di domande non poste. Per ogni libro non letto diventa più grande. Teme la curiosità.',
   deathQuote:'"Non puoi sapere tutto... l\'ignoranza è infinita..."',
   weaknesses:['deep_reading','critical_thinking','memory'],
   requirements:[{key:'level',label:'Livello 25+',threshold:25},{key:'skill',skill:'deep_reading',label:'Lettura Profonda Lv.35+',threshold:35}],
   reward:{relic:'infinite_scroll',xp:700}},
  {id:'mediocrity',name:'MEDIOCRAS',            title:'Custode dello Status Quo',       icon:'📊',
   color:'#fbbf24',world:'war_room',
   lore:'Sussurra "abbastanza bene è sufficiente". Prospera nel conformismo. Odia chi punta all\'eccellenza.',
   deathQuote:'"Come osi... rifiutare la normalità..."',
   weaknesses:['leadership','business','critical_thinking'],
   requirements:[{key:'level',label:'Livello 35+',threshold:35},{key:'skill',skill:'leadership',label:'Leadership Lv.40+',threshold:40}],
   reward:{relic:'excellence_seal',xp:900}},
  {id:'fear',name:'TIMOR',                      title:'Arciduca della Paralisi',        icon:'👁️',
   color:'#00e5ff',world:'citadel',
   lore:'Non attacca il corpo — attacca l\'identità. "Sei abbastanza bravo?" conosce tutte le tue insicurezze.',
   deathQuote:'"Il tuo coraggio è un\'anomalia... devo sparire..."',
   weaknesses:['coding','engineering','willpower'],
   requirements:[{key:'level',label:'Livello 50+',threshold:50},{key:'skill',skill:'coding',label:'Coding Lv.60+',threshold:60}],
   reward:{relic:'fearless_core',xp:1200}},
  {id:'shadow_self',name:'ALTER EGO',           title:'Il Tuo Sé Peggiore',             icon:'🪞',
   color:'#dc143c',world:'forest',
   lore:'Non è un mostro esterno. È la versione di te che avrebbe mollato. Ogni giorno senza disciplina lo fortifica.',
   deathQuote:'"Hai vinto... questa volta. Tornerò ogni mattina che dimentichi perché hai iniziato."',
   weaknesses:['discipline','streak'],
   requirements:[{key:'streak',label:'Streak 14 giorni',threshold:14},{key:'missions',label:'50 Missioni Totali',threshold:50}],
   reward:{relic:'mirror_shard',xp:800}},
  {id:'chaos_emperor',name:'CHAOS EMPEROR',     title:'Imperatore del Caos Totale',     icon:'🔱',
   color:'#7b2fff',world:'nexus',
   lore:'Il boss finale. Non è un nemico — è il limite superiore di ciò che credi di poter diventare. Abbatterlo significa riscriverti.',
   deathQuote:'"...Impossibile. Il tuo potenziale era reale. Era sempre stato reale."',
   weaknesses:['all'],
   requirements:[{key:'level',label:'Livello 100+',threshold:100},{key:'streak',label:'Streak 100 giorni',threshold:100},{key:'bosses',label:'6+ Boss Sconfitti',threshold:6}],
   reward:{relic:'polymath_sigil',xp:5000}},
];

// ══════════════════════════════════════════════════
// 9. SKILL PATHS (anime-style)
// ══════════════════════════════════════════════════
const SKILL_PATHS = [
  {id:'warrior',name:'WARRIOR PATH',icon:'⚔️',color:'#ef4444',
   desc:'Il Percorso del Guerriero. Corpo come acciaio, mente come diamante.',
   skills:['strength','endurance','flexibility','discipline'],
   nodes:[
     {name:'Principiante',icon:'🥋',lv:0},{name:'Guerriero',icon:'⚔️',lv:20},
     {name:'Elite Warrior',icon:'🗡️',lv:50},{name:'Supreme Warrior',icon:'💪',lv:100},
   ]},
  {id:'scientist',name:'SCIENTIST PATH',icon:'🔬',color:'#00ff88',
   desc:'Il Percorso del Senku. La scienza è la forza della verità.',
   skills:['analysis','coding','engineering','critical_thinking'],
   nodes:[
     {name:'Studente',icon:'📐',lv:0},{name:'Ricercatore',icon:'🔬',lv:25},
     {name:'Scienziato',icon:'⚗️',lv:60},{name:'Dr. Stone',icon:'🌟',lv:100},
   ]},
  {id:'strategist',name:'STRATEGIST PATH',icon:'🎯',color:'#ffd700',
   desc:'Il Percorso del Genio Strategico. Ogni mossa calcolata 10 passi avanti.',
   skills:['critical_thinking','leadership','analysis','business'],
   nodes:[
     {name:'Tattician',icon:'♟️',lv:0},{name:'Strategist',icon:'🎯',lv:20},
     {name:'Grand Strategist',icon:'🏆',lv:55},{name:'Supreme Commander',icon:'👑',lv:100},
   ]},
  {id:'creator',name:'CREATOR PATH',icon:'🎨',color:'#ec4899',
   desc:'Il Percorso del Creatore. Arte, musica, e creatività come armi cosmiche.',
   skills:['creativity','music','communication'],
   nodes:[
     {name:'Artista',icon:'🎨',lv:0},{name:'Creatore',icon:'✨',lv:20},
     {name:'Visionario',icon:'🌈',lv:50},{name:'Cosmic Creator',icon:'🌌',lv:100},
   ]},
  {id:'scholar',name:'SCHOLAR PATH',icon:'📚',color:'#c77dff',
   desc:'Il Percorso dello Studioso. La conoscenza è il potere assoluto.',
   skills:['deep_reading','memory','focus','critical_thinking'],
   nodes:[
     {name:'Lettore',icon:'📖',lv:0},{name:'Studioso',icon:'📚',lv:20},
     {name:'Erudito',icon:'🔭',lv:50},{name:'Saggio Arcano',icon:'🧙',lv:100},
   ]},
  {id:'leader',name:'LEADER PATH',icon:'👑',color:'#ffaa00',
   desc:'Il Percorso del Leader. Guida eserciti, costruisci imperi, ispira generazioni.',
   skills:['leadership','communication','business','discipline'],
   nodes:[
     {name:'Seguace',icon:'👤',lv:0},{name:'Capitano',icon:'⚔️',lv:20},
     {name:'Generale',icon:'🎖️',lv:50},{name:'Galactic Founder',icon:'🌌',lv:100},
   ]},
];

// ══════════════════════════════════════════════════
// 10. LEGENDARY RELICS
// ══════════════════════════════════════════════════
const RELICS = [
  {id:'focus_gem',    name:'Focus Gem',              icon:'💎',rarity:'common',   color:'#6b7280',
   bonus:'+10% XP Focus',desc:'Un cristallo che vibra a 40Hz, la frequenza del flow state.',
   unlock:{type:'skill',skill:'focus',lv:10}},
  {id:'dawn_bell',    name:'Campana dell\'Alba',      icon:'🔔',rarity:'uncommon', color:'#10b981',
   bonus:'+15% XP Missioni',desc:'Suona all\'alba per chi ha sconfitto la procrastinazione.',
   unlock:{type:'boss',boss:'procrastination'}},
  {id:'order_crystal',name:'Cristallo dell\'Ordine',  icon:'🔷',rarity:'rare',    color:'#4f8cff',
   bonus:'+20% XP Analisi',desc:'Frammento di un sistema perfetto mai esistito prima.',
   unlock:{type:'boss',boss:'chaos'}},
  {id:'iron_heart',   name:'Cuore di Ferro',          icon:'❤️‍🔥',rarity:'rare',  color:'#ef4444',
   bonus:'+25% XP Body',desc:'Forgiato nel fuoco della disciplina fisica assoluta.',
   unlock:{type:'boss',boss:'weakness'}},
  {id:'infinite_scroll',name:'Rotolo Infinito',       icon:'📜',rarity:'epic',    color:'#a78bfa',
   bonus:'+30% XP Conoscenza',desc:'Non finisce mai. Come le domande di chi conosce davvero.',
   unlock:{type:'boss',boss:'ignorance'}},
  {id:'excellence_seal',name:'Sigillo dell\'Eccellenza',icon:'⭐',rarity:'epic',  color:'#fbbf24',
   bonus:'Tutte XP +10%',desc:'Il marchio di chi non si è mai accontentato del sufficiente.',
   unlock:{type:'boss',boss:'mediocrity'}},
  {id:'fearless_core',name:'Nucleo Impavido',          icon:'💫',rarity:'legendary',color:'#00e5ff',
   bonus:'+40% XP Engineering',desc:'Emette luce fredda. La paura non può avvicinarsi.',
   unlock:{type:'boss',boss:'fear'}},
  {id:'mirror_shard', name:'Frammento dello Specchio', icon:'🪞',rarity:'rare',   color:'#dc143c',
   bonus:'+20% XP Streak',desc:'Riflette chi puoi diventare, non chi sei.',
   unlock:{type:'boss',boss:'shadow_self'}},
  {id:'polymath_sigil',name:'Sigillo del Polimata',    icon:'🌌',rarity:'legendary',color:'#7b2fff',
   bonus:'XP ×2 — ASCENDANT',desc:'L\'emblema finale. Solo chi ha abbattuto il Chaos Emperor.',
   unlock:{type:'boss',boss:'chaos_emperor'}},
  {id:'crown_focus',  name:'Corona del Focus',         icon:'👁️',rarity:'legendary',color:'#00e5ff',
   bonus:'Focus Burst sempre attivo',desc:'La corona dei Deep Workers leggendari.',
   unlock:{type:'level',lv:50}},
  {id:'blueprint_senku',name:'Blueprint di Senku',     icon:'⚗️',rarity:'legendary',color:'#00ff88',
   bonus:'Science XP ×3',desc:'Il progetto originale della Kingdom of Science.',
   unlock:{type:'skill',skill:'engineering',lv:80}},
  {id:'core_monarch', name:'Core del Monarca',          icon:'💎',rarity:'legendary',color:'#7b2fff',
   bonus:'Shadow Energy illimitata',desc:"Il cuore del Monarca delle Ombre. Pulsante di potere.",
   unlock:{type:'streak',days:100}},
  {id:'reactor_infinity',name:'Reactor of Infinity',   icon:'⚡',rarity:'legendary',color:'#ffd700',
   bonus:'Power Level +∞',desc:'Un reattore che converte la disciplina in energia pura.',
   unlock:{type:'transform',tf:'cosmic_engineer'}},
  {id:'tome_polymath',name:'Tome del Polimata',         icon:'📕',rarity:'legendary',color:'#c77dff',
   bonus:'Tutti i percorsi sbloccati',desc:'Contiene la saggezza di ogni percorso possibile.',
   unlock:{type:'level',lv:100}},
];

function isRelicUnlocked(r,data,ds){
  const u=r.unlock;
  if(u.type==='skill')  return xpToLevel(data.skills[u.skill]||0)>=u.lv;
  if(u.type==='boss')   return (ds.defeatedBosses||[]).includes(u.boss);
  if(u.type==='streak') return data.streak>=u.days;
  if(u.type==='level')  return data.globalLevel>=u.lv;
  if(u.type==='transform'){const tf=getActiveTransformation(data,ds);return tf.id===u.tf||TRANSFORMATIONS.findIndex(t=>t.id===tf.id)>=TRANSFORMATIONS.findIndex(t=>t.id===u.tf);}
  return false;
}

// ══════════════════════════════════════════════════
// 11. TITLES & RANKS
// ══════════════════════════════════════════════════
const RANKS = [
  {name:'NOVIZIO',    icon:'🌱',color:'#6b7280',lv:0,   desc:'Il viaggio inizia adesso'},
  {name:'HUNTER',     icon:'🏹',color:'#10b981',lv:5,   desc:'Hai scelto di combattere'},
  {name:'ELITE',      icon:'⚔️',color:'#4f8cff',lv:15,  desc:'Oltre la media per sempre'},
  {name:'MASTER',     icon:'🌟',color:'#fbbf24',lv:30,  desc:'Il comando del tuo dominio'},
  {name:'MONARCH',    icon:'👑',color:'#ff0040',lv:60,  desc:'Re del tuo universo'},
  {name:'ARCHITECT',  icon:'🏛️',color:'#c77dff',lv:80,  desc:"Costruisci realtà dall'idea"},
  {name:'SUPREME COMMANDER',icon:'🎖️',color:'#00e5ff',lv:90,desc:'Guidi eserciti di sistemi'},
  {name:'GALACTIC FOUNDER',icon:'🌌',color:'#7b2fff',lv:100,desc:'Fondi civiltà galattiche'},
];

function getActiveRank(lv){let r=RANKS[0];for(const rk of RANKS){if(lv>=rk.lv)r=rk;}return r;}

// ══════════════════════════════════════════════════
// 12. SKILL DEFS (for path nodes / worlds)
// ══════════════════════════════════════════════════
const SKILL_DEFS = [
  {id:'focus',             name:'Focus',            icon:'🎯',color:'#4f8cff'},
  {id:'memory',            name:'Memoria',          icon:'🧠',color:'#38bdf8'},
  {id:'analysis',          name:'Analisi',          icon:'🔬',color:'#22d3ee'},
  {id:'strength',          name:'Forza',            icon:'💪',color:'#ef4444'},
  {id:'endurance',         name:'Resistenza',       icon:'🫁',color:'#f97316'},
  {id:'flexibility',       name:'Mobilità',         icon:'🧘',color:'#fb923c'},
  {id:'deep_reading',      name:'Lettura Profonda', icon:'📚',color:'#a78bfa'},
  {id:'critical_thinking', name:'Pensiero Critico', icon:'🔭',color:'#8b5cf6'},
  {id:'engineering',       name:'Ingegneria',       icon:'⚙️',color:'#00d4ff'},
  {id:'coding',            name:'Coding',           icon:'💻',color:'#4f8cff'},
  {id:'business',          name:'Business',         icon:'💼',color:'#fbbf24'},
  {id:'communication',     name:'Comunicazione',    icon:'🎙️',color:'#f59e0b'},
  {id:'creativity',        name:'Creatività',       icon:'🎨',color:'#ec4899'},
  {id:'music',             name:'Musica',           icon:'🎵',color:'#e879f9'},
  {id:'discipline',        name:'Disciplina',       icon:'⚡',color:'#10b981'},
  {id:'leadership',        name:'Leadership',       icon:'👑',color:'#d97706'},
  {id:'recovery',          name:'Recovery',         icon:'🌊',color:'#22c55e'},
];

// ══════════════════════════════════════════════════
// 13. ACHIEVEMENTS
// ══════════════════════════════════════════════════
const ACHIEVEMENTS = [
  {id:'first_step',   name:'PRIMO PASSO',         icon:'👣',rarity:'common',   color:'#10b981',desc:'Apri il Dungeon OS per la prima volta.'},
  {id:'awakened_ach', name:'IL RISVEGLIO',         icon:'⚡',rarity:'uncommon', color:'#c77dff',desc:'Raggiungi la forma Awakened.'},
  {id:'first_boss',   name:'PRIMO SANGUE',         icon:'⚔️',rarity:'uncommon', color:'#ef4444',desc:'Sconfiggi il tuo primo boss.'},
  {id:'streak_7',     name:'FIAMMA ACCESA',         icon:'🔥',rarity:'uncommon', color:'#f97316',desc:'Mantieni lo streak per 7 giorni.'},
  {id:'streak_30',    name:'FIAMMA PERENNE',        icon:'🏅',rarity:'rare',     color:'#fbbf24',desc:'Streak di 30 giorni consecutivi.'},
  {id:'streak_100',   name:'FIAMMA ETERNA',         icon:'💎',rarity:'legendary',color:'#7b2fff',desc:'Streak di 100 giorni. Leggenda assoluta.'},
  {id:'power_1000',   name:'POWER LEVEL 1000',      icon:'💥',rarity:'rare',     color:'#00e5ff',desc:'Raggiungi 1000 Power Level.'},
  {id:'power_10000',  name:'POWER LEVEL 10.000',    icon:'🌟',rarity:'epic',     color:'#ffd700',desc:'10.000 Power Level. Sei oltre i umani.'},
  {id:'all_worlds',   name:'ESPLORATORE COSMICO',   icon:'🌌',rarity:'epic',     color:'#7b2fff',desc:'Sblocca tutte le dimensioni.'},
  {id:'all_bosses',   name:'MASSACRATORE',          icon:'💀',rarity:'legendary',color:'#ff0040',desc:'Sconfiggi tutti gli 8 boss.'},
  {id:'galactic',     name:'GALACTIC ARCHITECT',    icon:'🚀',rarity:'legendary',color:'#7b2fff',desc:'Raggiungi la forma finale.'},
  {id:'army_1000',    name:'SIGNORE DELL\'ESERCITO',icon:'⚔️',rarity:'epic',     color:'#7b2fff',desc:"Esercito di 1000+ unità."},
  {id:'monarch_ach',  name:'MONARCA',               icon:'👑',rarity:'legendary',color:'#ff0040',desc:'Raggiungi la forma Monarch.'},
  {id:'all_relics',   name:'CACCIATORE DI RELIQUIE',icon:'🎒',rarity:'epic',     color:'#a78bfa',desc:'Ottieni tutte le reliquie leggendarie.'},
  {id:'senku',        name:'DR. STONE',             icon:'⚗️',rarity:'legendary',color:'#00ff88',desc:'Sblocca il Senku Protocol.'},
];

function computeUnlockedAchs(data,ds){
  const unlocked=[];
  const def=ds.defeatedBosses||[];
  const tf=getActiveTransformation(data,ds);
  const army=computeArmySize(data);
  const pl=Math.round(computePowerLevel(data)*(tf.powerMult||1));
  unlocked.push('first_step');
  if(['awakened','ascendant','monarch','cosmic_engineer','galactic_architect'].includes(tf.id))unlocked.push('awakened_ach');
  if(def.length>=1)unlocked.push('first_boss');
  if(data.streak>=7) unlocked.push('streak_7');
  if(data.streak>=30)unlocked.push('streak_30');
  if(data.streak>=100)unlocked.push('streak_100');
  if(pl>=1000)  unlocked.push('power_1000');
  if(pl>=10000) unlocked.push('power_10000');
  if(data.globalLevel>=100)unlocked.push('all_worlds');
  if(def.length>=BOSSES.length)unlocked.push('all_bosses');
  if(tf.id==='galactic_architect')unlocked.push('galactic');
  if(army>=1000)unlocked.push('army_1000');
  if(['monarch','cosmic_engineer','galactic_architect'].includes(tf.id))unlocked.push('monarch_ach');
  const relicCount=RELICS.filter(r=>isRelicUnlocked(r,data,ds)).length;
  if(relicCount>=RELICS.length)unlocked.push('all_relics');
  if(isTechUnlocked(TECHNIQUES.find(t=>t.id==='senku_protocol'),data,ds))unlocked.push('senku');
  return unlocked;
}

// ══════════════════════════════════════════════════
// 14. STORY CHAPTERS
// ══════════════════════════════════════════════════
const STORY_CHAPTERS = [
  {id:0,num:'PROLOGO',title:'IL RISVEGLIO',
   text:'"Nel buio prima dell\'alba, una voce: il tuo potenziale non è un sogno. È dati. Ogni ora investita è un livello guadagnato. Il Sistema ti ha scelto. Ora scegli tu."',
   objectives:[
     {text:'Completa la prima missione',key:'missions',threshold:1},
     {text:'Raggiungi il livello 1',    key:'level',   threshold:1},
   ],unlockLv:0},
  {id:1,num:'CAPITOLO I',title:'I PRIMI PASSI DEL HUNTER',
   text:'"La Foresta della Disciplina ti accoglie. Non è un luogo gentile. Ogni abitudine rotta lascia un\'impronta. Ogni giorno consistente forgia un guerriero."',
   objectives:[
     {text:'Livello 5+',     key:'level',   threshold:5},
     {text:'Streak 7 giorni',key:'streak',  threshold:7},
     {text:'20 Missioni',    key:'missions',threshold:20},
   ],unlockLv:1},
  {id:2,num:'CAPITOLO II',title:'LA FORGIA DEL CORPO',
   text:'"Le Montagne del Corpo non perdonano le scuse. Il dolore è temporaneo. Il cambiamento è permanente. FRAGILITAS ti osserva — e inizia ad avere paura."',
   objectives:[
     {text:'Forza Lv.20+',      key:'skill',skill:'strength',   threshold:20},
     {text:'Resistenza Lv.15+', key:'skill',skill:'endurance',  threshold:15},
     {text:'Streak 14 giorni',  key:'streak',threshold:14},
   ],unlockLv:10},
  {id:3,num:'CAPITOLO III',title:'L\'ACCADEMIA ARCANA',
   text:'"La conoscenza non si misura in credenziali. Si misura in connessioni neurali, pattern riconosciuti, sistemi compresi. NESCIENTIA trema."',
   objectives:[
     {text:'Focus Lv.30+',         key:'skill',skill:'focus',      threshold:30},
     {text:'Lettura Profonda Lv.25+',key:'skill',skill:'deep_reading',threshold:25},
     {text:'Livello 25+',           key:'level',threshold:25},
   ],unlockLv:20},
  {id:4,num:'CAPITOLO IV',title:'LA CITTADELLA DELL\'INGEGNERE',
   text:'"Il codice è il linguaggio dell\'universo. Ogni algoritmo è una legge fisica che hai imparato a piegare. Sei diventato pericoloso."',
   objectives:[
     {text:'Coding Lv.40+',      key:'skill',skill:'coding',     threshold:40},
     {text:'Ingegneria Lv.35+',  key:'skill',skill:'engineering',threshold:35},
     {text:'3+ Boss Sconfitti',  key:'bosses',threshold:3},
   ],unlockLv:35},
  {id:5,num:'CAPITOLO V — FINALE',title:'IL GALACTIC ARCHITECT',
   text:'"Non sei più una persona che studia, si allena, costruisce. Sei la somma di ogni ora investita, ogni limite infranto, ogni boss abbattuto. Il Galactic Nexus ti aspetta."',
   objectives:[
     {text:'Livello 100+',      key:'level', threshold:100},
     {text:'Streak 100 giorni', key:'streak',threshold:100},
     {text:'5+ Boss Sconfitti', key:'bosses',threshold:5},
   ],unlockLv:60},
];

// ══════════════════════════════════════════════════
// 15. DAILY QUESTS
// ══════════════════════════════════════════════════
function generateQuests(data){
  const today=new Date().toDateString();
  const ds=loadDungeon();
  if(ds.questsLastReset!==today){ds.questsLastReset=today;ds.questsCompleted=[];saveDungeon(ds);}
  const comp=ds.questsCompleted||[];
  const allQ=[
    {id:'q_study',   name:'Sessione di Studio',   icon:'📚',color:'#4f8cff',cat:'MENTE',    xp:80,
     desc:'Completa una sessione di studio oggi',done:data.todayDone>=1},
    {id:'q_3miss',   name:'Tripletta',             icon:'⚔️',color:'#ef4444',cat:'DISCIPLINA',xp:120,
     desc:'Completa 3 missioni oggi',            done:data.todayDone>=3},
    {id:'q_streak',  name:'Mantieni la Fiamma',    icon:'🔥',color:'#f97316',cat:'STREAK',   xp:60+data.streak*2,
     desc:`Streak attivo (${data.streak} giorni)`,done:data.streak>0},
    {id:'q_boss',    name:'Studia il Boss',         icon:'💀',color:'#ff0040',cat:'DUNGEON',  xp:50,
     desc:'Visita la scheda Boss',               done:comp.includes('q_boss')},
    {id:'q_power',   name:'Controlla il Power Level',icon:'💠',color:'#c77dff',cat:'DUNGEON',xp:40,
     desc:'Visita il pannello Power',            done:comp.includes('q_power')},
    {id:'q_5miss',   name:'Campione del Giorno',   icon:'🏆',color:'#ffd700',cat:'DISCIPLINA',xp:200,
     desc:'Completa 5 missioni oggi',            done:data.todayDone>=5},
    {id:'q_world',   name:'Esplora un Mondo',       icon:'🌌',color:'#7b2fff',cat:'DUNGEON',  xp:70,
     desc:'Visita la mappa dei Mondi',           done:comp.includes('q_world')},
    {id:'q_army',    name:'Ispeziona l\'Esercito',  icon:'👥',color:'#7b2fff',cat:'ESERCITO', xp:60,
     desc:'Visita il pannello Esercito',         done:comp.includes('q_army')},
    {id:'q_tech',    name:'Usa una Tecnica',        icon:'⚡',color:'#00ff88',cat:'POTERE',   xp:90,
     desc:'Visita il pannello Tecniche',         done:comp.includes('q_tech')},
  ];
  const seed=new Date().toDateString().split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  return [...allQ].sort((a,b)=>((seed*a.id.length)%97)-((seed*b.id.length)%97)).slice(0,6);
}

// ══════════════════════════════════════════════════
// 16. RENDER FUNCTIONS
// ══════════════════════════════════════════════════

// ── HUD ──
function renderHUD(data,ds){
  const tf=getActiveTransformation(data,ds);
  const rank=getActiveRank(data.globalLevel);
  const pl=Math.round(computePowerLevel(data)*(tf.powerMult||1));
  const army=computeArmySize(data);

  // Avatar
  $('char-avatar').textContent=tf.icon;
  $('char-avatar').style.borderColor=tf.color;
  $('char-avatar').style.boxShadow=`0 0 30px ${tf.color}50`;
  $('char-rank-label').style.color=rank.color;
  $('char-rank-label').textContent=rank.name;
  $('char-name').textContent='POLIMATA';
  $('char-class-badge').textContent=`◈ ${tf.name} ◈`;
  $('char-class-badge').style.borderColor=tf.color;
  $('char-class-badge').style.color=tf.color;
  $('power-level').textContent=fmtNum(pl);
  $('transform-banner').textContent=`◈ FORMA ATTIVA: ${tf.name} — MOLTIPLICATORE: ×${tf.powerMult} — ESERCITO: ${fmtNum(army)} UNITÀ ◈`;

  const {pct}=lvProgress(data.totalXp);
  const hudStats=[
    {label:'LIVELLO',val:data.globalLevel,pct,sc:'#00e5ff'},
    {label:'XP TOTALE',val:fmtNum(data.totalXp),pct:Math.min(100,(data.totalXp/100000)*100),sc:'#c77dff'},
    {label:'STREAK 🔥',val:data.streak+'d',pct:Math.min(100,(data.streak/100)*100),sc:'#f97316'},
    {label:'MISSIONI',val:data.totalDone,pct:Math.min(100,(data.totalDone/500)*100),sc:'#ffd700'},
  ];
  $('hud-stats').innerHTML=hudStats.map(s=>`
    <div class="hud-stat" style="--sc:${s.sc}">
      <div class="hud-stat-val">${s.val}</div>
      <div class="hud-stat-label">${s.label}</div>
      <div class="hud-stat-bar"><div class="hud-stat-fill" style="width:${s.pct}%"></div></div>
    </div>`).join('');
}

// ── STATUS ──
function renderStatus(data,ds){
  const tf=getActiveTransformation(data,ds);
  const pl=Math.round(computePowerLevel(data)*(tf.powerMult||1));
  const army=computeArmySize(data);
  const rank=getActiveRank(data.globalLevel);
  const {pct}=lvProgress(data.totalXp);

  const cards=[
    {icon:'⚡',val:fmtNum(pl),        label:'POWER LEVEL',       pct:Math.min(100,(pl/100000)*100),  sc:'#00e5ff'},
    {icon:'🌌',val:tf.name,           label:'FORMA ATTIVA',       pct:100,                             sc:tf.color},
    {icon:'👑',val:rank.name,         label:'TITOLO ATTUALE',     pct:Math.min(100,(data.globalLevel/100)*100),sc:rank.color},
    {icon:'👥',val:fmtNum(army),      label:'DIMENSIONE ESERCITO',pct:Math.min(100,(army/10000)*100),  sc:'#7b2fff'},
    {icon:'🎯',val:data.globalLevel,  label:'LIVELLO GLOBALE',    pct,                                  sc:'#c77dff'},
    {icon:'🔥',val:data.streak+'d',   label:'STREAK',             pct:Math.min(100,(data.streak/100)*100),sc:'#f97316'},
    {icon:'💀',val:(ds.defeatedBosses||[]).length+'/'+BOSSES.length,label:'BOSS SCONFITTI',pct:((ds.defeatedBosses||[]).length/BOSSES.length)*100,sc:'#ff0040'},
    {icon:'📊',val:fmtNum(data.totalXp),label:'XP TOTALE',       pct:Math.min(100,(data.totalXp/200000)*100),sc:'#ffd700'},
    {icon:'🌊',val:data.recovScore||'—',label:'RECOVERY SCORE',  pct:Math.min(100,(data.recovScore||0)/100*100),sc:'#00ff88'},
    {icon:'📋',val:data.totalDone,    label:'MISSIONI TOTALI',    pct:Math.min(100,(data.totalDone/500)*100),sc:'#4f8cff'},
  ];

  $('panel-status').innerHTML=`
    <div class="sec-title">ANIMATED STATUS HUD <span class="accent">— LIVE DATA</span></div>
    <div class="status-grid">${cards.map(c=>`
      <div class="stat-card" style="--sc:${c.sc}">
        <div class="stat-icon">${c.icon}</div>
        <div class="stat-val">${c.val}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-bar"><div class="stat-fill" style="width:${c.pct}%"></div></div>
      </div>`).join('')}
    </div>
    <div style="background:rgba(0,229,255,0.03);border:1px solid rgba(0,229,255,0.1);padding:16px;margin-top:4px;border-left:3px solid ${tf.color}">
      <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:4px;color:${tf.color};margin-bottom:8px">◈ FORMA ATTUALE: ${tf.name}</div>
      <div style="font-size:10px;color:var(--text2);font-style:italic;line-height:1.9">${tf.flavor}</div>
      <div style="margin-top:10px;font-size:8px;color:var(--text3);letter-spacing:2px">MOLTIPLICATORE POWER: ×${tf.powerMult} &nbsp;|&nbsp; POWER LEVEL EFFETTIVO: ${fmtNum(pl)}</div>
    </div>`;
}

// ── POWER SYSTEM ──
function renderPower(data){
  const s=data.skills;
  $('panel-power').innerHTML=`<div class="sec-title">SISTEMA DEI POTERI</div>
    <div class="power-grid">${POWERS.map(p=>{
      const val=p.formula(s,data);
      const max=Math.max(1000,val*1.5);
      const pct=Math.min(100,(val/max)*100);
      return`<div class="power-card" style="--pc:${p.color}">
        <div class="pc-top">
          <div class="pc-icon">${p.icon}</div>
          <div class="pc-tag">${p.tag}</div>
        </div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-val">${fmtNum(val)}</div>
        <div class="pc-bar"><div class="pc-fill" style="width:${pct}%;background:${p.color};box-shadow:0 0 6px ${p.color}"></div></div>
        <div class="pc-desc">${p.desc}</div>
      </div>`;
    }).join('')}</div>`;
  markQuestDone('q_power');
}

// ── TRANSFORMATIONS ──
function renderTransforms(data,ds){
  $('panel-transforms').innerHTML=`<div class="sec-title">FORME DI TRASFORMAZIONE</div>
    <div class="tf-grid">${TRANSFORMATIONS.map(tf=>{
      const reqs=tf.requirements.map(r=>({...r,...checkTransformReq(r,data,ds)}));
      const unlocked=tf.always||reqs.every(r=>r.met);
      return`<div class="tf-card ${unlocked?'tf-unlocked':'tf-locked'}" style="--tc:${tf.color}">
        <div class="tf-head">
          <span class="tf-form-icon">${tf.icon}</span>
          <div class="tf-name">${tf.name}</div>
          <div class="tf-sub">${tf.subtitle}</div>
        </div>
        <div class="tf-body">
          <div class="tf-flavor">${tf.flavor}</div>
          ${reqs.length?`<div class="tf-reqs">${reqs.map(r=>`
            <div class="tf-req">
              <span class="tf-req-name" style="color:${r.met?'#00ff88':'var(--text2)'}">${r.met?'✓':''} ${r.label}</span>
              <div class="tf-req-prog">
                <div class="tf-req-bar"><div class="tf-req-fill" style="width:${r.pct}%"></div></div>
                <span class="tf-req-pct">${r.pct}%</span>
              </div>
            </div>`).join('')}</div>`:''}
          <div style="margin-top:8px;font-size:8px;color:var(--text2)">MOLTIPLICATORE: <span style="color:${tf.color};font-family:'Orbitron',monospace">×${tf.powerMult}</span></div>
          <div class="tf-status ${unlocked?'s-unlocked':'s-locked'}">${unlocked?'✓ SBLOCCATA':'🔒 BLOCCATA'}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
}

// ── TECHNIQUES ──
function renderTechniques(data,ds){
  $('panel-techniques').innerHTML=`<div class="sec-title">TECNICHE SPECIALI</div>
    <div class="tech-grid">${TECHNIQUES.map(t=>{
      const unlocked=isTechUnlocked(t,data,ds);
      const power=t.power(data);
      return`<div class="tech-card ${unlocked?'':'tech-locked'}" style="--tc:${t.color}">
        <div class="tech-top">
          <div class="tech-icon">${t.icon}</div>
          <div class="tech-meta">
            <div class="tech-name">${t.name}</div>
            <div class="tech-type">${t.type}</div>
          </div>
        </div>
        <div class="tech-power">${fmtNum(power)}</div>
        <div class="tech-desc">${t.desc}</div>
        <div class="tech-cost">COSTO: ${t.cost}</div>
        ${!unlocked?`<div style="margin-top:6px;font-size:7px;color:var(--text3)">🔒 ${t.unlock?.key==='skill'?`${t.unlock.skill} Lv.${t.unlock.threshold}+`:t.unlock?.key==='level'?`Livello ${t.unlock.threshold}+`:t.unlock?.key==='streak'?`Streak ${t.unlock.threshold}d`:t.unlock?.key==='bosses'?`${t.unlock.threshold} boss sconfitti`:''}</div>`:''}
      </div>`;
    }).join('')}</div>`;
  markQuestDone('q_tech');
}

// ── ARMY ──
function renderArmy(data,ds){
  const army=computeArmySize(data);
  $('panel-army').innerHTML=`<div class="sec-title">SISTEMA DI EVOCAZIONE</div>
    <div class="army-banner">
      <span class="army-count">${fmtNum(army)}</span>
      <div class="army-label">UNITÀ NELL'ESERCITO DEL POLIMATA</div>
    </div>
    <div class="summon-grid">${SUMMONS.map(s=>{
      const locked=s.unlock&&(()=>{const u=s.unlock;if(u.key==='streak')return data.streak<u.threshold;if(u.key==='skill')return xpToLevel(data.skills[u.skill]||0)<u.threshold;return false;})();
      const count=locked?0:s.formula(data,ds);
      return`<div class="summon-card ${locked?'s-locked':'s-active'}" style="--sc:${s.color}">
        <span class="summon-icon">${s.icon}</span>
        <div class="summon-name">${s.name}</div>
        <div class="summon-count">${fmtNum(count)}</div>
        <div class="summon-sub">unità attive</div>
        <div class="summon-unlock-info">${locked?`🔒 ${s.unlock.key==='streak'?`Streak ${s.unlock.threshold}d+`:`${s.unlock.skill} Lv.${s.unlock.threshold}+`}`:s.desc}</div>
      </div>`;
    }).join('')}</div>`;
  markQuestDone('q_army');
}

// ── WORLDS ──
function renderWorlds(data,ds){
  const lv=data.globalLevel;
  const map=$('panel-worlds');
  map.innerHTML=`<div class="sec-title">DIMENSIONI & MONDI</div>
    <div class="world-map" id="world-map" style="min-height:480px">
      <div class="world-bg"></div>
      <div class="world-header">REGNO DEL POLIMATA — MULTIVERSE</div>
    </div>
    <div id="world-detail-container"></div>`;
  const wmap=document.getElementById('world-map');
  WORLDS.forEach(w=>{
    const unlocked=lv>=w.unlockLv;
    const isActive=ds.activeWorld===w.id;
    const node=document.createElement('div');
    node.className=`world-node ${isActive?'w-active':''}`;
    node.style.cssText=`left:${w.x};top:${w.y};--wc:${w.color}`;
    node.innerHTML=`<div class="world-hex ${unlocked?'wh-unlocked':'wh-locked'}">${w.icon}</div>
      <div class="world-name" style="color:${unlocked?w.color:'var(--text3)'}">${w.name}</div>
      <div class="world-lv">LV.${w.unlockLv}+</div>`;
    node.onclick=()=>unlocked?showWorldDetail(w,data,ds):showToast(`🔒 Sblocca al Livello ${w.unlockLv}`);
    wmap.appendChild(node);
  });
  markQuestDone('q_world');
}

function showWorldDetail(world,data,ds){
  const container=document.getElementById('world-detail-container');
  const wBosses=BOSSES.filter(b=>b.world===world.id);
  container.innerHTML=`<div class="world-detail">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:${world.color}">${world.icon} ${world.name}</div>
        <div style="font-size:8px;color:var(--text2);margin-top:3px">${world.desc}</div>
      </div>
      <div style="font-size:8px;letter-spacing:2px;color:var(--text3)">LV.${world.unlockLv}+</div>
    </div>
    <div style="font-size:9px;letter-spacing:3px;color:var(--cyan);margin-bottom:8px;font-family:'Cinzel',serif">⚔ DUNGEON</div>
    <div class="dung-list">${world.dungeons.map(d=>{
      const xp=data.skills[d.skill]||0;
      const sl=xpToLevel(xp);
      const pct=lvProgress(xp).pct;
      return`<div class="dung-item" style="--dc:${d.color}">
        <div class="dung-name">${d.id.replace(/-/g,' ').toUpperCase()}</div>
        <span class="diff-tag diff-${d.diff}">${d.diff.toUpperCase()}</span>
        <div class="dung-skill">${SKILL_DEFS.find(s=>s.id===d.skill)?.icon||''} ${d.skill}</div>
        <div class="dung-bar"><div class="dung-fill" style="width:${pct}%;background:${d.color}"></div></div>
        <div class="dung-lbl"><span>Lv.${sl}</span><span>${pct}%</span></div>
      </div>`;
    }).join('')}</div>
    ${wBosses.length?`<div style="font-size:9px;letter-spacing:3px;color:var(--crimson);margin:12px 0 8px;font-family:'Cinzel',serif">💀 BOSS IN QUESTA DIMENSIONE</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${wBosses.map(b=>{
      const def=(ds.defeatedBosses||[]).includes(b.id);
      return`<div style="padding:8px 14px;border:1px solid ${def?'#00ff88':b.color};color:${def?'#00ff88':b.color};font-size:9px;font-family:'Cinzel',serif;cursor:pointer;background:rgba(0,0,0,0.4)" onclick="switchTab('bosses')">${b.icon} ${b.name.split(',')[0]} ${def?'✓':''}</div>`;
    }).join('')}</div>`:''}
  </div>`;
  // update active world
  const state=loadDungeon();state.activeWorld=world.id;saveDungeon(state);
}

// ── BOSSES ──
function renderBosses(data,ds){
  const def=ds.defeatedBosses||[];
  const activeBoss=BOSSES.find(b=>!def.includes(b.id));
  let html=`<div class="sec-title">BOSS CINEMATICI</div>`;

  if(activeBoss){
    const hpPct=computeBossHP(activeBoss,data,ds);
    html+=`<div class="boss-arena" style="--bc:${activeBoss.color}">
      <div class="boss-portrait" style="border-color:${activeBoss.color};box-shadow:0 0 50px ${activeBoss.color}60">${activeBoss.icon}</div>
      <div class="boss-name" style="color:${activeBoss.color}">${activeBoss.name}</div>
      <div class="boss-title-lbl">${activeBoss.title}</div>
      <div class="hp-wrap">
        <div class="hp-labels"><span>HP DEL BOSS</span><span style="color:${activeBoss.color}">${Math.round(hpPct)}%</span></div>
        <div class="hp-outer"><div class="hp-fill" style="width:${hpPct}%;background:linear-gradient(90deg,${activeBoss.color},${activeBoss.color}99)"></div></div>
      </div>
      <div class="boss-lore">"${activeBoss.lore}"</div>
      <div class="boss-reqs">
        <div class="boss-req-title">REQUISITI PER SCONFIGGERLO</div>
        ${activeBoss.requirements.map(r=>{
          let cur=0,needed=r.threshold||0;
          if(r.key==='level')   cur=data.globalLevel;
          else if(r.key==='streak')  cur=data.streak;
          else if(r.key==='missions')cur=data.totalDone;
          else if(r.key==='bosses')  cur=def.length;
          else if(r.key==='skill')   cur=xpToLevel(data.skills[r.skill]||0);
          const met=cur>=needed;
          return`<div class="boss-req-row">
            <span class="req-lbl">${r.label}</span>
            <span class="${met?'req-met':'req-unmet'}">${met?'✓ SODDISFATTO':`${cur}/${needed}`}</span>
          </div>`;
        }).join('')}
      </div>
      ${hpPct<=0?`<button class="boss-btn" onclick="defeatBoss('${activeBoss.id}')">⚔ SCONFIGGI ${activeBoss.name.split(',')[0]}</button>`:`<div style="text-align:center;font-size:8px;color:var(--text2);letter-spacing:3px;padding:8px">★ SODDISFA I REQUISITI PER ABBATTERE L'HP A ZERO ★</div>`}
    </div>`;
  }

  html+=`<div style="margin-top:20px"><div class="sec-title">TUTTI I BOSS</div>
    <div class="boss-grid">${BOSSES.map(b=>{
      const isDef=def.includes(b.id);
      return`<div class="boss-mini" style="border-color:${isDef?'#00ff8844':b.color+'33'};background:${isDef?'rgba(0,255,136,0.02)':'rgba(0,0,0,0.3)'}">
        <div class="boss-mini-top">
          <span class="boss-mini-icon">${b.icon}</span>
          <div>
            <div class="boss-mini-name" style="color:${isDef?'#00ff88':b.color}">${b.name.split(',')[0]}</div>
            <div class="boss-mini-title">${b.title}</div>
          </div>
        </div>
        ${isDef?`<div style="font-size:8px;color:var(--text2);font-style:italic;margin-top:4px">"${b.deathQuote}"</div>`:''}
        <div class="boss-mini-badge" style="border-color:${isDef?'#00ff88':b.color+'66'};color:${isDef?'#00ff88':b.color}">${isDef?'SCONFITTO':'ATTIVO'}</div>
      </div>`;
    }).join('')}</div></div>`;

  $('panel-bosses').innerHTML=html;
  markQuestDone('q_boss');
}

function computeBossHP(boss,data,ds){
  const def=ds.defeatedBosses||[];
  const total=boss.requirements.length;
  let met=0;
  boss.requirements.forEach(r=>{
    let ok=false;
    if(r.key==='level')   ok=data.globalLevel>=r.threshold;
    else if(r.key==='streak')  ok=data.streak>=r.threshold;
    else if(r.key==='missions')ok=data.totalDone>=r.threshold;
    else if(r.key==='bosses')  ok=def.length>=r.threshold;
    else if(r.key==='skill')   ok=xpToLevel(data.skills[r.skill]||0)>=r.threshold;
    if(ok)met++;
  });
  return Math.max(0,100-(met/total)*100);
}

function defeatBoss(bossId){
  const ds=loadDungeon();
  if(!(ds.defeatedBosses||[]).includes(bossId)){
    ds.defeatedBosses=[...(ds.defeatedBosses||[]),bossId];
    saveDungeon(ds);
    const boss=BOSSES.find(b=>b.id===bossId);
    battleFlash();
    showToast(`⚔ ${boss.name.split(',')[0]} SCONFITTO! +${boss.reward.xp} XP`);
    setTimeout(()=>{const d=loadPolyData();renderHUD(d,ds);renderBosses(d,ds);},1200);
  }
}

// ── PATHS ──
function renderPaths(data){
  $('panel-paths').innerHTML=`<div class="sec-title">PERCORSI ANIME</div>
    <div class="path-grid">${SKILL_PATHS.map(path=>{
      const skillLvs=path.skills.map(sk=>xpToLevel(data.skills[sk]||0));
      const avgLv=Math.round(skillLvs.reduce((a,b)=>a+b,0)/skillLvs.length);
      const currentNode=path.nodes.reduce((best,n)=>avgLv>=n.lv?n:best,path.nodes[0]);
      return`<div class="path-card" style="--pc:${path.color}">
        <div class="path-head">
          <div class="path-icon">${path.icon}</div>
          <div class="path-meta">
            <div class="path-name">${path.name}</div>
            <div class="path-prog">Media skill: Lv.${avgLv} — ${currentNode.name}</div>
          </div>
        </div>
        <div style="font-size:8px;color:var(--text2);margin-bottom:10px">${path.desc}</div>
        <div class="path-nodes">${path.nodes.map(n=>{
          const done=avgLv>n.lv;
          const active=currentNode.name===n.name;
          return`<div class="path-node ${done?'pn-done':active?'pn-active':''}">
            <span class="pn-icon">${n.icon}</span>
            <span class="pn-name">${n.name}</span>
            <span class="pn-lv">Lv.${n.lv}+</span>
            ${done?'<span class="pn-check">✓</span>':''}
          </div>`;
        }).join('')}</div>
      </div>`;
    }).join('')}</div>`;
}

// ── RELICS ──
function renderRelics(data,ds){
  const rarityColors={common:'#6b7280',uncommon:'#10b981',rare:'#4f8cff',epic:'#a78bfa',legendary:'#ffd700'};
  $('panel-relics').innerHTML=`<div class="sec-title">RELIQUIE LEGGENDARIE</div>
    <div class="relic-grid">${RELICS.map(r=>{
      const unlocked=isRelicUnlocked(r,data,ds);
      const col=r.color||rarityColors[r.rarity]||'#6b7280';
      return`<div class="relic-card ${r.rarity==='legendary'?'rl-legendary':''} ${unlocked?'':'relic-locked'}" style="--rc:${col};border-color:${unlocked?col+'66':'var(--border)'}">
        <span class="relic-icon">${r.icon}</span>
        <div class="relic-name">${r.name}</div>
        <div class="relic-rarity">${r.rarity.toUpperCase()}</div>
        <div class="relic-desc">${unlocked?r.desc:'???'}</div>
        ${unlocked?`<div class="relic-bonus">${r.bonus}</div>`:''}
      </div>`;
    }).join('')}</div>`;
}

// ── TITLES ──
function renderTitles(data){
  const lv=data.globalLevel;
  const rank=getActiveRank(lv);
  $('panel-titles').innerHTML=`<div class="sec-title">TITOLI & GRADI</div>
    <div class="title-current">
      <span class="active-title-name">${rank.name}</span>
      <div class="active-title-sub">${rank.desc}</div>
    </div>
    <div class="rank-ladder">${RANKS.map(r=>{
      const state=lv>=r.lv?(lv>r.lv&&RANKS[RANKS.indexOf(r)+1]&&lv>=RANKS[RANKS.indexOf(r)+1].lv?'rk-passed':'rk-current'):'rk-future';
      return`<div class="rank-item ${state}" style="--rcolor:${r.color}">
        <div class="rank-icon">${r.icon}</div>
        <div class="rank-name" style="color:${r.color}">${r.name}</div>
        <div class="rank-lv">LV.${r.lv}+</div>
      </div>`;
    }).join('')}</div>`;
}

// ── STORY ──
function renderStory(data,ds){
  const def=ds.defeatedBosses||[];
  const tf=getActiveTransformation(data,ds);
  $('panel-story').innerHTML=`<div class="sec-title">STORIA — CAPITOLI</div>
    <div class="story-intro">
      <div class="story-intro-title">✦ CRONACA DEL POLIMATA ✦</div>
      <div class="story-text">Anno ${new Date().getFullYear()}. Livello globale ${data.globalLevel}. Streak: ${data.streak} giorni. ${data.totalDone} missioni completate. Forma attiva: <span style="color:${tf.color}">${tf.name}</span>. Power Level: <span style="color:var(--gold)">${fmtNum(Math.round(computePowerLevel(data)*(tf.powerMult||1)))}</span>. Il viaggio del Polimata è scritto nei dati — ogni XP è un passo, ogni boss abbattuto è un capitolo concluso.</div>
    </div>
    <div class="story-timeline">${STORY_CHAPTERS.map(ch=>{
      const unlocked=data.globalLevel>=ch.unlockLv;
      const objs=ch.objectives.map(o=>{
        let done=false;
        if(o.key==='level')   done=data.globalLevel>=o.threshold;
        if(o.key==='streak')  done=data.streak>=o.threshold;
        if(o.key==='missions')done=data.totalDone>=o.threshold;
        if(o.key==='skill')   done=xpToLevel(data.skills[o.skill]||0)>=o.threshold;
        if(o.key==='bosses')  done=def.length>=o.threshold;
        return{...o,done};
      });
      const allDone=objs.every(o=>o.done);
      const cls=!unlocked?'ch-locked':allDone?'ch-done':'ch-active';
      const badge=!unlocked?'cb-locked':allDone?'cb-done':'cb-active';
      const label=!unlocked?'BLOCCATO':allDone?'COMPLETATO':'IN CORSO';
      return`<div class="story-ch ${cls}">
        <div class="ch-head">
          <div><div class="ch-num">${ch.num}</div><div class="ch-title">${ch.title}</div></div>
          <span class="ch-badge ${badge}">${label}</span>
        </div>
        ${unlocked?`<div class="ch-text">${ch.text}</div>
        <div class="ch-objs">${objs.map(o=>`<div class="ch-obj ${o.done?'obj-done':''}">${o.text}</div>`).join('')}</div>`:`<div style="font-size:8px;color:var(--text3);letter-spacing:2px">Sblocca al Livello ${ch.unlockLv}</div>`}
      </div>`;
    }).join('')}</div>`;
}

// ── DESTINY ──
function renderDestiny(data,ds){
  const tf=getActiveTransformation(data,ds);
  const pl=Math.round(computePowerLevel(data)*(tf.powerMult||1));
  const army=computeArmySize(data);
  const rank=getActiveRank(data.globalLevel);
  // Projection: at current streak pace, days to next rank
  const nextRank=RANKS.find(r=>r.lv>data.globalLevel)||RANKS[RANKS.length-1];
  const xpPerDay=data.streak>0?Math.round(data.totalXp/Math.max(1,data.streak)):100;
  const xpToNext=xpForLevel(nextRank.lv)-data.totalXp;
  const daysToNext=xpToNext>0&&xpPerDay>0?Math.ceil(xpToNext/xpPerDay):0;
  // Planetary influence
  const influence=Math.min(100,Math.round((data.globalLevel/100)*40+(data.streak/100)*30+(army/10000)*20+(pl/100000)*10));

  $('panel-destiny').innerHTML=`<div class="sec-title">SISTEMA DEL DESTINO</div>
    <div class="destiny-panel">
      <div class="destiny-title">PROIEZIONE DEL FUTURO</div>
      <div style="font-size:7px;letter-spacing:4px;color:var(--text2);text-align:center;margin-bottom:18px;text-transform:uppercase">Basato sui tuoi dati reali attuali</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:18px">
        ${[
          {icon:'⚡',val:fmtNum(pl),    label:'POWER LEVEL ATTUALE',sc:'#00e5ff'},
          {icon:'📅',val:daysToNext>0?daysToNext+'g':'<1g',label:`GIORNI AL RANGO: ${nextRank.name}`,sc:nextRank.color},
          {icon:'🌍',val:influence+'%', label:'INFLUENZA PLANETARIA',sc:'#7b2fff'},
          {icon:'👥',val:fmtNum(army),  label:'ESERCITO PROIETTATO', sc:'#c77dff'},
          {icon:'📈',val:fmtNum(xpPerDay),label:'XP/GIORNO (MEDIA)', sc:'#ffd700'},
          {icon:'🎯',val:tf.name,       label:'FORMA ATTIVA',         sc:tf.color},
        ].map(m=>`<div style="background:rgba(0,0,0,0.5);border:1px solid var(--border);padding:12px;text-align:center;--dmc:${m.sc}">
          <div style="font-size:20px;margin-bottom:5px">${m.icon}</div>
          <div style="font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:${m.sc};margin-bottom:2px">${m.val}</div>
          <div style="font-size:7px;letter-spacing:2px;color:var(--text2)">${m.label}</div>
        </div>`).join('')}
      </div>
      <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(0,229,255,0.12);border-left:3px solid var(--cyan);padding:16px">
        <div style="font-size:8px;letter-spacing:3px;color:var(--cyan);margin-bottom:10px;text-transform:uppercase;font-family:'Cinzel',serif">◈ PROFEZIA DEL SISTEMA</div>
        <div style="font-size:10px;color:var(--text2);line-height:1.9">${generateProphecy(data,ds,daysToNext,nextRank,pl,army)}</div>
      </div>
    </div>`;
}

function generateProphecy(data,ds,daysToNext,nextRank,pl,army){
  const tf=getActiveTransformation(data,ds);
  const def=ds.defeatedBosses||[];
  if(data.globalLevel>=100) return `"Il Galactic Architect è già emerso. Non esiste più un limite superiore da raggiungere — solo universi da costruire. L'esercito di ${fmtNum(army)} unità aspetta i tuoi ordini."`;
  if(data.globalLevel>=60)  return `"Il Monarch è a ${daysToNext} giorni dal titolo di ${nextRank.name}. Con uno streak di ${data.streak} giorni, il Power Level raggiungerà ${fmtNum(pl*2)} alla prossima trasformazione."`;
  if(data.streak>=30)       return `"${data.streak} giorni di streak consecutivi. Il Sistema ha calcolato: se mantieni questo ritmo, raggiungerai il rango ${nextRank.name} in ${daysToNext} giorni. Il Chaos Emperor inizia a notarti."`;
  if(data.streak>=7)        return `"La fiamma dello streak arde da ${data.streak} giorni. Non spegnerla. Ogni giorno è un mattone del futuro. Il tuo esercito cresce: ${fmtNum(army)} unità fedeli."`;
  return `"Sei agli inizi, ma il Sistema ti ha già scelto. Il tuo potenziale è reale — non è ancora stato dimostrato. Ogni giorno investito moltiplica il Power Level. Continua."`;
}

// ── QUESTS ──
function renderQuests(data){
  const quests=generateQuests(data);
  const now=new Date(),midnight=new Date(now);midnight.setHours(24,0,0,0);
  const diff=midnight-now,hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000);
  const done=quests.filter(q=>q.done).length;
  const catColors={'MENTE':'#4f8cff','DISCIPLINA':'#ef4444','STREAK':'#f97316','DUNGEON':'#c77dff','ESERCITO':'#7b2fff','POTERE':'#00ff88'};
  $('panel-quests').innerHTML=`<div class="sec-title">MISSIONI GIORNALIERE</div>
    <div class="quest-meta">
      <div class="quest-timer">⏱ RESET IN ${hh}h ${mm}m</div>
      <div class="quest-prog">${done}/${quests.length} COMPLETATE</div>
    </div>
    <div class="quest-list">${quests.map(q=>`
      <div class="quest-item ${q.done?'q-done':''}" style="--qc:${catColors[q.cat]||'var(--cyan)'}">
        <div class="quest-stripe"></div>
        <div class="quest-ico">${q.icon}</div>
        <div class="quest-body">
          <div class="quest-name">${q.name}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-cat">${q.cat}</div>
        </div>
        <div class="quest-reward">
          <div class="quest-xp">+${q.xp}</div>
          <div class="quest-xp-lbl">XP</div>
        </div>
        ${q.done?'<div class="quest-done-stamp">✓ DONE</div>':''}
      </div>`).join('')}
    </div>`;
}

// ── ACHIEVEMENTS ──
function renderAchievements(data,ds){
  const unlocked=computeUnlockedAchs(data,ds);
  const rarityColor={common:'#6b7280',uncommon:'#10b981',rare:'#4f8cff',epic:'#a78bfa',legendary:'#ffd700'};
  let filter='all';
  function draw(){
    const items=ACHIEVEMENTS.filter(a=>filter==='all'?true:filter==='unlocked'?unlocked.includes(a.id):!unlocked.includes(a.id))
      .sort((a,b)=>(unlocked.includes(a.id)?0:1)-(unlocked.includes(b.id)?0:1));
    document.getElementById('ach-grid-inner').innerHTML=items.map(a=>{
      const isU=unlocked.includes(a.id);
      const col=a.color||rarityColor[a.rarity]||'#6b7280';
      return`<div class="ach-item ${isU?'a-unlocked':'a-locked'}" style="--ac:${col}">
        <div class="ach-orb">${a.icon}</div>
        <div class="ach-body">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-rarity">${a.rarity.toUpperCase()}</div>
        </div>
      </div>`;
    }).join('');
  }
  $('panel-achievements').innerHTML=`<div class="sec-title">TRAGUARDI EPICI</div>
    <div class="ach-filter">
      <button class="ach-btn active" data-af="all" onclick="setAchFilter(this,'all')">TUTTI</button>
      <button class="ach-btn" data-af="unlocked" onclick="setAchFilter(this,'unlocked')">SBLOCCATI</button>
      <button class="ach-btn" data-af="locked" onclick="setAchFilter(this,'locked')">BLOCCATI</button>
    </div>
    <div class="ach-grid" id="ach-grid-inner"></div>`;
  window.setAchFilter=(btn,f)=>{
    document.querySelectorAll('.ach-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');filter=f;draw();
  };
  draw();
}

// ══════════════════════════════════════════════════
// 17. QUEST TRACKING
// ══════════════════════════════════════════════════
function markQuestDone(id){
  const ds=loadDungeon();
  if(!(ds.questsCompleted||[]).includes(id)){
    ds.questsCompleted=[...(ds.questsCompleted||[]),id];
    saveDungeon(ds);
  }
}

// ══════════════════════════════════════════════════
// 18. TABS ENGINE
// ══════════════════════════════════════════════════
// switchTab defined below in UNIFIED INIT

// ══════════════════════════════════════════════════

// CLASS CODEX MODULE — Sistema Classi & Nemici
// Appended to dungeon.js — non tocca nulla di esistente
// ══════════════════════════════════════════════════════════════════════════════

// ── Storage keys ──
const CODEX_KEYS = {
  classes:     'polylife_dungeon_classes',
  enemyCodex:  'polylife_dungeon_enemy_codex',
  matchups:    'polylife_dungeon_matchups',
};
function loadClasses()  { return ls.get(CODEX_KEYS.classes)   || { activeClass: 'athena', xp: {} }; }
function saveClasses(s) { ls.set(CODEX_KEYS.classes, s); }

// ══════════════════════════════════════════════════════════════════════════════
// CLASS DEFINITIONS — 6 classi originali PolyLife
// ══════════════════════════════════════════════════════════════════════════════
const CLASSES = [
  {
    id: 'titan',
    name: 'TITAN',
    archetype: 'Tank / Custode',
    role: 'PROTEZIONE DEL SISTEMA',
    icon: '🛡️',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg,#ef4444,#dc2626)',
    desc: 'Il Titan è la roccia su cui poggia tutto il sistema. Disciplina assoluta, corpo come fortezza, resilienza che non cede mai. Mentre gli altri avanzano, il Titan tiene il fronte.',
    mainStats: ['strength', 'endurance', 'discipline'],
    xpSources: [
      { label: 'Allenamento fisico completato', key: 'strength', mult: 1.5 },
      { label: 'LEO Protocol rispettato', key: 'discipline', mult: 2.0 },
      { label: 'Recovery Center', key: 'recovery', mult: 1.2 },
    ],
    passive: {
      name: 'Fortezza Vivente',
      desc: 'Ogni giorno di streak aggiunge +2% resistenza ai debuff nemici. Stack massimo: +100% (50 giorni).',
      type: 'passive',
    },
    actives: [
      { name: 'Muro di Ferro', desc: 'Blocca il prossimo attacco nemico (task fallita). Ricarica: 24h.', cost: '100 Endurance', type: 'active', unlockStreak: 7 },
      { name: 'Grido del Titan', desc: 'Aumenta la produttività di tutte le classi del 20% per 2 ore. Attivabile dopo 5 missioni consecutive.', cost: '200 Ki + 150 Discipline', type: 'active', unlockStreak: 14 },
    ],
    ultimate: { name: 'UNBREAKABLE', desc: 'Per 1 settimana, nessuna task fallita conta come debuff. Richiede: streak 30+ e strength Lv.50+.', cost: 'All reserves', type: 'ultimate', unlockStreak: 30 },
    evolution: ['NOVICE TITAN', 'IRON GUARD', 'WARLORD', 'TITAN PRIME'],
    evolutionLv: [0, 10, 30, 60],
    sinergie: [
      { with: 'helios', effect: 'Recovery score +30%. La fortezza si ripara più velocemente.' },
      { with: 'ares',   effect: 'Task completion velocity +25%. La guardia avanza assieme al combattente.' },
    ],
    strongVs: ['beasts', 'fiends', 'undead'],
    weakVs:   ['aberrations', 'dragons'],
  },
  {
    id: 'athena',
    name: 'ATHENA',
    archetype: 'Caster / Analista',
    role: 'CONOSCENZA & PROBLEM SOLVING',
    icon: '🦉',
    color: '#c77dff',
    gradient: 'linear-gradient(135deg,#c77dff,#9d4edd)',
    desc: 'Athena non combatte con forza bruta — combatte con comprensione. Ogni problema è un sistema da decodificare, ogni nemico ha una debolezza logica. La mente è l\'arma definitiva.',
    mainStats: ['focus', 'analysis', 'critical_thinking'],
    xpSources: [
      { label: 'Sessioni di studio profondo', key: 'deep_reading', mult: 2.0 },
      { label: 'Flashcard completate', key: 'memory', mult: 1.5 },
      { label: 'Analisi e pensiero critico', key: 'analysis', mult: 1.8 },
    ],
    passive: {
      name: 'Occhio Critico',
      desc: 'I boss con tipo "Aberrations" o "Constructs" mostrano automaticamente le loro debolezze. XP studio +15% permanente.',
      type: 'passive',
    },
    actives: [
      { name: 'Deep Work Domain', desc: 'Attiva uno stato di focus totale. Per 90 minuti, XP studio ×2. Richiede focus Lv.20+.', cost: '150 Mana', type: 'active', unlockStreak: 5 },
      { name: 'Analisi Tattica', desc: 'Rivela le debolezze di qualsiasi nemico attivo. Riduce HP del boss del 15%.', cost: '200 Intelligence', type: 'active', unlockStreak: 10 },
    ],
    ultimate: { name: 'DOMAIN EXPANSION — INFINITE ANALYSIS', desc: 'Per 24 ore, tutto il sistema opera al picco cognitivo. Tutte le skill XP ×1.5. Richiede focus Lv.50+.', cost: '500 Mana + 300 Intelligence', type: 'ultimate', unlockStreak: 21 },
    evolution: ['INITIATE', 'SCHOLAR', 'ARCHON', 'ATHENA PRIME'],
    evolutionLv: [0, 8, 25, 55],
    sinergie: [
      { with: 'hephaestus', effect: 'Engineering XP +20%. La scienza e la tecnica si amplificano.' },
      { with: 'orion',      effect: 'Pianificazione a lungo termine +35%. La visione strategica si chiarisce.' },
    ],
    strongVs: ['aberrations', 'constructs', 'fey'],
    weakVs:   ['beasts', 'elementals'],
  },
  {
    id: 'ares',
    name: 'ARES',
    archetype: 'DPS / Esecutore',
    role: 'AZIONE RAPIDA & TASK COMPLETION',
    icon: '⚔️',
    color: '#ff4500',
    gradient: 'linear-gradient(135deg,#ff4500,#cc2200)',
    desc: 'Ares non pianifica — esegue. La velocità di completamento delle task è la sua forza. Ogni missione è una battaglia, ogni deadline una guerra da vincere prima del tempo.',
    mainStats: ['focus', 'discipline', 'willpower'],
    xpSources: [
      { label: 'Daily Missions completate', key: 'discipline', mult: 2.5 },
      { label: 'Task completate in anticipo', key: 'focus', mult: 2.0 },
      { label: 'Streak mantenuto', key: 'discipline', mult: 1.5 },
    ],
    passive: {
      name: 'Berserker Streak',
      desc: 'Ogni 5 missioni consecutive nella stessa sessione, la prossima vale doppio XP.',
      type: 'passive',
    },
    actives: [
      { name: 'Blitz Mode', desc: 'Le prossime 3 task contano come 5. Durata: 2 ore. Richiede 3 missioni già completate oggi.', cost: '120 Ki + 100 Willpower', type: 'active', unlockStreak: 3 },
      { name: 'Battle Cry', desc: 'Azzera il cooldown di tutte le abilità attive. Usabile 1 volta al giorno.', cost: '300 Ki', type: 'active', unlockStreak: 14 },
    ],
    ultimate: { name: 'THOUSAND CUTS', desc: 'Ogni task completata oggi dà +5% XP bonus cumulativo (max +100%). Dura fino a mezzanotte.', cost: '400 Willpower', type: 'ultimate', unlockStreak: 20 },
    evolution: ['ROOKIE', 'SOLDIER', 'ELITE WARRIOR', 'ARES PRIME'],
    evolutionLv: [0, 5, 20, 50],
    sinergie: [
      { with: 'titan', effect: 'Resistenza ai debuff +20%. La guardia protegge il combattente.' },
      { with: 'helios', effect: 'Recovery post-battle ×1.5. Il guaritore mantiene il guerriero in campo.' },
    ],
    strongVs: ['humanoids', 'monstrosities', 'constructs'],
    weakVs:   ['dragons', 'fiends'],
  },
  {
    id: 'helios',
    name: 'HELIOS',
    archetype: 'Healer / Equilibratore',
    role: 'RECOVERY & ENERGIA VITALE',
    icon: '☀️',
    color: '#00ff88',
    gradient: 'linear-gradient(135deg,#00ff88,#00cc66)',
    desc: 'Helios è la fonte di rinnovamento del sistema. Senza recupero non c\'è crescita. Il sonno, la mobilità, l\'equilibrio mentale — sono armi invisibili ma decisive.',
    mainStats: ['recovery', 'flexibility', 'endurance'],
    xpSources: [
      { label: 'Recovery Center completato', key: 'recovery', mult: 2.5 },
      { label: 'Sessioni di mobilità/stretching', key: 'flexibility', mult: 2.0 },
      { label: 'Sonno ottimale (8h)', key: 'endurance', mult: 1.8 },
    ],
    passive: {
      name: 'Rigenerazione Solare',
      desc: 'Ogni sessione di recovery completa ripristina il 15% delle abilità attive usate. Recovery score ≥70 → XP giornaliero +10%.',
      type: 'passive',
    },
    actives: [
      { name: 'Surge of Light', desc: 'Rimuove un debuff attivo (task fallita della settimana). Ricarica: 3 giorni.', cost: '150 Chakra', type: 'active', unlockStreak: 7 },
      { name: 'Equilibrium Field', desc: 'Per le prossime 48h, il recovery score non può scendere sotto 60 anche senza sessioni.', cost: '200 Chakra', type: 'active', unlockStreak: 14 },
    ],
    ultimate: { name: 'SOLAR RESURRECTION', desc: 'Annulla completamente gli effetti di un boss sconfitto male. Resetta HP boss al 100% — ma questa volta vinci tu facilmente.', cost: '500 Chakra + 300 Mana', type: 'ultimate', unlockStreak: 21 },
    evolution: ['MEDIC', 'HEALER', 'SOLAR MONK', 'HELIOS PRIME'],
    evolutionLv: [0, 7, 20, 45],
    sinergie: [
      { with: 'titan', effect: 'Il Titan recupera il doppio più veloce. Muscoli e sistema nervoso si allineano.' },
      { with: 'ares',  effect: 'Ares non si esaurisce mai. Il ciclo azione-recupero diventa infinito.' },
    ],
    strongVs: ['undead', 'elementals', 'fey'],
    weakVs:   ['fiends', 'dragons'],
  },
  {
    id: 'orion',
    name: 'ORION',
    archetype: 'Ranger / Stratega',
    role: 'PRECISIONE & OBIETTIVI LONG-TERM',
    icon: '🎯',
    color: '#ffd700',
    gradient: 'linear-gradient(135deg,#ffd700,#cc9900)',
    desc: 'Orion vede dove gli altri non arrivano. La sua forza non è nella velocità, ma nella precisione. Ogni freccia è un obiettivo a lungo termine centrato in anticipo.',
    mainStats: ['critical_thinking', 'analysis', 'leadership'],
    xpSources: [
      { label: 'Space Command completato', key: 'leadership', mult: 2.5 },
      { label: 'Pianificazione settimanale', key: 'critical_thinking', mult: 2.0 },
      { label: 'Obiettivi a lungo termine centrati', key: 'analysis', mult: 1.8 },
    ],
    passive: {
      name: 'Visione d\'Aquila',
      desc: 'I Dragon-type enemies (scadenze, esami) mostrano un conto alla rovescia preciso. Leadership XP +20%.',
      type: 'passive',
    },
    actives: [
      { name: 'Precision Strike', desc: 'Il prossimo obiettivo di questa settimana conta ×2 verso XP e progressione boss.', cost: '180 Aura + 120 Intelligence', type: 'active', unlockStreak: 7 },
      { name: 'Long View', desc: 'Proietta il tuo Power Level tra 30 giorni se mantieni il ritmo attuale. Sblocca la sezione Destino avanzata.', cost: '200 Intelligence', type: 'active', unlockStreak: 10 },
    ],
    ultimate: { name: 'GALACTIC SCOUT', desc: 'Per 7 giorni, ogni obiettivo completato conta doppio verso la progressione di storia e boss. Richiede: leadership Lv.40+.', cost: '400 Aura + 300 Intelligence', type: 'ultimate', unlockStreak: 30 },
    evolution: ['TRACKER', 'SCOUT', 'RANGER', 'ORION PRIME'],
    evolutionLv: [0, 8, 22, 50],
    sinergie: [
      { with: 'athena',     effect: 'Analisi predittiva +40%. La mente e la visione si fondono.' },
      { with: 'hephaestus', effect: 'I progetti hanno deadline automaticamente ottimizzate. +25% efficienza.' },
    ],
    strongVs: ['dragons', 'monstrosities', 'elementals'],
    weakVs:   ['fiends', 'beasts'],
  },
  {
    id: 'hephaestus',
    name: 'HEPHAESTUS',
    archetype: 'Builder / Forgiatore',
    role: 'ENGINEERING & COSTRUZIONE',
    icon: '⚙️',
    color: '#00e5ff',
    gradient: 'linear-gradient(135deg,#00e5ff,#0088bb)',
    desc: 'Hephaestus non combatte — costruisce. Ogni sistema creato è un\'arma contro il caos. Il codice, i prototipi, i progetti: strumenti che trasformano l\'idea in realtà permanente.',
    mainStats: ['coding', 'engineering', 'analysis'],
    xpSources: [
      { label: 'Project Forge / sessioni coding', key: 'coding', mult: 2.5 },
      { label: 'Engineering completata', key: 'engineering', mult: 2.0 },
      { label: 'Prototipi e MVP creati', key: 'analysis', mult: 1.8 },
    ],
    passive: {
      name: 'Automazione Perpetua',
      desc: 'Ogni sistema costruito riduce permanentemente del 5% il tempo richiesto per le task simili future. Stack: +50% max.',
      type: 'passive',
    },
    actives: [
      { name: 'Forge Protocol', desc: 'Attiva una sessione di deep coding potenziata. XP engineering ×2 per 3 ore. Richiede coding Lv.15+.', cost: '180 Intelligence + 120 Mana', type: 'active', unlockStreak: 5 },
      { name: 'System Override', desc: 'Distruggi un Construct-type nemico immediatamente, senza requisiti HP. 1 uso ogni 7 giorni.', cost: '350 Intelligence', type: 'active', unlockStreak: 21 },
    ],
    ultimate: { name: 'GODFORGE', desc: 'Costruisci un artefatto permanente: +15% a tutte le XP di engineering per sempre. Richiede coding Lv.60+ e engineering Lv.50+.', cost: '600 Intelligence + 400 Mana', type: 'ultimate', unlockStreak: 45 },
    evolution: ['APPRENTICE', 'CRAFTSMAN', 'ENGINEER', 'HEPHAESTUS PRIME'],
    evolutionLv: [0, 10, 30, 70],
    sinergie: [
      { with: 'athena',  effect: 'La scienza potenzia l\'ingegneria. XP coding e analysis +20% reciprocamente.' },
      { with: 'orion',   effect: 'I sistemi costruiti rispettano sempre le deadline. Nessun Dragon-type sopravvive.' },
    ],
    strongVs: ['constructs', 'aberrations', 'undead'],
    weakVs:   ['beasts', 'humanoids'],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ENEMY TYPE DEFINITIONS — 10 tipi originali
// ══════════════════════════════════════════════════════════════════════════════
const ENEMY_TYPES = [
  {
    id: 'aberrations',
    name: 'ABERRAZIONI',
    icon: '🌀',
    color: '#9d4edd',
    threat: 'MENTALE',
    desc: 'Caos mentale, ansia cognitiva, confusione profonda. Si nutrono di incertezza e paralisi decisionale.',
    behavior: 'Attaccano il focus. Ogni sessione di studio non completata le fortifica. Spesso invisibili finché non è troppo tardi.',
    weaknesses: ['athena', 'hephaestus'],
    resistances: ['ares', 'titan'],
    examples: ['Ansia da prestazione', 'Paralisi da analisi', 'Overload informativo', 'Sindrome dell\'impostore'],
    dataSource: 'Aumentano con sessioni di studio interrotte, flashcard saltate, focus Lv basso.',
    spawnFormula: data => Math.max(0, 10 - xpToLevel(data.skills.focus || 0)),
  },
  {
    id: 'beasts',
    name: 'BESTIE',
    icon: '🐺',
    color: '#f97316',
    threat: 'IMPULSIVO',
    desc: 'Impulsi, pigrizia, istinti distruttivi, scroll infinito. Sono veloci e si moltiplicano se non contenuti.',
    behavior: 'Attaccano la disciplina. Ogni giorno senza streak le potenzia. Si presentano come "una piccola pausa".',
    weaknesses: ['titan', 'ares'],
    resistances: ['athena', 'hephaestus'],
    examples: ['Social media binge', 'Procrastinazione da Netflix', 'Snooze ripetuto', 'Cibo compulsivo'],
    dataSource: 'Aumentano con streak basso, missioni saltate, discipline Lv basso.',
    spawnFormula: data => Math.max(0, 10 - Math.min(10, data.streak)),
  },
  {
    id: 'constructs',
    name: 'COSTRUTTI',
    icon: '⚙️',
    color: '#94a3b8',
    threat: 'SISTEMATICO',
    desc: 'Routine obsolete, automatismi sbagliati, sistemi inefficienti che operano su autopilota.',
    behavior: 'Non attaccano — rallentano. Ogni sistema inefficiente che rimane attivo drena risorse silenziosamente.',
    weaknesses: ['hephaestus', 'athena', 'ares'],
    resistances: ['helios', 'titan'],
    examples: ['Workflow obsoleto', 'Abitudini negative radicate', 'Tool non aggiornati', 'Processi manuali automatizzabili'],
    dataSource: 'Aumentano con engineering Lv basso, task ripetute non ottimizzate.',
    spawnFormula: data => Math.max(0, 8 - xpToLevel(data.skills.engineering || 0)),
  },
  {
    id: 'dragons',
    name: 'DRAGHI',
    icon: '🐉',
    color: '#ff0040',
    threat: 'CRITICO',
    desc: 'Le grandi sfide: scadenze imminenti, esami, verifiche, deliverable importanti. Potenti e inevitabili.',
    behavior: 'Appaiono con preavviso. Più si procrastina, più crescono. Richiedono preparazione prolungata.',
    weaknesses: ['orion', 'athena'],
    resistances: ['ares', 'helios'],
    examples: ['Deadline progetto', 'Esame di certificazione', 'Presentazione importante', 'Launch di prodotto'],
    dataSource: 'Spawn aumenta con deadline nel calendario e critical_thinking Lv basso.',
    spawnFormula: data => Math.max(0, 5 - xpToLevel(data.skills.critical_thinking || 0) / 20),
  },
  {
    id: 'elementals',
    name: 'ELEMENTALI',
    icon: '⚡',
    color: '#38bdf8',
    threat: 'AMBIENTALE',
    desc: 'Stanchezza, stress esterno, imprevisti, ambiente non controllato. Forze di contesto che si oppongono alla produttività.',
    behavior: 'Casuali e imprevedibili. Aumentano nei periodi di bassa recovery. Si combinano per creare tempeste.',
    weaknesses: ['orion', 'helios'],
    resistances: ['ares', 'athena'],
    examples: ['Stanchezza accumulata', 'Stress da contesto', 'Imprevisti familiari', 'Ambienti rumorosi'],
    dataSource: 'Aumentano con recovery score basso, streak interrotto, recovery Lv basso.',
    spawnFormula: data => Math.max(0, 10 - (data.recovScore || 0) / 10),
  },
  {
    id: 'fey',
    name: 'FEY',
    icon: '✨',
    color: '#ec4899',
    threat: 'SOTTILE',
    desc: 'Distrazioni leggere ma continue. Seducenti, quasi innocue singolarmente, devastanti in combinazione.',
    behavior: 'Sembrano innocue. Sottraggono piccole quantità di focus ogni volta. Non si vede il danno finché è tardi.',
    weaknesses: ['athena', 'helios'],
    resistances: ['titan', 'orion'],
    examples: ['Notifiche continue', 'Conversazioni non urgenti', 'Micro-interruzioni', 'Tab infiniti aperti'],
    dataSource: 'Aumentano con focus Lv basso e sessioni interrotte.',
    spawnFormula: data => Math.max(0, 10 - xpToLevel(data.skills.focus || 0) / 5),
  },
  {
    id: 'fiends',
    name: 'DEMONI',
    icon: '😈',
    color: '#7b2fff',
    threat: 'DISTRUTTIVO',
    desc: 'Vizi distruttivi, autosabotaggio profondo, procrastinazione pesante. Nemici interni che conoscono ogni tua debolezza.',
    behavior: 'Parlano con la tua voce. "Non puoi farcela." Si rafforzano quando cedi. Il ciclo è il loro territorio.',
    weaknesses: ['titan', 'ares'],
    resistances: ['athena', 'helios'],
    examples: ['Autosabotaggio prima delle scadenze', 'Cicli di procrastinazione pesante', 'Auto-critica paralizzante', 'Dipendenze comportamentali'],
    dataSource: 'Aumentano con streak rotto, boss non sconfitti, discipline Lv basso.',
    spawnFormula: (data, ds) => Math.max(0, 8 - Math.min(8, (ds.defeatedBosses || []).length)),
  },
  {
    id: 'monstrosities',
    name: 'MOSTRI',
    icon: '👾',
    color: '#22d3ee',
    threat: 'CAOTICO',
    desc: 'Problemi ibridi e caotici che combinano più tipi di ostacoli. Imprevedibili, non classificabili, violenti.',
    behavior: 'Non seguono schemi fissi. Cambiano forma durante il combattimento. Richiedono flessibilità tattica.',
    weaknesses: ['ares', 'orion'],
    resistances: ['athena', 'helios'],
    examples: ['Giornate caotiche totali', 'Crisi multidimensionali', 'Problemi tecnici + deadline + stress', 'Tutto-va-storto-insieme'],
    dataSource: 'Aumentano con chaos days (molte missioni fallite, streak basso, recovery basso).',
    spawnFormula: (data, ds) => {
      const chaos = Math.max(0, 5 - data.streak) + Math.max(0, 5 - data.todayDone);
      return Math.round(chaos);
    },
  },
  {
    id: 'undead',
    name: 'NON-MORTI',
    icon: '💀',
    color: '#64748b',
    threat: 'STAGNANTE',
    desc: 'Task vecchi, backlog stagnante, rimpianti non elaborati. Morti ma non ancora sepolti — continuano a pesare.',
    behavior: 'Lenti ma persistenti. Non attaccano — opprimono. Il loro peso aumenta col tempo. Devono essere chiusi.',
    weaknesses: ['helios', 'hephaestus'],
    resistances: ['ares', 'orion'],
    examples: ['Backlog di mesi', 'Progetti abbandonati', 'Email non risposte', 'Obiettivi dimenticati'],
    dataSource: 'Aumentano con task vecchie nel backlog, missioni mai completate, livelli stagnanti.',
    spawnFormula: data => Math.max(0, Math.round((data.totalDone < 10 ? 10 - data.totalDone : 0))),
  },
  {
    id: 'humanoids',
    name: 'UMANOIDI',
    icon: '🧑',
    color: '#a78bfa',
    threat: 'ORDINARIO',
    desc: 'Ostacoli quotidiani ordinari. Non straordinari, ma costanti. Richiedono azione continua più che eroismo.',
    behavior: 'Prevedibili ma numerosi. Appaiono ogni giorno. Si gestiscono con routine solida e disciplina.',
    weaknesses: ['ares', 'titan'],
    resistances: ['orion', 'hephaestus'],
    examples: ['Email di bassa priorità', 'Riunioni non necessarie', 'Richieste di terze parti', 'Burocrazia quotidiana'],
    dataSource: 'Costanti — rappresentano il carico baseline giornaliero.',
    spawnFormula: data => Math.max(1, 5 - Math.min(4, data.todayDone)),
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// MATCHUP MATRIX
// ══════════════════════════════════════════════════════════════════════════════
// Valori: 2=forte, 1=neutro, 0=debole
const MATCHUP = {
  titan:       { aberrations:1, beasts:2, constructs:1, dragons:0, elementals:1, fey:1,  fiends:2, monstrosities:1, undead:2, humanoids:2 },
  athena:      { aberrations:2, beasts:0, constructs:2, dragons:1, elementals:0, fey:2,  fiends:0, monstrosities:0, undead:1, humanoids:1 },
  ares:        { aberrations:0, beasts:1, constructs:2, dragons:0, elementals:0, fey:0,  fiends:1, monstrosities:2, undead:0, humanoids:2 },
  helios:      { aberrations:1, beasts:0, constructs:0, dragons:0, elementals:2, fey:2,  fiends:0, monstrosities:0, undead:2, humanoids:0 },
  orion:       { aberrations:0, beasts:0, constructs:1, dragons:2, elementals:2, fey:1,  fiends:0, monstrosities:2, undead:1, humanoids:1 },
  hephaestus:  { aberrations:2, beasts:0, constructs:2, dragons:1, elementals:1, fey:0,  fiends:0, monstrosities:1, undead:2, humanoids:0 },
};

// ══════════════════════════════════════════════════════════════════════════════
// CLASS XP COMPUTATION — da skill reali
// ══════════════════════════════════════════════════════════════════════════════
function computeClassXP(classId, data) {
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return 0;
  return cls.xpSources.reduce((sum, src) => {
    const skillXP = data.skills[src.key] || 0;
    return sum + Math.round(skillXP * src.mult);
  }, 0);
}

function computeClassLevel(classId, data) {
  const xp = computeClassXP(classId, data);
  return xpToLevel(xp);
}

function getClassEvolution(cls, level) {
  let stage = 0;
  for (let i = 0; i < cls.evolutionLv.length; i++) {
    if (level >= cls.evolutionLv[i]) stage = i;
  }
  return { stage, name: cls.evolution[stage] };
}

function detectDominantClass(data) {
  let best = CLASSES[0], bestXP = 0;
  for (const cls of CLASSES) {
    const xp = computeClassXP(cls.id, data);
    if (xp > bestXP) { bestXP = xp; best = cls; }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════════════════
// ENEMY THREAT LEVEL — spawn attuale dai dati reali
// ══════════════════════════════════════════════════════════════════════════════
function computeEnemyThreats(data, ds) {
  return ENEMY_TYPES.map(e => {
    const count = Math.round(e.spawnFormula(data, ds));
    const threat = count >= 8 ? 'CRITICO' : count >= 5 ? 'ALTO' : count >= 2 ? 'MEDIO' : count >= 1 ? 'BASSO' : 'NULLO';
    const threatColor = count >= 8 ? '#ff0040' : count >= 5 ? '#ff4500' : count >= 2 ? '#ffd700' : '#00ff88';
    return { ...e, count, threat, threatColor, pct: Math.min(100, count * 10) };
  }).sort((a, b) => b.count - a.count);
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER CLASS CODEX
// ══════════════════════════════════════════════════════════════════════════════
function renderCodex(data, ds) {
  const savedClasses = loadClasses();
  const dominantClass = detectDominantClass(data);
  const activeClassId = savedClasses.activeClass || dominantClass.id;
  const activeCls = CLASSES.find(c => c.id === activeClassId) || dominantClass;
  const activeLevel = computeClassLevel(activeClassId, data);
  const { stage, name: evoName } = getClassEvolution(activeCls, activeLevel);
  const threats = computeEnemyThreats(data, ds);

  let codexView = 'classes'; // classes | enemies | matchups

  function buildActiveClassCard() {
    const mainStatVals = activeCls.mainStats.map(sk => ({
      sk, lv: xpToLevel(data.skills[sk] || 0), name: SKILL_DEFS.find(s => s.id === sk)?.name || sk
    }));
    return `
    <div class="active-class-card" style="--cc:${activeCls.color}">
      <div class="acc-inner">
        <div class="acc-portrait" style="--cc:${activeCls.color}">${activeCls.icon}</div>
        <div class="acc-info">
          <div class="acc-archetype">${activeCls.archetype}</div>
          <div class="acc-name">${activeCls.name}</div>
          <div class="acc-role">${activeCls.role}</div>
          <div class="acc-desc">${activeCls.desc}</div>
          <div class="acc-stats">
            ${mainStatVals.map(s => `
            <div class="acc-stat">
              <div class="acc-stat-val" style="color:${activeCls.color}">${s.lv}</div>
              <div class="acc-stat-label">${s.name}</div>
            </div>`).join('')}
            <div class="acc-stat">
              <div class="acc-stat-val" style="color:var(--gold)">${activeLevel}</div>
              <div class="acc-stat-label">Livello Classe</div>
            </div>
            <div class="acc-stat">
              <div class="acc-stat-val" style="color:var(--purple2)">${evoName}</div>
              <div class="acc-stat-label">Evoluzione</div>
            </div>
            <div class="acc-stat">
              <div class="acc-stat-val" style="color:var(--green)">${stage + 1}/4</div>
              <div class="acc-stat-label">Stadio</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function buildClassSelector() {
    return `<div class="class-selector">${CLASSES.map(cls => {
      const lv = computeClassLevel(cls.id, data);
      const xp = computeClassXP(cls.id, data);
      const pct = lvProgress(xp).pct;
      const isActive = cls.id === activeClassId;
      return `
      <div class="class-card ${isActive ? 'cc-active' : ''}" style="--cc:${cls.color}"
           onclick="selectClass('${cls.id}')">
        <span class="cc-icon">${cls.icon}</span>
        <div class="cc-name">${cls.name}</div>
        <div class="cc-role">${cls.archetype}</div>
        <div class="cc-xp-bar"><div class="cc-xp-fill" style="width:${pct}%;background:${cls.color}"></div></div>
        <div class="cc-xp-label"><span>Lv.${lv}</span><span>${pct}%</span></div>
        <div class="cc-passive">${cls.passive.name}</div>
        ${isActive ? '' : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function buildAbilities() {
    const all = [
      activeCls.passive,
      ...activeCls.actives,
      activeCls.ultimate,
    ];
    return `
    <div class="sec-title" style="font-size:9px;margin-top:16px">⚔ ABILITÀ — ${activeCls.name}</div>
    <div class="ability-grid">${all.map(ab => {
      const reqStreak = ab.unlockStreak || 0;
      const isLocked = reqStreak > data.streak;
      return `
      <div class="ability-card ${isLocked ? 'ab-locked' : ''} ab-${ab.type}">
        ${isLocked ? `<div class="ab-locked-badge">🔒 Streak ${reqStreak}d</div>` : ''}
        <div class="ab-type t-${ab.type}">${ab.type.toUpperCase()}</div>
        <div class="ab-name">${ab.name}</div>
        <div class="ab-desc">${ab.desc}</div>
        ${ab.cost ? `<div class="ab-cost">⚡ ${ab.cost}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function buildEvolution() {
    return `
    <div class="sec-title" style="font-size:9px;margin-top:16px">🌀 CATENA EVOLUTIVA</div>
    <div class="evo-chain">${activeCls.evolution.map((name, i) => {
      const done = stage > i;
      const current = stage === i;
      const locked = stage < i;
      const cls2 = done ? 'evo-done' : current ? 'evo-current' : 'evo-locked';
      return `
        <div class="evo-node ${cls2}" style="${current ? `color:${activeCls.color};border-color:${activeCls.color}` : ''}">
          ${done ? '✓ ' : current ? '▶ ' : ''}${name}
          <div style="font-size:7px;opacity:0.6;margin-top:2px">Lv.${activeCls.evolutionLv[i]}+</div>
        </div>
        ${i < activeCls.evolution.length - 1 ? '<div class="evo-arrow">→</div>' : ''}`;
    }).join('')}</div>`;
  }

  function buildSynergies() {
    return `
    <div class="sec-title" style="font-size:9px;margin-top:16px">🔗 SINERGIE</div>
    <div style="background:var(--bg2);border:1px solid var(--border);padding:12px">
      ${activeCls.sinergie.map(syn => {
        const partner = CLASSES.find(c => c.id === syn.with);
        return `<div class="synergy-row">
          <span class="syn-from">${activeCls.icon}</span>
          <span class="syn-plus">+</span>
          <span class="syn-to">${partner?.icon || '?'}</span>
          <span class="syn-arrow">→</span>
          <span style="font-size:9px;color:var(--text2);flex:1">${syn.effect}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function buildMatchupRow(cls) {
    const row = MATCHUP[cls.id] || {};
    return `<tr>
      <td style="color:${cls.color}">${cls.icon} ${cls.name}</td>
      ${ENEMY_TYPES.map(e => {
        const v = row[e.id] ?? 1;
        return `<td>${v === 2 ? '<span class="m-strong">▲</span>' : v === 0 ? '<span class="m-weak">▼</span>' : '<span class="m-neutral">—</span>'}</td>`;
      }).join('')}
    </tr>`;
  }

  function buildEnemyCodex() {
    return `
    <div class="sec-title">💀 ENEMY CODEX — MINACCE ATTIVE</div>
    <div class="enemy-type-grid">${threats.map(e => `
      <div class="enemy-type-card" style="--ec:${e.color}">
        <div class="etc-header">
          <div class="etc-icon">${e.icon}</div>
          <div class="etc-meta">
            <div class="etc-name">${e.name}</div>
            <div class="etc-role">Tipo: ${e.id}</div>
          </div>
        </div>
        <div class="etc-threat" style="color:${e.threatColor};border-color:${e.threatColor}">${e.threat}</div>
        <div class="etc-desc">"${e.desc}"</div>
        <div class="etc-tags">
          <span class="etc-tag">Comportamento: ${e.behavior.split('.')[0]}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${e.weaknesses.map(w => {
            const cls = CLASSES.find(c => c.id === w);
            return `<span class="etc-tag t-weak">⚡ ${cls?.name || w}</span>`;
          }).join('')}
          ${e.resistances.map(r => {
            const cls = CLASSES.find(c => c.id === r);
            return `<span class="etc-tag t-resist">🛡 ${cls?.name || r}</span>`;
          }).join('')}
        </div>
        <div class="etc-source" style="color:var(--text3);font-size:8px">📊 ${e.dataSource}</div>
        <div class="etc-spawn-bar"><div class="etc-spawn-fill" style="width:${e.pct}%;background:${e.color}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:7px;color:var(--text3);margin-top:3px">
          <span>Spawn attuale: ${e.count}</span><span>${e.pct}%</span>
        </div>
        <div style="margin-top:8px;font-size:8px;color:var(--text2)">
          <strong style="color:${e.color}">Esempi:</strong> ${e.examples.slice(0, 3).join(' · ')}
        </div>
      </div>`).join('')}
    </div>`;
  }

  function buildMatchupMatrix() {
    return `
    <div class="sec-title">⚔ MATRICE MATCHUP</div>
    <div style="overflow-x:auto">
      <table class="matchup-table">
        <thead><tr>
          <th>CLASSE →</th>
          ${ENEMY_TYPES.map(e => `<th title="${e.name}">${e.icon}</th>`).join('')}
        </tr></thead>
        <tbody>${CLASSES.map(buildMatchupRow).join('')}</tbody>
      </table>
      <div class="matchup-legend">
        <div class="ml-item"><span class="m-strong">▲</span> Vantaggio — danno ×2</div>
        <div class="ml-item"><span class="m-neutral">—</span> Neutro</div>
        <div class="ml-item"><span class="m-weak">▼</span> Svantaggio — danno ×0.5</div>
      </div>
    </div>
    <div style="margin-top:14px;font-size:9px;color:var(--text2);line-height:1.8;border-left:2px solid var(--cyan);padding-left:10px">
      La matrice è dinamica: la tua classe attiva (${activeCls.name}) è <span style="color:${activeCls.color}">forte contro ${activeCls.strongVs.map(v=>ENEMY_TYPES.find(e=>e.id===v)?.name||v).join(', ')}</span>
      e <span style="color:var(--crimson)">debole contro ${activeCls.weakVs.map(v=>ENEMY_TYPES.find(e=>e.id===v)?.name||v).join(', ')}</span>.
    </div>`;
  }

  // Nav buttons
  const navBtns = `
  <div style="display:flex;gap:6px;margin-bottom:16px">
    <button class="btn ${codexView==='classes'?'btn-active':''}" onclick="setCodexView('classes')" style="${codexView==='classes'?'border-color:var(--cyan);color:var(--cyan)':''}">⚜ CLASSI</button>
    <button class="btn ${codexView==='enemies'?'btn-active':''}" onclick="setCodexView('enemies')" style="${codexView==='enemies'?'border-color:var(--crimson);color:var(--crimson)':''}">💀 NEMICI</button>
    <button class="btn ${codexView==='matchups'?'btn-active':''}" onclick="setCodexView('matchups')" style="${codexView==='matchups'?'border-color:var(--gold);color:var(--gold)':''}">⚔ MATCHUP</button>
  </div>`;

  function buildClassesView() {
    return `
    <div class="sec-title">⚜ CLASS CODEX</div>
    ${navBtns}
    ${buildActiveClassCard()}
    <div class="sec-title" style="font-size:9px;margin-top:20px">SELEZIONA CLASSE</div>
    ${buildClassSelector()}
    ${buildAbilities()}
    ${buildEvolution()}
    ${buildSynergies()}`;
  }

  function render() {
    const panel = document.getElementById('panel-codex');
    if (codexView === 'classes') panel.innerHTML = buildClassesView();
    else if (codexView === 'enemies') panel.innerHTML = `<div class="sec-title">⚜ CLASS CODEX</div>${navBtns}${buildEnemyCodex()}`;
    else panel.innerHTML = `<div class="sec-title">⚜ CLASS CODEX</div>${navBtns}${buildMatchupMatrix()}`;

    // bind selectClass
    window.selectClass = (id) => {
      const sc = loadClasses();
      sc.activeClass = id;
      saveClasses(sc);
      showToast(`⚜ Classe cambiata: ${CLASSES.find(c=>c.id===id)?.name}`);
      renderCodex(loadPolyData(), loadDungeon());
    };
    window.setCodexView = (view) => {
      codexView = view;
      render();
    };
  }

  render();
}

// ── Extend switchTab to handle 'codex' ──
const _origSwitchTab = switchTab;

// Solo Leveling × Dragon Ball × Naruto × HxH × MHA × JJK × Blue Lock × Marvel
// Appended — zero modifiche al codice esistente
// ══════════════════════════════════════════════════════════════════════════════

const V3_KEYS = {
  powers:      'polylife_dungeon_power_systems',
  transV3:     'polylife_dungeon_transformations_v3',
  titlesV3:    'polylife_dungeon_titles_v3',
  villains:    'polylife_dungeon_villains',
  awakening:   'polylife_dungeon_awakening_tree',
  heroClasses: 'polylife_dungeon_classes',
};
function loadV3State(key, def) { return ls.get(key) || def; }
function saveV3State(key, v)   { ls.set(key, v); }

// ══════════════════════════════════════════════════════════════════════════════
// HERO CLASSES v3 — 10 classi con ispirazioni anime/Marvel
// ══════════════════════════════════════════════════════════════════════════════
const HERO_CLASSES = [
  {
    id: 'athena_v3', name: 'ATHENA', archetype: 'Sage Class',
    icon: '🦉', color: '#c77dff',
    inspirations: ['Senku', 'Shikamaru', 'Batman', 'Dr. Strange'],
    domain: ['Studio', 'Memoria', 'Analisi', 'Problem Solving'],
    desc: 'La mente è l\'arma definitiva. Athena non combatte con la forza — decodifica la realtà. Ogni problema diventa un sistema da risolvere. Ogni nemico ha una debolezza logica.',
    skills: ['focus', 'analysis', 'critical_thinking', 'deep_reading', 'memory'],
    ultimates: [
      { name: '10 BILLION IQ MODE', icon: '🧬', desc: 'Attiva il picco cognitivo assoluto. XP studio ×3 per 24h. Richiede focus Lv.50+.', req: 50, reqSkill: 'focus', power: data => xpToLevel(data.skills.focus||0)*50 + xpToLevel(data.skills.analysis||0)*40 },
      { name: 'PERFECT RECALL', icon: '📡', desc: 'Ogni informazione studiata viene memorizzata con precisione fotografica. Memory XP ×5 oggi.', req: 30, reqSkill: 'memory', power: data => xpToLevel(data.skills.memory||0)*60 },
      { name: 'KNOWLEDGE DOMAIN', icon: '🌀', desc: 'Domain Expansion cognitivo. Per 90 minuti nulla può interrompere il flusso.', req: 75, reqSkill: 'focus', power: data => computePowerLevel(data)*0.3 },
    ],
    statKeys: ['focus', 'analysis', 'memory'],
    xpFormula: s => (s.focus||0)*0.5 + (s.analysis||0)*0.6 + (s.critical_thinking||0)*0.5 + (s.deep_reading||0)*0.7 + (s.memory||0)*0.5,
    unlockLv: 0,
  },
  {
    id: 'titan_v3', name: 'TITAN', archetype: 'Juggernaut Class',
    icon: '🛡️', color: '#ef4444',
    inspirations: ['All Might', 'Escanor', 'Hulk', 'Yujiro Hanma'],
    domain: ['Forza', 'Resilienza', 'Disciplina Fisica', 'Protezione'],
    desc: 'Il corpo è la prima arma. La disciplina è la corazza. Il Titan non cede, non rallenta, non smette. "I am here." Ogni allenamento è un mattone dell\'immortalità.',
    skills: ['strength', 'endurance', 'discipline', 'flexibility'],
    ultimates: [
      { name: 'PLUS ULTRA', icon: '💥', desc: 'Supera ogni limite fisico. Forza ×2 per la prossima sessione di allenamento.', req: 20, reqSkill: 'strength', power: data => xpToLevel(data.skills.strength||0)*40 + xpToLevel(data.skills.endurance||0)*35 },
      { name: 'IRON BODY', icon: '🔩', desc: 'Il corpo diventa acciaio. Recovery automatico ×2 per 48h.', req: 40, reqSkill: 'endurance', power: data => xpToLevel(data.skills.endurance||0)*50 },
      { name: 'DEMON BACK MODE', icon: '😈', desc: 'La forma definitiva del Titan. Powered by Baki. Ogni limite fisico infranto conta doppio.', req: 70, reqSkill: 'strength', power: data => computePowerLevel(data)*0.4 },
    ],
    statKeys: ['strength', 'endurance', 'discipline'],
    xpFormula: s => (s.strength||0)*0.6 + (s.endurance||0)*0.6 + (s.discipline||0)*0.5 + (s.flexibility||0)*0.4,
    unlockLv: 0,
  },
  {
    id: 'ares_v3', name: 'ARES', archetype: 'Fighting Spirit Class',
    icon: '⚔️', color: '#ff4500',
    inspirations: ['Goku', 'Naruto', 'Deku', 'Makunouchi Ippo'],
    domain: ['Combattimento', 'Volontà', 'Perseveranza', 'Tecnica'],
    desc: '"Never give up." Ares è lo spirito che non si ferma mai. Ogni caduta è un\'opportunità per rialzarsi più forte. Il cuore del campione batte anche quando il corpo dice basta.',
    skills: ['discipline', 'focus', 'endurance'],
    ultimates: [
      { name: 'FIGHTING SPIRIT', icon: '🔥', desc: 'Lo spirito da combattimento si accende. Task completion XP ×2 per oggi.', req: 10, reqSkill: 'discipline', power: data => data.totalDone*20 + data.streak*15 },
      { name: 'DEMPSEY FLOW', icon: '🥊', desc: 'Ispirato a Ippo. Stato di flow da combattimento. 5 missioni in fila senza pausa.', req: 25, reqSkill: 'focus', power: data => xpToLevel(data.skills.focus||0)*30 + data.todayDone*50 },
      { name: 'CHAMPION HEART', icon: '🏆', desc: 'Il cuore del campione vero. Ogni missione fallita oggi diventa doppia XP domani.', req: 50, reqSkill: 'discipline', power: data => computePowerLevel(data)*0.35 },
    ],
    statKeys: ['discipline', 'focus', 'endurance'],
    xpFormula: s => (s.discipline||0)*0.7 + (s.focus||0)*0.5 + (s.endurance||0)*0.5,
    unlockLv: 0,
  },
  {
    id: 'helios_v3', name: 'HELIOS', archetype: 'Phoenix Class',
    icon: '☀️', color: '#00ff88',
    inspirations: ['Marco the Phoenix', 'Rengoku', 'Gon (post-training)'],
    domain: ['Recovery', 'Energia', 'Rigenerazione', 'Equilibrio'],
    desc: 'Come l\'araba fenice, Helios rinasce sempre. Il recupero non è debolezza — è l\'arma segreta. Rengoku bruciava fino all\'ultimo respiro. Tu bruci ogni giorno.',
    skills: ['recovery', 'flexibility', 'endurance'],
    ultimates: [
      { name: 'PHOENIX REBIRTH', icon: '🦅', desc: 'Azzera tutti i debuff attivi. Recovery score +30 per 48h.', req: 15, reqSkill: 'recovery', power: data => (data.recovScore||0)*20 + xpToLevel(data.skills.recovery||0)*30 },
      { name: 'SOLAR RESTORATION', icon: '🌅', desc: 'Ripristino solare completo. Ogni skill XP +10% per 24h dopo una sessione di recovery ottimale.', req: 35, reqSkill: 'flexibility', power: data => xpToLevel(data.skills.flexibility||0)*40 + xpToLevel(data.skills.recovery||0)*35 },
    ],
    statKeys: ['recovery', 'flexibility', 'endurance'],
    xpFormula: s => (s.recovery||0)*0.7 + (s.flexibility||0)*0.6 + (s.endurance||0)*0.4,
    unlockLv: 5,
  },
  {
    id: 'orion_v3', name: 'ORION', archetype: 'Cosmic Ranger Class',
    icon: '🎯', color: '#ffd700',
    inspirations: ['Iron Man', 'Astronauti', 'Navigatori Stellari', 'Hawkeye'],
    domain: ['Visione Cosmica', 'Precisione', 'Missione a Lungo Termine', 'Spazio'],
    desc: 'Orion vede dove gli altri non arrivano. La sua freccia non manca mai perché è già stata calcolata 10 passi prima. Iron Man non improvvisa — pianifica.',
    skills: ['critical_thinking', 'analysis', 'leadership'],
    ultimates: [
      { name: 'ORBITAL LOCK', icon: '🛰️', desc: 'Blocca l\'obiettivo. Il prossimo goal della settimana conta ×3.', req: 20, reqSkill: 'leadership', power: data => xpToLevel(data.skills.leadership||0)*45 + xpToLevel(data.skills.analysis||0)*35 },
      { name: 'STELLAR VISION', icon: '🌟', desc: 'Vedi il futuro a 90 giorni. Proiezione avanzata Power Level attivata.', req: 40, reqSkill: 'critical_thinking', power: data => xpToLevel(data.skills.critical_thinking||0)*50 },
      { name: 'COSMIC ASCENSION', icon: '🚀', desc: 'Trascrendi il piano tattico. Per 7 giorni, ogni obiettivo conta doppio verso storia e boss.', req: 70, reqSkill: 'leadership', power: data => computePowerLevel(data)*0.45 },
    ],
    statKeys: ['critical_thinking', 'leadership', 'analysis'],
    xpFormula: s => (s.critical_thinking||0)*0.6 + (s.leadership||0)*0.6 + (s.analysis||0)*0.5,
    unlockLv: 10,
  },
  {
    id: 'hephaestus_v3', name: 'HEPHAESTUS', archetype: 'Builder Class',
    icon: '⚙️', color: '#00e5ff',
    inspirations: ['Tony Stark', 'Bulma', 'Mei Hatsume', 'Senku (engineering)'],
    domain: ['Engineering', 'Coding', 'Invenzione', 'Prototipi'],
    desc: 'Hephaestus non sogna le armi — le forgia. Tony Stark costruiva Iron Man in una caverna. Tu costruisci il tuo futuro con il codice e l\'ingegneria.',
    skills: ['coding', 'engineering', 'analysis'],
    ultimates: [
      { name: 'ARC REACTOR FORGE', icon: '⚡', desc: 'Sessione di deep coding potenziata. Engineering XP ×3 per 3 ore.', req: 15, reqSkill: 'coding', power: data => xpToLevel(data.skills.coding||0)*45 + xpToLevel(data.skills.engineering||0)*40 },
      { name: 'INSTANT PROTOTYPE', icon: '🔧', desc: 'Da idea a prototipo in 24h. Sblocca missioni ingegneria speciali.', req: 40, reqSkill: 'engineering', power: data => xpToLevel(data.skills.engineering||0)*55 },
      { name: 'IRON GENESIS', icon: '🤖', desc: 'La creazione definitiva. Un sistema costruito che genera valore autonomo.', req: 80, reqSkill: 'coding', power: data => computePowerLevel(data)*0.5 },
    ],
    statKeys: ['coding', 'engineering', 'analysis'],
    xpFormula: s => (s.coding||0)*0.7 + (s.engineering||0)*0.7 + (s.analysis||0)*0.5,
    unlockLv: 10,
  },
  {
    id: 'mercury_v3', name: 'MERCURY', archetype: 'Wealth Master Class',
    icon: '💰', color: '#ffaa00',
    inspirations: ['Tony Stark (CEO)', 'Warren Buffett', 'Elon Musk'],
    domain: ['Business', 'Finanza', 'Monetizzazione', 'Leverage'],
    desc: 'Mercury muove mercati, non muscoli. Il denaro è energia — chi capisce il flusso dei capitali può costruire civiltà. "Make it rain."',
    skills: ['business', 'leadership', 'communication'],
    ultimates: [
      { name: 'CAPITAL CASCADE', icon: '💸', desc: 'Il denaro genera denaro. Business XP ×4 per 24h.', req: 25, reqSkill: 'business', power: data => xpToLevel(data.skills.business||0)*50 + xpToLevel(data.skills.leadership||0)*35 },
      { name: 'MARKET DOMINATION', icon: '📈', desc: 'Domina ogni mercato. Leadership XP ×2 + Communication XP ×2 per 48h.', req: 60, reqSkill: 'business', power: data => computePowerLevel(data)*0.4 },
    ],
    statKeys: ['business', 'leadership', 'communication'],
    xpFormula: s => (s.business||0)*0.7 + (s.leadership||0)*0.5 + (s.communication||0)*0.5,
    unlockLv: 20,
  },
  {
    id: 'archon_v3', name: 'ARCHON', archetype: 'Supreme Strategist Class',
    icon: '♟️', color: '#9d4edd',
    inspirations: ['Lelouch vi Britannia', 'Doctor Strange', 'Shikamaru (ultimate)'],
    domain: ['Leadership', 'Strategia', 'Decisioni', 'Futuro'],
    desc: '"All according to keikaku." L\'Archon non combatte — governa. Ogni mossa è calcolata. Ogni decisione ha 10 conseguenze già pianificate. Il futuro appartiene a chi lo costruisce oggi.',
    skills: ['leadership', 'critical_thinking', 'communication', 'analysis'],
    ultimates: [
      { name: "KING'S GAMBIT", icon: '♟️', desc: "Sacrifica qualcosa oggi per guadagnare il triplo domani. Missione speciale sbloccata.", req: 30, reqSkill: 'leadership', power: data => xpToLevel(data.skills.leadership||0)*55 + xpToLevel(data.skills.critical_thinking||0)*45 },
      { name: 'FUTURE SIGHT', icon: '🔮', desc: 'Vedi le conseguenze di ogni decisione. Pianificazione strategica +100% efficienza.', req: 55, reqSkill: 'analysis', power: data => xpToLevel(data.skills.analysis||0)*60 + xpToLevel(data.skills.critical_thinking||0)*50 },
      { name: 'ABSOLUTE COMMAND', icon: '👁️', desc: "L'ordine dell'Archon non si discute. Tutte le classi attive ricevono +25% XP per 24h.", req: 90, reqSkill: 'leadership', power: data => computePowerLevel(data)*0.6 },
    ],
    statKeys: ['leadership', 'critical_thinking', 'analysis'],
    xpFormula: s => (s.leadership||0)*0.6 + (s.critical_thinking||0)*0.6 + (s.communication||0)*0.5 + (s.analysis||0)*0.5,
    unlockLv: 30,
  },
  {
    id: 'polaris_v3', name: 'POLARIS', archetype: 'Commander Class',
    icon: '⭐', color: '#4f8cff',
    inspirations: ['Captain America', 'Shanks', 'Kageyama & Hinata (Haikyu!!)'],
    domain: ['Guida', 'Visione', 'Teamwork', 'Competitive Flow'],
    desc: '"Ace of the Court. Captain of the crew." Polaris guida non con la forza ma con la visione. Sul campo la presenza basta. Come Kageyama + Hinata: la perfezione nasce dalla sincronizzazione.',
    skills: ['leadership', 'communication', 'discipline'],
    ultimates: [
      { name: "COMMANDER'S HAKI", icon: '👊', desc: 'La tua presenza risolve ogni tensione. Leadership XP ×3 oggi.', req: 20, reqSkill: 'leadership', power: data => xpToLevel(data.skills.leadership||0)*45 + xpToLevel(data.skills.communication||0)*35 },
      { name: 'ACE AWAKENING', icon: '🏐', desc: 'Modalità Ace attivata. Ogni vittoria sportiva oggi conta ×5 verso XP POLARIS.', req: 40, reqSkill: 'discipline', power: data => xpToLevel(data.skills.discipline||0)*50 + data.streak*20 },
      { name: 'COURT INSTINCT', icon: '⚡', desc: 'Flow state atletico assoluto. Beach volleyball, sport: ogni performance è leggenda.', req: 65, reqSkill: 'leadership', power: data => computePowerLevel(data)*0.4 },
    ],
    statKeys: ['leadership', 'communication', 'discipline'],
    xpFormula: s => (s.leadership||0)*0.6 + (s.communication||0)*0.6 + (s.discipline||0)*0.5,
    unlockLv: 25,
  },
  {
    id: 'nova_v3', name: 'NOVA', archetype: 'Ascendant Class',
    icon: '🌌', color: '#7b2fff',
    inspirations: ['Sung Jin-Woo', 'Superman Prime', 'Gojo Satoru', 'Zeno'],
    domain: ['Mastery Globale', 'Ascensione', 'Trascendenza', 'Onniscienza'],
    desc: '"I alone level up." Nova è la classe finale. Sbloccabile solo con mastery globale su tutti i domini. È la convergenza di ogni percorso, ogni sacrificio, ogni vittoria. Il True Polymath.',
    skills: ['focus', 'strength', 'coding', 'leadership', 'discipline'],
    ultimates: [
      { name: 'SHADOW MONARCH', icon: '👑', desc: "L'esercito delle ombre obbedisce. Army size ×10 per 24h.", req: 80, reqSkill: 'discipline', power: data => computeArmySize(data)*500 },
      { name: 'TRUE POLYMATH', icon: '🔱', desc: 'La forma del Polimata Vero. Tutte le XP ×2 per 48h. Richiede livello 80+.', req: 80, reqLevel: true, power: data => computePowerLevel(data)*2 },
      { name: 'GOD MODE', icon: '⚡', desc: 'Oltre ogni limite. Power Level effettivo ×10 per 1 ora.', req: 100, reqLevel: true, power: data => computePowerLevel(data)*10 },
      { name: 'COSMIC TRANSCENDENCE', icon: '🌌', desc: 'La singolarità del Polimata. Ogni azione conta il triplo. Per sempre.', req: 100, reqLevel: true, power: data => computePowerLevel(data)*50 },
    ],
    statKeys: ['focus', 'strength', 'coding'],
    xpFormula: s => Object.values(s).reduce((sum, v) => sum + v, 0) * 0.1,
    unlockLv: 80,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// POWER SYSTEMS v3 — 10 sistemi ispirati agli anime
// ══════════════════════════════════════════════════════════════════════════════
const POWER_SYSTEMS_V3 = [
  { id:'aura',       name:'AURA',           icon:'✨', color:'#ffd700', anime:'Hunter x Hunter — Nen',
    desc:'L\'energia vitale emessa dal corpo allenato. Più forte il corpo e la mente, più l\'aura domina lo spazio.',
    formula: (s,data) => Math.round(xpToLevel(s.strength||0)*12 + xpToLevel(s.discipline||0)*15 + data.streak*30),
    rankFormula: v => v>=5000?'Nen Master':v>=2000?'Advanced':v>=500?'Intermediate':v>=100?'Basic':'Unawakened',
  },
  { id:'chakra',     name:'CHAKRA',         icon:'☯️', color:'#00ff88', anime:'Naruto — Chakra System',
    desc:'Fusione di energia fisica e spirituale. Cresce con il recupero e l\'equilibrio mente-corpo.',
    formula: (s,data) => Math.round(xpToLevel(s.recovery||0)*14 + xpToLevel(s.flexibility||0)*10 + (data.recovScore||0)*20),
    rankFormula: v => v>=5000?'Sage Level':v>=2000?'Jonin':v>=500?'Chunin':v>=100?'Genin':'Academy',
  },
  { id:'haki',       name:'HAKI',           icon:'👊', color:'#ff4500', anime:'One Piece — Haki',
    desc:"La volontà manifestata come forza. L'Haki del Conquistatore appartiene solo a chi è nato per guidare.",
    formula: (s,data) => Math.round(xpToLevel(s.leadership||0)*18 + xpToLevel(s.discipline||0)*12 + data.totalDone*5),
    rankFormula: v => v>=5000?'Conqueror\'s Haki':v>=2000?'Armament':v>=500?'Observation':v>=100?'Awakening':'Dormant',
  },
  { id:'ki',         name:'KI',             icon:'🔥', color:'#ff7733', anime:'Dragon Ball — Ki',
    desc:'L\'energia vitale combattiva. Si accumula con allenamento fisico estremo e volontà incrollabile.',
    formula: (s,data) => Math.round(xpToLevel(s.strength||0)*15 + xpToLevel(s.endurance||0)*12 + data.streak*40),
    rankFormula: v => v>=5000?'Ultra Instinct':v>=2000?'Super Saiyan':v>=500?'Kaioken':v>=100?'Base Power':'Latent',
  },
  { id:'mana',       name:'MANA',           icon:'🔷', color:'#c77dff', anime:'Black Clover — Magic Power',
    desc:"Potenza magica arcana. Alimentata dallo studio profondo e dall'analisi. La magia è logica applicata.",
    formula: (s,data) => Math.round(xpToLevel(s.focus||0)*14 + xpToLevel(s.analysis||0)*16 + xpToLevel(s.deep_reading||0)*12),
    rankFormula: v => v>=5000?'Arcane Stage':v>=2000?'Grand Magic':v>=500?'Intermediate':v>=100?'Basic':'No Magic',
  },
  { id:'nen',        name:'NEN',            icon:'🌀', color:'#00e5ff', anime:'Hunter x Hunter — Nen',
    desc:'Il sistema più complesso e sofisticato. Solo i veri cacciatori lo padroneggiano. Richiede mente e corpo.',
    formula: (s,data) => Math.round(xpToLevel(s.critical_thinking||0)*16 + xpToLevel(s.focus||0)*12 + xpToLevel(s.analysis||0)*14),
    rankFormula: v => v>=5000?'Specialist':v>=2000?'Enhancer':v>=500?'Transmuter':v>=100?'Hatsu learner':'Unawakened',
  },
  { id:'cursed',     name:'CURSED ENERGY',  icon:'💀', color:'#9d4edd', anime:'Jujutsu Kaisen — Cursed Energy',
    desc:"Energia nata dalla negatività trasformata in potere. Ogni ostacolo vinto alimenta il potere maledetto.",
    formula: (s,data) => Math.round((loadDungeon().defeatedBosses||[]).length*200 + data.totalDone*10 + xpToLevel(s.discipline||0)*15),
    rankFormula: v => v>=5000?'Special Grade':v>=2000?'Grade 1':v>=500?'Grade 2':v>=100?'Grade 3':'Unregistered',
  },
  { id:'shadow',     name:'SHADOW AUTHORITY',icon:'🌑', color:'#7b2fff', anime:'Solo Leveling — Shadow Monarch',
    desc:"Il potere del Monarca delle Ombre. Cresce con la disciplina assoluta e i boss sconfitti. Solo chi non si ferma mai lo possiede.",
    formula: (s,data) => Math.round(data.streak*60 + xpToLevel(s.discipline||0)*20 + (loadDungeon().defeatedBosses||[]).length*300),
    rankFormula: v => v>=5000?'Shadow Monarch':v>=2000?'Shadow Commander':v>=500?'Shadow Soldier':v>=100?'Awakened':'Normal',
  },
  { id:'cosmic',     name:'COSMIC ENERGY',  icon:'🚀', color:'#4f8cff', anime:'Marvel — Cosmic Entities',
    desc:"L'energia dell'universo concentrata in un individuo. Iron Man la sfrutta tecnologicamente. Tu intellettualmente.",
    formula: (s,data) => Math.round(xpToLevel(s.engineering||0)*16 + xpToLevel(s.coding||0)*14 + xpToLevel(s.analysis||0)*12 + data.globalLevel*10),
    rankFormula: v => v>=5000?'Cosmic Entity':v>=2000?'Celestial':v>=500?'Stellar':v>=100?'Planetary':'Human',
  },
  { id:'fighting',   name:'FIGHTING SPIRIT',icon:'🥊', color:'#ef4444', anime:'Hajime no Ippo — Fighting Spirit',
    desc:"Lo spirito che non si arrende mai. Ippo alzava i pugni anche a terra. Tu alzi la disciplina anche quando tutto pesa.",
    formula: (s,data) => Math.round(data.totalDone*15 + data.streak*50 + xpToLevel(s.endurance||0)*18),
    rankFormula: v => v>=5000?'World Champion':v>=2000?'Contender':v>=500?'Veteran':v>=100?'Rookie':'Beginner',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// VILLAIN CODEX v3 — 10 archenemici epici
// ══════════════════════════════════════════════════════════════════════════════
const VILLAINS_V3 = [
  { id:'sloth_king',   name:'SLOTH KING',          title:'Il Re della Pigrizia Eterna',  icon:'👑', color:'#6b7280',
    lore:'Regna da secoli sulla terra del "ci penso domani". La sua corona è fatta di ore sprecate e potenziali non espressi. Non attacca — aspetta.',
    type:'DEMON', weaknesses:['ares_v3','titan_v3'], counterClasses:['ARES','TITAN'],
    requirements:[{key:'missions',label:'20 Missioni Completate',threshold:20},{key:'streak',label:'Streak 7 giorni',threshold:7}],
    deathQuote:'"Impossibile... qualcuno ha spezzato la catena del comfort..."',
    reward:{power: 500, title:'Sloth Slayer'},
  },
  { id:'lord_entropy', name:'LORD ENTROPY',         title:'Il Divoratore di Sistemi',    icon:'🌀', color:'#ec4899',
    lore:'Nato dal caos primordiale. Ogni sistema ben costruito lo attira come la luce attira le falene. Non può essere ignorato — solo sconfitto.',
    type:'ELEMENTAL', weaknesses:['athena_v3','hephaestus_v3'], counterClasses:['ATHENA','HEPHAESTUS'],
    requirements:[{key:'level',label:'Livello 15+',threshold:15},{key:'skill',skill:'analysis',label:'Analisi Lv.20+',threshold:20}],
    deathQuote:'"Il tuo ordine è... una perturbazione nell\'universo..."',
    reward:{power: 800, title:'Order Keeper'},
  },
  { id:'doom_scroll',  name:'DOOM SCROLL',          title:'Il Predatore del Tempo',     icon:'📱', color:'#374151',
    lore:'Abita nei feed infiniti e nelle notifiche senza fine. Non ha bisogno di combattere — semplicemente ti assorbe, secondo dopo secondo, senza che tu te ne accorga.',
    type:'FEY', weaknesses:['athena_v3','polaris_v3'], counterClasses:['ATHENA','POLARIS'],
    requirements:[{key:'streak',label:'Streak 10 giorni',threshold:10},{key:'missions',label:'30 Missioni',threshold:30}],
    deathQuote:'"Il tuo focus è... illegale..."',
    reward:{power: 600, title:'Attention Master'},
  },
  { id:'chaos_hydra',  name:'CHAOS HYDRA',          title:'Hydra del Caos Mentale',     icon:'🐉', color:'#7c3aed',
    lore:'Sette teste, sette forme di ansia. Tagli una — ne crescono due. Solo la mente che comprende il sistema può fermarla davvero.',
    type:'ABERRATION', weaknesses:['athena_v3','helios_v3'], counterClasses:['ATHENA','HELIOS'],
    requirements:[{key:'level',label:'Livello 20+',threshold:20},{key:'skill',skill:'focus',label:'Focus Lv.30+',threshold:30}],
    deathQuote:'"La tua chiarezza... è veleno per me..."',
    reward:{power: 1000, title:'Clarity King'},
  },
  { id:'abyss_dragon', name:'ABYSS DRAGON',         title:'Il Drago dell\'Abisso Interiore',icon:'🐲', color:'#1e3a5f',
    lore:'Il più antico dei nemici. Abita nelle profondità della paura di fallire. Non si combatte con la forza — si affronta con il coraggio di fare comunque.',
    type:'DRAGON', weaknesses:['orion_v3','ares_v3'], counterClasses:['ORION','ARES'],
    requirements:[{key:'level',label:'Livello 30+',threshold:30},{key:'streak',label:'Streak 20 giorni',threshold:20}],
    deathQuote:'"Il tuo coraggio... non dovrebbe esistere..."',
    reward:{power: 1500, title:'Abyss Conqueror'},
  },
  { id:'shadow_doubt', name:'SHADOW OF DOUBT',      title:'L\'Ombra dell\'Impostore',   icon:'🪞', color:'#4a1942',
    lore:'"Sei davvero abbastanza bravo?" Conosce ogni tua insicurezza. Usa la tua stessa voce. È il Gojo Satoru del male interiore — infinito, fino a quando non lo guardi in faccia.',
    type:'FIEND', weaknesses:['titan_v3','ares_v3'], counterClasses:['TITAN','ARES'],
    requirements:[{key:'streak',label:'Streak 14 giorni',threshold:14},{key:'missions',label:'50 Missioni',threshold:50}],
    deathQuote:'"...sei diventato reale. Non posso più negarti."',
    reward:{power: 1200, title:'Doubt Destroyer'},
  },
  { id:'tempter',      name:'THE TEMPTER',           title:'Il Signore delle Tentazioni', icon:'😈', color:'#991b1b',
    lore:'Non forza — seduce. Ogni vizio, ogni distrazione piacevole, ogni scusa confortante è la sua arma. Prospera nel "solo questa volta".',
    type:'FIEND', weaknesses:['titan_v3','archon_v3'], counterClasses:['TITAN','ARCHON'],
    requirements:[{key:'level',label:'Livello 25+',threshold:25},{key:'skill',skill:'discipline',label:'Disciplina Lv.35+',threshold:35}],
    deathQuote:'"La tua disciplina... è innaturale..."',
    reward:{power: 1100, title:'Iron Will'},
  },
  { id:'undead_backlog',name:'THE UNDEAD BACKLOG',  title:'Il Peso di Tutto il Non Fatto',icon:'💀', color:'#374151',
    lore:'Ogni task non completata diventa un non-morto. Non sono pericolosi singolarmente — ma insieme formano un esercito che schiaccia la produttività sotto il suo peso.',
    type:'UNDEAD', weaknesses:['hephaestus_v3','helios_v3'], counterClasses:['HEPHAESTUS','HELIOS'],
    requirements:[{key:'missions',label:'75 Missioni Totali',threshold:75},{key:'level',label:'Livello 35+',threshold:35}],
    deathQuote:'"Il backlog... è finalmente... a riposo..."',
    reward:{power: 1300, title:'Backlog Slayer'},
  },
  { id:'hollow_king',  name:'THE HOLLOW KING',      title:'Re del Vuoto Interiore',     icon:'👁️', color:'#0c4a6e',
    lore:'Non è il nulla — è il nulla che vuole espandersi. Vive nei momenti di disconnessione profonda. La sua presenza annulla ogni motivazione. Come Sung Jin-Woo prima del risveglio.',
    type:'MONSTER', weaknesses:['nova_v3','ares_v3'], counterClasses:['NOVA','ARES'],
    requirements:[{key:'level',label:'Livello 50+',threshold:50},{key:'streak',label:'Streak 30 giorni',threshold:30}],
    deathQuote:'"Il tuo risveglio... è la mia fine..."',
    reward:{power: 2000, title:'Monarch of Will'},
  },
  { id:'devourer_time',name:'THE DEVOURER OF TIME', title:'Il Divoratore Cosmico del Tempo',icon:'⏳',color:'#7b2fff',
    lore:'Il boss finale. Non combatte — accumula. Ogni secondo sprecato lo fortifica. È la somma di tutti i nemici precedenti, la cristallizzazione di ogni momento che non tornerà. Solo il True Polymath può fermarlo.',
    type:'COSMIC', weaknesses:['nova_v3','archon_v3','orion_v3'], counterClasses:['NOVA','ARCHON','ORION'],
    requirements:[{key:'level',label:'Livello 100+',threshold:100},{key:'streak',label:'Streak 100 giorni',threshold:100},{key:'bosses',label:'8 Boss Sconfitti',threshold:8}],
    deathQuote:'"...il tempo era tuo. Lo è sempre stato. Hai solo smesso di sprecarlo."',
    reward:{power: 10000, title:'True Polymath'},
  },
];

// RANK SYSTEM v3
const RANKS_V3 = [
  {rank:'E', color:'#6b7280', lv:0,   icon:'⬛'},
  {rank:'D', color:'#10b981', lv:5,   icon:'🟩'},
  {rank:'C', color:'#4f8cff', lv:15,  icon:'🟦'},
  {rank:'B', color:'#fbbf24', lv:30,  icon:'🟨'},
  {rank:'A', color:'#f97316', lv:50,  icon:'🟧'},
  {rank:'S', color:'#ef4444', lv:70,  icon:'🟥'},
  {rank:'SS',color:'#c77dff', lv:85,  icon:'🔮'},
  {rank:'SSS',color:'#7b2fff',lv:95,  icon:'💜'},
  {rank:'Mythic',color:'#ffd700',lv:100, icon:'⭐'},
  {rank:'Divine',color:'#00e5ff',lv:120, icon:'🌟'},
  {rank:'Transcendent',color:'#ffffff',lv:150, icon:'✨'},
];
function getRankV3(lv){ let r=RANKS_V3[0]; for(const rk of RANKS_V3){if(lv>=rk.lv)r=rk;} return r; }

// TITLES v3
const TITLES_V3 = [
  {id:'scholar_king',   name:'The Scholar King',         req:{key:'skill',skill:'focus',lv:50},       color:'#c77dff'},
  {id:'iron_titan',     name:'The Iron Titan',            req:{key:'skill',skill:'strength',lv:50},    color:'#ef4444'},
  {id:'champion_spirit',name:'The Champion Spirit',       req:{key:'streak',days:30},                  color:'#ff4500'},
  {id:'ace_court',      name:'The Ace of the Court',      req:{key:'streak',days:14},                  color:'#ffd700'},
  {id:'shadow_monarch', name:'The Shadow Monarch',        req:{key:'boss',count:5},                    color:'#7b2fff'},
  {id:'cosmic_engineer',name:'The Cosmic Engineer',       req:{key:'skill',skill:'coding',lv:80},      color:'#00e5ff'},
  {id:'supreme_strat',  name:'The Supreme Strategist',   req:{key:'skill',skill:'leadership',lv:60},  color:'#9d4edd'},
  {id:'galactic_founder',name:'The Galactic Founder',    req:{key:'level',lv:100},                    color:'#7b2fff'},
  {id:'true_polymath',  name:'The True Polymath',         req:{key:'level',lv:100,boss:8,streak:100},  color:'#ffffff'},
];

function checkTitleV3(title, data, ds) {
  const r=title.req, def=ds.defeatedBosses||[];
  if(r.key==='skill') return xpToLevel(data.skills[r.skill]||0)>=r.lv;
  if(r.key==='streak') return data.streak>=r.days;
  if(r.key==='boss') return def.length>=r.count;
  if(r.key==='level') {
    let ok = data.globalLevel>=r.lv;
    if(r.boss) ok = ok && def.length>=r.boss;
    if(r.streak) ok = ok && data.streak>=r.streak;
    return ok;
  }
  return false;
}

// AWAKENING FORMS v3
const AWAKENING_FORMS = [
  { id:'base_form',    name:'BASE FORM',          icon:'🧑', color:'#6b7280', anime:'Baseline', mult:1,    desc:'Il punto di partenza. Il potenziale è qui, latente.', reqs:[] },
  { id:'lock_in',      name:'LOCK-IN MODE',        icon:'🔒', color:'#4f8cff', anime:'Blue Lock', mult:1.5,  desc:'"I am the best striker in the world." La modalità ego assoluto. Solo per chi si è scelto.', reqs:[{key:'streak',v:5,label:'Streak 5d'}] },
  { id:'flow_state',   name:'FLOW STATE',          icon:'🌊', color:'#00e5ff', anime:'Sports Anime',mult:1.8, desc:'Quando corpo e mente si sincronizzano perfettamente. Il tempo si dilata.', reqs:[{key:'streak',v:7,label:'Streak 7d'},{key:'missions',v:20,label:'20 Missioni'}] },
  { id:'sage_mode',    name:'SAGE MODE',           icon:'🧘', color:'#00ff88', anime:'Naruto',    mult:2.5,  desc:'La natura stessa diventa alleata. Percezione totale. Stato zen del guerriero.', reqs:[{key:'level',v:10,label:'Lv.10+'},{key:'skill',skill:'focus',v:20,label:'Focus Lv.20+'}] },
  { id:'super_saiyan', name:'SUPER SAIYAN',        icon:'⚡', color:'#ffd700', anime:'Dragon Ball', mult:3.0, desc:'"Kakarot..." La trasformazione leggendaria. Ogni limite fisico viene abbattuto.', reqs:[{key:'streak',v:14,label:'Streak 14d'},{key:'skill',skill:'strength',v:25,label:'Forza Lv.25+'}] },
  { id:'gear_awk',     name:'GEAR AWAKENING',      icon:'⚙️', color:'#ff7733', anime:'One Piece', mult:3.5,  desc:'Luffy usa il suo corpo come arma. Tu usi ogni skill come leva amplificata.', reqs:[{key:'level',v:20,label:'Lv.20+'},{key:'missions',v:50,label:'50 Missioni'}] },
  { id:'domain_exp',   name:'DOMAIN EXPANSION',    icon:'🌀', color:'#9d4edd', anime:'Jujutsu Kaisen',mult:5, desc:'Il dominio cognitivo assoluto. Nessun nemico sopravvive all\'interno.', reqs:[{key:'level',v:30,label:'Lv.30+'},{key:'skill',skill:'focus',v:40,label:'Focus Lv.40+'}] },
  { id:'limit_break',  name:'LIMIT BREAK',         icon:'💥', color:'#ef4444', anime:'Final Fantasy / MHA', mult:6, desc:'"Plus Ultra." Il limite è solo un\'opinione. Frantumare ogni tetto del possibile.', reqs:[{key:'streak',v:30,label:'Streak 30d'},{key:'level',v:40,label:'Lv.40+'}] },
  { id:'ultra_inst',   name:'ULTRA INSTINCT',      icon:'☯️', color:'#c0c0c0', anime:'Dragon Ball Super', mult:10, desc:'Il corpo si muove da solo. La mente osserva. La perfezione in movimento.', reqs:[{key:'level',v:60,label:'Lv.60+'},{key:'streak',v:60,label:'Streak 60d'},{key:'skill',skill:'discipline',v:70,label:'Disciplina Lv.70+'}] },
  { id:'shadow_monarch_f',name:'SHADOW MONARCH',   icon:'👑', color:'#7b2fff', anime:'Solo Leveling', mult:15, desc:'I alone level up. Il Monarca delle Ombre governa tutto. Il potere è assoluto.', reqs:[{key:'boss',v:5,label:'5+ Boss'},{key:'streak',v:60,label:'Streak 60d'},{key:'level',v:70,label:'Lv.70+'}] },
  { id:'true_polymath_f',name:'TRUE POLYMATH',     icon:'🔱', color:'#00e5ff', anime:'Original', mult:25,    desc:'La convergenza di ogni percorso. Ogni dominio padroneggiato. La leggenda si compie.', reqs:[{key:'level',v:80,label:'Lv.80+'},{key:'skill',skill:'focus',v:80,label:'Focus Lv.80+'},{key:'skill',skill:'strength',v:60,label:'Forza Lv.60+'},{key:'skill',skill:'coding',v:70,label:'Coding Lv.70+'}] },
  { id:'cosmic_asc',   name:'COSMIC ASCENSION',   icon:'🌌', color:'#ffffff', anime:'Marvel / DC', mult:50,  desc:'Oltre l\'umano. Oltre il pianeta. La coscienza si espande al livello cosmico.', reqs:[{key:'level',v:100,label:'Lv.100+'},{key:'streak',v:100,label:'Streak 100d'},{key:'boss',v:8,label:'Tutti i boss'}] },
  { id:'god_mode',     name:'GOD MODE',            icon:'✨', color:'#ffd700', anime:'All Series — Final Form', mult:100, desc:'"It\'s over." La forma finale. Non esiste nulla oltre. Sei diventato la leggenda.', reqs:[{key:'level',v:150,label:'Lv.150+'},{key:'streak',v:365,label:'Streak 1 anno'}] },
];

function checkAwkReq(r, data, ds) {
  const def=ds.defeatedBosses||[];
  if(r.key==='level')   return {ok:data.globalLevel>=r.v, cur:data.globalLevel, need:r.v};
  if(r.key==='streak')  return {ok:data.streak>=r.v, cur:data.streak, need:r.v};
  if(r.key==='missions')return {ok:data.totalDone>=r.v, cur:data.totalDone, need:r.v};
  if(r.key==='boss')    return {ok:def.length>=r.v, cur:def.length, need:r.v};
  if(r.key==='skill')   { const lv=xpToLevel(data.skills[r.skill]||0); return {ok:lv>=r.v, cur:lv, need:r.v}; }
  return {ok:false, cur:0, need:r.v};
}

function getActiveAwakening(data, ds) {
  let active = AWAKENING_FORMS[0];
  for (const f of AWAKENING_FORMS) {
    const ok = f.reqs.every(r => checkAwkReq(r,data,ds).ok);
    if (ok) active = f;
  }
  return active;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS v3
// ══════════════════════════════════════════════════════════════════════════════

// ── HERO CLASSES ──
function renderHeroClasses(data, ds) {
  const saved = loadV3State(V3_KEYS.heroClasses, {activeClass:'athena_v3'});
  const activeId = saved.activeClass || 'athena_v3';
  const active = HERO_CLASSES.find(h=>h.id===activeId) || HERO_CLASSES[0];
  const awk = getActiveAwakening(data, ds);
  const rank = getRankV3(data.globalLevel);

  function computeHeroXP(hc) {
    return Math.round(hc.xpFormula(data.skills));
  }

  function buildHeroCard(hc) {
    const isActive = hc.id === activeId;
    const xp = computeHeroXP(hc);
    const lv = xpToLevel(xp);
    const {pct} = lvProgress(xp);
    const isUnlocked = data.globalLevel >= hc.unlockLv;
    const statVals = hc.statKeys.map(sk => ({sk, lv: xpToLevel(data.skills[sk]||0), name: SKILL_DEFS.find(s=>s.id===sk)?.name||sk}));

    return `
    <div class="hero-card ${isActive?'hc-active':''} ${!isUnlocked?'':'has-aura'}"
         style="--hc:${hc.color};opacity:${isUnlocked?1:0.4};cursor:${isUnlocked?'pointer':'default'}"
         onclick="${isUnlocked?`selectHeroClass('${hc.id}')`:''}" >
      <div class="hc-banner" data-inspo="${hc.inspirations[0]}">
        <span class="hc-emblem">${hc.icon}</span>
        <div class="hc-class-name">${hc.name}</div>
        <div class="hc-archetype">${hc.archetype}</div>
        <div class="hc-inspirations">${hc.inspirations.map(i=>`<span class="hc-inspo-tag">${i}</span>`).join('')}</div>
      </div>
      <div class="hc-body">
        <div class="hc-desc">${hc.desc}</div>
        <div class="hc-domain">${hc.domain.map(d=>`<span class="hc-domain-tag">${d}</span>`).join('')}</div>
        <div class="hc-stats-row">
          ${statVals.map(s=>`
          <div class="hc-stat">
            <div class="hc-stat-val" style="color:${hc.color}">${s.lv}</div>
            <div class="hc-stat-lbl">${s.name}</div>
          </div>`).join('')}
        </div>
        <div class="hc-xp-bar"><div class="hc-xp-fill" style="width:${pct}%;background:${hc.color}"></div></div>
        <div class="hc-xp-label"><span>Lv.${lv}</span><span>${pct}%</span></div>
        <div class="hc-ultimates">
          ${hc.ultimates.map(u=>{
            const skillLv = u.reqLevel ? data.globalLevel : xpToLevel(data.skills[u.reqSkill]||0);
            const locked = skillLv < (u.req||0);
            const power = u.power(data);
            return `
            <div class="hc-ultimate ${locked?'ult-locked':''}">
              <span class="hc-ult-power">${fmtNum(power)}</span>
              <div class="hc-ult-name">${u.icon} ${u.name}</div>
              <div class="hc-ult-desc">${u.desc}</div>
              ${locked?`<div class="hc-ult-req">🔒 ${u.reqSkill||'Livello'} ${u.req}+ richiesto</div>`:''}
            </div>`;
          }).join('')}
        </div>
        ${!isUnlocked?`<div style="text-align:center;margin-top:10px;font-size:8px;color:var(--text3);letter-spacing:2px">🔒 SBLOCCA AL LIVELLO ${hc.unlockLv}</div>`:''}
        ${isUnlocked?`<button class="hc-select-btn ${isActive?'active-class-btn':''}" onclick="selectHeroClass('${hc.id}')">
          ${isActive?'✓ CLASSE ATTIVA':'SELEZIONA QUESTA CLASSE'}
        </button>`:''}
      </div>
    </div>`;
  }

  const rankInfo = rank;
  document.getElementById('panel-heroes').innerHTML = `
  <div class="sec-title">🦸 HERO CLASSES — SCEGLI LA TUA IDENTITÀ</div>
  <div style="display:flex;align-items:center;gap:16px;padding:14px;background:var(--bg2);border:1px solid var(--border);margin-bottom:20px">
    <div style="font-size:48px;filter:drop-shadow(0 0 12px ${active.color})">${active.icon}</div>
    <div>
      <div style="font-size:7px;letter-spacing:4px;color:${active.color};margin-bottom:2px">${active.archetype}</div>
      <div style="font-family:'Cinzel Decorative',serif;font-size:16px;color:${active.color};letter-spacing:2px">${active.name}</div>
      <div style="font-size:8px;color:var(--text2);margin-top:3px">Rango: <span style="color:${rankInfo.color};font-family:'Orbitron',monospace">${rankInfo.icon} ${rankInfo.rank}</span> &nbsp;|&nbsp; Forma: <span style="color:${awk.color}">${awk.name}</span> ×${awk.mult}</div>
    </div>
  </div>
  <div class="hero-grid">${HERO_CLASSES.map(buildHeroCard).join('')}</div>`;

  window.selectHeroClass = (id) => {
    const state = loadV3State(V3_KEYS.heroClasses, {activeClass:'athena_v3'});
    state.activeClass = id;
    saveV3State(V3_KEYS.heroClasses, state);
    const hc = HERO_CLASSES.find(h=>h.id===id);
    showToast(`🦸 ${hc.name} — ${hc.archetype} attivato!`);
    renderHeroClasses(loadPolyData(), loadDungeon());
  };
}

// ── POWER SYSTEMS v3 ──
function renderPowerSystems(data) {
  const s = data.skills;
  const html = `
  <div class="sec-title">💠 POWER SYSTEMS — ENERGIE ANIME</div>
  <div class="psys-grid">${POWER_SYSTEMS_V3.map(ps => {
    const val = ps.formula(s, data);
    const rank = ps.rankFormula(val);
    const pct = Math.min(100, (val / 5000) * 100);
    return `
    <div class="psys-card" style="--pc:${ps.color}" data-anime="${ps.anime}">
      <div class="psys-rank">${rank}</div>
      <span class="psys-icon">${ps.icon}</span>
      <div class="psys-name">${ps.name}</div>
      <div class="psys-anime">${ps.anime}</div>
      <div class="psys-val" style="color:${ps.color}">${fmtNum(val)}</div>
      <div class="psys-bar"><div class="psys-fill" style="width:${pct}%;background:linear-gradient(90deg,${ps.color}88,${ps.color})"></div></div>
      <div class="psys-desc">${ps.desc}</div>
    </div>`;
  }).join('')}</div>`;
  document.getElementById('panel-powersys').innerHTML = html;
}

// ── VILLAIN CODEX v3 ──
function renderVillains(data, ds) {
  const def = ds.defeatedBosses || [];
  const stateKey = V3_KEYS.villains;
  const defVillains = loadV3State(stateKey, {defeated:[]}).defeated || [];

  function computeVillainHP(v) {
    const total = v.requirements.length;
    let met = 0;
    v.requirements.forEach(r => {
      let ok = false;
      if(r.key==='level')   ok = data.globalLevel >= r.threshold;
      if(r.key==='streak')  ok = data.streak >= r.threshold;
      if(r.key==='missions')ok = data.totalDone >= r.threshold;
      if(r.key==='bosses')  ok = def.length >= r.threshold;
      if(r.key==='skill')   ok = xpToLevel(data.skills[r.skill]||0) >= r.threshold;
      if(ok) met++;
    });
    return Math.max(0, 100 - (met/total)*100);
  }

  // Active villain (first not defeated)
  const activeVillain = VILLAINS_V3.find(v => !defVillains.includes(v.id));

  let html = `<div class="sec-title">👹 VILLAIN CODEX — ARCHENEMICI</div>`;

  if (activeVillain) {
    const hp = computeVillainHP(activeVillain);
    html += `
    <div style="margin-bottom:20px;padding:14px;background:rgba(255,0,64,0.04);border:1px solid rgba(255,0,64,0.2);border-left:3px solid #ff0040;">
      <div style="font-size:7px;letter-spacing:3px;color:#ff0040;margin-bottom:6px">⚠ VILLAIN ATTIVO</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:32px">${activeVillain.icon}</div>
        <div>
          <div style="font-family:'Cinzel',serif;font-size:13px;color:${activeVillain.color}">${activeVillain.name}</div>
          <div style="font-size:8px;color:var(--text2)">${activeVillain.title}</div>
          <div style="margin-top:4px;font-size:8px;color:var(--text2)">Contrastato da: ${activeVillain.counterClasses.join(', ')}</div>
        </div>
        <div style="flex:1;text-align:right">
          <div style="font-family:'Orbitron',monospace;font-size:20px;color:#ff0040">${Math.round(hp)}%</div>
          <div style="font-size:7px;color:var(--text3)">HP RIMASTO</div>
        </div>
      </div>
    </div>`;
  }

  html += `<div class="villain-grid">${VILLAINS_V3.map(v => {
    const isDefeated = defVillains.includes(v.id);
    const hp = computeVillainHP(v);
    const isActive = !isDefeated && v === activeVillain;
    return `
    <div class="villain-card ${isDefeated?'v-defeated':isActive?'v-active':''}" style="--vc:${v.color}">
      <div class="vc-type-badge">${v.type}</div>
      <div class="vc-header">
        <span class="vc-portrait">${v.icon}</span>
        <div class="vc-name">${v.name}</div>
        <div class="vc-title">${v.title}</div>
      </div>
      <div class="vc-body">
        <div class="vc-lore">"${v.lore}"</div>
        <div class="vc-hp-labels"><span>HP</span><span style="color:${v.color}">${Math.round(hp)}%</span></div>
        <div class="vc-hp-bar"><div class="vc-hp-fill" style="width:${hp}%;background:linear-gradient(90deg,${v.color},${v.color}88)"></div></div>
        <div class="vc-weakness">
          ${v.weaknesses.map(w=>{const hc=HERO_CLASSES.find(h=>h.id===w);return`<span class="vc-weak-tag" style="border-color:${hc?.color||'#fff'};color:${hc?.color||'#fff'}">⚡ ${hc?.name||w}</span>`;}).join('')}
        </div>
        <div class="vc-req-list">
          <div class="vc-req-title">REQUISITI PER SCONFIGGERLO</div>
          ${v.requirements.map(r=>{
            let cur=0,need=r.threshold;
            if(r.key==='level')   cur=data.globalLevel;
            if(r.key==='streak')  cur=data.streak;
            if(r.key==='missions')cur=data.totalDone;
            if(r.key==='bosses')  cur=(ds.defeatedBosses||[]).length;
            if(r.key==='skill')   cur=xpToLevel(data.skills[r.skill]||0);
            const met=cur>=need;
            return`<div class="vc-req-row"><span>${r.label}</span><span style="color:${met?'#00ff88':'#ff7733'}">${met?'✓':cur+'/'+need}</span></div>`;
          }).join('')}
        </div>
        ${isDefeated?`<div class="vc-defeated-badge"><div style="font-size:24px">✓</div><div style="font-size:10px;color:#00ff88;letter-spacing:3px;font-family:'Cinzel',serif">SCONFITTO</div><div style="font-size:8px;color:var(--text2);font-style:italic;margin-top:4px">"${v.deathQuote}"</div></div>`:
          hp<=0?`<button class="vc-defeat-btn" onclick="defeatVillain('${v.id}')">⚔ SCONFIGGI ${v.name}</button>`:`<div style="text-align:center;font-size:7px;color:var(--text3);letter-spacing:2px;padding:8px">★ SODDISFA I REQUISITI PER ABBATTERE L'HP ★</div>`}
      </div>
    </div>`;
  }).join('')}</div>`;

  document.getElementById('panel-villains').innerHTML = html;

  window.defeatVillain = (id) => {
    const state = loadV3State(stateKey, {defeated:[]});
    if (!state.defeated.includes(id)) {
      state.defeated.push(id);
      saveV3State(stateKey, state);
      const v = VILLAINS_V3.find(x=>x.id===id);
      battleFlash();
      showToast(`💀 ${v.name} SCONFITTO! +${fmtNum(v.reward.power)} POWER`);
      setTimeout(()=>renderVillains(loadPolyData(), loadDungeon()), 1000);
    }
  };
}

// ── AWAKENING TREE ──
function renderAwakening(data, ds) {
  const activeForm = getActiveAwakening(data, ds);
  const pl = Math.round(computePowerLevel(data) * (activeForm.mult || 1));
  const rank = getRankV3(data.globalLevel);
  const totalPct = Math.min(100, Math.round((AWAKENING_FORMS.filter(f => {
    return f.reqs.every(r => checkAwkReq(r,data,ds).ok);
  }).length / AWAKENING_FORMS.length) * 100));

  // Unlocked titles
  const unlockedTitles = TITLES_V3.filter(t => checkTitleV3(t, data, ds));
  const activeTitle = unlockedTitles[unlockedTitles.length-1] || TITLES_V3[0];

  document.getElementById('panel-awakening').innerHTML = `
  <div class="sec-title">🌀 AWAKENING TREE — FORME LEGGENDARIE</div>

  <div class="awakening-hero">
    <span class="awk-portrait">${activeForm.icon}</span>
    <div class="awk-current-name">${activeForm.name}</div>
    <div class="awk-subtitle">${activeForm.anime} — ×${activeForm.mult} POWER MULTIPLIER</div>
    <div style="margin-top:12px;display:flex;gap:20px;justify-content:center;flex-wrap:wrap">
      <div style="text-align:center">
        <div style="font-family:'Orbitron',monospace;font-size:22px;color:var(--gold)">${fmtNum(pl)}</div>
        <div style="font-size:7px;color:var(--text2);letter-spacing:2px">POWER LEVEL EFFETTIVO</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:22px;font-family:'Orbitron',monospace;color:${rank.color}">${rank.icon} ${rank.rank}</div>
        <div style="font-size:7px;color:var(--text2);letter-spacing:2px">RANGO</div>
      </div>
      <div style="text-align:center">
        <div style="font-family:'Orbitron',monospace;font-size:22px;color:var(--purple2)">${totalPct}%</div>
        <div style="font-size:7px;color:var(--text2);letter-spacing:2px">ALBERO COMPLETATO</div>
      </div>
    </div>
  </div>

  ${unlockedTitles.length?`
  <div style="margin-bottom:16px;padding:12px;background:rgba(255,215,0,0.04);border:1px solid rgba(255,215,0,0.2)">
    <div style="font-size:7px;letter-spacing:3px;color:var(--gold3);margin-bottom:6px;font-family:'Cinzel',serif">TITOLI SBLOCCATI (${unlockedTitles.length}/${TITLES_V3.length})</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${unlockedTitles.map(t=>`
      <div style="padding:4px 10px;border:1px solid ${t.color};color:${t.color};font-size:8px;font-family:'Cinzel',serif;letter-spacing:2px">${t.name}</div>`).join('')}
    </div>
  </div>`:''}

  <div class="sec-title" style="font-size:9px">TUTTI I RANGHI — E → TRANSCENDENT</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${RANKS_V3.map(r=>{
    const active2=data.globalLevel>=r.lv&&(RANKS_V3.find((rk,i)=>data.globalLevel<(RANKS_V3[i+1]?.lv||999)&&data.globalLevel>=rk.lv)?.rank===r.rank);
    return`<div style="padding:5px 10px;border:1px solid ${data.globalLevel>=r.lv?r.color:'var(--border)'};color:${data.globalLevel>=r.lv?r.color:'var(--text3)'};font-size:9px;font-family:'Cinzel',serif;${active2?'box-shadow:0 0 8px '+r.color:''}">
      ${r.icon} ${r.rank}<div style="font-size:7px;color:var(--text3)">Lv.${r.lv}</div>
    </div>`;
  }).join('')}</div>

  <div class="sec-title" style="font-size:9px">FORME DI RISVEGLIO</div>
  <div class="awk-tree">${AWAKENING_FORMS.map(form => {
    const reqResults = form.reqs.map(r => ({...r, ...checkAwkReq(r,data,ds)}));
    const unlocked = reqResults.every(r=>r.ok);
    const isActive2 = form.id === activeForm.id;
    const cls = isActive2?'awk-active-form':unlocked?'awk-unlocked':'awk-locked';
    const statusCls = isActive2?'fs-active':unlocked?'fs-unlocked':'fs-locked';
    const statusTxt = isActive2?'◈ FORMA ATTIVA':unlocked?'✓ SBLOCCATA':'🔒 BLOCCATA';
    return `
    <div class="awk-node ${cls}" style="--ac:${form.color}">
      <span class="awk-form-icon">${form.icon}</span>
      <div class="awk-form-name">${form.name}</div>
      <div class="awk-form-sub">${form.anime}</div>
      <div class="awk-form-mult">×${form.mult}</div>
      <div class="awk-form-desc">"${form.desc}"</div>
      ${form.reqs.length?`<div class="awk-req-summary">${reqResults.map(r=>`<div style="color:${r.ok?'#00ff88':'var(--text3)'}">
        ${r.ok?'✓':''} ${r.label}: ${r.cur}/${r.need}</div>`).join('')}</div>`:'<div style="font-size:7px;color:var(--green);letter-spacing:2px">✓ SEMPRE DISPONIBILE</div>'}
      <div class="awk-form-status ${statusCls}">${statusTxt}</div>
    </div>`;
  }).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXTEND switchTab for new panels
// ══════════════════════════════════════════════════════════════════════════════
const _v3origSwitch = window.switchTab;

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED INIT — Single router, no override chains
// ══════════════════════════════════════════════════════════════════════════════

const PANEL_RENDERERS = {
  status:      function(d,ds){ renderStatus(d,ds); },
  power:       function(d){ renderPower(d); },
  transforms:  function(d,ds){ renderTransforms(d,ds); },
  techniques:  function(d,ds){ renderTechniques(d,ds); },
  army:        function(d,ds){ renderArmy(d,ds); },
  worlds:      function(d,ds){ renderWorlds(d,ds); },
  bosses:      function(d,ds){ renderBosses(d,ds); },
  paths:       function(d){ renderPaths(d); },
  relics:      function(d,ds){ renderRelics(d,ds); },
  titles:      function(d){ renderTitles(d); },
  story:       function(d,ds){ renderStory(d,ds); },
  destiny:     function(d,ds){ renderDestiny(d,ds); },
  quests:      function(d){ renderQuests(d); },
  achievements:function(d,ds){ renderAchievements(d,ds); },
  codex:       function(d,ds){ renderCodex(d,ds); },
  heroes:      function(d,ds){ renderHeroClasses(d,ds); },
  powersys:    function(d){ renderPowerSystems(d); },
  villains:    function(d,ds){ renderVillains(d,ds); },
  awakening:   function(d,ds){ renderAwakening(d,ds); },
};

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
  var tab = document.querySelector('[data-tab="' + tabId + '"]');
  var panel = document.getElementById('panel-' + tabId);
  if (tab)   tab.classList.add('active');
  if (panel) panel.classList.add('active');
  var renderer = PANEL_RENDERERS[tabId];
  if (renderer) {
    try {
      var d = loadPolyData(), ds = loadDungeon();
      renderer(d, ds);
    } catch(e) { console.warn('Panel render error [' + tabId + ']:', e); }
  }
  var qtracks = { bosses:'q_boss', power:'q_power', worlds:'q_world', army:'q_army', techniques:'q_tech' };
  if (qtracks[tabId]) markQuestDone(qtracks[tabId]);
}

window.switchTab = switchTab;
window.defeatBoss = defeatBoss;

function _renderHUD_unified(data, ds) {
  try {
    var awk  = (typeof getActiveAwakening === 'function') ? getActiveAwakening(data, ds) : null;
    var tf   = getActiveTransformation(data, ds);
    var form = awk || { icon: tf.icon, color: tf.color, name: tf.name, mult: tf.powerMult || 1 };
    var rankObj = (typeof getRankV3 === 'function') ? getRankV3(data.globalLevel) : getActiveRank(data.globalLevel);
    var heroState = ls.get('polylife_dungeon_classes') || {activeClass:'athena_v3'};
    var hero = (typeof HERO_CLASSES !== 'undefined') ? (HERO_CLASSES.find(function(h){ return h.id === heroState.activeClass; }) || HERO_CLASSES[0]) : null;
    var pl   = Math.round(computePowerLevel(data) * (form.mult || 1));
    var army = computeArmySize(data);

    var avatar = document.getElementById('char-avatar');
    if (avatar) { avatar.textContent = form.icon; avatar.style.borderColor = form.color; avatar.style.boxShadow = '0 0 30px ' + form.color + '50'; }

    var rankLbl = document.getElementById('char-rank-label');
    if (rankLbl) { rankLbl.style.color = rankObj.color; rankLbl.textContent = rankObj.rank || rankObj.name; }

    var charName = document.getElementById('char-name');
    if (charName) charName.textContent = 'POLIMATA';

    var charBadge = document.getElementById('char-class-badge');
    if (charBadge) {
      var badgeTxt = hero ? (hero.icon + ' ' + hero.name) : form.name;
      charBadge.textContent = '◈ ' + badgeTxt + ' ◈';
      charBadge.style.borderColor = form.color;
      charBadge.style.color = form.color;
    }

    var plEl = document.getElementById('power-level');
    if (plEl) plEl.textContent = fmtNum(pl);

    var banner = document.getElementById('transform-banner');
    if (banner) {
      var heroTxt = hero ? (' ❖ ' + hero.icon + ' ' + hero.name) : '';
      banner.textContent = '◈ ' + form.name + ' (×' + form.mult + ')' + heroTxt + ' ❖ ' + (rankObj.rank || rankObj.name) + ' ❖ PL: ' + fmtNum(pl) + ' ❖ ARMY: ' + fmtNum(army) + ' ◈';
    }

    var prog = lvProgress(data.totalXp);
    var hudStats = [
      {label:'LIVELLO',   val:data.globalLevel,  pct:prog.pct,                                    sc:'#00e5ff'},
      {label:'XP TOTALE', val:fmtNum(data.totalXp), pct:Math.min(100,(data.totalXp/100000)*100), sc:'#c77dff'},
      {label:'STREAK',    val:data.streak+'d',   pct:Math.min(100,(data.streak/100)*100),         sc:'#f97316'},
      {label:'MISSIONI',  val:data.totalDone,    pct:Math.min(100,(data.totalDone/500)*100),      sc:'#ffd700'},
    ];
    var hudEl = document.getElementById('hud-stats');
    if (hudEl) hudEl.innerHTML = hudStats.map(function(s){
      return '<div class="hud-stat" style="--sc:' + s.sc + '">' +
        '<div class="hud-stat-val">' + s.val + '</div>' +
        '<div class="hud-stat-label">' + s.label + '</div>' +
        '<div class="hud-stat-bar"><div class="hud-stat-fill" style="width:' + s.pct + '%"></div></div>' +
        '</div>';
    }).join('');
  } catch(e) { console.warn('HUD render error:', e); }
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function(){ window.switchTab(tab.dataset.tab); });
  });
  try {
    var data = loadPolyData();
    var ds   = loadDungeon();
    _renderHUD_unified(data, ds);
    renderStatus(data, ds);
    setInterval(function(){
      try { _renderHUD_unified(loadPolyData(), loadDungeon()); } catch(e) {}
    }, 30000);
  } catch(e) { console.error('Dungeon OS init error:', e); }
});
