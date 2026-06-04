import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

/* ─── storage ─── */
const STORE = "wf_v4";
const load = () => {
  try {
    const raw = localStorage.getItem(STORE)
      || localStorage.getItem("wf_v3")
      || localStorage.getItem("wf_v2")
      || "{}";
    const parsed = JSON.parse(raw);
    localStorage.setItem(STORE, JSON.stringify(parsed));
    return parsed;
  } catch { return {}; }
};
const persist = (d) => localStorage.setItem(STORE, JSON.stringify(d));

/* ─── helpers ─── */
const todayStr   = () => new Date().toISOString().slice(0, 10);
const addDays    = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtShort   = (s) => new Date(s + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
const fmtWeekday = (s) => new Date(s + "T00:00:00").toLocaleDateString("ja-JP", { weekday: "short" });
const fmtFull    = (s) => new Date(s + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "long" });

const bmiInfo = (b) => {
  if (b < 18.5) return { label: "低体重",   color: "#60a5fa" };
  if (b < 25)   return { label: "普通体重", color: "#00e5b0" };
  if (b < 30)   return { label: "肥満Ⅰ度", color: "#fbbf24" };
  return               { label: "肥満Ⅱ度+", color: "#f87171" };
};

/* ═══════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@300;400;500&display=swap');

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }

:root {
  --bg:      #02040a;
  --panel:   #080e1a;
  --card:    #0d1525;
  --card2:   #131e32;
  --line:    rgba(255,255,255,0.08);
  --line2:   rgba(255,255,255,0.15);

  --t1: #ffffff;
  --t2: #9ab0cc;
  --t3: #4e6480;

  --mint:  #00e5b0;
  --mintd: #00c49a;
  --mdim:  rgba(0,229,176,0.11);
  --mglow: rgba(0,229,176,0.22);
  --mring: rgba(0,229,176,0.18);

  --red:  #f87171;
  --rdim: rgba(248,113,113,0.12);
  --amb:  #fbbf24;
  --blu:  #60a5fa;
  --cyan: #38bdf8;

  --r-sm: 12px;
  --r-md: 16px;
  --r-lg: 22px;
  --r-xl: 28px;

  --sh: 0 4px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset;
  --sh-lg: 0 8px 48px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.05) inset;
}

html, body {
  background: var(--bg);
  color: var(--t1);
  font-family: 'Geist', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overscroll-behavior: none;
}

/* ── Noise + ambient orbs ── */
.noise {
  position:fixed; inset:0; z-index:0; pointer-events:none;
  opacity:0.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:180px 180px;
}
.orb { position:fixed; border-radius:50%; pointer-events:none; z-index:0; filter:blur(110px); }
.orb1 { width:500px;height:500px; top:-150px; right:-100px;
         background:radial-gradient(circle, rgba(0,229,176,0.07) 0%, transparent 65%); }
.orb2 { width:400px;height:400px; bottom:0; left:-100px;
         background:radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 65%); }

/* ── App shell ── */
.app { position:relative; z-index:1; min-height:100vh; display:flex; flex-direction:column; }

/* ── Sidebar nav ── */
.sidebar {
  position:fixed; top:0; left:0; bottom:0;
  width:176px;
  background: var(--panel);
  border-right:1px solid var(--line);
  display:flex; flex-direction:column;
  padding:0; z-index:100;
  box-shadow: 2px 0 24px rgba(0,0,0,0.5);
}
.sidebar-logo {
  padding:22px 18px 16px;
  border-bottom:1px solid var(--line);
}
.sidebar-logo-text { font-size:15px; font-weight:600; letter-spacing:-0.3px; color:var(--t1); }
.sidebar-logo-text em { color:var(--mint); font-style:normal; }
.sidebar-logo-sub { font-size:11px; color:var(--t3); margin-top:3px; letter-spacing:0.03em; }

.sidebar-nav { flex:1; padding:12px 10px; display:flex; flex-direction:column; gap:2px; }
.nav-item {
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; border-radius:var(--r-sm);
  font-size:12px; font-weight:500; color:var(--t2);
  background:none; border:none; cursor:pointer; width:100%;
  text-align:left; transition:all .15s; letter-spacing:0.01em;
}
.nav-item:hover { background:rgba(255,255,255,0.05); color:var(--t1); }
.nav-item.on {
  background: rgba(0,229,176,0.10);
  color:var(--mint);
  box-shadow:inset 0 0 0 1px rgba(0,229,176,0.15);
}
.nav-item svg { width:16px; height:16px; stroke-width:1.8; flex-shrink:0; }

.sidebar-footer {
  padding:14px 18px 20px;
  border-top:1px solid var(--line);
  font-size:10px; color:var(--t3);
  font-family:'Geist Mono',monospace;
}

/* ── Main content area ── */
.main {
  margin-left:176px;
  min-height:100vh;
  display:flex; flex-direction:column;
}

.topbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 32px 14px;
  border-bottom:1px solid var(--line);
  background:rgba(8,14,26,0.8);
  backdrop-filter:blur(16px);
  position:sticky; top:0; z-index:50;
}
.topbar-title { font-size:15px; font-weight:600; color:var(--t1); letter-spacing:-0.2px; }
.topbar-date  { font-family:'Geist Mono',monospace; font-size:12px; color:var(--t2); }

/* Mobile-only logo in topbar — hidden on PC */
.mob-logo { display:none; }

.content { padding:28px 32px 44px; flex:1; }

/* ── GRID LAYOUTS ── */
/* Home: hero-left + sidebar-right */
.home-grid {
  display:grid;
  grid-template-columns:1fr 340px;
  gap:20px;
  align-items:start;
  margin-bottom:20px;
}
.home-grid-right { display:flex; flex-direction:column; gap:16px; }

/* 3-column stat strip */
.stat-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:12px; }

/* ── CARD base ── */
.card {
  background:var(--card);
  border:1px solid var(--line);
  border-radius:var(--r-lg);
  box-shadow:var(--sh);
}

/* ── HERO weight card (left column) ── */
.hero-card {
  background: linear-gradient(145deg, #0e1d30 0%, #0a1420 50%, #080e1a 100%);
  border:1px solid var(--mring);
  border-radius:var(--r-xl);
  padding:28px 36px 24px;
  position:relative; overflow:hidden;
  box-shadow:
    var(--sh-lg),
    0 0 0 1px rgba(0,229,176,0.06),
    0 0 60px rgba(0,229,176,0.07);
}
.hero-card::before {
  content:''; position:absolute; top:-80px; right:-80px;
  width:320px; height:320px; border-radius:50%;
  background:radial-gradient(circle, rgba(0,229,176,0.10) 0%, transparent 65%);
  pointer-events:none;
}
.hero-card::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
  background:linear-gradient(90deg, transparent, rgba(0,229,176,0.15), transparent);
}

.hero-top {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:22px;
}
.hero-eyebrow { font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--t2); }
.date-input {
  background:rgba(255,255,255,0.06); border:1px solid var(--line2); border-radius:9px;
  padding:6px 12px; color:var(--t2);
  font-family:'Geist Mono',monospace; font-size:12px;
  outline:none; color-scheme:dark; transition:all .2s;
}
.date-input:hover { border-color:var(--line2); color:var(--t1); }
.date-input:focus { border-color:var(--mint); color:var(--t1); }

/* THE number */
.number-wrap { margin-bottom:4px; }
.weight-input {
  font-family:'Geist Mono',monospace;
  font-size:120px; font-weight:300;   /* bigger — undeniable main character */
  letter-spacing:-7px; line-height:1;
  color:#ffffff;                       /* pure white — max contrast */
  background:none; border:none; outline:none;
  width:100%;
  caret-color:var(--mint);
  -moz-appearance:textfield;
}
.weight-input::-webkit-outer-spin-button,
.weight-input::-webkit-inner-spin-button { -webkit-appearance:none; }
.weight-input::placeholder { color:rgba(255,255,255,0.08); }

.weight-meta {
  display:flex; align-items:center; gap:12px;
  margin-bottom:10px;
}
/* kg unit: step back visually — smaller, pushed down */
.weight-unit {
  font-size:18px; color:var(--t3);
  font-family:'Geist Mono',monospace; font-weight:300;
  align-self:flex-end; padding-bottom:14px;
}
.diff-pill {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'Geist Mono',monospace; font-size:14px; font-weight:600;
  padding:5px 14px; border-radius:20px;
  letter-spacing:0.01em;
}
.diff-pill.up  { color:var(--red);  background:var(--rdim);  box-shadow:0 0 12px rgba(248,113,113,0.15); }
.diff-pill.dn  { color:var(--mint); background:var(--mdim);  box-shadow:0 0 12px rgba(0,229,176,0.15); }
.diff-pill.nil { color:var(--t3);   background:rgba(255,255,255,0.05); border:1px solid var(--line); }

