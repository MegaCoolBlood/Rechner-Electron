// Central operator definitions and helpers

export const OPERATORS = [
  { token: '**', arity: 2, precedence: 3, associativity: 'right', spacing: 'binary-spaced' },
  { token: '*', arity: 2, precedence: 2, associativity: 'left', spacing: 'binary-spaced' },
  { token: '/', arity: 2, precedence: 2, associativity: 'left', spacing: 'binary-spaced' },
  { token: '%', arity: 2, precedence: 2, associativity: 'left', spacing: 'binary-spaced' },
  { token: '+', arity: 2, precedence: 1, associativity: 'left', spacing: 'binary-spaced' },
  { token: '-', arity: 2, precedence: 1, associativity: 'left', spacing: 'binary-spaced' },
  // unary handled contextually for + and - (tight spacing)
];

const TOKENS = OPERATORS.map(o => o.token);
const BINARY_TOKENS = TOKENS; // all listed here are binary; unary is contextual for + and -
const UNARY_TOKENS = ['+', '-'];

export function isOperatorToken(chOrToken) {
  return TOKENS.includes(chOrToken);
}

export function isBinaryOperator(token) {
  return BINARY_TOKENS.includes(token);
}

export function isUnaryOperator(token) {
  return UNARY_TOKENS.includes(token);
}

export function isAddSub(token) {
  return token === '+' || token === '-';
}

export function isMulDiv(token) {
  return token === '*' || token === '/' || token === '%';
}

export function isPower(token) {
  return token === '**';
}
