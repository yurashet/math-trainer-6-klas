'use strict';
/* ============================================================
   app.js — Матэматычны трэнажор, 6 клас
   1) §-выбар «раздзел → §» (панэль на галоўнай, docs/design-sub.md)
   2) генератары з generators.js: window.SUBS / window.GEN_BY_SUB
   3) стан v3: localStorage['mt6_state_v3'], subs['chapter:S<N>']

   Кананічны ключ § — 'decimals:S4': ён жа ключ GEN_BY_SUB і data-scope.
   Мадэль — 1:1 па docs/data-model-sub.md (§5.7, §6).
   ============================================================ */

const STORE_KEY = 'mt6_state_v3';
const LEGACY_KEY = 'mt6_state_v2';
const CHAPTERS = ['decimals', 'percent', 'sets', 'rational', 'coords', 'geometry'];
const SUBS_COUNT = (function () {
  const base = { decimals: 10, percent: 7, sets: 4, rational: 9, coords: 3, geometry: 5 };
  if (typeof window !== 'undefined' && window.SUBS) {
    CHAPTERS.forEach(ch => { if (window.SUBS[ch] && window.SUBS[ch].length) base[ch] = window.SUBS[ch].length; });
  }
  return base;
})();
const DEFAULT_LEVEL = 3, MIN_LEVEL = 1, MAX_LEVEL = 10, MIX_LEVEL = 5;
const BADGE_IDS = ['first', 'ten', 'fifty', 'hundred', 'streak3', 'grade8', 'grade10', 'perfect'];

const TOPICS = [
  { id: 'decimals', name: 'Дзесятковыя дробы', emoji: '🔟' },
  { id: 'percent',  name: 'Працэнты і прапорцыі', emoji: '💯' },
  { id: 'sets',     name: 'Мноствы', emoji: '🎲' },
  { id: 'rational', name: 'Рацыянальныя лікі', emoji: '➕' },
  { id: 'coords',   name: 'Каардынатная плоскасць', emoji: '📈' },
  { id: 'geometry', name: 'Наглядная геаметрыя', emoji: '📐' }
];
const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));

