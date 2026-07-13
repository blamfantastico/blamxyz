import { useState, useCallback } from "react";

// --- GameRules (shared) ---
const MATCH3_RULES = {
  gameType: "match3",
  name: "Match-3",
  version: 1,
  grid: { width: 3, height: 3, cellCount: 9 },
  symbols: { poolSize: [6, 12], matchThreshold: 3 },
  winConditions: [
    { prizeTier: "jackpot", rule: "match:>=5", description: "Match 5+ symbols" },
    { prizeTier: "large", rule: "match:>=4", description: "Match 4 symbols" },
    { prizeTier: "small", rule: "match:>=3", description: "Match 3 symbols" },
  ],
  prizeTiers: [
    { id: "small", label: "$10", condition: "Match 3 symbols", value: 1000 },
    { id: "large", label: "$100", condition: "Match 4 symbols", value: 10000 },
    { id: "jackpot", label: "$1,000", condition: "Match 5 symbols", value: 100000 },
  ],
  nearMiss: { enabled: true, rate: 0.4, types: ["one-short"] },
};

const SYMBOL_THEMES = {
  fruit: { name: "Fruit Frenzy", symbols: ["🍒", "🍋", "🍊", "🍇", "🍉", "🍓", "🫐", "🍑"] },
  gems: { name: "Gem Rush", symbols: ["💎", "💍", "👑", "🔮", "⭐", "🌟", "💫", "✨"] },
  ocean: { name: "Ocean Treasure", symbols: ["🐚", "🦀", "🐙", "🐠", "🦈", "🐋", "🪸", "🦞"] },
  space: { name: "Cosmic Cash", symbols: ["🚀", "🛸", "🌍", "🌙", "☄️", "🪐", "👽", "🌌"] },
  retro: { name: "Arcade Jackpot", symbols: ["👾", "🕹️", "🎮", "🎰", "🃏", "🎲", "🎯", "🏆"] },
};

