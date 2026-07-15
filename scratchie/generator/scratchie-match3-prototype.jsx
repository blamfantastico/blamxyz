import { useState, useCallback } from "react";

// --- Shared prize pool (dollars) ---
const PRIZE_POOL = [
  { label: "$5", value: 5, tier: "small" },
  { label: "$10", value: 10, tier: "small" },
  { label: "$20", value: 20, tier: "small" },
  { label: "$50", value: 50, tier: "large" },
  { label: "$100", value: 100, tier: "large" },
  { label: "$500", value: 500, tier: "jackpot" },
  { label: "$1,000", value: 1000, tier: "jackpot" },
];

function pickWinPrize() {
  const r = Math.random();
  if (r < 0.03) return PRIZE_POOL[6]; // $1,000
  if (r < 0.12) return PRIZE_POOL[5]; // $500
  if (r < 0.30) return PRIZE_POOL[4]; // $100
  if (r < 0.55) return PRIZE_POOL[3]; // $50
  return PRIZE_POOL[Math.floor(Math.random() * 3)]; // $5 / $10 / $20
}
function lowPrize() {
  return PRIZE_POOL[Math.floor(Math.random() * 4)]; // $5 – $50
}

// --- GameRules ---
const MATCH3_RULES = {
  gameType: "match3",
  name: "Match-3",
  version: 1,
  grid: { width: 3, height: 3, cellCount: 9 },
  symbols: { poolSize: [6, 12], matchThreshold: 3 },
  prizeTiers: [
    { id: "small", label: "$10", condition: "Match 3 symbols", value: 10 },
    { id: "large", label: "$100", condition: "Match 4 symbols", value: 100 },
    { id: "jackpot", label: "$1,000", condition: "Match 5 symbols", value: 1000 },
  ],
  nearMiss: { enabled: true, rate: 0.4 },
  howToWin: "Match 3+ of the same symbol to win.",
};

const KEYMATCH_RULES = {
  gameType: "keymatch",
  name: "Key Number Match",
  version: 1,
  winningCount: 3,
  yourCount: 9,
  numberMax: 40,
  grid: { width: 3, height: 3 },
  nearMiss: { enabled: true, rate: 0.4 },
  howToWin: "Match any of YOUR NUMBERS to a WINNING NUMBER — win that prize.",
};

const PRIZEMATCH_RULES = {
  gameType: "prizematch",
  name: "Prize Match",
  version: 1,
  grid: { width: 3, height: 3, cellCount: 9 },
  matchThreshold: 3,
  amounts: PRIZE_POOL,
  nearMiss: { enabled: true, rate: 0.4 },
  howToWin: "Reveal three matching prize amounts — win that amount.",
};

const GAMES = [
  { id: "match3", rules: MATCH3_RULES, icon: "🎯", label: "Match-3" },
  { id: "keymatch", rules: KEYMATCH_RULES, icon: "🔑", label: "Key Match" },
  { id: "prizematch", rules: PRIZEMATCH_RULES, icon: "💵", label: "Prize Match" },
];
const RULES_BY_TYPE = { match3: MATCH3_RULES, keymatch: KEYMATCH_RULES, prizematch: PRIZEMATCH_RULES };

// A theme is the ticket's visual identity, independent of game type. Treat each theme
// as an asset-pack manifest — emoji/CSS placeholders now, real images later (resolved
// by themeId from the downloaded pack):
//   name + icon          -> brand logo            (emoji + text now)
//   accent/accent2/glow  -> palette               (stays)
//   symbols              -> symbol art  +  foil-cover motifs  +  background watermark
// `symbols` is a SET (not one icon) so covers and watermarks have variety across cells.
const SYMBOL_THEMES = {
  fruit: { name: "Fruit Frenzy", icon: "🍒", accent: "#ff6b6b", accent2: "#ffa94d", glow: "rgba(255,107,107,0.45)", symbols: ["🍒", "🍋", "🍊", "🍇", "🍉", "🍓", "🫐", "🍑"] },
  gems: { name: "Gem Rush", icon: "💎", accent: "#b388ff", accent2: "#00e5ff", glow: "rgba(179,136,255,0.45)", symbols: ["💎", "💍", "👑", "🔮", "⭐", "🌟", "💫", "✨"] },
  ocean: { name: "Ocean Treasure", icon: "🌊", accent: "#4dd0e1", accent2: "#0288d1", glow: "rgba(77,208,225,0.45)", symbols: ["🐚", "🦀", "🐙", "🐠", "🦈", "🐋", "🪸", "🦞"] },
  space: { name: "Cosmic Cash", icon: "🚀", accent: "#b39ddb", accent2: "#ff8a80", glow: "rgba(179,157,219,0.45)", symbols: ["🚀", "🛸", "🌍", "🌙", "☄️", "🪐", "👽", "🌌"] },
  retro: { name: "Arcade Jackpot", icon: "👾", accent: "#69f0ae", accent2: "#ff4081", glow: "rgba(255,64,129,0.45)", symbols: ["👾", "🕹️", "🎮", "🎰", "🃏", "🎲", "🎯", "🏆"] },
};