/* ---------- дробныя прыборы ---------- */
function $(id) { return document.getElementById(id); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
function intNonNeg(v) { const n = num(v); return n > 0 ? Math.floor(n) : 0; }
function clampLevel(v) {
  const n = Math.floor(num(v));
  if (n < MIN_LEVEL) return DEFAULT_LEVEL;
  return Math.min(MAX_LEVEL, n);
}
function isDay(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
/* acc — працэнт 0..100, ratio — доля 0..1 (для шырыні бараў) */
function accOf(c, t) { return t > 0 ? Math.round(c / t * 100) : null; }
function ratioOf(c, t) { return t > 0 ? Math.round(c / t * 1000) / 1000 : null; }
/* лік для чалавека: «−12,5», «3,14» */
function fmt(x) {
  const v = Math.round(x * 1000) / 1000;
  return String(v).replace('-', '−').replace('.', ',');
}
/* тэкст пытання: 1.5 → 1,5 (генератары ўжо даюць коску) */
function loc(s) { return String(s).replace(/(\d)\.(\d)/g, '$1,$2'); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pluralSubs(n) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'параграф';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'параграфы';
  return 'параграфаў';
}
function clampGrade(acc) { return Math.max(1, Math.min(10, Math.round(1 + acc * 9))); }
function overallGrade(s) { if (!s.solved) return null; return clampGrade(s.correct / s.solved); }

const BADGES = [
  { id: 'first', name: 'Першы крок', emoji: '🐣', test: s => s.solved >= 1 },
  { id: 'ten', name: 'Дзясятак', emoji: '🔟', test: s => s.solved >= 10 },
  { id: 'fifty', name: 'Паўсотні', emoji: '🏅', test: s => s.solved >= 50 },
  { id: 'hundred', name: 'Сотня!', emoji: '🏆', test: s => s.solved >= 100 },
  { id: 'streak3', name: '3 дні запар', emoji: '🔥', test: s => s.streakDays >= 3 },
  { id: 'grade8', name: 'Адзнака 8+', emoji: '🌟', test: s => overallGrade(s) >= 8 },
  { id: 'grade10', name: 'Ідэальна 10!', emoji: '💎', test: s => overallGrade(s) >= 10 && s.solved >= 20 },
  { id: 'perfect', name: 'Бездакорная сесія', emoji: '✨', test: s => s.hadPerfectSession }
];

/* ============================================================
   Мадэль даных v3 (docs/data-model-sub.md §5.7)
   ============================================================ */
function defaultState() {
  const topics = {};
  CHAPTERS.forEach(ch => { topics[ch] = { correct: 0, total: 0, level: DEFAULT_LEVEL }; });
  return {
    v: 3, xp: 0, level: 1, solved: 0, correct: 0,
    streakDays: 0, lastDay: null, todayCount: 0, todayDate: null, dailyGoal: 10,
    topics, subs: {}, badges: [], hadPerfectSession: false, history: [], settings: { sound: true }
  };
}

/* ---------- scope ---------- */
function parseScope(scope) {
  if (scope == null) return null;
  const s = String(scope).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  if (s === 'mix') return { kind: 'mix', chapter: null, sn: null, subId: null, key: 'mix' };
  const m = /^([a-z]+)(?::([a-z]?)(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const ch = m[1];
  if (!Object.prototype.hasOwnProperty.call(SUBS_COUNT, ch)) return null;
  if (m[3] === undefined) return { kind: 'chapter', chapter: ch, sn: null, subId: null, key: ch };
  if (m[2] && m[2] !== 's') return null;            // дазволены толькі прэфікс S
  const sn = parseInt(m[3], 10);
  if (sn < 1 || sn > SUBS_COUNT[ch]) return null;
  return { kind: 'sub', chapter: ch, sn: sn, subId: 'S' + sn, key: ch + ':S' + sn };
}
function normalizeScope(raw) { const p = parseScope(raw); return p ? p.key : null; }

function snOf(subId) { return Number(String(subId).replace(/\D/g, '')); }
/* Адзіная крыніца назваў §§ — window.SUBS (generators.js), DEC-2.
   app.js не трымае ніводнай назвы §; фолбэк — толькі нумар. */
function subRecord(chapter, sn) {
  const list = window.SUBS && window.SUBS[chapter];
  return Array.isArray(list) ? list.find(x => x && x.id === 'S' + sn) || null : null;
}
function subName(chapter, sn) {
  const full = subRecord(chapter, sn);
  return (full && full.name) || '§' + sn;
}
function subFullName(chapter, sn) {
  const full = subRecord(chapter, sn);
  return (full && full.name) || '';
}

/* ---------- санацыя ---------- */
function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { sound: true };
  return { sound: raw.sound === true };
}
function sanitizeTopics(raw) {
  const out = {};
  CHAPTERS.forEach(ch => {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw[ch] : null;
    const total = src ? intNonNeg(src.total) : 0;
    let correct = src ? intNonNeg(src.correct) : 0;
    if (correct > total) correct = total;
    out[ch] = { correct: correct, total: total, level: src ? clampLevel(src.level) : DEFAULT_LEVEL };
  });
  return out;
}
function sanitizeSubEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { correct: 0, total: 0, level: DEFAULT_LEVEL };
  }
  const total = intNonNeg(raw.total);
  let correct = intNonNeg(raw.correct);
  if (correct > total) correct = total;
  return { correct: correct, total: total, level: clampLevel(raw.level) };
}
function sanitizeSubs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach(k => {
    const p = parseScope(k);                        // кананізуе і адсякае невядомае
    if (!p || p.kind !== 'sub') return;
    out[p.key] = sanitizeSubEntry(raw[k]);
  });
  return out;
}
function sanitizeState(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = Object.assign({}, src);               // невядомыя палі пераносім
  out.v = 3;
  out.xp = intNonNeg(src.xp);
  out.level = Math.max(1, Math.floor(num(src.level)) || 1);
  out.solved = intNonNeg(src.solved);
  out.correct = Math.min(intNonNeg(src.correct), out.solved);
  out.streakDays = intNonNeg(src.streakDays);
  out.lastDay = isDay(src.lastDay) ? src.lastDay : null;
  out.todayCount = intNonNeg(src.todayCount);
  out.todayDate = isDay(src.todayDate) ? src.todayDate : null;
  out.dailyGoal = Math.min(50, Math.max(1, intNonNeg(src.dailyGoal) || 10));
  out.hadPerfectSession = src.hadPerfectSession === true;
  out.badges = Array.isArray(src.badges)
    ? src.badges.filter(b => typeof b === 'string' && BADGE_IDS.indexOf(b) >= 0) : [];
  out.history = Array.isArray(src.history) ? src.history.slice(-200) : [];
  out.settings = sanitizeSettings(src.settings);
  out.topics = sanitizeTopics(src.topics);
  out.subs = sanitizeSubs(src.subs);
  return out;
}

/* ---------- чытанне ---------- */
function subEntryOf(state, key) {
  const subs = state && state.subs;
  return subs && typeof subs === 'object' ? (subs[key] || null) : null;
}
/* сярэдні ўзровень пакрытых §§ (раздзела або ўсіх); null — калі даных няма */
function meanLevelOfSubs(state, chapter) {
  let sum = 0, n = 0;
  if (chapter) {
    for (let i = 1; i <= SUBS_COUNT[chapter]; i++) {
      const e = subEntryOf(state, chapter + ':S' + i);
      if (e && e.total > 0) { sum += clampLevel(e.level); n++; }
    }
  } else {
    CHAPTERS.forEach(ch => {
      for (let i = 1; i <= SUBS_COUNT[ch]; i++) {
        const e = subEntryOf(state, ch + ':S' + i);
        if (e && e.total > 0) { sum += clampLevel(e.level); n++; }
      }
    });
  }
  return n > 0 ? sum / n : null;
}