/* Trend sentence */
.trend-line {
  font-size:12px; color:var(--t3); margin-bottom:14px;
  display:flex; align-items:center; gap:7px;
  letter-spacing:0.01em;
}
.trend-line .dot {
  width:6px; height:6px; border-radius:50%; flex-shrink:0; opacity:0.85;
}

.hero-secondary {
  display:flex; gap:0; margin-bottom:20px;
  border:1px solid var(--line); border-radius:var(--r-md); overflow:hidden;
}
/* Sub items — supporting info, visually quieter */
.hs-item {
  display:flex; flex-direction:column; gap:4px;
  padding:12px 14px; flex:1;
  border-right:1px solid var(--line);
}
.hs-item:last-child { border-right:none; }
/* Primary item — wider, highlighted, draws the eye */
.hs-item.primary {
  flex:1.8;                            /* wider than siblings */
  padding:14px 18px;
  background:linear-gradient(135deg, rgba(0,229,176,0.06) 0%, rgba(0,229,176,0.02) 100%);
  border-right:1px solid rgba(0,229,176,0.15);
}
/* Labels: sub items slightly dimmer than primary */
.hs-label {
  font-size:10px; font-weight:600; letter-spacing:0.08em;
  text-transform:uppercase; color:var(--t3); margin-bottom:0;
}
.hs-item.primary .hs-label {
  color:var(--t2);                     /* label brighter in primary cell */
  letter-spacing:0.10em;
}
/* Values: sub items smaller and dimmer */
.hs-val   { font-family:'Geist Mono',monospace; font-size:16px; font-weight:400; color:var(--t2); letter-spacing:-0.3px; }
.hs-val.mint  { color:var(--mint); }
.hs-val.large { font-size:20px; font-weight:500; color:var(--mint); letter-spacing:-0.5px; }
.hs-val.red   { color:var(--red); }

/* Sentence-style KPI: "あと X kg" — primary cell only */
.hs-sentence {
  font-size:13px; font-weight:400; color:var(--t2);
  line-height:1.4; letter-spacing:0.01em;
  display:flex; align-items:baseline; gap:3px; flex-wrap:wrap;
}
.hs-sentence.mint  { color:var(--mint); font-size:14px; }
.hs-sentence.muted { color:var(--t3);   font-size:12px; line-height:1.4; }
.hs-accent {
  font-family:'Geist Mono',monospace;
  font-size:34px; font-weight:300; color:var(--mint);  /* bigger — unmissable */
  letter-spacing:-1px; line-height:1;
  vertical-align:baseline; margin:0 1px;
}

/* Log inputs inside hero */
.hero-inputs { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
.input-row {
  display:flex; align-items:center; gap:12px;
  background:rgba(255,255,255,0.04); border:1px solid var(--line);
  border-radius:var(--r-sm); padding:8px 14px;
  overflow:hidden;               /* contain children within card */
  transition:border-color .15s;
}
.input-row:focus-within { border-color:rgba(0,229,176,0.3); }
.input-ico { font-size:14px; flex-shrink:0; width:20px; }
.input-lbl { font-size:12px; color:var(--t2); flex-shrink:0; width:48px; }
.text-inp {
  flex:1; background:none; border:none; outline:none;
  color:var(--t1); font-family:'Geist',sans-serif; font-size:14px;
}
.text-inp::placeholder { color:var(--t3); }
.num-inp {
  flex:1; min-width:0;           /* allow shrink inside flex — prevents overflow */
  background:none; border:none; outline:none;
  color:var(--t1); font-family:'Geist Mono',monospace; font-size:15px;
  text-align:right; -moz-appearance:textfield;
}
.num-inp::-webkit-outer-spin-button,
.num-inp::-webkit-inner-spin-button { -webkit-appearance:none; }
.num-inp::placeholder { color:var(--t3); }
.inp-unit { font-size:12px; color:var(--t3); flex-shrink:0; margin-left:4px; }

.save-btn {
  width:100%; padding:12px;
  background:var(--mint); color:#020d08;
  font-family:'Geist',sans-serif; font-size:14px; font-weight:700;
  letter-spacing:0.04em; border:none; border-radius:var(--r-md);
  cursor:pointer;
  /* all transitions in one place */
  transition:
    background   .18s ease,
    transform    .10s ease,
    box-shadow   .18s ease,
    opacity      .15s ease;
  position:relative; overflow:hidden;
  /* subtle shine layer */
  isolation:isolate;
}
.save-btn::after {
  content:'';
  position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 60%);
  border-radius:inherit;
  pointer-events:none; opacity:1;
  transition:opacity .18s;
}
/* Hover — lift + brighten */
.save-btn:hover {
  background:var(--mintd);
  transform:translateY(-2px);
  box-shadow:0 6px 24px rgba(0,229,176,0.28), 0 2px 6px rgba(0,229,176,0.14);
}
.save-btn:hover::after { opacity:0.5; }
/* Press — compress inward */
.save-btn:active {
  transform:scale(0.97) translateY(0px);
  box-shadow:0 1px 4px rgba(0,229,176,0.10);
  transition:transform .06s ease, box-shadow .06s ease;
}
/* Saving state */
.save-btn.saving {
  opacity:0.65; pointer-events:none;
  transform:none; box-shadow:none;
}
/* Success state */
.save-btn.ok {
  background:var(--mdim); color:var(--mint);
  border:1px solid rgba(0,229,176,0.22);
  pointer-events:none;
  box-shadow:0 0 16px rgba(0,229,176,0.10);
}
/* Check icon animation */
@keyframes checkPop {
  0%   { transform:scale(0) rotate(-8deg); opacity:0; }
  60%  { transform:scale(1.15) rotate(2deg); opacity:1; }
  100% { transform:scale(1) rotate(0deg); opacity:1; }
}
.save-btn.ok .btn-check {
  display:inline-block;
  animation:checkPop .28s cubic-bezier(.34,1.56,.64,1) both;
}
.save-btn:not(.ok) .btn-check { display:none; }

/* KPI value fade-up on change */
@keyframes kpiFade {
  from { opacity:0; transform:translateY(4px); }
  to   { opacity:1; transform:translateY(0); }
}
.kpi-val { animation:kpiFade .25s ease both; }

/* ── RIGHT COLUMN CARDS ── */
.side-card {
  background:var(--card);
  border:1px solid var(--line);
  border-radius:var(--r-lg);
  padding:22px 24px;
  box-shadow:var(--sh);
}
.side-card + .side-card { margin-top:0; }
.card-label {
  font-size:10px; font-weight:600; letter-spacing:0.10em;
  text-transform:uppercase; color:var(--t3); margin-bottom:14px;
}

/* Goal card */
/* Header row: label left, pct KPI right */
.goal-header-row {
  display:flex; justify-content:space-between; align-items:flex-start;
  margin-bottom:18px;
}
.goal-pct-kpi {
  text-align:right;
}
.goal-pct-num {
  font-family:'Geist Mono',monospace;
  font-size:32px; font-weight:300; letter-spacing:-1.5px;
  color:var(--mint); line-height:1;
}
.goal-pct-label {
  font-size:10px; font-weight:600; letter-spacing:0.08em;
  text-transform:uppercase; color:var(--t3); margin-top:4px;
}

/* Target weight display */
.goal-target-row {
  display:flex; align-items:baseline; gap:6px;
  margin-bottom:18px;
}
.goal-target-num {
  font-family:'Geist Mono',monospace;
  font-size:28px; font-weight:400; letter-spacing:-1px; color:var(--t1);
}
.goal-target-unit { font-size:13px; color:var(--t3); }
.goal-target-label {
  font-size:11px; color:var(--t3); margin-left:4px;
}

