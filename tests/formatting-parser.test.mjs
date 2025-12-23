import test from 'node:test';
import assert from 'node:assert/strict';

// Provide Decimal globally for formatting/parser modules
import Decimal from 'decimal.js';
global.Decimal = Decimal;

const {
  isWhitespace,
  findLastNonWhitespace,
  formatIntegerWithSeparators,
  formatNumberPart,
  formatDecimal,
  formatNumberString,
  formatExpressionWithCaret,
  formatOperatorsWithCaret,
} = await import('../src/formatting.mjs');

const { sanitizeExpression, tokenize, evaluateTokens, evaluateExpression } = await import('../src/parser.mjs');

const NBSP = '\u00A0';

test('formatDecimal groups thousands and trims trailing zeros', () => {
  assert.equal(formatDecimal(new Decimal('1234567')), `1${NBSP}234${NBSP}567`);
  assert.equal(formatDecimal(new Decimal('1234.500')), `1${NBSP}234,5`);
  assert.equal(formatDecimal(null), 'Fehler');
});

test('formatNumberString preserves partial decimals during input', () => {
  assert.equal(formatNumberString('0,'), '0,');
  assert.equal(formatNumberString('12,003'), `12,003`);
  assert.equal(formatNumberString(',5'), '0,5');
  assert.equal(formatNumberString('-1234.050'), `-1${NBSP}234,050`);
  assert.equal(formatNumberString('1000'), `1${NBSP}000`);
  assert.equal(formatNumberString('1e-3'), '0,001');
  assert.equal(formatNumberString('1.2.3'), '1.2.3');
  assert.equal(formatNumberString('abc'), 'abc');
});

test('evaluateExpression handles basic ops, precedence, and right-associative power', () => {
  assert.equal(evaluateExpression('2+3*4').toString(), '14');
  assert.equal(evaluateExpression('2**3**2').toString(), '512');
  assert.equal(evaluateExpression('-2 + +3').toString(), '1');
  assert.equal(evaluateExpression('-(2+3)').toString(), '-5');
  assert.equal(evaluateExpression('5-2').toString(), '3');
  assert.equal(evaluateExpression('8/4').toString(), '2');
});

test('evaluateExpression normalizes commas and whitespace', () => {
  assert.equal(evaluateExpression('1,5 + 2').toString(), '3.5');
  assert.equal(evaluateExpression(`1${NBSP}000 + 2`).toString(), '1002');
});

test('parser helpers cover sanitize/tokenize/error paths', () => {
  assert.equal(sanitizeExpression(' 1,5 + 2 '), '1.5+2');
  assert.deepEqual(tokenize('-3.5 + 2'), [
    { type: 'number', value: '-3.5' },
    { type: 'operator', value: '+' },
    { type: 'number', value: '2' },
  ]);

  // Leading whitespace is skipped
  assert.deepEqual(tokenize('   2'), [
    { type: 'number', value: '2' },
  ]);

  // Unknown characters are skipped without tokens
  assert.deepEqual(tokenize('2a'), [{ type: 'number', value: '2' }]);

  // Only whitespace yields no tokens
  assert.deepEqual(tokenize('   \t'), []);

  // Closing parenthesis branch increments position
  const parenTokens = tokenize('(1)');
  assert.equal(evaluateTokens(parenTokens).toString(), '1');

  // Minus after closing parenthesis is binary, not unary
  assert.deepEqual(tokenize('(1)-2'), [
    { type: 'operator', value: '(' },
    { type: 'number', value: '1' },
    { type: 'operator', value: ')' },
    { type: 'operator', value: '-' },
    { type: 'number', value: '2' },
  ]);

  const badTokens = tokenize(')');
  assert.throws(() => evaluateTokens(badTokens), /Unexpected token/);
});

test('basic formatting helpers', () => {
  assert.ok(isWhitespace(' '));
  assert.ok(isWhitespace(NBSP));
  assert.ok(!isWhitespace('x'));

  assert.equal(findLastNonWhitespace(`ab${NBSP} `, 3), 1);
  assert.equal(findLastNonWhitespace('    ', 3), -1);

  assert.equal(formatIntegerWithSeparators('123456'), `123${NBSP}456`);
  assert.equal(formatNumberPart('-1234.500', true), `-1${NBSP}234,5`);
  assert.equal(formatNumberPart('1234', false), `1${NBSP}234`);
});