// --- ServerGenerator ---
function generate(rules, theme, forceOutcome = null) {
  const symbols = SYMBOL_THEMES[theme].symbols;
  const pool = symbols.slice(0, 8);

  // Determine outcome
  const roll = Math.random();
  let outcome;
  if (forceOutcome === "win" || (forceOutcome === null && roll < 0.15)) {
    // Pick a prize tier
    const tierRoll = Math.random();
    if (tierRoll < 0.02) outcome = { isWinner: true, prizeTier: "jackpot", matchCount: 5 };
    else if (tierRoll < 0.15) outcome = { isWinner: true, prizeTier: "large", matchCount: 4 };
    else outcome = { isWinner: true, prizeTier: "small", matchCount: 3 };
  } else if (forceOutcome === "near-miss" || (forceOutcome === null && roll < 0.15 + 0.85 * rules.nearMiss.rate)) {
    outcome = { isWinner: false, prizeTier: null, nearMiss: true, matchCount: 2 };
  } else {
    outcome = { isWinner: false, prizeTier: null, nearMiss: false, matchCount: 0 };
  }

  // Build grid
  const cells = new Array(rules.grid.cellCount);

  if (outcome.isWinner) {
    const winSymbol = pool[Math.floor(Math.random() * pool.length)];
    const remaining = pool.filter((s) => s !== winSymbol);

    // Place winning symbols
    const positions = shuffle([...Array(rules.grid.cellCount).keys()]);
    for (let i = 0; i < outcome.matchCount; i++) {
      cells[positions[i]] = { symbolId: winSymbol, isWinning: true };
    }
    // Fill rest — avoid accidental extra match groups
    const fillerCounts = {};
    for (let i = outcome.matchCount; i < rules.grid.cellCount; i++) {
      let sym;
      let attempts = 0;
      do {
        sym = remaining[Math.floor(Math.random() * remaining.length)];
        attempts++;
      } while ((fillerCounts[sym] || 0) >= rules.symbols.matchThreshold - 1 && attempts < 50);
      fillerCounts[sym] = (fillerCounts[sym] || 0) + 1;
      cells[positions[i]] = { symbolId: sym, isWinning: false };
    }
  } else if (outcome.nearMiss) {
    // Near miss: place N-1 of a symbol
    const nearSymbol = pool[Math.floor(Math.random() * pool.length)];
    const remaining = pool.filter((s) => s !== nearSymbol);
    const positions = shuffle([...Array(rules.grid.cellCount).keys()]);

    for (let i = 0; i < rules.symbols.matchThreshold - 1; i++) {
      cells[positions[i]] = { symbolId: nearSymbol, isWinning: false };
    }
    // Fill rest — no symbol (including nearSymbol) may reach matchThreshold
    const fillerCounts = { [nearSymbol]: rules.symbols.matchThreshold - 1 };
    for (let i = rules.symbols.matchThreshold - 1; i < rules.grid.cellCount; i++) {
      let sym;
      let attempts = 0;
      do {
        sym = remaining[Math.floor(Math.random() * remaining.length)];
        attempts++;
      } while ((fillerCounts[sym] || 0) >= rules.symbols.matchThreshold - 1 && attempts < 50);
      fillerCounts[sym] = (fillerCounts[sym] || 0) + 1;
      cells[positions[i]] = { symbolId: sym, isWinning: false };
    }
  } else {
    // Pure loss — ensure no symbol appears >= matchThreshold times
    const filled = [];
    for (let i = 0; i < rules.grid.cellCount; i++) {
      let sym;
      let attempts = 0;
      do {
        sym = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      } while (
        filled.filter((s) => s === sym).length >= rules.symbols.matchThreshold - 1 &&
        attempts < 50
      );
      filled.push(sym);
      cells[i] = { symbolId: sym, isWinning: false };
    }
  }

  const prizeTierData = rules.prizeTiers.find((t) => t.id === outcome.prizeTier);

  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    gameType: rules.gameType,
    rulesVersion: rules.version,
    themeId: theme,
    outcome: {
      isWinner: outcome.isWinner,
      prizeTier: outcome.prizeTier,
      prizeValue: prizeTierData?.value ?? null,
      prizeLabel: prizeTierData?.label ?? null,
      nearMiss: outcome.nearMiss || false,
    },
    content: {
      gridWidth: rules.grid.width,
      gridHeight: rules.grid.height,
      cells: cells.map((c, i) => ({
        position: [Math.floor(i / rules.grid.width), i % rules.grid.width],
        ...c,
      })),
    },
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- UI ---
const FOIL_PATTERNS = ["▓▓▓", "███", "░░░", "╬╬╬", "◈◈◈"];

export default function ScratchiePrototype() {
  const [theme, setTheme] = useState("fruit");
  const [ticket, setTicket] = useState(null);
  const [revealed, setRevealed] = useState(new Set());
  const [forceOutcome, setForceOutcome] = useState(null);
  const [history, setHistory] = useState([]);

  const generateTicket = useCallback(() => {
    const t = generate(MATCH3_RULES, theme, forceOutcome);
    setTicket(t);
    setRevealed(new Set());
  }, [theme, forceOutcome]);

  const revealCell = (idx) => {
    if (!ticket) return;
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === ticket.content.cells.length && !history.find((h) => h.id === ticket.id)) {
        setHistory((h) => [{ ...ticket.outcome, id: ticket.id, theme }, ...h].slice(0, 20));
      }
      return next;
    });
  };

  const revealAll = () => {
    if (!ticket) return;
    const all = new Set(ticket.content.cells.map((_, i) => i));
    setRevealed(all);
    if (!history.find((h) => h.id === ticket.id)) {
      setHistory((h) => [{ ...ticket.outcome, id: ticket.id, theme }, ...h].slice(0, 20));
    }
  };

  const allRevealed = ticket && revealed.size === ticket.content.cells.length;

  // Count symbols for frequency display
  const symbolCounts = {};
  if (ticket) {
    ticket.content.cells.forEach((c) => {
      symbolCounts[c.symbolId] = (symbolCounts[c.symbolId] || 0) + 1;
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a1a2e",
      color: "#e0e0e0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bangers&display=swap');

        .ticket-title {
          font-family: 'Bangers', cursive;
          font-size: 28px;
          letter-spacing: 3px;
          text-align: center;
          background: linear-gradient(135deg, #ffd700, #ff8c00, #ffd700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: none;
          margin-bottom: 4px;
        }

        .ticket-card {
          background: linear-gradient(145deg, #16213e, #0f3460);
          border: 3px solid #ffd700;
          border-radius: 16px;
          padding: 20px;
          max-width: 340px;
          margin: 0 auto;
          box-shadow:
            0 0 20px rgba(255, 215, 0, 0.15),
            inset 0 1px 0 rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }

        .ticket-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,215,0,0.02) 10px,
            rgba(255,215,0,0.02) 20px
          );
          pointer-events: none;
        }

        .cell-btn {
          width: 80px;
          height: 80px;
          border: 2px solid #334;
          border-radius: 10px;
          font-size: 36px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          user-select: none;
        }

        .cell-foil {
          background: linear-gradient(135deg, #4a4a6a, #5a5a7a, #4a4a6a);
          color: #6a6a8a;
          font-size: 14px;
          letter-spacing: 1px;
          border-color: #555;
        }

        .cell-foil:hover {
          background: linear-gradient(135deg, #5a5a7a, #6a6a8a, #5a5a7a);
          border-color: #ffd700;
          transform: scale(1.05);
        }

        .cell-revealed {
          background: #0d1b2a;
          border-color: #334;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .cell-winner {
          border-color: #ffd700 !important;
          box-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), winGlow 1.5s ease-in-out infinite;
        }

        @keyframes popIn {
          0% { transform: scale(0.7); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes winGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }
          50% { box-shadow: 0 0 24px rgba(255, 215, 0, 0.7); }
        }

        .ctrl-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 2px solid;
        }

        .ctrl-primary {
          background: #ffd700;
          color: #1a1a2e;
          border-color: #ffd700;
        }
        .ctrl-primary:hover { background: #ffe44d; transform: translateY(-1px); }

        .ctrl-secondary {
          background: transparent;
          color: #8888aa;
          border-color: #334;
        }
        .ctrl-secondary:hover { border-color: #ffd700; color: #ffd700; }

        .ctrl-active {
          background: rgba(255,215,0,0.15);
          color: #ffd700;
          border-color: #ffd700;
        }

        .theme-chip {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 2px solid #334;
          background: transparent;
          color: #8888aa;
          transition: all 0.15s ease;
          font-family: 'JetBrains Mono', monospace;
          white-space: nowrap;
        }
        .theme-chip:hover { border-color: #666; color: #ccc; }
        .theme-active {
          border-color: #ffd700;
          color: #ffd700;
          background: rgba(255,215,0,0.1);
        }

        .result-banner {
          text-align: center;
          padding: 12px;
          border-radius: 10px;
          margin-top: 12px;
          font-weight: 700;
          font-size: 15px;
          animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .result-win {
          background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.2));
          border: 2px solid #ffd700;
          color: #ffd700;
        }

        .result-near {
          background: rgba(255,100,100,0.1);
          border: 2px solid #664;
          color: #cc8844;
        }

        .result-loss {
          background: rgba(100,100,150,0.1);
          border: 2px solid #334;
          color: #666;
        }

        .data-panel {
          background: #0d1b2a;
          border: 1px solid #1a2a4a;
          border-radius: 10px;
          padding: 14px;
          font-size: 11px;
          line-height: 1.6;
          max-height: 400px;
          overflow-y: auto;
        }

        .data-panel::-webkit-scrollbar { width: 6px; }
        .data-panel::-webkit-scrollbar-track { background: transparent; }
        .data-panel::-webkit-scrollbar-thumb { background: #334; border-radius: 3px; }

        .freq-bar {
          height: 6px;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Bangers', cursive",
            fontSize: 36,
            letterSpacing: 4,
            background: "linear-gradient(135deg, #ffd700, #ff8c00)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}>
            SCRATCHIE
          </h1>
          <div style={{ fontSize: 12, color: "#556", marginTop: 4 }}>
            Match-3 Ticket Generator Prototype
          </div>
        </div>

        {/* Theme selector */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
          {Object.entries(SYMBOL_THEMES).map(([key, t]) => (
            <button
              key={key}
              className={`theme-chip ${theme === key ? "theme-active" : ""}`}
              onClick={() => setTheme(key)}
            >
              {t.symbols[0]} {t.name}
            </button>
          ))}
        </div>

        {/* Outcome controls */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <button className="ctrl-btn ctrl-primary" onClick={generateTicket}>
            Generate Ticket
          </button>
          <button
            className={`ctrl-btn ${forceOutcome === "win" ? "ctrl-active" : "ctrl-secondary"}`}
            onClick={() => setForceOutcome(forceOutcome === "win" ? null : "win")}
          >
            Force Win
          </button>
          <button
            className={`ctrl-btn ${forceOutcome === "near-miss" ? "ctrl-active" : "ctrl-secondary"}`}
            onClick={() => setForceOutcome(forceOutcome === "near-miss" ? null : "near-miss")}
          >
            Force Near-Miss
          </button>
          {ticket && !allRevealed && (
            <button className="ctrl-btn ctrl-secondary" onClick={revealAll}>
              Reveal All
            </button>
          )}
        </div>

        {ticket && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
            {/* Ticket card */}
            <div>
              <div className="ticket-card">
                <div className="ticket-title">{SYMBOL_THEMES[theme].name}</div>
                <div style={{ textAlign: "center", fontSize: 10, color: "#667", marginBottom: 14, letterSpacing: 1 }}>
                  MATCH 3 TO WIN
                </div>

                {/* Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${ticket.content.gridWidth}, 80px)`,
                  gap: 8,
                  justifyContent: "center",
                }}>
                  {ticket.content.cells.map((cell, idx) => {
                    const isRevealed = revealed.has(idx);
                    const showWin = isRevealed && allRevealed && cell.isWinning;
                    return (
                      <button
                        key={idx}
                        className={`cell-btn ${isRevealed ? (showWin ? "cell-winner" : "cell-revealed") : "cell-foil"}`}
                        onClick={() => !isRevealed && revealCell(idx)}
                      >
                        {isRevealed ? cell.symbolId : FOIL_PATTERNS[idx % FOIL_PATTERNS.length]}
                      </button>
                    );
                  })}
                </div>

                {/* Prize table */}
                <div style={{
                  marginTop: 14,
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  fontSize: 11,
                }}>
                  {MATCH3_RULES.prizeTiers.map((tier) => (
                    <div key={tier.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "2px 0",
                      color: allRevealed && ticket.outcome.prizeTier === tier.id ? "#ffd700" : "#667",
                    }}>
                      <span>{tier.condition}</span>
                      <span style={{ fontWeight: 700 }}>{tier.label}</span>
                    </div>
                  ))}
                </div>

                {/* Result banner */}
                {allRevealed && (
                  <div className={`result-banner ${
                    ticket.outcome.isWinner ? "result-win" :
                    ticket.outcome.nearMiss ? "result-near" : "result-loss"
                  }`}>
                    {ticket.outcome.isWinner
                      ? `🎉 WINNER! ${ticket.outcome.prizeLabel}`
                      : ticket.outcome.nearMiss
                      ? "😩 So close! One symbol away..."
                      : "Better luck next time!"}
                  </div>
                )}
              </div>

              {/* Symbol frequency */}
              {allRevealed && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#556", marginBottom: 8, fontWeight: 600 }}>
                    Symbol Distribution
                  </div>
                  {Object.entries(symbolCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sym, count]) => (
                      <div key={sym} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{sym}</span>
                        <div className="freq-bar" style={{
                          width: `${(count / ticket.content.cells.length) * 120}px`,
                          background: count >= MATCH3_RULES.symbols.matchThreshold
                            ? "#ffd700"
                            : count === MATCH3_RULES.symbols.matchThreshold - 1
                            ? "#cc8844"
                            : "#334",
                        }} />
                        <span style={{ fontSize: 11, color: "#667" }}>×{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Data panel */}
            <div>
              <div style={{ fontSize: 11, color: "#556", marginBottom: 8, fontWeight: 600 }}>
                TicketData (server payload)
              </div>
              <div className="data-panel">
                <pre style={{ margin: 0, color: "#8888bb", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {JSON.stringify(ticket, null, 2)}
                </pre>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#556", marginBottom: 8, fontWeight: 600 }}>
                    Generation History ({history.length})
                  </div>
                  <div className="data-panel" style={{ maxHeight: 200 }}>
                    {history.map((h, i) => (
                      <div key={h.id} style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: "4px 0",
                        borderBottom: i < history.length - 1 ? "1px solid #1a2a4a" : "none",
                        fontSize: 11,
                      }}>
                        <span style={{ width: 20, color: "#445" }}>#{history.length - i}</span>
                        <span>{SYMBOL_THEMES[h.theme].symbols[0]}</span>
                        <span style={{
                          color: h.isWinner ? "#ffd700" : h.nearMiss ? "#cc8844" : "#556",
                          fontWeight: h.isWinner ? 700 : 400,
                        }}>
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
          <div style={{
            textAlign: "center",
            padding: 60,
            color: "#445",
            fontSize: 14,
          }}>
            Pick a theme and hit Generate to create a ticket
          </div>
        )}
      </div>
    </div>
  );
}