/* Progress track — taller for more presence */
.track {
  height:6px; background:var(--card2); border-radius:3px;
  margin-bottom:8px; position:relative; overflow:visible;
}
.track-fill {
  height:100%; border-radius:3px;
  background:linear-gradient(90deg, var(--mint), var(--cyan));
  transition:width .7s cubic-bezier(.4,0,.2,1); position:relative;
  box-shadow:0 0 8px rgba(0,229,176,0.25);
}
.track-fill::after {
  content:''; position:absolute; right:-6px; top:-5px;
  width:16px; height:16px; border-radius:50%;
  background:#fff; border:2.5px solid var(--mint);
  box-shadow:0 0 10px var(--mglow);
}
.track-lbls {
  display:flex; justify-content:space-between;
  font-family:'Geist Mono',monospace; font-size:10px; color:var(--t3);
  margin-bottom:16px;
}

/* Remaining row */
.goal-remain-row {
  display:flex; align-items:baseline; gap:5px;
  margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--line);
}
.goal-remain-pre  { font-size:13px; color:var(--t2); }
.goal-remain-num  {
  font-family:'Geist Mono',monospace;
  font-size:26px; font-weight:400; letter-spacing:-1px; color:var(--mint);
}
.goal-remain-unit { font-size:13px; color:rgba(0,229,176,0.55); }
.goal-achieved    { font-size:16px; color:var(--mint); font-weight:500; }

.goal-val { font-family:'Geist Mono',monospace; font-size:26px; font-weight:400; color:var(--t1); }
.goal-val.mint { color:var(--mint); }
.goal-val.sm   { font-size:18px; }
.goal-val.hero { font-size:28px; font-weight:300; letter-spacing:-1px; color:var(--mint); }
.goal-sub { font-size:10px; color:var(--t2); font-weight:500; letter-spacing:0.06em; text-transform:uppercase; }

.goal-input-row {
  display:flex; align-items:center; justify-content:space-between;
}
.goal-input-lbl { font-size:12px; color:var(--t2); }
.goal-input-wrap { display:flex; align-items:center; gap:6px; }
.mini-input {
  background:var(--card2); border:1px solid var(--line2); border-radius:8px;
  padding:6px 10px; color:var(--t1);
  font-family:'Geist Mono',monospace; font-size:14px;
  width:76px; outline:none; text-align:right;
  transition:border-color .2s; -moz-appearance:textfield;
}
.mini-input::-webkit-outer-spin-button, .mini-input::-webkit-inner-spin-button { -webkit-appearance:none; }
.mini-input:focus { border-color:var(--mint); }
.mini-unit { font-size:12px; color:var(--t3); }

/* BMI card */
.bmi-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
.bmi-big { font-family:'Geist Mono',monospace; font-size:42px; font-weight:300; letter-spacing:-2px; line-height:1; }
.bmi-cat { font-size:12px; font-weight:500; margin-top:5px; }
.bmi-bar-track {
  height:5px; border-radius:3px; overflow:hidden; margin-bottom:6px;
  background:linear-gradient(90deg,#60a5fa 0%,#00e5b0 27%,#fbbf24 58%,#f87171 100%);
  position:relative;
}
.bmi-pip {
  position:absolute; top:-5px;
  width:15px; height:15px; border-radius:50%;
  background:#fff; border:2.5px solid var(--bg);
  box-shadow:0 0 8px rgba(0,0,0,.8);
  transform:translateX(-50%); transition:left .5s cubic-bezier(.4,0,.2,1);
}
.bmi-ticks { display:flex; justify-content:space-between; font-size:9px; color:var(--t3); font-family:'Geist Mono',monospace; }
.ht-row { display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:10px; }

/* Streak card */
.streak-display { display:flex; align-items:baseline; gap:8px; margin-bottom:6px; }
.streak-num { font-family:'Geist Mono',monospace; font-size:52px; font-weight:300; letter-spacing:-2px; color:var(--blu); line-height:1; }
.streak-unit { font-size:16px; color:var(--t2); }
.streak-sub { font-size:12px; color:var(--t3); }

/* ── STAT STRIP ── */
.stat-cell {
  background:var(--card); border:1px solid var(--line);
  border-radius:var(--r-md); padding:12px 16px;
  box-shadow:var(--sh);
}
.sc-val {
  font-family:'Geist Mono',monospace;
  font-size:20px; font-weight:400; letter-spacing:-0.5px;
  line-height:1; margin-bottom:4px; color:var(--t1);
}
.sc-lbl { font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--t3); }

/* ── GRAPH ── */
.graph-card {
  background:var(--card); border:1px solid var(--line);
  border-radius:var(--r-lg); overflow:hidden;
  box-shadow:var(--sh); margin-bottom:20px;
}
.graph-head {
  display:flex; justify-content:space-between; align-items:center;
  padding:18px 24px 0;
}
.graph-title { font-size:10px; font-weight:600; letter-spacing:0.10em; text-transform:uppercase; color:var(--t3); margin-bottom:4px; }
.graph-cur { font-family:'Geist Mono',monospace; font-size:30px; font-weight:400; letter-spacing:-1px; color:var(--t1); }
.graph-cur span { font-size:14px; color:var(--t3); margin-left:3px; }
.period-row { display:flex; gap:2px; background:var(--card2); border-radius:10px; padding:3px; border:1px solid var(--line); }
.p-btn {
  padding:6px 16px; font-size:12px; font-weight:600;
  font-family:'Geist',sans-serif;
  border:none; border-radius:8px; cursor:pointer;
  color:var(--t3); background:none; transition:all .15s; letter-spacing:0.02em;
}
.p-btn.on { background:var(--card); color:var(--t1); box-shadow:0 1px 5px rgba(0,0,0,.5); }
.graph-body { padding:20px 0 8px; }
.ctip {
  background:rgba(8,14,26,0.96); backdrop-filter:blur(16px);
  border:1px solid rgba(0,229,176,0.2); border-radius:12px; padding:10px 14px;
}
.ctip-l { font-size:11px; color:var(--t3); margin-bottom:3px; }
.ctip-v { font-family:'Geist Mono',monospace; font-size:17px; font-weight:500; color:var(--mint); }