function getSubStats(scope, state) {
  const p = parseScope(scope);
  if (!p) return null;
  const st = state || S;

  if (p.kind === 'sub') {
    const e = subEntryOf(st, p.key) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    return {
      scope: p.key, kind: 'sub', chapter: p.chapter, sn: p.sn, subId: p.subId,
      correct: e.correct, total: e.total,
      acc: accOf(e.correct, e.total), ratio: ratioOf(e.correct, e.total),
      level: e.total > 0 ? clampLevel(e.level) : DEFAULT_LEVEL,
      empty: e.total === 0
    };
  }

  if (p.kind === 'chapter') {
    const t = (st.topics && st.topics[p.chapter]) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    let covered = 0;
    for (let i = 1; i <= SUBS_COUNT[p.chapter]; i++) {
      const e = subEntryOf(st, p.chapter + ':S' + i);
      if (e && e.total > 0) covered++;
    }
    return {
      scope: p.chapter, kind: 'chapter', chapter: p.chapter, sn: null, subId: null,
      correct: t.correct, total: t.total,
      acc: accOf(t.correct, t.total), ratio: ratioOf(t.correct, t.total),
      level: clampLevel(t.level),
      empty: t.total === 0, covered: covered, subsCount: SUBS_COUNT[p.chapter]
    };
  }

  let correct = 0, total = 0, covered = 0, chaptersWithData = 0, lsum = 0;
  CHAPTERS.forEach(ch => {
    const t = (st.topics && st.topics[ch]) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    correct += t.correct; total += t.total;
    if (t.total > 0) { chaptersWithData++; lsum += clampLevel(t.level); }
    for (let i = 1; i <= SUBS_COUNT[ch]; i++) {
      const e = subEntryOf(st, ch + ':S' + i);
      if (e && e.total > 0) covered++;
    }
  });
  return {
    scope: 'mix', kind: 'mix', chapter: null, sn: null, subId: null,
    correct: correct, total: total, acc: accOf(correct, total), ratio: ratioOf(correct, total),
    level: chaptersWithData > 0
      ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(lsum / chaptersWithData)))
      : MIX_LEVEL,
    empty: total === 0, covered: covered, chaptersWithData: chaptersWithData
  };
}
function levelFor(scope, state) {
  const s = getSubStats(scope, state);
  return s ? s.level : DEFAULT_LEVEL;
}

/* ---------- запіс ---------- */
/* чыстае ядро: новы стан, без мутацый і без localStorage */
function reduceResult(state, p, ok) {
  const next = Object.assign({}, state);
  next.topics = Object.assign({}, state.topics);
  next.subs = Object.assign({}, state.subs);

  const cur = next.subs[p.key] && typeof next.subs[p.key] === 'object'
    ? sanitizeSubEntry(next.subs[p.key])
    : { correct: 0, total: 0, level: DEFAULT_LEVEL };
  next.subs[p.key] = {
    correct: cur.correct + (ok ? 1 : 0),
    total: cur.total + 1,
    level: ok ? Math.min(MAX_LEVEL, cur.level + 1) : Math.max(MIN_LEVEL, cur.level - 1)
  };

  const t = next.topics[p.chapter];
  if (t) {
    const mean = meanLevelOfSubs(next, p.chapter);
    next.topics[p.chapter] = {
      correct: t.correct + (ok ? 1 : 0),
      total: t.total + 1,
      level: mean === null ? clampLevel(t.level) : Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(mean)))
    };
  }
  return next;
}

function addResult(scope, ok) {
  const p = parseScope(scope);
  if (!p || p.kind !== 'sub') return null;
  if (typeof ok !== 'boolean') return null;
  S = reduceResult(sanitizeState(S), p, ok);
  saveState();
  return getSubStats(p.key, S);
}

/* ---------- сховішча ---------- */
function readRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function parseRaw(raw) { try { return raw == null ? null : JSON.parse(raw); } catch (e) { return null; } }
function writeState(st) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { /* квота / прыватны рэжым */ }
}
function saveState() { writeState(S); }
function loadState() {
  const v3 = parseRaw(readRaw(STORE_KEY));
  if (v3 && typeof v3 === 'object' && !Array.isArray(v3)) return sanitizeState(v3);
  const v2 = parseRaw(readRaw(LEGACY_KEY));           // міграцыя v2 → v3
  if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
    const migrated = sanitizeState(v2);
    writeState(migrated);                             // адразу фіксуем v3; v2 не чапаем
    return migrated;
  }
  return defaultState();
}

/* ============================================================
   Генератары (§) — ключ = кананічны subId
   ============================================================ */
const HAS_GEN = !!(window.SUBS && window.GEN_BY_SUB && typeof window.GEN_BY_SUB === 'object');