// --- Helpers ---
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollOutcome(forceOutcome, nearMissRate) {
  if (forceOutcome === "win") return "win";
  if (forceOutcome === "near-miss") return "near";
  const r = Math.random();
  if (r < 0.15) return "win";
  if (r < 0.15 + 0.85 * nearMissRate) return "near";
  return "loss";
}

function envelope(gameType, themeId, rulesVersion, outcome, content) {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    gameType,
    rulesVersion,
    themeId,
    outcome,
    content,
  };
}

// --- Generators ---
function generateMatch3(rules, theme, forceOutcome) {
  const pool = SYMBOL_THEMES[theme].symbols.slice(0, 8);
  const out = rollOutcome(forceOutcome, rules.nearMiss.rate);
  const threshold = rules.symbols.matchThreshold;
  const cells = new Array(rules.grid.cellCount);
  let prizeTier = null;

  if (out === "win") {
    const tierRoll = Math.random();
    const matchCount = tierRoll < 0.02 ? 5 : tierRoll < 0.15 ? 4 : 3;
    prizeTier = matchCount >= 5 ? "jackpot" : matchCount >= 4 ? "large" : "small";
    const winSymbol = pool[Math.floor(Math.random() * pool.length)];
    const remaining = pool.filter((s) => s !== winSymbol);
    const positions = shuffle([...Array(rules.grid.cellCount).keys()]);
    for (let i = 0; i < matchCount; i++) cells[positions[i]] = { symbolId: winSymbol, isWinning: true };
    const counts = {};
    for (let i = matchCount; i < rules.grid.cellCount; i++) {
      let sym, tries = 0;
      do { sym = remaining[Math.floor(Math.random() * remaining.length)]; tries++; }
      while ((counts[sym] || 0) >= threshold - 1 && tries < 50);
      counts[sym] = (counts[sym] || 0) + 1;
      cells[positions[i]] = { symbolId: sym, isWinning: false };
    }
  } else if (out === "near") {
    const nearSymbol = pool[Math.floor(Math.random() * pool.length)];
    const remaining = pool.filter((s) => s !== nearSymbol);
    const positions = shuffle([...Array(rules.grid.cellCount).keys()]);
    for (let i = 0; i < threshold - 1; i++) cells[positions[i]] = { symbolId: nearSymbol, isWinning: false };
    const counts = { [nearSymbol]: threshold - 1 };
    for (let i = threshold - 1; i < rules.grid.cellCount; i++) {
      let sym, tries = 0;
      do { sym = remaining[Math.floor(Math.random() * remaining.length)]; tries++; }
      while ((counts[sym] || 0) >= threshold - 1 && tries < 50);
      counts[sym] = (counts[sym] || 0) + 1;
      cells[positions[i]] = { symbolId: sym, isWinning: false };
    }
  } else {
    const filled = [];
    for (let i = 0; i < rules.grid.cellCount; i++) {
      let sym, tries = 0;
      do { sym = pool[Math.floor(Math.random() * pool.length)]; tries++; }
      while (filled.filter((s) => s === sym).length >= threshold - 1 && tries < 50);
      filled.push(sym);
      cells[i] = { symbolId: sym, isWinning: false };
    }
  }

  const tierData = rules.prizeTiers.find((t) => t.id === prizeTier);
  return envelope("match3", theme, rules.version, {
    isWinner: out === "win",
    prizeTier,
    prizeValue: tierData?.value ?? null,
    prizeLabel: tierData?.label ?? null,
    nearMiss: out === "near",
  }, {
    gridWidth: rules.grid.width,
    gridHeight: rules.grid.height,
    cells: cells.map((c, i) => ({ position: [Math.floor(i / rules.grid.width), i % rules.grid.width], ...c })),
  });
}

