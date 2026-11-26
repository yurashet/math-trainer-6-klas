#!/usr/bin/env node
'use strict';
/* §-smoke: node tools/smoke-subs.js  (без залежнасцяў, не патрабуе DOM) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const box = { window: {}, console: console, Math: Math, Date: Date, JSON: JSON, Set: Set, Map: Map,
  Number: Number, String: String, Object: Object, Array: Array, parseInt: parseInt,
  parseFloat: parseFloat, isNaN: isNaN, RegExp: RegExp, isFinite: isFinite };
box.globalThis = box.window;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'generators.js'), 'utf8'), box, { filename: 'generators.js' });
const SUBS = box.window.SUBS || {}, GEN = box.window.GEN_BY_SUB || {};
const errors = [], warns = [];
const fd = x => String(Math.round(x * 1000) / 1000).replace('-', '−').replace('.', ',');
const dp = a => { const s = String(a); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const eps = a => 0.5 * Math.pow(10, -Math.max(dp(a), 2));
const DS = [1, 3, 5, 7, 10];
const EXPECT = { decimals: 10, percent: 7, sets: 4, rational: 9, coords: 3, geometry: 5 };
const keys = [];
for (const ch of Object.keys(SUBS)) for (const s of SUBS[ch]) keys.push(ch + ':' + s.id);

if (keys.length !== 38) errors.push('SUBS: ' + keys.length + ' §§ замест 38');
for (const ch of Object.keys(SUBS)) {
  if (EXPECT[ch] && SUBS[ch].length !== EXPECT[ch]) errors.push(ch + ': ' + SUBS[ch].length + ' §§ замест ' + EXPECT[ch]);
}
for (const k of keys) if (!Array.isArray(GEN[k]) || !GEN[k].length) errors.push('няма генератара: ' + k);
for (const k of Object.keys(GEN)) if (keys.indexOf(k) < 0) errors.push('лішні ключ: ' + k);

for (const k of keys) {
  const fns = GEN[k] || [];
  if (fns.length < 2) warns.push(k + ': толькі ' + fns.length + ' генератар (мэта ≥2)');
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    if (typeof fn !== 'function') { errors.push(k + '[' + i + ']: не функцыя'); continue; }
    const seen = new Set();
    let bad = 0;
    for (const d of DS) {
      for (let n = 0; n < 40; n++) {
        let r;
        try { r = fn(d); } catch (e) { errors.push(k + '[' + i + '] d=' + d + ': ' + e.message); bad = 1; break; }
        if (!r || typeof r !== 'object') { errors.push(k + '[' + i + ']: вынік не аб\'ект'); bad = 1; break; }
        if (typeof r.q !== 'string' || r.q.length < 5 || r.q.length > 300) { errors.push(k + '[' + i + ']: дрэннае q'); bad = 1; break; }
        if (typeof r.hint !== 'string' || r.hint.length < 6 || r.hint.length > 200) { errors.push(k + '[' + i + ']: дрэнны hint'); bad = 1; break; }
        if (typeof r.a !== 'number' || !isFinite(r.a)) { errors.push(k + '[' + i + ']: a не лік (' + r.a + ')'); bad = 1; break; }
        if (Math.abs(r.a) > 1e6) errors.push(k + '[' + i + ']: a завялікі ' + r.a);
        if (Math.abs(r.a - Math.round(r.a * 1000) / 1000) > 1e-9) errors.push(k + '[' + i + ']: a з >3 знакамі ' + r.a);
        if (/NaN|undefined|Infinity|e\+/.test(r.q)) errors.push(k + '[' + i + ']: смецце ў q');
        if (/{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*}/.test(r.q)) errors.push(k + '[' + i + ']: незапоўнены маркер шаблону ў q');
        const av = fd(r.a), qNums = String(r.q).match(/\d+(?:[.,]\d+)?/g) || [];
        const isOperand = qNums.length >= 2 && qNums.indexOf(av) >= 0;
        if (!isOperand && Math.abs(r.a) >= 20 &&
            new RegExp('(?<![0-9,])' + av.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9])(?!,[0-9])').test(r.hint)) {
          errors.push(k + '[' + i + ']: hint змяшчае адказ ' + av); bad = 1; break;
        }
        if (d === 5) seen.add(r.q);
      }
      if (bad) break;
    }
    if (!bad && seen.size < 20) warns.push(k + '[' + i + '] (' + (fn.name || 'fn') + '): ' + seen.size + ' розных q з 200');
  }
}

function pool(scope) {
  if (scope.indexOf(':') > 0) return (GEN[scope] || []).slice();
  if (scope === 'mix') { let a = []; for (const k of keys) a = a.concat(GEN[k] || []); return a; }
  let a = []; for (const s of (SUBS[scope] || [])) a = a.concat(GEN[scope + ':' + s.id] || []); return a;
}
function parseAns(v) {
  const t = String(v).replace(/[\u2212\u2013\u2014]/g, '-').replace(/,/g, '.').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return parseFloat(t);
}
const scopes = keys.concat(Object.keys(SUBS)).concat(['mix']);
let sessions = 0, questions = 0;
for (const scope of scopes) {
  const p = pool(scope);
  if (!p.length) { errors.push('пусты пул: ' + scope); continue; }
  sessions++;
  for (let q = 0; q < 10; q++) {
    let r = null;
    for (let t = 0; t < 5 && !r; t++) {
      const fn = p[Math.floor(Math.random() * p.length)];
      try { const x = fn(5); if (x && isFinite(x.a)) r = x; } catch (e) { }
    }
    if (!r) { errors.push('сесія ' + scope + ': не ўдалося згенераваць пытанне'); break; }
    questions++;
    const back = parseAns(fd(r.a));
    if (!(Math.abs(back - r.a) <= eps(r.a) + 1e-9)) errors.push('сесія ' + scope + ': адказ не вяртаецца праз увод (' + fd(r.a) + ' → ' + back + ')');
  }
}

const total = Object.keys(GEN).reduce((n, k) => n + (GEN[k] ? GEN[k].length : 0), 0);
console.log('§§: ' + keys.length + ', генератараў: ' + total + ', сесій: ' + sessions + ', пытанняў: ' + questions);
for (const ch of Object.keys(SUBS)) {
  const cnt = SUBS[ch].reduce((n, s) => n + ((GEN[ch + ':' + s.id] || []).length), 0);
  console.log('  ' + ch + ': ' + SUBS[ch].length + ' §§ / ' + cnt + ' генератараў');
}
warns.slice(0, 25).forEach(w => console.log('WARN ' + w));
const uniq = [...new Set(errors)];
uniq.slice(0, 40).forEach(e => console.log('FAIL ' + e));
console.log(uniq.length ? ('ПРАВАЛ: ' + uniq.length + ' памылак') : 'OK: 0 памылак');
process.exit(uniq.length ? 1 : 0);