function gensOf(subId) {
  const g = HAS_GEN ? window.GEN_BY_SUB[subId] : null;
  return Array.isArray(g) && g.length ? g : null;
}
function subsListOf(chapter) {
  const list = window.SUBS && window.SUBS[chapter];
  if (Array.isArray(list) && list.length) {
    return list.map(s => ({ id: s.id, sn: snOf(s.id), name: s.name }));
  }
  const out = [];
  for (let i = 1; i <= SUBS_COUNT[chapter]; i++) out.push({ id: 'S' + i, sn: i, name: '' });
  return out;
}
function pickSubKey(chapter) {
  const pool = subsListOf(chapter).filter(s => gensOf(chapter + ':' + s.id));
  if (!pool.length) return null;
  return chapter + ':' + pick(pool).id;
}
/* ці ёсць у раздзеле хоць адзін § з генератарамі (для «Усе §» і mix) */
function hasAnyGen(chapter) {
  return subsListOf(chapter).some(s => !!gensOf(chapter + ':' + s.id));
}
/* раздзелы па слабасці: найслабейшы часцей (як у v2 для mix) */
function weightedChapters() {
  const rows = CHAPTERS.map(id => {
    const st = getSubStats(id);
    return { id: id, acc: st.acc === null ? 0.5 : st.acc / 100 };
  }).sort((a, b) => a.acc - b.acc);
  const out = [];
  rows.forEach((r, i) => { const c = 4 - i; for (let j = 0; j < c; j++) out.push(r.id); });
  return out;
}

function chooseQuestion(scope) {
  const p = parseScope(scope);
  if (!p || !HAS_GEN) return null;

  let subKey = null;
  if (p.kind === 'sub') {
    /* явa выбраны § без генератара — не падмяняем іншым § (DEC-10) */
    subKey = gensOf(p.key) ? p.key : null;
  } else if (p.kind === 'chapter') {
    subKey = pickSubKey(p.chapter);
  } else {
    const order = weightedChapters();
    for (let i = 0; i < order.length && !subKey; i++) subKey = pickSubKey(order[i]);
  }
  if (!subKey) return null;

  const sub = parseScope(subKey);
  const pool = gensOf(sub.key);
  if (!pool) return null;

  const d = levelFor(sub.key);                     // складанасць па §
  for (let attempt = 0; attempt < 5; attempt++) {
    const fn = pick(pool);
    try {
      const r = fn(d);
      if (!r || typeof r.q !== 'string' || typeof r.a !== 'number' || !isFinite(r.a)) continue;
      return {
        q: r.q, a: r.a, hint: typeof r.hint === 'string' ? r.hint : '',
        topicId: sub.chapter, subId: sub.key, sub: sub.subId, sn: sub.sn,
        difficulty: d, fn: fn
      };
    } catch (e) { /* наступная спроба */ }
  }
  return null;
}

/* ============================================================
   Канфеті і гук (без змен у паводзінах)
   ============================================================ */
const cv = $('confetti');
const ctx = cv.getContext('2d');
let particles = [], rafId = null, confettiStopId = null;
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function sizeCanvas() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
window.addEventListener('resize', sizeCanvas); sizeCanvas();
function burst() {
  if (reduceMotion) return;
  const cols = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#a29bfe', '#fd79a8'];
  for (let i = 0; i < 90; i++) {
    particles.push({
      x: window.innerWidth / 2, y: window.innerHeight / 2.4,
      vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.9) * 14,
      g: 0.35 + Math.random() * 0.2, col: pick(cols), life: 70 + Math.random() * 30,
      r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3
    });
  }
  if (!rafId) rafId = requestAnimationFrame(tick);
  /* засцерагальнік: калі rAF затарможаны (фон/эканомія), канвас не застаецца запоўненым */
  if (confettiStopId) clearTimeout(confettiStopId);
  confettiStopId = setTimeout(() => {
    particles = [];
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    confettiStopId = null;
  }, 2600);
}
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  particles.forEach(p => {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life--; p.rot += p.vr;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life / 80); ctx.fillStyle = p.col;
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore();
  });
  particles = particles.filter(p => p.life > 0 && p.y < cv.height + 50);
  if (particles.length) { rafId = requestAnimationFrame(tick); }
  else { ctx.clearRect(0, 0, cv.width, cv.height); rafId = null; }
}
let audioCtx = null;
function beep(ok) {
  if (!S.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
    o.frequency.value = ok ? 880 : 220;
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    o.start(); o.stop(audioCtx.currentTime + 0.26);
  } catch (e) { /* гук — неабавязковы */ }
}

/* ============================================================
   Экранная логіка
   ============================================================ */
let S = loadState();
let session = null;
let current = null;
let awaiting = false;
let panelChapter = null;
let statsChapter = 'decimals';

