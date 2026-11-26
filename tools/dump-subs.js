#!/usr/bin/env node
'use strict';
/* dump-subs.js — па адным узоры з кожнага генератара для вочнай зверкі матэматыкі */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const box = { window: {}, console: console, Math: Math, Date: Date, JSON: JSON, Set: Set, Map: Map,
  Number: Number, String: String, Object: Object, Array: Array, parseInt: parseInt,
  parseFloat: parseFloat, isNaN: isNaN, RegExp: RegExp, isFinite: isFinite };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'generators.js'), 'utf8'), box, { filename: 'generators.js' });
const { SUBS, GEN_BY_SUB } = box.window;
let i = 0;
for (const ch of Object.keys(SUBS)) {
  for (const s of SUBS[ch]) {
    const k = ch + ':' + s.id;
    console.log('\n## ' + k + '  «' + s.name + '»');
    for (const fn of (GEN_BY_SUB[k] || [])) {
      const d = (i++ % 10) + 1;
      const r = fn(d);
      console.log('  [' + fn.name + ' d=' + d + '] Q: ' + r.q);
      console.log('      A: ' + r.a + '   | ' + r.hint);
    }
  }
}
