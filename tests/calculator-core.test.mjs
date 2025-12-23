import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
global.Decimal = Decimal;

import { insertTextCore, backspaceCore, formatAll } from '../src/calculator-core.mjs';
import { isWhitespace } from '../src/formatting.mjs';

const NBSP = '\u00A0';

function state(value, pos) {
  return { value, selectionStart: pos, selectionEnd: pos };
}

test('insertTextCore: typing numbers and operators formats and moves caret', () => {
  let s = state('', 0);
  s = insertTextCore(s.value, s.selectionStart, s.selectionEnd, '1');
  assert.equal(s.value, '1');
  assert.equal(s.selectionStart, 1);

  s = insertTextCore(s.value, s.selectionStart, s.selectionEnd, '000');
  assert.equal(s.value, `1${NBSP}000`);
  assert.equal(s.selectionStart, `1${NBSP}000`.length);

  s = insertTextCore(s.value, s.selectionStart, s.selectionEnd, '+');
  assert.equal(s.value, `1${NBSP}000 + `);
  assert.equal(s.selectionStart, s.value.length);

  s = insertTextCore(s.value, s.selectionStart, s.selectionEnd, '-');
  assert.equal(s.value, `1${NBSP}000 - `);
  assert.equal(s.selectionStart, s.value.length);

  s = insertTextCore(s.value, s.selectionStart, s.selectionEnd, '2');
  assert.equal(s.value, `1${NBSP}000 - 2`);

  let p = state('2', 1);
  p = insertTextCore(p.value, p.selectionStart, p.selectionEnd, '**');
  assert.equal(p.value, '2 ** ');
  const replaced = insertTextCore(p.value, p.selectionStart, p.selectionEnd, '+');
  assert.equal(replaced.value, '2 + ');

  const atStart = insertTextCore('', 0, 0, '+');
  assert.equal(atStart.value, '+');
  assert.equal(atStart.selectionStart, 1);

  const defOp = insertTextCore('12', undefined, undefined, '+');
  assert.equal(defOp.value, `12 + `);
  assert.equal(defOp.selectionStart, defOp.value.length);

  const defNum = insertTextCore('', undefined, undefined, '7');
  assert.equal(defNum.value, '7');
  assert.equal(defNum.selectionStart, 1);
});

test('backspaceCore: deleting chars respects operator spacing and caret', () => {
  let s = state(`1${NBSP}000 - 2`, `1${NBSP}000 - 2`.length);

  s = backspaceCore(s.value, s.selectionStart, s.selectionEnd);
  assert.equal(s.value, `1${NBSP}000 - `);
  assert.equal(s.selectionStart, s.value.length);

  s = backspaceCore(s.value, s.selectionStart, s.selectionEnd);
  assert.ok(!/[+\-*/]/.test(s.value.replaceAll(' ', '')));
  assert.ok(s.selectionStart <= s.value.length);

  let t = state(`1 + 2`, 2);
  t = backspaceCore(t.value, t.selectionStart, t.selectionEnd);
  assert.equal(t.value, '12');
  assert.ok(t.selectionStart === 1 || t.selectionStart === t.value.length);

  let u = state('2 ** 3', '2 ** 3'.length - 1);
  u = backspaceCore(u.value, u.selectionStart, u.selectionEnd);
  assert.ok(!u.value.includes('**'));
  assert.ok(u.selectionStart <= u.value.length);

  let v = state('2 *3', 2);
  v = backspaceCore(v.value, v.selectionStart, v.selectionEnd);
  assert.equal(v.value, '23');
  assert.ok(v.selectionStart <= v.value.length);

  let w = state('2 **3', 2);
  w = backspaceCore(w.value, w.selectionStart, w.selectionEnd);
  assert.equal(w.value, '23');
  assert.ok(w.selectionStart <= w.value.length);

  let x = state('2 + ', '2 + '.length);
  x = backspaceCore(x.value, x.selectionStart, x.selectionEnd);
  assert.equal(x.value, '2');
  assert.equal(x.selectionStart, 1);

  let y = state('123', 3);
  y = backspaceCore(y.value, y.selectionStart, y.selectionEnd);
  assert.equal(y.value, '12');
  assert.equal(y.selectionStart, 2);

  let z = state(`12 3`, 3);
  z = backspaceCore(z.value, z.selectionStart, z.selectionEnd);
  assert.equal(z.value, '123');
  assert.equal(z.selectionStart, 2);

  let aa = state('2  + ', '2  + '.length);
  aa = backspaceCore(aa.value, aa.selectionStart, aa.selectionEnd);
  assert.equal(aa.value, '2');
  assert.equal(aa.selectionStart, 1);

  let ab = state('2 +  3', 4);
  ab = backspaceCore(ab.value, ab.selectionStart, ab.selectionEnd);
  assert.equal(ab.value, '23');
  assert.equal(ab.selectionStart, 1);

  // operator after with no trailing space and at end-of-string: deleteEnd < length false
  let ac = state('2 +', 2);
  ac = backspaceCore(ac.value, ac.selectionStart, ac.selectionEnd);
  assert.equal(ac.value, '2');
  assert.equal(ac.selectionStart, 1);
});

test('backspaceCore: deletion of selection', () => {
  let s = state(`1${NBSP}000 + 200`, `1${NBSP}000 + 200`.length);
  // select the last three digits "200" and delete
  const start = s.value.length - 3;
  const end = s.value.length;
  s = backspaceCore(s.value, start, end);
  assert.equal(s.value, `1${NBSP}000 + `);
  assert.ok(s.selectionStart <= s.value.length);
});

test('backspaceCore: backspace at start does nothing', () => {
  const s = backspaceCore('123', 0, 0);
  assert.equal(s.value, '123');
  assert.equal(s.selectionStart, 0);
});

test('backspaceCore: defaults for selection indices via ?? fallback', () => {
  const s = backspaceCore('12', undefined, undefined);
  assert.equal(s.value, '1');
  assert.equal(s.selectionStart, 1);
});

test('formatAll maps caret through number and operator formatting', () => {
  const r = formatAll('1234+5', 4);
  assert.equal(r.text, `1${NBSP}234 + 5`);
  assert.ok(r.caret >= 5 && r.caret <= r.text.length);
});