function generateKeyMatch(rules, theme, forceOutcome) {
  const out = rollOutcome(forceOutcome, rules.nearMiss.rate);
  const winning = [];
  const winSet = new Set();
  while (winning.length < rules.winningCount) {
    const n = 1 + Math.floor(Math.random() * rules.numberMax);
    if (!winSet.has(n)) { winSet.add(n); winning.push(n); }
  }

  const usedYour = new Set();
  const nonMatching = () => {
    let n, tries = 0;
    do { n = 1 + Math.floor(Math.random() * rules.numberMax); tries++; }
    while ((winSet.has(n) || usedYour.has(n)) && tries < 200);
    return n;
  };

  const M = rules.yourCount;
  const winnerIdx = out === "win" ? Math.floor(Math.random() * M) : -1;
  const nearIdx = out === "near" ? Math.floor(Math.random() * M) : -1;
  const winPrize = out === "win" ? pickWinPrize() : null;

  const yourNumbers = [];
  for (let i = 0; i < M; i++) {
    let number, prize, isWinning = false;
    if (i === winnerIdx) {
      number = winning[Math.floor(Math.random() * winning.length)];
      prize = winPrize;
      isWinning = true;
    } else if (i === nearIdx) {
      const base = winning[Math.floor(Math.random() * winning.length)];
      let cand = Math.random() < 0.5 ? base - 1 : base + 1;
      if (cand < 1) cand = base + 1;
      if (cand > rules.numberMax) cand = base - 1;
      number = !winSet.has(cand) && !usedYour.has(cand) ? cand : nonMatching();
      prize = pickWinPrize(); // a tantalizing high prize you just missed
    } else {
      number = nonMatching();
      prize = lowPrize();
    }
    usedYour.add(number);
    yourNumbers.push({ number, prizeLabel: prize.label, prizeValue: prize.value, prizeTier: prize.tier, isWinning });
  }

  const winnerCell = yourNumbers.find((y) => y.isWinning) || null;
  return envelope("keymatch", theme, rules.version, {
    isWinner: out === "win",
    prizeTier: winnerCell?.prizeTier ?? null,
    prizeValue: winnerCell?.prizeValue ?? null,
    prizeLabel: winnerCell?.prizeLabel ?? null,
    nearMiss: out === "near",
  }, { winningNumbers: winning, yourNumbers });
}

function generatePrizeMatch(rules, theme, forceOutcome) {
  const out = rollOutcome(forceOutcome, rules.nearMiss.rate);
  const N = rules.grid.cellCount;
  const amounts = rules.amounts;
  const cap = rules.matchThreshold - 1;
  const cells = new Array(N);
  const positions = shuffle([...Array(N).keys()]);
  const counts = {};
  let won = null;

  const setCell = (pos, amt, isWinning) => {
    cells[pos] = { prizeLabel: amt.label, prizeValue: amt.value, prizeTier: amt.tier, isWinning };
    counts[amt.label] = (counts[amt.label] || 0) + 1;
  };

  let start = 0;
  if (out === "win") {
    won = pickWinPrize();
    for (let i = 0; i < rules.matchThreshold; i++) setCell(positions[i], won, true);
    start = rules.matchThreshold;
  } else if (out === "near") {
    const near = pickWinPrize();
    for (let i = 0; i < cap; i++) setCell(positions[i], near, false);
    start = cap;
  }
  // Fill the rest so no *other* amount reaches the match threshold.
  for (let i = start; i < N; i++) {
    let amt, tries = 0;
    do { amt = amounts[Math.floor(Math.random() * amounts.length)]; tries++; }
    while ((counts[amt.label] || 0) >= cap && tries < 80);
    setCell(positions[i], amt, false);
  }

  return envelope("prizematch", theme, rules.version, {
    isWinner: out === "win",
    prizeTier: won?.tier ?? null,
    prizeValue: won?.value ?? null,
    prizeLabel: won?.label ?? null,
    nearMiss: out === "near",
  }, {
    gridWidth: rules.grid.width,
    gridHeight: rules.grid.height,
    cells: cells.map((c, i) => ({ position: [Math.floor(i / rules.grid.width), i % rules.grid.width], ...c })),
  });
}

function generateForType(gameType, theme, forceOutcome) {
  if (gameType === "keymatch") return generateKeyMatch(KEYMATCH_RULES, theme, forceOutcome);
  if (gameType === "prizematch") return generatePrizeMatch(PRIZEMATCH_RULES, theme, forceOutcome);
  return generateMatch3(MATCH3_RULES, theme, forceOutcome);
}

