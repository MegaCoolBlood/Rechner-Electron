import test from 'node:test';
import assert from 'node:assert/strict';
import { applySquareOp, applySqrtOp, applyReciprocalOp } from '../src/calculator-core.mjs';

test('applySquareOp wraps expression and appends ** 2', () => {
  assert.equal(applySquareOp('4'), '(4) ** 2');
  assert.equal(applySquareOp('4 * 4'), '(4 * 4) ** 2');
  assert.equal(applySquareOp('(2 + 3)'), '((2 + 3)) ** 2');
});

test('applySqrtOp wraps expression and appends ** (1/2)', () => {
  assert.equal(applySqrtOp('16'), '(16) ** (1/2)');
  assert.equal(applySqrtOp('4 * 4'), '(4 * 4) ** (1/2)');
  assert.equal(applySqrtOp('(2 + 3)'), '((2 + 3)) ** (1/2)');
});

test('applySqrtOp after applySquareOp chains correctly', () => {
  let expr = '4';
  expr = applySquareOp(expr);
  assert.equal(expr, '(4) ** 2');
  expr = applySqrtOp(expr);
  assert.equal(expr, '((4) ** 2) ** (1/2)');
});

test('applyReciprocalOp wraps expression with 1/(expr)', () => {
  assert.equal(applyReciprocalOp('4'), '(1/(4))');
  assert.equal(applyReciprocalOp('2+2'), '(1/(2+2))');
  assert.equal(applyReciprocalOp('(3 - 1)'), '(1/((3 - 1)))');
});