function show(id) {
  ['screen-home', 'screen-quiz', 'screen-result', 'screen-stats'].forEach(s => {
    const el = $(s); if (el) el.classList.toggle('hidden', s !== id);
  });
}

/* ---------- галоўная + §-панэль ---------- */
function renderHome(openChapter) {
  const g = overallGrade(S);
  $('home-grade').textContent = g === null ? '—' : g;
  $('home-level').textContent = S.level;
  $('home-xp').textContent = S.xp;
  $('home-streak').textContent = S.streakDays;
  const goal = Math.min(S.todayCount, S.dailyGoal);
  $('daily-fill').style.width = Math.round(goal / S.dailyGoal * 100) + '%';
  $('daily-text').textContent = 'Сёння: ' + goal + '/' + S.dailyGoal;

  const grid = $('topic-grid');
  grid.innerHTML = '';
  TOPICS.forEach(t => {
    const st = getSubStats(t.id);
    const n = SUBS_COUNT[t.id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'topic-card';
    b.dataset.chapter = t.id;
    b.setAttribute('aria-controls', 'sub-panel');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', t.name + '. ' + n + ' ' + pluralSubs(n) + '. ' +
      (st.acc === null ? 'няма даных' : st.acc + ' працэнты') + ', узровень ' + st.level);
    b.innerHTML =
      '<span class="tc-emoji" aria-hidden="true">' + t.emoji + '</span>' +
      '<span class="tc-name">' + esc(t.name) + '</span>' +
      '<span class="tc-stat">' + (st.acc === null ? 'нов.' : st.acc + '% • ур. ' + st.level) + '</span>' +
      '<span class="tc-open" aria-hidden="true">выбраць § →</span>';
    b.onclick = () => openSubPanel(t.id);
    if (!HAS_GEN) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    grid.appendChild(b);
  });

  /* «Змяшаная трэніроўка» неактыўная без генератараў (клік не маўчыць) */
  const mixBtn = $('start-mix');
  if (mixBtn) {
    const canMix = HAS_GEN && CHAPTERS.some(hasAnyGen);
    mixBtn.disabled = !canMix;
    mixBtn.setAttribute('aria-disabled', String(!canMix));
  }

  show('screen-home');
  closeSubPanel(false);
  if (openChapter) openSubPanel(openChapter);
}

function openSubPanel(chapterId) {
  if (!TOPIC_MAP[chapterId]) return;
  panelChapter = chapterId;
  const t = TOPIC_MAP[chapterId];
  const st = getSubStats(chapterId);
  const n = SUBS_COUNT[chapterId];

  $('sub-title').textContent = t.emoji + ' ' + t.name;
  $('sub-title').title = t.emoji + ' ' + t.name;
  $('sub-chapter-meta').textContent = st.acc === null
    ? n + ' §§ · няма даных'
    : n + ' §§ · ' + st.acc + '% · ур. ' + st.level;

  const list = $('sub-list');
  list.innerHTML = '';
  const subs = subsListOf(chapterId);
  /* § 5.5: «Усе §» працуе, калі ў раздзеле ёсць хоць адзін § з генератарамі */
  const usable = subs.some(s => !!gensOf(chapterId + ':' + s.id));
  const allBtn = $('sub-all');
  allBtn.disabled = !usable;
  allBtn.setAttribute('aria-disabled', String(!usable));
  $('sub-all-meta').textContent = usable ? n + ' §§' : 'недаступна';

  if (!subs.length) {
    const li = document.createElement('li');
    li.className = 'sub-empty';
    li.textContent = 'Для гэтага раздзела пакуль няма параграфаў.';
    list.appendChild(li);
  }
  subs.forEach(s => {
    const key = chapterId + ':' + s.id;             // 'decimals:S4'
    const hasGen = !!gensOf(key);                   // DEC-10: § без генератараў
    if (!hasGen) console.error('няма генератара: ' + key);
    const stat = getSubStats(key);
    const state = !hasGen ? 'unavailable'
      : (stat.total === 0 ? 'new' : (stat.acc < 50 ? 'weak' : (stat.acc < 85 ? 'ok' : 'strong')));
    const full = subFullName(chapterId, s.sn);
    const label = !hasGen
      ? '§' + s.sn + '. ' + full + '. недаступна'
      : stat.total === 0
        ? '§' + s.sn + '. ' + full + '. Яшчэ не трэнавалі'
        : '§' + s.sn + '. ' + full + '. ' + stat.acc + ' працэнты, узровень ' + stat.level;
    const width = stat.ratio === null ? 0 : Math.round(stat.ratio * 100);

    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sub-item';
    b.id = 'sub-item-' + chapterId + '-' + s.id;
    b.dataset.chapter = chapterId;
    b.dataset.sub = s.id;
    b.dataset.scope = key;                          // design-sub.md: 'decimals:S4'
    b.setAttribute('data-state', state);
    b.setAttribute('aria-label', label);
    b.innerHTML =
      '<span class="si-num" aria-hidden="true">§' + s.sn + '</span>' +
      '<span class="si-body">' +
        '<span class="si-name">' + esc(subName(chapterId, s.sn)) + '</span>' +
        '<span class="si-bar" aria-hidden="true"><span class="si-bar-fill" style="width:' +
          width + '%"></span></span>' +
      '</span>' +
      '<span class="si-meta">' +
        '<b class="si-pct">' + (!hasGen ? 'недаступна'
          : (stat.acc === null ? 'нов.' : stat.acc + '%')) + '</b>' +
        '<span class="si-lvl">' + (!hasGen ? '' : (stat.acc === null ? '—' : 'ур. ' + stat.level)) + '</span>' +
      '</span>' +
      '<span class="si-arrow" aria-hidden="true">›</span>';
    if (hasGen) {
      b.onclick = () => startSession(b.dataset.scope);
    } else {
      b.disabled = true;                            // сесія не стартуе
      b.setAttribute('aria-disabled', 'true');
    }
    li.appendChild(b);
    list.appendChild(li);
  });

  $('home-chapters').classList.add('hidden');
  $('sub-panel').classList.remove('hidden');
  document.querySelectorAll('.topic-card').forEach(c => {
    c.setAttribute('aria-expanded', String(c.dataset.chapter === chapterId));
  });
  const titleEl = $('sub-title');
  if (titleEl && titleEl.focus) titleEl.focus();
}