/* ── RECORDS TABLE ── */
.rec-table-wrap {
  background:var(--card); border:1px solid var(--line);
  border-radius:var(--r-lg); overflow:hidden; box-shadow:var(--sh);
}
.rec-table-head {
  display:flex; justify-content:space-between; align-items:center;
  padding:18px 24px 14px; border-bottom:1px solid var(--line);
}
.rec-table-cnt { font-size:12px; color:var(--t3); font-family:'Geist Mono',monospace; }
.rec-cols {
  display:grid; grid-template-columns:100px 120px 1fr 90px 60px;
  gap:0; padding:8px 24px; border-bottom:1px solid var(--line);
  background:rgba(255,255,255,0.02);
}
.rec-col-hd { font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--t3); }
.rec-row {
  display:grid; grid-template-columns:100px 120px 1fr 90px 60px;
  gap:0; padding:14px 24px; border-bottom:1px solid var(--line);
  transition:background .12s; align-items:center;
}
.rec-row:last-child { border-bottom:none; }
.rec-row:hover { background:rgba(255,255,255,0.02); }
.rec-date-col { display:flex; flex-direction:column; gap:2px; }
.rd { font-family:'Geist Mono',monospace; font-size:13px; font-weight:500; color:var(--t1); }
.rw { font-size:10px; color:var(--t3); }
.rec-weight { font-family:'Geist Mono',monospace; font-size:22px; font-weight:400; letter-spacing:-0.8px; color:var(--t1); }
.rec-weight span { font-size:12px; color:var(--t3); margin-left:2px; }
.rec-memo { font-size:13px; color:var(--t2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:16px; }
.rec-steps { font-family:'Geist Mono',monospace; font-size:13px; color:var(--t2); }
.pill { font-family:'Geist Mono',monospace; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; display:inline-block; }
.p-up { color:var(--red);  background:var(--rdim); }
.p-dn { color:var(--mint); background:var(--mdim); }
.p-eq { color:var(--t3);   background:rgba(255,255,255,0.04); border:1px solid var(--line); }

/* ── Animations ── */
@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
.fu  { animation:fadeUp .32s ease both; }
.d1  { animation-delay:.05s; }
.d2  { animation-delay:.10s; }
.d3  { animation-delay:.15s; }
.d4  { animation-delay:.20s; }

/* ── Record card (history view) ── */
.history-header {
  display:flex; justify-content:space-between; align-items:baseline;
  margin-bottom:20px;
}
.history-title { font-size:20px; font-weight:600; color:var(--t1); letter-spacing:-0.3px; }
.history-count { font-family:'Geist Mono',monospace; font-size:12px; color:var(--t3); }

.rec-card-item {
  background:var(--card);
  border:1px solid var(--line);
  border-radius:var(--r-md);         /* tighter radius — denser list feel */
  padding:14px 18px 14px 22px;       /* left room for accent bar */
  margin-bottom:8px;
  box-shadow:0 2px 12px rgba(0,0,0,0.3);
  transition:border-color .15s, background .15s;
  position:relative; overflow:hidden;
  display:flex; align-items:center; gap:16px;  /* horizontal layout */
}
.rec-card-item:hover {
  border-color:var(--line2);
  background:linear-gradient(90deg, rgba(255,255,255,0.015) 0%, transparent 100%);
}
/* Left accent bar */
.rec-card-item::before {
  content:''; position:absolute; left:0; top:12px; bottom:12px;
  width:3px; border-radius:0 2px 2px 0;
  background:var(--line2); transition:background .2s;
}
.rec-card-item.up::before   { background:var(--red);  box-shadow:0 0 6px rgba(248,113,113,0.35); }
.rec-card-item.down::before { background:var(--mint); box-shadow:0 0 6px rgba(0,229,176,0.35); }
.rec-card-item.flat::before { background:var(--amb); }

/* LEFT: weight — the hero */
.rc-weight-col { flex-shrink:0; width:96px; }
.rc-weight-row { display:flex; align-items:baseline; gap:3px; }
.rc-weight {
  font-family:'Geist Mono',monospace;
  font-size:28px; font-weight:400; letter-spacing:-1px; line-height:1;
  color:var(--t1);
}
.rc-weight-unit { font-size:12px; color:var(--t3); font-weight:400; padding-bottom:2px; }
.rc-diff {
  font-family:'Geist Mono',monospace; font-size:11px; font-weight:600;
  padding:2px 7px; border-radius:20px; margin-top:5px; display:inline-block;
}
.rc-diff.up   { color:var(--red);  background:var(--rdim); }
.rc-diff.down { color:var(--mint); background:var(--mdim); }
.rc-diff.flat { color:var(--t3);   background:rgba(255,255,255,0.05); border:1px solid var(--line); }

/* RIGHT: date + meta */
.rc-info-col {
  flex:1; min-width:0;
  display:flex; flex-direction:column; gap:5px;
}
.rc-date-row { display:flex; align-items:center; gap:6px; }
.rc-date {
  font-size:13px; font-weight:500; color:var(--t1); letter-spacing:-0.1px;
}
.rc-weekday { font-size:11px; color:var(--t3); }
.rc-meta {
  display:flex; flex-direction:column; gap:3px;
}
.rc-meta-item {
  display:flex; align-items:center; gap:5px;
  font-size:12px; color:var(--t2);
  white-space:nowrap; overflow:hidden;
}
.rc-meta-ico { font-size:11px; flex-shrink:0; opacity:0.8; }
.rc-memo-text {
  color:var(--t2); font-size:12px;
  overflow:hidden; text-overflow:ellipsis;
}

/* Empty state */
.rec-empty {
  text-align:center; padding:60px 20px;
  display:flex; flex-direction:column; align-items:center; gap:12px;
}
.rec-empty-icon { font-size:36px; opacity:0.4; }
.rec-empty-text { font-size:14px; color:var(--t3); }
.rec-empty-sub  { font-size:12px; color:var(--t3); opacity:0.7; }

/* ── Home 7-day mini chart ── */
.home-mini-chart {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 22px 28px 12px;
  box-shadow: var(--sh);
}
.home-mini-chart-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.home-mini-chart-title {
  font-size: 10px; font-weight: 600; letter-spacing: 0.10em;
  text-transform: uppercase; color: var(--t3);
}
.home-mini-chart-val {
  font-family: 'Geist Mono', monospace;
  font-size: 13px; color: var(--t2);
}

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════════════════════════ */

/* ── Tablet: 768–1023px ── */
@media (max-width: 1023px) {
  .sidebar {
    width: 64px;
    overflow: hidden;
  }
  .sidebar-logo { padding: 20px 0; display:flex; justify-content:center; }
  .sidebar-logo-text { display: none; }
  .sidebar-logo-sub  { display: none; }
  .sidebar-footer    { display: none; }
  .sidebar-nav { padding: 12px 8px; gap: 4px; }
  .nav-item {
    padding: 10px;
    justify-content: center;
    gap: 0;
  }
  .nav-item span { display: none; }
  .nav-item svg  { width: 20px; height: 20px; }
  .main { margin-left: 64px; }
  .topbar { padding: 16px 24px 14px; }
  .content { padding: 24px 24px 40px; }
  .home-grid { grid-template-columns: 1fr; }
  .stat-strip { grid-template-columns: repeat(3, 1fr); }
  .hero-card { padding: 28px 28px 24px; }
  .weight-input { font-size: 96px; letter-spacing: -5px; }
}

/* ── Mobile: ≤900px ── */
@media (max-width: 900px) {
  /* Hide sidebar entirely; show bottom tab nav */
  .sidebar     { display: none; }
  .mob-nav     { display: flex !important; }
  .main        { margin-left: 0; }
  .topbar {
    padding: 12px 16px 10px;
    align-items: center;
  }
  .topbar-date  { display: none; }
  .topbar-title { display: none; }   /* replaced by mob-logo on SP */
  .mob-logo     { display: flex; flex-direction: column; gap: 2px; }
  .mob-logo-name {
    font-size: 17px; font-weight: 600; letter-spacing: -0.3px;
    color: var(--t1); line-height: 1;
  }
  .mob-logo-name em { color: var(--mint); font-style: normal; }
  .mob-logo-sub {
    font-size: 11px; color: var(--t2);
    letter-spacing: 0.03em; line-height: 1;
  }
  .content     { padding: 28px 12px 100px; }

  /* Hero card */
  .hero-card {
    padding: 20px 18px 18px;
    border-radius: var(--r-lg);
  }
  .hero-top { margin-bottom: 14px; }
  .weight-input { font-size: 76px; letter-spacing: -4px; }
  .weight-unit  { font-size: 18px; }
  .weight-meta  { margin-bottom: 12px; }

  /* KPI strip: 2×2 grid instead of horizontal row */
  .hero-secondary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin-bottom: 16px;
    padding: 0;
    border-top: none;
    border-bottom: none;
  }
  .hs-item {
    padding: 11px 13px;           /* single definition — no duplicate */
    border: 1px solid var(--line);
    background: rgba(255,255,255,0.02);
    flex: none;                   /* override PC flex:1 — grid handles sizing */
  }
  /* 2×2 rounded corners */
  .hs-item:nth-child(1) { border-radius: var(--r-sm) 0 0 0; border-right: none; }
  .hs-item:nth-child(2) { border-radius: 0 var(--r-sm) 0 0; }
  .hs-item:nth-child(3) { border-radius: 0 0 0 var(--r-sm); border-right: none; border-top: none; }
  .hs-item:nth-child(4) { border-radius: 0 0 var(--r-sm) 0; border-top: none; }

  .hs-label {
    font-size: 10px;
    font-weight: 700;             /* bolder for small size readability */
    margin-bottom: 4px;
    color: #8fa8c8;               /* explicit bright value — not var(--t3) */
    display: block;
    letter-spacing: 0.04em;       /* tighter — easier to read at 10px */
    text-transform: uppercase;
    opacity: 1 !important;        /* ensure nothing hides it */
  }
  .hs-val {
    font-size: 13px;
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Geist', sans-serif;
  }

  .hero-inputs  { margin-bottom: 14px; }

  /* Home: single column */
  .home-grid        { grid-template-columns: 1fr; gap: 10px; }
  .home-grid-right  { gap: 10px; }

  /* Side cards: tighter vertical padding */
  .side-card  { padding: 14px 16px; }
  .goal-val   { font-size: 20px; }
  .bmi-big    { font-size: 30px; }
  .streak-num { font-size: 36px; }

  /* Card titles: visible on mobile (override var(--t3) which is too dark) */
  .card-label {
    margin-bottom: 10px;
    font-size: 12px;
    letter-spacing: 0.06em;
    color: #8fa8c8;     /* explicit bright value */
    opacity: 1;
  }
  .home-mini-chart-title {
    font-size: 12px;
    letter-spacing: 0.06em;
    color: #8fa8c8;
    opacity: 1;
  }

  /* BMI card: stack vertically on mobile */
  .bmi-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px;
  }
  .bmi-row > div:last-child {
    width: 100%;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px;
  }

  /* Constrain steps input so 「歩」 never gets pushed out */
  .num-inp { font-size: 14px; }
  .inp-unit { font-size: 12px; margin-left: 2px; }

  /* Graph: smaller height, remove bottom padding */
  .graph-head  { padding: 16px 14px 0; }
  .graph-cur   { font-size: 22px; }
  .graph-body  { padding-bottom: 0; }

  /* Mini home chart: reduce bottom whitespace */
  .home-mini-chart       { padding: 16px 14px 0; }
  .home-mini-chart-head  { margin-bottom: 10px; }

  /* Records */
  .rec-cols   { display: none; }
  .rec-row    { grid-template-columns: 52px 90px 1fr 0 48px; padding: 11px 14px; gap: 0; }
  .rec-memo   { display: none; }
  .rec-steps  { display: none; }
  .rec-weight { font-size: 18px; }
  .rec-table-head { padding: 12px 14px 10px; }
}