// revealable cells for the current ticket (keymatch reveals its "your numbers")
function cellsOf(ticket) {
  return ticket.gameType === "keymatch" ? ticket.content.yourNumbers : ticket.content.cells;
}

// --- UI ---
export default function ScratchiePrototype() {
  const [gameType, setGameType] = useState("match3");
  const [theme, setTheme] = useState("fruit");
  const [ticket, setTicket] = useState(null);
  const [revealed, setRevealed] = useState(new Set());
  const [forceOutcome, setForceOutcome] = useState(null);
  const [history, setHistory] = useState([]);

  const generateTicket = useCallback(() => {
    setTicket(generateForType(gameType, theme, forceOutcome));
    setRevealed(new Set());
  }, [gameType, theme, forceOutcome]);

  const cellCount = ticket ? cellsOf(ticket).length : 0;
  const allRevealed = ticket && revealed.size === cellCount;

  const logHistory = (t) => {
    setHistory((h) => [{ ...t.outcome, id: t.id, gameType: t.gameType, theme: t.themeId }, ...h].slice(0, 20));
  };

  const revealCell = (idx) => {
    if (!ticket) return;
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === cellCount && !history.find((h) => h.id === ticket.id)) logHistory(ticket);
      return next;
    });
  };

  const revealAll = () => {
    if (!ticket) return;
    setRevealed(new Set(cellsOf(ticket).map((_, i) => i)));
    if (!history.find((h) => h.id === ticket.id)) logHistory(ticket);
  };

  const banner = (t) => (
    <div className={`result-banner ${t.outcome.isWinner ? "result-win" : t.outcome.nearMiss ? "result-near" : "result-loss"}`}>
      {t.outcome.isWinner
        ? `🎉 WINNER! ${t.outcome.prizeLabel}`
        : t.outcome.nearMiss
        ? "😩 So close! One away..."
        : "Better luck next time!"}
    </div>
  );

  // The ticket keeps the theme it was generated with; the selector drives it otherwise.
  const at = SYMBOL_THEMES[(ticket && ticket.themeId) || theme];

  // Unscratched cells show a dimmed theme symbol (varied per cell) as placeholder
  // "foil art" — drawn from the theme's symbol SET so a Gem Rush cover isn't nine
  // identical diamonds. Swapped for a real foil texture when art assets land.
  const coverArt = (idx) => {
    const s = SYMBOL_THEMES[ticket.themeId].symbols;
    return <span className="foil-motif">{s[idx % s.length]}</span>;
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#1a1a2e", color: "#e0e0e0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", padding: "24px",
      "--accent": at.accent, "--accent2": at.accent2, "--glow": at.glow,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bangers&display=swap');
        .ticket-title { font-family: 'Bangers', cursive; font-size: 28px; letter-spacing: 3px; text-align: center; background: linear-gradient(135deg, var(--accent), var(--accent2), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }
        .ticket-card { background: linear-gradient(145deg, #16213e, #0f3460); border: 3px solid var(--accent); border-radius: 16px; padding: 20px; max-width: 340px; margin: 0 auto; box-shadow: 0 0 20px rgba(255,215,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .cell-btn { width: 80px; height: 80px; border: 2px solid #334; border-radius: 10px; font-size: 34px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; user-select: none; }
        .cell-foil { background: linear-gradient(135deg, #4a4a6a, #5a5a7a, #4a4a6a); color: #6a6a8a; font-size: 14px; letter-spacing: 1px; border-color: #555; }
        .foil-motif { font-size: 30px; opacity: 0.4; filter: grayscale(0.65) brightness(1.1); }
        .ticket-watermark { position: absolute; inset: 0; display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; font-size: 34px; line-height: 1; opacity: 0.06; pointer-events: none; overflow: hidden; transform: rotate(-14deg) scale(1.35); z-index: 0; }
        .ticket-body { position: relative; z-index: 1; }
        .cell-foil:hover { background: linear-gradient(135deg, #5a5a7a, #6a6a8a, #5a5a7a); border-color: var(--accent); transform: scale(1.05); }
        .cell-revealed { background: #0d1b2a; border-color: #334; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .cell-winner { border-color: var(--accent) !important; box-shadow: 0 0 12px var(--glow); animation: popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275), winGlow 1.5s ease-in-out infinite; }
        .cell-num { font-size: 26px; font-weight: 800; line-height: 1; }
        .cell-prize { font-size: 12px; color: #b9b96a; margin-top: 3px; }
        .cell-amount { font-size: 20px; font-weight: 800; color: #ffe08a; }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes winGlow { 0%,100% { box-shadow: 0 0 12px var(--glow);} 50% { box-shadow: 0 0 24px var(--glow);} }
        .ctrl-btn { padding: 8px 16px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; border: 2px solid; }
        .ctrl-primary { background: var(--accent); color: #1a1a2e; border-color: var(--accent); }
        .ctrl-primary:hover { background: var(--accent); filter: brightness(1.12); transform: translateY(-1px); }
        .ctrl-secondary { background: transparent; color: #8888aa; border-color: #334; }
        .ctrl-secondary:hover { border-color: var(--accent); color: var(--accent); }
        .ctrl-active { background: rgba(255,215,0,0.15); color: var(--accent); border-color: var(--accent); }
        .theme-chip { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 2px solid #334; background: transparent; color: #8888aa; transition: all 0.15s ease; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }
        .theme-chip:hover { border-color: #666; color: #ccc; }
        .theme-active { border-color: var(--accent); color: var(--accent); background: rgba(255,215,0,0.1); }
        .keynum-chip { display:inline-flex; align-items:center; justify-content:center; min-width: 40px; height: 40px; padding: 0 8px; border-radius: 8px; font-size: 20px; font-weight: 800; background: linear-gradient(135deg,var(--accent),var(--accent2)); color:#1a1a2e; }
        .result-banner { text-align: center; padding: 12px; border-radius: 10px; margin-top: 12px; font-weight: 700; font-size: 15px; animation: popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
        .result-win { background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.2)); border: 2px solid var(--accent); color: var(--accent); }
        .result-near { background: rgba(255,100,100,0.1); border: 2px solid #664; color: #cc8844; }
        .result-loss { background: rgba(100,100,150,0.1); border: 2px solid #334; color: #666; }
        .data-panel { background: #0d1b2a; border: 1px solid #1a2a4a; border-radius: 10px; padding: 14px; font-size: 11px; line-height: 1.6; max-height: 460px; overflow-y: auto; }
        .data-panel::-webkit-scrollbar { width: 6px; }
        .data-panel::-webkit-scrollbar-thumb { background: #334; border-radius: 3px; }
        .section-label { font-size: 10px; color: #667; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0 6px; text-align:center; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 36, letterSpacing: 4, background: "linear-gradient(135deg,var(--accent),var(--accent2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            SCRATCHIE
          </h1>
          <div style={{ fontSize: 12, color: "#556", marginTop: 4 }}>Ticket Generator Prototype</div>
        </div>

        {/* Game-type selector */}
        <div className="section-label" style={{ margin: "0 0 4px" }}>Game</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
          {GAMES.map((g) => (
            <button key={g.id} className={`theme-chip ${gameType === g.id ? "theme-active" : ""}`} onClick={() => { setGameType(g.id); setTicket(null); }}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>

        {/* Theme selector — visual identity, applies to every game type */}
        <div className="section-label" style={{ margin: "0 0 4px" }}>Theme</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
          {Object.entries(SYMBOL_THEMES).map(([key, t]) => (
            <button key={key} className={`theme-chip ${theme === key ? "theme-active" : ""}`} onClick={() => setTheme(key)}>
              {t.icon} {t.name}
            </button>
          ))}
        </div>

        {/* Outcome controls */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <button className="ctrl-btn ctrl-primary" onClick={generateTicket}>Generate Ticket</button>
          <button className={`ctrl-btn ${forceOutcome === "win" ? "ctrl-active" : "ctrl-secondary"}`} onClick={() => setForceOutcome(forceOutcome === "win" ? null : "win")}>Force Win</button>
          <button className={`ctrl-btn ${forceOutcome === "near-miss" ? "ctrl-active" : "ctrl-secondary"}`} onClick={() => setForceOutcome(forceOutcome === "near-miss" ? null : "near-miss")}>Force Near-Miss</button>
          {ticket && !allRevealed && <button className="ctrl-btn ctrl-secondary" onClick={revealAll}>Reveal All</button>}
        </div>

        {ticket && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
            {/* Ticket card */}
            <div>
              <div className="ticket-card">
                {/* Faint tiled symbol watermark — placeholder for real background art */}
                <div className="ticket-watermark" aria-hidden="true">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <span key={i}>{at.symbols[i % at.symbols.length]}</span>
                  ))}
                </div>
                <div className="ticket-body">
                <div className="ticket-title">{SYMBOL_THEMES[ticket.themeId].icon} {SYMBOL_THEMES[ticket.themeId].name}</div>
                <div style={{ textAlign: "center", fontSize: 10, color: "#778", marginBottom: 12, letterSpacing: 0.5 }}>
                  {RULES_BY_TYPE[ticket.gameType].name.toUpperCase()} · {RULES_BY_TYPE[ticket.gameType].howToWin}
                </div>

                {/* --- Match-3 & Prize-Match: a 3×3 reveal grid --- */}
                {(ticket.gameType === "match3" || ticket.gameType === "prizematch") && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${ticket.content.gridWidth}, 80px)`, gap: 8, justifyContent: "center" }}>
                    {ticket.content.cells.map((cell, idx) => {
                      const isRev = revealed.has(idx);
                      const showWin = isRev && allRevealed && cell.isWinning;
                      return (
                        <button key={idx} className={`cell-btn ${isRev ? (showWin ? "cell-winner" : "cell-revealed") : "cell-foil"}`} onClick={() => !isRev && revealCell(idx)}>
                          {!isRev ? coverArt(idx) : ticket.gameType === "match3" ? cell.symbolId : <span className="cell-amount">{cell.prizeLabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* --- Key Number Match: winning numbers + your numbers --- */}
                {ticket.gameType === "keymatch" && (
                  <div>
                    <div className="section-label">Winning Numbers</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 6 }}>
                      {ticket.content.winningNumbers.map((n, i) => <span key={i} className="keynum-chip">{n}</span>)}
                    </div>
                    <div className="section-label">Your Numbers</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 80px)", gap: 8, justifyContent: "center" }}>
                      {ticket.content.yourNumbers.map((cell, idx) => {
                        const isRev = revealed.has(idx);
                        const showWin = isRev && allRevealed && cell.isWinning;
                        return (
                          <button key={idx} className={`cell-btn ${isRev ? (showWin ? "cell-winner" : "cell-revealed") : "cell-foil"}`} onClick={() => !isRev && revealCell(idx)}>
                            {!isRev ? coverArt(idx) : (
                              <>
                                <span className="cell-num" style={{ color: showWin ? "var(--accent)" : "#dfe" }}>{cell.number}</span>
                                <span className="cell-prize">{cell.prizeLabel}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prize table (match-3 tiers) */}
                {ticket.gameType === "match3" && (
                  <div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontSize: 11 }}>
                    {MATCH3_RULES.prizeTiers.map((tier) => (
                      <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: allRevealed && ticket.outcome.prizeTier === tier.id ? "var(--accent)" : "#667" }}>
                        <span>{tier.condition}</span>
                        <span style={{ fontWeight: 700 }}>{tier.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {allRevealed && banner(ticket)}
                </div>
              </div>
            </div>

            {/* Data panel */}
            <div>
              <div style={{ fontSize: 11, color: "#556", marginBottom: 8, fontWeight: 600 }}>TicketData (server payload)</div>
              <div className="data-panel">
                <pre style={{ margin: 0, color: "#8888bb", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(ticket, null, 2)}</pre>
              </div>

              {history.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#556", marginBottom: 8, fontWeight: 600 }}>Generation History ({history.length})</div>
                  <div className="data-panel" style={{ maxHeight: 200 }}>
                    {history.map((h, i) => (
                      <div key={h.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: i < history.length - 1 ? "1px solid #1a2a4a" : "none", fontSize: 11 }}>
                        <span style={{ width: 20, color: "#445" }}>#{history.length - i}</span>
                        <span>{SYMBOL_THEMES[h.theme]?.icon}{GAMES.find((g) => g.id === h.gameType)?.icon}</span>
                        <span style={{ color: h.isWinner ? "var(--accent)" : h.nearMiss ? "#cc8844" : "#556", fontWeight: h.isWinner ? 700 : 400 }}>
                          {h.isWinner ? `WIN ${h.prizeLabel}` : h.nearMiss ? "NEAR MISS" : "LOSS"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!ticket && (
          <div style={{ textAlign: "center", padding: 60, color: "#445", fontSize: 14 }}>
            Pick a game type and hit Generate to create a ticket
          </div>
        )}
      </div>
    </div>
  );
}