function closeSubPanel(focusBack) {
  const panel = $('sub-panel'), chapters = $('home-chapters');
  if (panel) panel.classList.add('hidden');
  if (chapters) chapters.classList.remove('hidden');
  document.querySelectorAll('.topic-card').forEach(c => c.setAttribute('aria-expanded', 'false'));
  if (focusBack !== false && panelChapter) {
    const card = document.querySelector('.topic-card[data-chapter="' + panelChapter + '"]');
    if (card && card.focus) card.focus();
  }
  panelChapter = null;
}

/* ---------- сесія ---------- */
function startSession(scope) {
  const canon = normalizeScope(scope);
  if (!canon || !HAS_GEN) { renderHome(); return; }
  const p = parseScope(canon);
  /* DEC-10 / §5.5: § без генератараў не запускае сесію і не падмяняецца іншым § */
  if (p.kind === 'sub' && !gensOf(p.key)) {
    console.error('няма генератара: ' + p.key);
    return;
  }
  if ((p.kind === 'chapter' && !hasAnyGen(p.chapter)) ||
      (p.kind === 'mix' && !CHAPTERS.some(hasAnyGen))) {
    const banner = $('gen-error');
    if (banner) banner.classList.remove('hidden');
    renderHome();
    return;
  }
  session = { scope: canon, answered: 0, correct: 0, total: 10, startXp: S.xp, perfect: true };
  show('screen-quiz');
  nextQuestion();
}

function topicLabel() {
  const p = parseScope(session ? session.scope : 'mix');
  /* §5.7, канон 1.2: у mix загаловак — «Змяшаная трэніроўка», без раздзела і § */
  if (p && p.kind === 'mix') return '🦉 Змяшаная трэніроўка';
  const ch = TOPIC_MAP[current.topicId];
  if (!ch) return '';
  if (p && p.kind === 'sub') return ch.emoji + ' ' + ch.name + ' · §' + current.sn;
  if (p && p.kind === 'chapter') return ch.emoji + ' ' + ch.name + ' · усе §';
  return ch.emoji + ' ' + ch.name + ' · §' + current.sn;
}

function nextQuestion() {
  if (!session) return;
  if (session.answered >= session.total) { finishSession(); return; }
  current = chooseQuestion(session.scope);
  if (!current) {
    // засцерагальнік: ніколі не белы экран і не завесны цыкл
    $('gen-error').classList.remove('hidden');
    renderHome();
    return;
  }
  awaiting = false;
  $('q-counter').textContent = (session.answered + 1) + ' / ' + session.total;
  const qt = $('q-topic');
  const label = topicLabel();
  qt.textContent = label;
  qt.title = label;
  $('quiz-fill').style.width = Math.round(session.answered / session.total * 100) + '%';
  const qText = loc(current.q);
  const qEl = $('question');
  /* доўгія тэкставыя задачы не павінны выціскаць поле адказу за экран */
  qEl.className = 'question' + (qText.length > 150 ? ' q-xlong' : (qText.length > 90 ? ' q-long' : ''));
  qEl.textContent = qText;
  const inp = $('answer');
  inp.value = ''; inp.disabled = false;
  $('feedback').className = 'feedback hidden';
  $('feedback').textContent = '';
  $('submit-btn').classList.remove('hidden');
  $('next-btn').classList.add('hidden');
  $('mascot-emoji').textContent = '🦉';
  inp.onkeydown = e => { if (e.key === 'Enter') submitAnswer(); };
  setTimeout(() => inp.focus(), 50);
}