/* ── Mobile bottom nav ── */
/* ── Mobile tab bar ── */
.mob-nav {
  display: none !important; /* overridden to flex in mobile media query */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 9999;
  background: #071225;
  border-top: 1px solid rgba(255,255,255,0.10);
  /* padding broken out — env() in shorthand breaks some browsers */
  padding-top: 8px;
  padding-left: 8px;
  padding-right: 8px;
  padding-bottom: 16px; /* fallback */
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  justify-content: space-around;
  align-items: stretch;
  gap: 4px;
  min-height: 60px;
}

.mob-nav-btn {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  padding: 8px 4px 6px;
  background: none; border: none; cursor: pointer;
  border-radius: 12px;
  /* inactive: readable but not competing with content */
  color: rgba(255,255,255,0.38);
  font-family: 'Geist', sans-serif;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  transition: color .18s, background .18s;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  min-width: 0;
}

/* Active indicator: mint pill above icon */
.mob-nav-btn::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 0; height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--mint);
  box-shadow: 0 0 8px rgba(0,229,176,0.6);
  transition: width .22s cubic-bezier(.34,1.2,.64,1);
}
.mob-nav-btn.on::before { width: 28px; }

/* Active state */
.mob-nav-btn.on {
  color: var(--mint);
  background: rgba(0,229,176,0.07);
}

.mob-nav-btn:active {
  background: rgba(255,255,255,0.06);
  transform: scale(0.94);
  transition: transform .08s ease, background .08s ease;
}

.mob-nav-btn svg {
  width: 22px; height: 22px; stroke-width: 1.6;
  transition: transform .18s cubic-bezier(.34,1.2,.64,1);
}
.mob-nav-btn.on svg {
  transform: scale(1.08);
}

/* Label */
.mob-nav-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.03em; line-height: 1;
}

/* SP-only bottom nav */
.sp-nav { display: none; }
@media (max-width: 767px) {
  .sp-nav { display: flex; }
}

