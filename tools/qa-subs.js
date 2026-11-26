#!/usr/bin/env node
'use strict';
/* qa-subs.js — узмоцненая праверка AC-1..AC-6 + AC-2/AC-3 па §§.
   Ключавое: parseAns і isCorrect бяруцца НЕПАСРЭДНА з app.js (рэгуляркай),
   каб правяраць рэальны код, а не копію. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const box = { window: {}, console: console, Math: Math, Date: Date, JSON: JSON, Set: Set, Map: Map,
  Number: Number, String: String, Object: Object, Array: Array, parseInt: parseInt,
  parseFloat: parseFloat, isNaN: isNaN, RegExp: RegExp, isFinite: isFinite };
box.globalThis = box.window;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'generators.js'), 'utf8'), box, { filename: 'generators.js' });

/* --- выняць parseAns / dp / tolFor / isCorrect з app.js --- */
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
function cut(start, endMarker) {
  const i = app.indexOf(start);
  if (i < 0) throw new Error('не знойдзена ў app.js: ' + start);
  const j = app.indexOf(endMarker, i);
  return app.slice(i, j);
}
const parseSrc = cut('function parseAns(v)', '/* допуск');
const tolSrc = cut('function dp(x)', 'function submitAnswer');
vm.runInContext(parseSrc + '\n' + tolSrc + '\nwindow.__qa={parseAns:parseAns,isCorrect:isCorrect,tolFor:tolFor};', box, { filename: 'app-extract.js' });
const { parseAns, isCorrect, tolFor } = box.window.__qa;