/* правілы ўводу (docs/spec-sub.md §3.6) */
function parseAns(v) {
  if (v == null) return NaN;
  let t = String(v).trim();
  if (/[eE]/.test(t)) return NaN;
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/[\s\u00a0\u202f]/g, '');
  t = t.replace(/,/g, '.');
  t = t.replace(/[^0-9.\-]/g, '');
  if (!/^-?\d{1,9}(\.\d{1,6})?$/.test(t)) return NaN;
  return parseFloat(t);
}
/* допуск (docs/spec-sub.md §3.5) */
function dp(x) {
  const s = String(Math.abs(x));
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}
function tolFor(a) { return 0.5 * Math.pow(10, -Math.max(dp(a), 2)); }
function isCorrect(val, a) { return Math.abs(val - a) <= tolFor(a) + 1e-9; }

function submitAnswer() {
  if (!current || awaiting || !session) return;
  const val = parseAns($('answer').value);
  if (isNaN(val)) {
    $('feedback').className = 'feedback warn';
    $('feedback').textContent = 'Увядзі лік 🙂';
    return;
  }
  awaiting = true;
  $('answer').disabled = true;

  const ok = isCorrect(val, current.a);

  // адзіны шлях запісу: addResult сам абнаўляе і subs[key], і topics[chapter]
  addResult(current.subId, ok);

  if (ok) {
    session.correct++;
    S.correct++; S.solved++;
    const gain = 5 + current.difficulty * 2;
    S.xp += gain;
    $('mascot-emoji').textContent = '🎉';
    burst(); beep(true);
    $('feedback').className = 'feedback ok';
    $('feedback').innerHTML = '✅ Правільна! +' + gain + ' XP<br><span class="hint">' +
      esc(loc(current.hint)) + '</span>';
  } else {
    S.solved++;
    session.perfect = false;
    $('mascot-emoji').textContent = '🤔';
    beep(false);
    $('feedback').className = 'feedback bad';
    $('feedback').innerHTML = '❌ Правільны адказ: <b>' + fmt(current.a) +
      '</b><br><span class="hint">' + esc(loc(current.hint)) + '</span>';
  }

  session.answered++;
  bumpLevel(); touchDay(); saveState();
  $('submit-btn').classList.add('hidden');
  $('next-btn').classList.remove('hidden');
}

function bumpLevel() { S.level = Math.floor(S.xp / 100) + 1; }
function touchDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (S.todayDate !== today) {
    S.todayDate = today; S.todayCount = 0;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    S.streakDays = (S.lastDay === y) ? S.streakDays + 1 : 1;
  }
  S.todayCount++; S.lastDay = today;
  checkBadges();
}
function checkBadges() {
  BADGES.forEach(b => { if (!S.badges.includes(b.id) && b.test(S)) S.badges.push(b.id); });
}

function scopeLabel() {
  const p = parseScope(session ? session.scope : 'mix');
  if (!p) return '';
  if (p.kind === 'sub') return '§' + p.sn + ' · ' + subName(p.chapter, p.sn);
  if (p.kind === 'chapter') return 'Усе § · ' + TOPIC_MAP[p.chapter].name;
  return 'Змяшаная трэніроўка';
}

function finishSession() {
  if (session.perfect && session.correct === session.total) S.hadPerfectSession = true;
  checkBadges(); saveState();
  const acc = session.correct / session.total, grade = clampGrade(acc);
  $('res-grade').textContent = grade;
  $('res-acc').textContent = Math.round(acc * 100) + '%';
  $('res-correct').textContent = session.correct + ' / ' + session.total;
  $('res-xp').textContent = '+' + (S.xp - session.startXp) + ' XP';
  $('res-scope').textContent = scopeLabel();
  const p = parseScope(session.scope);
  $('res-change').classList.toggle('hidden', !p || p.kind === 'mix');
  $('res-msg').textContent = grade >= 10 ? 'Бездакорна! Ты супер! 🌟'
    : grade >= 8 ? 'Выдатна! Яшчэ крыху да 10! 🚀'
    : grade >= 6 ? 'Добра, працягвай трэніравацца! 💪'
    : 'Не здавайся — кожная спроба робіць мацнейшым! 🌱';
  if (grade >= 8) burst();
  show('screen-result');
}

/* ---------- дашборд ---------- */
function renderChapterTabs() {
  const wrap = $('stats-chapter-tabs');
  if (!wrap) return;
  wrap.innerHTML = '';
  TOPICS.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (t.id === statsChapter ? ' active' : '');
    b.dataset.chapter = t.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t.id === statsChapter));
    b.textContent = t.emoji + ' ' + t.name;
    b.onclick = () => { statsChapter = t.id; renderChapterTabs(); renderSubBars(); };
    wrap.appendChild(b);
  });
}
function renderSubBars() {
  const wrap = $('stats-sub-bars');
  if (!wrap) return;
  wrap.innerHTML = '';
  subsListOf(statsChapter).forEach(s => {
    const st = getSubStats(statsChapter + ':' + s.id);
    const width = st.ratio === null ? 0 : Math.round(st.ratio * 100);
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = '<span class="bar-label">§' + s.sn + ' · ' + esc(subName(statsChapter, s.sn)) +
      '</span><span class="bar"><span class="bar-fill" style="width:' + width + '%"></span></span>' +
      '<span class="bar-val">' + (st.acc === null ? '—' : st.acc + '%') + '</span>';
    wrap.appendChild(row);
  });
}

