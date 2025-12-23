import test from 'node:test';
import assert from 'node:assert/strict';

import { NBSP, groupSeparator, decimalSeparator, normalizeNumericInput } from '../src/locale.mjs';
import { isOperatorToken, isBinaryOperator, isUnaryOperator, isAddSub, isMulDiv, isPower } from '../src/operators.mjs';

test('locale helpers', () => {
  assert.equal(groupSeparator(), NBSP);
  assert.equal(decimalSeparator(), ',');
  assert.equal(normalizeNumericInput(`1${NBSP}234,5`), '1234.5');
});

test('operator helpers', () => {
  assert.ok(isOperatorToken('+'));
  assert.ok(isBinaryOperator('*'));
  assert.ok(isUnaryOperator('-'));
  assert.ok(isAddSub('+'));
  assert.ok(isMulDiv('/'));
  assert.ok(isPower('**'));
});