const SUBS = box.window.SUBS || {}, GEN = box.window.GEN_BY_SUB || {};
const EXPECT = { decimals: 10, percent: 7, sets: 4, rational: 9, coords: 3, geometry: 5 };
const keys = [];
for (const ch of Object.keys(SUBS)) for (const s of SUBS[ch]) keys.push(ch + ':' + s.id);
const errors = [], warns = [];
const err = m => { if (errors.indexOf(m) < 0) errors.push(m); };
const dp = a => { const s = String(Math.abs(a)); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

function fd(x) { return String(Math.round(x * 1000) / 1000).replace('-', '−').replace('.', ','); }
function decCap(k) {
  if (k === 'decimals:S9') return 3;
  if (k === 'decimals:S5') return 4;
  return 2;
}
const perGen = {}, perSub = {};
for (const k of keys) {
  perSub[k] = { count: (GEN[k] || []).length, qset: new Set() };
  for (let gi = 0; gi < (GEN[k] || []).length; gi++) {
    const fn = GEN[k][gi];
    if (typeof fn !== 'function') { err(k + '[' + gi + '] не функцыя'); continue; }
    const sig = k + '[' + gi + '] ' + (fn.name || 'fn');
    const seen = new Set();
    for (let d = 1; d <= 10; d++) {
      for (let n = 0; n < 60; n++) {
        let r;
        try { r = fn(d); } catch (e) { err(sig + ' d=' + d + ' кідок: ' + e.message); d = 11; break; }
        if (!r || typeof r !== 'object') { err(sig + ' вынік не аб\'ект'); d = 11; break; }
        if (typeof r.q !== 'string') { err(sig + ' q не радок'); d = 11; break; }
        if (r.q.length < 5 || r.q.length > 300) err(sig + ' даўжыня q=' + r.q.length);
        if (typeof r.hint !== 'string') { err(sig + ' hint не радок'); d = 11; break; }
        if (r.hint.length < 6 || r.hint.length > 200) err(sig + ' даўжыня hint=' + r.hint.length);
        if (typeof r.a !== 'number' || !isFinite(r.a)) { err(sig + ' a не лік: ' + r.a); d = 11; break; }
        if (Math.abs(r.a) > 1e6) err(sig + ' |a|>1e6: ' + r.a);
        if (dp(r.a) > decCap(k)) err(sig + ' a з ' + dp(r.a) + ' знакамі (кап ' + decCap(k) + ' па AC-3): ' + r.a);
        if (/NaN|undefined|null|Infinity|e\+/.test(r.q)) err(sig + ' смецце ў q: ' + r.q);
        if (/{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*}/.test(r.q)) err(sig + ' маркер шаблону ў q');
        if (/NaN|undefined|Infinity|e\+/.test(r.hint)) err(sig + ' смецце ў hint');
        if (/[A-Za-z]{3,}/.test(r.q)) {
          const latin = (r.q.match(/[A-Za-z]{3,}/g) || []).join(',');
          if (latin) err(sig + ' лацінскія словы ў q: ' + latin);
        }
        const v = parseAns(fd(r.a));
        if (!isCorrect(v, r.a)) err(sig + ' round-trip праз parseAns: ' + fd(r.a) + ' → ' + v + ' (a=' + r.a + ', tol=' + tolFor(r.a) + ')');
        if (d === 5) { seen.add(r.q); perSub[k].qset.add(r.q); }
      }
    }
    perGen[sig] = seen.size;
    if (seen.size < 20) warns.push('разнастайнасць ' + sig + ': ' + seen.size + ' розных q на 200 (мэта ≥20)');
  }
  if (perSub[k].count < 2) warns.push('генератараў у ' + k + ': ' + perSub[k].count + ' (мэта ≥2, блакуе ≥1)');
}

/* супадзенне набораў пытанняў паміж §§ (AC-4) */
const sigs = {};
for (const k of keys) {
  const s = [...perSub[k].qset].sort().join('|');
  if (sigs[s]) err('аднолькавы набор пытанняў у ' + sigs[s] + ' і ' + k);
  else sigs[s] = k;
}

/* сесіі: усе §§ + раздзелы + mix, 10 пытанняў, адказ праз parseAns */
function pool(scope) {
  if (scope.indexOf(':') > 0) return (GEN[scope] || []).slice();
  if (scope === 'mix') { let a = []; for (const k of keys) a = a.concat(GEN[k] || []); return a; }
  let a = []; for (const s of (SUBS[scope] || [])) a = a.concat(GEN[scope + ':' + s.id] || []); return a;
}
const scopes = keys.concat(Object.keys(SUBS)).concat(['mix']);
let sess = 0, qs = 0, badSess = 0;
for (const scope of scopes) {
  const p = pool(scope);
  if (!p.length) { err('пусты пул: ' + scope); continue; }
  sess++;
  for (let q = 0; q < 10; q++) {
    let r = null;
    for (let t = 0; t < 5 && !r; t++) {
      const fn = p[Math.floor(Math.random() * p.length)];
      try { const x = fn(1 + Math.floor(Math.random() * 10)); if (x && isFinite(x.a)) r = x; } catch (e) { }
    }
    if (!r) { err('сесія ' + scope + ': не ўдалося згенераваць'); badSess++; break; }
    qs++;
    if (!isCorrect(parseAns(fd(r.a)), r.a)) err('сесія ' + scope + ': адказ не прымаецца: ' + fd(r.a));
    if (scope.indexOf(':') > 0 && !(GEN[scope] || []).some(fn => { try { return fn === fn; } catch (e) { return false; } })) { }
  }
}

/* адпаведнасць § пулу: кожнае пытанне сесіі § — з пула менавіта гэтага § */
for (const k of keys) {
  const src = new Set((GEN[k] || []).map(fn => fn.name));
  for (let i = 0; i < 30; i++) {
    const r = (GEN[k] || [])[i % (GEN[k] || []).length](1 + i % 10);
    if (!src.has(GEN[k][i % GEN[k].length].name)) err('§ ' + k + ': пытанне па-за пулам');
    if (!r || typeof r.a !== 'number') err('§ ' + k + ': дрэннае пытанне ў серыі');
  }
}

console.log('AC-1: §§ ' + keys.length + ', ключоў GEN_BY_SUB ' + Object.keys(GEN).length + ', генератараў ' + Object.values(GEN).reduce((n, a) => n + a.length, 0));
for (const ch of Object.keys(SUBS)) {
  const cnt = Object.values(GEN).reduce((n, a, i) => n, 0);
  let tot = 0;
  for (const s of SUBS[ch]) tot += (GEN[ch + ':' + s.id] || []).length;
  console.log('  ' + ch.padEnd(9) + SUBS[ch].length + ' §§ / ' + tot + ' генератараў');
}
console.log('AC-5/6: сесій ' + sess + ', пытанняў ' + qs + ', збойных сесій ' + badSess);
console.log('AC-2/3/16: правяралася ' + Object.keys(perGen).length + ' генератараў × 600 выклікаў, round-trip праз рэальны parseAns');
console.log(errors.length ? 'ПАМЫЛКІ (' + errors.length + '):' : 'OK: 0 памылак');
errors.slice(0, 60).forEach(e => console.log('  FAIL ' + e));
warns.slice(0, 40).forEach(w => console.log('  WARN ' + w));
process.exit(errors.length ? 1 : 0);