function renderStats() {
  const g = overallGrade(S);
  $('st-grade').textContent = g === null ? '—' : g;
  $('st-solved').textContent = S.solved;
  $('st-acc').textContent = S.solved ? Math.round(S.correct / S.solved * 100) + '%' : '—';
  $('st-streak').textContent = S.streakDays;
  $('st-level').textContent = S.level;
  $('st-xp').textContent = S.xp;

  const wrap = $('topic-bars');
  wrap.innerHTML = '';
  TOPICS.forEach(t => {
    const st = getSubStats(t.id);
    const width = st.ratio === null ? 0 : Math.round(st.ratio * 100);
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = '<span class="bar-label">' + t.emoji + ' ' + esc(t.name) + '</span>' +
      '<span class="bar"><span class="bar-fill" style="width:' + width + '%"></span></span>' +
      '<span class="bar-val">' + (st.acc === null ? '—' : st.acc + '%') + '</span>';
    wrap.appendChild(row);
  });

  const weak = TOPICS
    .map(t => ({ id: t.id, name: t.name, st: getSubStats(t.id) }))
    .filter(x => x.st.total > 0)
    .sort((a, b) => (a.st.acc === null ? 101 : a.st.acc) - (b.st.acc === null ? 101 : b.st.acc))
    .slice(0, 3);
  $('weak').textContent = weak.length
    ? weak.map(w => w.name).join(', ')
    : 'Пакуль няма даных — патрэніруйся!';

  const bw = $('badges');
  bw.innerHTML = '';
  BADGES.forEach(b => {
    const got = S.badges.includes(b.id);
    const d = document.createElement('div');
    d.className = 'badge' + (got ? ' got' : '');
    d.innerHTML = '<span class="b-emoji">' + b.emoji + '</span><span class="b-name">' + esc(b.name) + '</span>';
    bw.appendChild(d);
  });

  renderChapterTabs();
  renderSubBars();
  $('sound-toggle').checked = !!S.settings.sound;
  show('screen-stats');
}

/* ---------- падзеі ---------- */
function bindEvents() {
  $('start-mix').onclick = () => startSession('mix');
  $('open-stats').onclick = () => renderStats();
  $('sub-back').onclick = () => closeSubPanel();
  $('sub-back-bottom').onclick = () => closeSubPanel();
  $('sub-all').onclick = () => { if (panelChapter) startSession(panelChapter); };
  $('res-again').onclick = () => startSession(session ? session.scope : 'mix');
  $('res-change').onclick = () => {
    const p = parseScope(session ? session.scope : 'mix');
    if (p && p.kind !== 'mix') renderHome(p.chapter); else renderHome();
  };
  $('res-home').onclick = () => renderHome();
  $('res-stats').onclick = () => renderStats();
  $('submit-btn').onclick = submitAnswer;
  $('next-btn').onclick = () => { awaiting = false; nextQuestion(); };
  $('stats-back').onclick = () => renderHome();
  $('sound-toggle').onchange = e => { S.settings.sound = e.target.checked; saveState(); };
  $('reset-btn').onclick = () => {
    if (!confirm('Скінуць увесь прагрэс?')) return;
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(LEGACY_KEY); } catch (e) { /* прыватны рэжым */ }
    S = defaultState(); saveState(); renderHome();
  };
  $('quiz-quit').onclick = () => {
    const p = parseScope(session ? session.scope : 'mix');
    if (p && p.kind !== 'mix') renderHome(p.chapter); else renderHome();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const home = $('screen-home');
      if (home && !home.classList.contains('hidden') && panelChapter) closeSubPanel();
      return;
    }
    if (e.key === 'Enter') {
      // Enter = «Далей», калі паказаны вынік і кнопка бачная.
      // Калі фокус у полі адказу — даём яму адправіць адказ (каб не пераскочыць водгук).
      const quiz = $('screen-quiz'), nb = $('next-btn');
      if (awaiting && quiz && !quiz.classList.contains('hidden') && nb && !nb.classList.contains('hidden')) {
        if (e.target && e.target.id === 'answer') return;
        e.preventDefault();
        awaiting = false;
        nextQuestion();
      }
    }
  });
}

/* ---------- старт ---------- */
if (!HAS_GEN) {
  const banner = $('gen-error');
  if (banner) banner.classList.remove('hidden');
}
bindEvents();
renderHome();