`;

/* ── Components ── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ctip">
      <div className="ctip-l">{label}</div>
      <div className="ctip-v">{payload[0].value} kg</div>
    </div>
  );
};

const NavIco = ({ id }) => {
  const d = {
    home:  <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    graph: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    list:  <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{d[id]}</svg>;
};

/* ════════════════════════════════════════════════════════
   APP
════════════════════════════════════════════════════════ */
export default function App() {
  const [tab,      setTab]      = useState(0);
  const [data,     setData]     = useState(load);
  const [date,     setDate]     = useState(todayStr);
  const [wVal,     setWVal]     = useState("");
  const [stepsVal, setStepsVal] = useState("");
  const [memoVal,  setMemoVal]  = useState("");
  const [goalStr,  setGoalStr]  = useState("");
  const [htStr,    setHtStr]    = useState("");
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [period,   setPeriod]   = useState(30);

  useEffect(() => {
    const r = (data.records || []).find(r => r.date === date);
    setWVal    (r?.weight != null ? String(r.weight) : "");
    setStepsVal(r?.steps  != null ? String(r.steps)  : "");
    setMemoVal (r?.memo || "");
    setSaved(false);
  }, [date, data.records]);

  useEffect(() => {
    setGoalStr(data.goal   != null ? String(data.goal)   : "");
    setHtStr  (data.height != null ? String(data.height) : "");
  }, [data.goal, data.height]);

  /* derived */
  const records = useMemo(() =>
    (data.records || []).slice().sort((a, b) => b.date.localeCompare(a.date)), [data]);
  const wRecs   = useMemo(() => records.filter(r => r.weight != null), [records]);
  const latest  = wRecs[0];
  const prevRec = wRecs[1];
  const diff    = latest && prevRec ? +(latest.weight - prevRec.weight).toFixed(1) : null;
  const goal    = data.goal   ?? null;
  const height  = data.height ?? null;
  const bmi     = latest && height ? +(latest.weight / ((height / 100) ** 2)).toFixed(1) : null;
  const bmiCat  = bmi ? bmiInfo(bmi) : null;
  const bmiPct  = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100)) : null;

  const avg7 = useMemo(() => {
    const cut = addDays(todayStr(), -6);
    const ws  = wRecs.filter(r => r.date >= cut).map(r => r.weight);
    return ws.length ? +(ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(1) : null;
  }, [wRecs]);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 365; i++) {
      if (wRecs.find(r => r.date === addDays(todayStr(), -i))) s++;
      else break;
    }
    return s;
  }, [wRecs]);

  const startW     = wRecs.length ? wRecs[wRecs.length - 1].weight : null;
  const toGoal     = latest && goal != null ? +(latest.weight - goal).toFixed(1) : null;
  const totalDelta = startW != null && goal != null ? startW - goal : null;
  const doneDelta  = startW != null && latest ? startW - latest.weight : 0;
  const goalPct    = totalDelta && totalDelta !== 0
    ? Math.max(0, Math.min(100, (doneDelta / totalDelta) * 100)) : 0;

  const chartData = useMemo(() => {
    const cut = addDays(todayStr(), -(period - 1));
    return [...wRecs].filter(r => r.date >= cut).reverse()
      .map(r => ({ date: fmtShort(r.date), weight: r.weight }));
  }, [wRecs, period]);
  const cMin = useMemo(() => chartData.length ? Math.min(...chartData.map(d => d.weight)) - 0.8 : 50, [chartData]);
  const cMax = useMemo(() => chartData.length ? Math.max(...chartData.map(d => d.weight)) + 0.8 : 80, [chartData]);

  const saveRecord = useCallback(() => {
    const num = parseFloat(wVal);
    if (isNaN(num) && !stepsVal && !memoVal) return;
    const rec = {
      date,
      weight: !isNaN(num) ? +num.toFixed(1) : null,
      steps:  stepsVal ? parseInt(stepsVal) : null,
      memo:   memoVal.trim() || null,
    };
    setData(prev => {
      const next = { ...prev, records: [...(prev.records || []).filter(r => r.date !== date), rec] };
      persist(next); return next;
    });
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 120);
  }, [date, wVal, stepsVal, memoVal]);

  const saveMeta = useCallback((key, raw) => {
    const n = parseFloat(raw);
    setData(prev => { const next = { ...prev, [key]: isNaN(n) ? null : n }; persist(next); return next; });
  }, []);

  const DiffPill = () => {
    if (diff === null) return <span className="diff-pill nil">初回記録</span>;
    if (diff > 0)      return <span className="diff-pill up">↑ +{diff} kg</span>;
    if (diff < 0)      return <span className="diff-pill dn">↓ {diff} kg</span>;
    return                   <span className="diff-pill nil">±0 kg</span>;
  };

  const pillOf = (d) => {
    if (d == null) return null;
    if (d > 0) return { cls: "p-up", txt: `+${d}` };
    if (d < 0) return { cls: "p-dn", txt: `${d}`  };
    return       { cls: "p-eq", txt: "±0" };
  };

  const NAV = [
    { id: "home",  label: "ダッシュボード" },
    { id: "graph", label: "グラフ" },
    { id: "list",  label: "記録一覧" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="noise"/>
      <div className="orb orb1"/>
      <div className="orb orb2"/>

      <div className="app">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-text">Weight<em>Flow</em></div>
            <div className="sidebar-logo-sub">health tracking</div>
          </div>
          <nav className="sidebar-nav">
            {NAV.map((n, i) => (
              <button key={i} className={`nav-item${tab === i ? " on" : ""}`} onClick={() => setTab(i)}>
                <NavIco id={n.id}/>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            {new Date().toLocaleDateString("ja-JP", { year:"numeric", month:"long", day:"numeric" })}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          <div className="topbar">
            {/* PC: page title / SP: WeightFlow brand */}
            <div className="topbar-title">
              {["ダッシュボード", "グラフ", "記録一覧"][tab]}
            </div>
            <div className="mob-logo">
              <div className="mob-logo-name">Weight<em>Flow</em></div>
              <div className="mob-logo-sub">health tracking</div>
            </div>
            <div className="topbar-date">
              {new Date().toLocaleDateString("ja-JP", { month:"long", day:"numeric", weekday:"long" })}
            </div>
          </div>

          <div className="content">

            {/* ══════════ DASHBOARD ══════════ */}
            {tab === 0 && (
              <>
                {/* 2-column: hero left, sidebar right */}
                <div className="home-grid">
                  {/* ── LEFT: Weight hero ── */}
                  <div className="hero-card fu">
                    <div className="hero-top">
                      <div className="hero-eyebrow">今日の体重</div>
                      <input className="date-input" type="date" value={date}
                        onChange={e => setDate(e.target.value)}/>
                    </div>

                    <div className="number-wrap">
                      <input
                        className="weight-input"
                        type="number" step="0.1" placeholder="—"
                        value={wVal}
                        onChange={e => setWVal(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveRecord()}
                      />
                    </div>

                    <div className="weight-meta">
                      <span className="weight-unit">kg</span>
                      <DiffPill/>
                    </div>

                    {/* Trend context line — plain language */}
                    {(() => {
                      const recentWs = wRecs.slice(0, 7).map(r => r.weight);
                      let trendColor = "var(--t3)";
                      let trendDot   = "var(--t3)";
                      let trendText  = "今日から記録をはじめましょう";
                      if (recentWs.length === 1) {
                        trendText  = "記録スタート。続けるほど精度が上がります";
                        trendColor = "var(--t2)";
                        trendDot   = "var(--mint)";
                      } else if (recentWs.length === 2) {
                        trendText  = "記録2日目。あと数日で傾向が見えてきます";
                        trendColor = "var(--t2)";
                        trendDot   = "var(--mint)";
                      } else if (recentWs.length >= 3) {
                        const first = recentWs[recentWs.length - 1];
                        const last  = recentWs[0];
                        const delta = +(last - first).toFixed(1);
                        if (delta > 0.5) {
                          trendColor = "var(--red)";
                          trendDot   = "var(--red)";
                          trendText  = `直近7日で +${delta} kg。食事と歩数を見直してみましょう`;
                        } else if (delta < -0.5) {
                          trendColor = "var(--mint)";
                          trendDot   = "var(--mint)";
                          trendText  = `直近7日で ${delta} kg。いいペースで進んでいます`;
                        } else {
                          trendColor = "var(--t2)";
                          trendDot   = "var(--amb)";
                          trendText  = "直近7日は横ばい。食事内容を振り返るタイミングです";
                        }
                      }
                      return (
                        <div className="trend-line" style={{color: trendColor}}>
                          <span className="dot" style={{background: trendDot}}/>
                          {trendText}
                        </div>
                      );
                    })()}

                    <div className="hero-secondary">
                      {/* あと何kg — primary, most actionable */}
                      <div className="hs-item primary">
                        <div className="hs-label">目標まで</div>
                        {toGoal == null
                          ? <div key="unset" className="hs-sentence muted kpi-val">目標体重を設定してください</div>
                          : toGoal <= 0
                          ? <div key="done" className="hs-sentence mint kpi-val">目標達成🎉</div>
                          : <div key={toGoal} className="hs-sentence kpi-val">
                              あと <span className="hs-accent">{Math.abs(toGoal)}</span> kg
                            </div>
                        }
                      </div>
                      {/* 前回比 */}
                      <div className="hs-item">
                        <div className="hs-label">前回比</div>
                        <div key={diff} className={`hs-val kpi-val${diff == null ? "" : diff > 0 ? " red" : diff < 0 ? " mint" : ""}`}>
                          {diff == null
                            ? <span style={{fontSize:13,color:"var(--t3)"}}>—</span>
                            : <>{diff > 0 ? "+" : ""}{diff}<span style={{fontSize:12,marginLeft:3,color:"var(--t3)"}}>kg</span></>
                          }
                        </div>
                      </div>
                      {/* 7日平均 */}
                      <div className="hs-item">
                        <div className="hs-label">7日平均</div>
                        <div key={avg7} className="hs-val kpi-val">
                          {avg7 != null
                            ? <>{avg7}<span style={{fontSize:12,marginLeft:3,color:"var(--t3)"}}>kg</span></>
                            : <span style={{fontSize:13,color:"var(--t3)"}}>—</span>
                          }
                        </div>
                      </div>
                      {/* 連続記録 */}
                      <div className="hs-item">
                        <div className="hs-label">連続記録</div>
                        <div key={streak} className="hs-val kpi-val">
                          {streak}<span style={{fontSize:12,marginLeft:3,color:"var(--t3)"}}>日</span>
                        </div>
                      </div>
                    </div>

                    <div className="hero-inputs">
                      <div className="input-row">
                        <span className="input-ico">🚶</span>
                        <span className="input-lbl">歩数</span>
                        <input className="num-inp" type="number" placeholder="0"
                          value={stepsVal} onChange={e => setStepsVal(e.target.value)}/>
                        <span className="inp-unit">歩</span>
                      </div>
                      <div className="input-row">
                        <span className="input-ico">🥗</span>
                        <span className="input-lbl">食事</span>
                        <input className="text-inp" type="text" placeholder="今日の食事メモ..."
                          value={memoVal} onChange={e => setMemoVal(e.target.value)}/>
                      </div>
                    </div>

                    <button
                      className={`save-btn${saving ? " saving" : saved ? " ok" : ""}`}
                      onClick={saveRecord}
                    >
                      {saving
                        ? "保存中..."
                        : saved
                        ? <><span className="btn-check">✓</span>{"  保存しました"}</>
                        : "記録する"
                      }
                    </button>
                  </div>

                  {/* ── RIGHT column ── */}
                  <div className="home-grid-right">
                    {/* Goal */}
                    <div className="side-card fu d1">
                      <div className="card-label">目標体重</div>

                      {/* ① 達成まであと 3kg — 完全に1行 */}
                      {toGoal == null ? (
                        <div style={{fontSize:13,color:"var(--t3)",padding:"12px 0",lineHeight:1.8}}>
                          目標体重を設定してください
                        </div>
                      ) : toGoal <= 0 ? (
                        <div style={{fontSize:18,color:"var(--mint)",fontWeight:500,padding:"12px 0"}}>🎉 目標達成！</div>
                      ) : (
                        <div style={{
                          display:"flex",
                          flexDirection:"row",
                          alignItems:"baseline",
                          justifyContent:"center",
                          flexWrap:"nowrap",
                          gap:6,
                          padding:"12px 0 14px",
                        }}>
                          <span style={{fontSize:13,color:"var(--t2)",fontWeight:600,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
                            達成まであと
                          </span>
                          <span key={toGoal} className="kpi-val" style={{
                            fontFamily:"'Geist Mono',monospace",
                            fontSize:52,fontWeight:300,letterSpacing:"-2.5px",
                            lineHeight:1,color:"var(--mint)",
                          }}>
                            {Math.abs(toGoal)}
                          </span>
                          <span style={{
                            fontFamily:"'Geist Mono',monospace",
                            fontSize:22,fontWeight:300,
                            color:"rgba(0,229,176,0.55)",
                            paddingBottom:4,
                          }}>
                            kg
                          </span>
                        </div>
                      )}

                      {/* ② 現在 58kg → 55kg 目標 */}
                      {goal != null && (
                        <div style={{
                          display:"flex",alignItems:"center",
                          flexDirection:"row",flexWrap:"nowrap",gap:5,
                          justifyContent:"center",
                          padding:"10px 0",
                          borderTop:"1px solid var(--line)",
                          borderBottom:"1px solid var(--line)",
                          marginBottom:13,
                          fontFamily:"'Geist Mono',monospace",fontSize:14,
                        }}>
                          <span style={{fontSize:10,color:"var(--t3)",fontWeight:600,letterSpacing:"0.06em"}}>現在</span>
                          <span style={{fontSize:18,fontWeight:400,letterSpacing:"-0.8px",color:"var(--t1)"}}>{latest?.weight ?? "—"}</span>
                          <span style={{fontSize:11,color:"var(--t3)"}}>kg</span>
                          <span style={{fontSize:12,color:"var(--t3)",margin:"0 2px"}}>→</span>
                          <span style={{fontSize:18,fontWeight:400,letterSpacing:"-0.8px",color:"var(--mint)"}}>{goal}</span>
                          <span style={{fontSize:11,color:"rgba(0,229,176,0.45)"}}>kg</span>
                          <span style={{fontSize:10,color:"var(--t3)",fontWeight:600,letterSpacing:"0.06em"}}>目標</span>
                        </div>
                      )}

                      {/* ③ 進捗バー */}
                      {goal != null && latest && (
                        <div style={{marginBottom:16}}>
                          <div className="track">
                            <div className="track-fill" style={{width:`${Math.max(2,goalPct)}%`}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Geist Mono',monospace",fontSize:10,color:"var(--t3)",marginTop:5}}>
                            <span>{startW} kg</span>
                            <span>{goal} kg</span>
                          </div>
                        </div>
                      )}

                      {/* ④ 入力フッター */}
                      <div className="goal-input-row">
                        <span className="goal-input-lbl">目標を設定</span>
                        <div className="goal-input-wrap">
                          <input className="mini-input" type="number" step="0.1" placeholder="60.0"
                            value={goalStr}
                            onChange={e=>{ setGoalStr(e.target.value); saveMeta("goal",e.target.value); }}/>
                          <span className="mini-unit">kg</span>
                        </div>
                      </div>
                    </div>

                    {/* BMI + streak combined */}
                    <div className="side-card fu d2">
                      <div className="card-label">BMI</div>
                      <div className="bmi-row">
                        <div>
                          {bmi
                            ? <>
                                <div className="bmi-big" style={{color:bmiCat.color}}>{bmi}</div>
                                <div className="bmi-cat" style={{color:bmiCat.color}}>{bmiCat.label}</div>
                              </>
                            : <div style={{fontSize:13,color:"var(--t3)"}}>身長を入力してください</div>
                          }
                        </div>
                        <div className="ht-row" style={{flexDirection:"column",alignItems:"flex-end",justifyContent:"flex-start",gap:4}}>
                          <div style={{fontSize:10,color:"var(--t3)",letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>身長</div>
                          <div className="goal-input-wrap">
                            <input className="mini-input" type="number" step="0.5" placeholder="170"
                              value={htStr}
                              onChange={e => { setHtStr(e.target.value); saveMeta("height", e.target.value); }}/>
                            <span className="mini-unit">cm</span>
                          </div>
                        </div>
                      </div>
                      {bmiPct != null && (
                        <>
                          <div className="bmi-bar-track">
                            <div className="bmi-pip" style={{left:`${bmiPct}%`}}/>
                          </div>
                          <div className="bmi-ticks">
                            <span>15</span><span>18.5</span><span>25</span><span>30</span><span>35</span>
                          </div>
                        </>
                      )}
                      {/* Streak row — folded into BMI card */}
                      <div style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        marginTop:14, paddingTop:12, borderTop:"1px solid var(--line)"
                      }}>
                        <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.10em",textTransform:"uppercase",color:"var(--t3)"}}>連続記録</span>
                        <span style={{fontFamily:"'Geist Mono',monospace",fontSize:16,color:streak>0?"var(--blu)":"var(--t3)"}}>
                          {streak}<span style={{fontSize:12,marginLeft:3,color:"var(--t3)"}}>日</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 7-day mini trend chart ── */}
                {(() => {
                  // Use real 7-day records if available, pad with dummy if < 7
                  const today = todayStr();
                  const days = Array.from({length:7}, (_,i) => addDays(today, -(6-i)));
                  const chartPoints = days.map(d => {
                    const rec = wRecs.find(r => r.date === d);
                    // dummy baseline: latest weight ± small noise, or 65kg fallback
                    const base = latest?.weight ?? 65.0;
                    const dummyNoise = [0.6,-0.3,0.8,-0.5,0.2,-0.7,0.4];
                    const idx = days.indexOf(d);
                    return {
                      date: fmtShort(d),
                      weight: rec ? rec.weight : +(base + dummyNoise[idx]).toFixed(1),
                      real: !!rec,
                    };
                  });
                  const vals = chartPoints.map(p => p.weight);
                  const lo = Math.min(...vals) - 1.5;
                  const hi = Math.max(...vals) + 1.5;
                  const hasReal = chartPoints.some(p => p.real);
                  return (
                    <div className="home-mini-chart fu d4">
                      <div className="home-mini-chart-head">
                        <div className="home-mini-chart-title">7日間の推移</div>
                        <div className="home-mini-chart-val" style={{
                          color: (() => {
                            const realPts = chartPoints.filter(p => p.real);
                            if (realPts.length < 2) return "var(--t3)";
                            const d = +(realPts[realPts.length-1].weight - realPts[0].weight).toFixed(1);
                            return d < 0 ? "var(--mint)" : d > 0 ? "var(--red)" : "var(--t2)";
                          })()
                        }}>
                          {(() => {
                            const realPts = chartPoints.filter(p => p.real);
                            if (realPts.length === 0) return "今週はまだ未記録";
                            if (realPts.length === 1) return "記録開始 — 継続で傾向が見える";
                            const delta = +(realPts[realPts.length-1].weight - realPts[0].weight).toFixed(1);
                            const sign = delta > 0 ? "+" : "";
                            return `直近7日 ${sign}${delta} kg`;
                          })()}
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartPoints} margin={{top:4,right:8,left:0,bottom:0}}>
                          <defs>
                            {/* Subtle area fill — fades to transparent quickly */}
                            <linearGradient id="hmg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#00e5b0" stopOpacity={0.10}/>
                              <stop offset="60%"  stopColor="#00e5b0" stopOpacity={0.03}/>
                              <stop offset="100%" stopColor="#00e5b0" stopOpacity={0}/>
                            </linearGradient>
                            {/* Glow filter for the line */}
                            <filter id="glow-mini" x="-20%" y="-80%" width="140%" height="260%">
                              <feGaussianBlur stdDeviation="2.5" result="blur"/>
                              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                            </filter>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false}/>
                          <XAxis
                            dataKey="date"
                            tick={{fontSize:11, fill:"#4e6480", fontFamily:"'Geist Mono',monospace"}}
                            tickLine={false} axisLine={false}
                          />
                          <YAxis
                            domain={[lo, hi]}
                            tick={{fontSize:11, fill:"#4e6480", fontFamily:"'Geist Mono',monospace"}}
                            tickLine={false} axisLine={false}
                            width={34}
                          />
                          <Tooltip content={<ChartTip/>} cursor={{stroke:"rgba(0,229,176,0.10)",strokeWidth:1,strokeDasharray:"3 3"}}/>
                          <Area
                            type="monotoneX" dataKey="weight"
                            stroke="#00e5b0" strokeWidth={1.5}
                            fill="url(#hmg)"
                            filter="url(#glow-mini)"
                            dot={(props) => {
                              const pt = chartPoints[props.index];
                              if (!pt?.real) return null;
                              return <circle key={props.index} cx={props.cx} cy={props.cy} r={2.5}
                                fill="#00e5b0" fillOpacity={0.9} stroke="rgba(0,229,176,0.25)" strokeWidth={4}/>;
                            }}
                            activeDot={{r:4, fill:"#00e5b0", strokeWidth:3, stroke:"rgba(0,229,176,0.25)"}}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

              </>
            )}

            {/* ══════════ GRAPH ══════════ */}
            {tab === 1 && (
              <>
                {/* Stat strip */}
                <div className="stat-strip fu">
                  {(() => {
                    const ws = wRecs.map(r => r.weight);
                    const mn = ws.length ? Math.min(...ws).toFixed(1) : "—";
                    const mx = ws.length ? Math.max(...ws).toFixed(1) : "—";
                    const av = ws.length ? (ws.reduce((a,b)=>a+b,0)/ws.length).toFixed(1) : "—";
                    return <>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--mint)"}}>{latest?.weight ?? "—"}</div>
                        <div className="sc-lbl">現在体重</div>
                      </div>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--t2)"}}>{avg7 ?? "—"}</div>
                        <div className="sc-lbl">7日平均</div>
                      </div>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--blu)"}}>{mn}</div>
                        <div className="sc-lbl">最低</div>
                      </div>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--t2)"}}>{av}</div>
                        <div className="sc-lbl">全期間平均</div>
                      </div>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--amb)"}}>{mx}</div>
                        <div className="sc-lbl">最高</div>
                      </div>
                      <div className="stat-cell">
                        <div className="sc-val" style={{color:"var(--blu)"}}>{streak}<span style={{fontSize:14,color:"var(--t3)",marginLeft:3}}>日</span></div>
                        <div className="sc-lbl">連続記録</div>
                      </div>
                    </>;
                  })()}
                </div>

                {/* Big graph */}
                <div className="graph-card fu d1">
                  <div className="graph-head">
                    <div>
                      <div className="graph-title">体重推移</div>
                      <div className="graph-cur">{latest?.weight ?? "—"}<span>kg</span></div>
                    </div>
                    <div className="period-row">
                      {[7, 30, 90].map(p => (
                        <button key={p} className={`p-btn${period===p?" on":""}`} onClick={() => setPeriod(p)}>
                          {p}日
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="graph-body">
                    {chartData.length < 2
                      ? <div style={{textAlign:"center",padding:"60px 0",fontSize:14,color:"var(--t3)"}}>
                          2件以上の記録でグラフが表示されます
                        </div>
                      : <ResponsiveContainer width="100%" height={420}>
                          <AreaChart data={chartData} margin={{top:10,right:28,left:4,bottom:4}}>
                            <defs>
                              {/* Area fill — gentle top-fade, mostly transparent */}
                              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="#00e5b0" stopOpacity={0.12}/>
                                <stop offset="50%"  stopColor="#00e5b0" stopOpacity={0.04}/>
                                <stop offset="100%" stopColor="#00e5b0" stopOpacity={0}/>
                              </linearGradient>
                              {/* Soft glow on the line */}
                              <filter id="glow-main" x="-10%" y="-80%" width="120%" height="260%">
                                <feGaussianBlur stdDeviation="3" result="blur"/>
                                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                              </filter>
                            </defs>
                            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false}/>
                            <XAxis dataKey="date"
                              tick={{fontSize:11,fill:"#4e6480",fontFamily:"'Geist Mono',monospace"}}
                              tickLine={false} axisLine={false}
                              interval={period===7?0:period===30?3:9}/>
                            <YAxis domain={[cMin,cMax]}
                              tick={{fontSize:11,fill:"#4e6480",fontFamily:"'Geist Mono',monospace"}}
                              tickLine={false} axisLine={false} width={36}/>
                            <Tooltip content={<ChartTip/>} cursor={{stroke:"rgba(0,229,176,0.08)",strokeWidth:1,strokeDasharray:"4 3"}}/>
                            {goal && <ReferenceLine y={goal} stroke="rgba(251,191,36,0.35)" strokeDasharray="5 4"
                              label={{value:`目標 ${goal}`,fill:"#fbbf24",fontSize:11,position:"insideTopRight"}}/>}
                            {avg7 && <ReferenceLine y={avg7} stroke="rgba(96,165,250,0.28)" strokeDasharray="3 3"
                              label={{value:`7日平均`,fill:"#60a5fa",fontSize:11,position:"insideBottomRight"}}/>}
                            <Area type="monotoneX" dataKey="weight"
                              stroke="#00e5b0" strokeWidth={1.5}
                              fill="url(#wg)"
                              filter="url(#glow-main)"
                              dot={period===7
                                ? {fill:"#00e5b0", fillOpacity:0.9, r:3,
                                   stroke:"rgba(0,229,176,0.25)", strokeWidth:4}
                                : false}
                              activeDot={{r:4, fill:"#00e5b0", strokeWidth:3, stroke:"rgba(0,229,176,0.22)"}}/>
                          </AreaChart>
                        </ResponsiveContainer>
                    }
                  </div>
                </div>
              </>
            )}

            {/* ══════════ RECORDS ══════════ */}
            {tab === 2 && (
              <div>
                {/* Header */}
                <div className="history-header fu">
                  <div className="history-title">記録一覧</div>
                  <div className="history-count">{records.length} 件</div>
                </div>

                {records.length === 0 ? (
                  <div className="rec-empty fu">
                    <div className="rec-empty-icon">📋</div>
                    <div className="rec-empty-text">まだ記録がありません</div>
                    <div className="rec-empty-sub">ダッシュボードから体重を記録してみましょう</div>
                  </div>
                ) : (
                  records.map((r, i) => {
                    // calc diff vs previous weight record
                    const wr  = wRecs.find(x => x.date === r.date);
                    const wi  = wRecs.indexOf(wr);
                    const pr  = wRecs[wi + 1];
                    const d   = wr && pr ? +(wr.weight - pr.weight).toFixed(1) : null;
                    const dir = d == null ? "neutral" : d > 0 ? "up" : d < 0 ? "down" : "flat";

                    // date formatting
                    const dateObj   = new Date(r.date + "T00:00:00");
                    const dateFmt   = dateObj.toLocaleDateString("ja-JP", { year:"numeric", month:"long", day:"numeric" });
                    const weekday   = dateObj.toLocaleDateString("ja-JP", { weekday:"long" });
                    const isToday   = r.date === todayStr();
                    const isYest    = r.date === addDays(todayStr(), -1);
                    const dateLabel = isToday ? "今日" : isYest ? "昨日" : dateFmt;

                    return (
                      <div
                        key={r.date}
                        className={`rec-card-item${dir === "up" ? " up" : dir === "down" ? " down" : dir === "flat" ? " flat" : ""}`}
                        style={{animation:`fadeUp .28s ease ${Math.min(i, 8) * .04}s both`}}
                      >
                        {/* Top: date + diff */}
                          {/* LEFT: weight (hero) + diff */}
                        <div className="rc-weight-col">
                          <div className="rc-weight-row">
                            {r.weight != null
                              ? <><div className="rc-weight">{r.weight}</div><div className="rc-weight-unit">kg</div></>
                              : <div className="rc-weight" style={{color:"var(--t3)"}}>—</div>
                            }
                          </div>
                          {d != null && (
                            <div className={`rc-diff${d > 0 ? " up" : d < 0 ? " down" : " flat"}`}>
                              {d > 0 ? `+${d}` : d}
                            </div>
                          )}
                        </div>

                        {/* RIGHT: date + steps + memo */}
                        <div className="rc-info-col">
                          <div className="rc-date-row">
                            <div className="rc-date">{dateLabel}</div>
                            {!isToday && !isYest && <div className="rc-weekday">{weekday}</div>}
                          </div>
                          <div className="rc-meta">
                            {r.steps != null && (
                              <div className="rc-meta-item">
                                <span className="rc-meta-ico">🚶</span>
                                <span>{r.steps.toLocaleString()} 歩</span>
                              </div>
                            )}
                            {r.memo && (
                              <div className="rc-meta-item">
                                <span className="rc-meta-ico">🥗</span>
                                <span className="rc-memo-text">{r.memo}</span>
                              </div>
                            )}
                            {!r.steps && !r.memo && (
                              <div style={{fontSize:11,color:"var(--t3)"}}>メモなし</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        </main>

        {/* ── Mobile bottom nav (SP only — hidden ≥768px via CSS) ── */}
        <nav style={{
          position:'fixed', bottom:12, left:14, right:14, height:58,
          background:'rgba(6,10,20,0.82)',
          backdropFilter:'blur(24px) saturate(1.6)',
          WebkitBackdropFilter:'blur(24px) saturate(1.6)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:999, zIndex:999999,
          justifyContent:'space-around', alignItems:'center',
        }} className="sp-nav">
          {[
            {label:"ホーム",  i:0},
            {label:"グラフ",  i:1},
            {label:"記録",    i:2},
          ].map(({label, i}) => (
            <button key={i} onClick={() => setTab(i)} style={{
              background:'none', border:'none', cursor:'pointer',
              color: tab===i ? '#14F1C9' : 'rgba(255,255,255,0.38)',
              fontSize:12, fontWeight:600, padding:'8px 22px',
              letterSpacing:'0.03em',
              transition:'color .18s',
            }}>
              {label}
            </button>
          ))}
        </nav>

      </div>
    </>
  );
}