test('formatExpressionWithCaret maps caret through number formatting', () => {
  const { text, caret } = formatExpressionWithCaret('1234+5', 4);
  assert.equal(text, `1${NBSP}234+5`);
  // caret originally after "1234" (pos 4) should move after formatted int (pos 5 due to NBSP)
  assert.equal(caret, 5);

  // caret after first token should gain offset for grouping
  const mapped = formatExpressionWithCaret('1000+20', 5);
  assert.equal(mapped.text, `1${NBSP}000+20`);
  assert.equal(mapped.caret, 6);

  // caret inside non-number segment should stay aligned
  const mixed = formatExpressionWithCaret('12abc34', 3);
  assert.equal(mixed.text, '12abc34');
  assert.equal(mixed.caret, 3);

  // caret at token start uses empty-prefix branch
  const startCaret = formatExpressionWithCaret('789', 0);
  assert.equal(startCaret.text, '789');
  assert.equal(startCaret.caret, 0);

  // trailing non-number segment triggers final segment branch
  const trailing = formatExpressionWithCaret('12abc', 5);
  assert.equal(trailing.text, '12abc');
  assert.equal(trailing.caret, 5);
});

test('formatOperatorsWithCaret enforces spacing and caret mapping', () => {
  // binary operator spacing
  const bin = formatOperatorsWithCaret(`1+2`, 3);
  assert.equal(bin.text, `1 + 2`);
  // caret after the original last char should land at end
  assert.ok(bin.caret <= bin.text.length);

  // unary minus stays tight
  const unary = formatOperatorsWithCaret(`-3+4`, 2);
  assert.equal(unary.text, `-3 + 4`);
  assert.ok(unary.caret >= 0 && unary.caret <= unary.text.length);

  // unary plus formatting
  const unaryPlus = formatOperatorsWithCaret(`+5`, 1);
  assert.equal(unaryPlus.text, `+5`);
  assert.ok(unaryPlus.caret >= 0 && unaryPlus.caret <= unaryPlus.text.length);

  // collapse duplicate spaces and adjust caret in pre-operator space
  const spaced = formatOperatorsWithCaret(`1  +  2`, 2);
  assert.equal(spaced.text, `1 + 2`);
  assert.ok(spaced.caret <= spaced.text.length);

  // caret positioned before operator should move to after first space for binary op
  const beforeOp = formatOperatorsWithCaret('1+2', 1);
  assert.equal(beforeOp.text, '1 + 2');
  assert.ok(beforeOp.caret >= 1 && beforeOp.caret <= beforeOp.text.length);

  // existing leading space before operator is collapsed
  const leadingSpace = formatOperatorsWithCaret('1 +2', 2);
  assert.equal(leadingSpace.text, '1 + 2');
  assert.ok(leadingSpace.caret >= 2 && leadingSpace.caret <= leadingSpace.text.length);

  // caret in pre-operator space adjusts to operator boundary
  const caretInSpace = formatOperatorsWithCaret('1 + 2', 2);
  assert.equal(caretInSpace.text, '1 + 2');
  assert.ok(caretInSpace.caret >= 2 && caretInSpace.caret <= caretInSpace.text.length);

  // multiple spaces collapse in cleanup loop
  const manySpaces = formatOperatorsWithCaret('1   +   2', 6);
  assert.equal(manySpaces.text, '1 + 2');
  assert.ok(manySpaces.caret <= manySpaces.text.length);

  // power operator recognized as multi-char token
  const power = formatOperatorsWithCaret('2**3', 3);
  assert.equal(power.text, '2 ** 3');
  assert.ok(power.caret <= power.text.length);

  // duplicate spaces without operators still collapse and adjust caret
  const dupSpaces = formatOperatorsWithCaret('1   2', 4);
  assert.equal(dupSpaces.text, '1 2');
  assert.ok(dupSpaces.caret <= dupSpaces.text.length);

  // duplicate-space cleanup adjusts caret when it sits after removed chars
  const dupSpacesCaret = formatOperatorsWithCaret('1   2', 5);
  assert.equal(dupSpacesCaret.text, '1 2');
  assert.equal(dupSpacesCaret.caret, dupSpacesCaret.text.length);
});
