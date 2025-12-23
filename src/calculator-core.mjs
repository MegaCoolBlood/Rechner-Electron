import { isWhitespace, findLastNonWhitespace, formatExpressionWithCaret, formatOperatorsWithCaret } from './formatting.mjs';
import { isBinaryOperator, isOperatorToken } from './operators.mjs';

/**
 * Wrap an expression in parentheses and append ** 2 operator.
 */
export function applySquareOp(expression) {
  return `(${expression}) ** 2`;
}

/**
 * Wrap an expression in parentheses and append ** (1/2) operator.
 */
export function applySqrtOp(expression) {
  return `(${expression}) ** (1/2)`;
}

/**
 * Wrap an expression in a reciprocal form without immediate evaluation.
 */
export function applyReciprocalOp(expression) {
  return `(1/(${expression}))`;
}

/**
 * Remove an operator (including optional spaces around) that ends at index `endIdx` in `str`.
 * Returns { text, cursor } with the new string and new cursor position.
 */
function removeOperatorBefore(str, caretIndex) {
  /* c8 ignore next */
  if (caretIndex <= 0) return { text: str, cursor: 0 };
  let idx = caretIndex - 1;
  if (isWhitespace(str[idx]) && idx > 0) idx -= 1; // move onto operator if we were at space
  // Determine operator length: '**' or single-char
  let opLen = 1;
  if (str[idx] === '*' && idx > 0 && str[idx - 1] === '*') {
    opLen = 2;
  }
  const opStart = idx - (opLen - 1);
  let deleteStart = opStart;
  while (deleteStart > 0 && isWhitespace(str[deleteStart - 1])) deleteStart--;
  let deleteEnd = idx + 1; // just after operator
  if (deleteEnd < str.length && isWhitespace(str[deleteEnd])) deleteEnd++;
  const before = str.slice(0, deleteStart);
  const after = str.slice(deleteEnd);
  return { text: before + after, cursor: deleteStart };
}

export function formatAll(value, caret) {
  const { text: numbersFormatted, caret: caretAfterNumbers } = formatExpressionWithCaret(value, caret);
  return formatOperatorsWithCaret(numbersFormatted, caretAfterNumbers);
}

/** Replace any trailing operator before the caret with a new operator token, collapsing spaces. */
function replaceOperator(before, newOp) {
  const lastNonSpaceIndex = findLastNonWhitespace(before, before.length - 1);
  if (lastNonSpaceIndex >= 0) {
    const lastChar = before[lastNonSpaceIndex];
    let isOperatorBefore = false;
    let operatorStartIndex = lastNonSpaceIndex;
    if (newOp && isBinaryOperator(newOp)) {
      if (lastChar === '*' && lastNonSpaceIndex > 0 && before[lastNonSpaceIndex - 1] === '*') {
        isOperatorBefore = true;
        operatorStartIndex = lastNonSpaceIndex - 1;
      } else if (isOperatorToken(lastChar)) {
        isOperatorBefore = true;
      }
    }
    if (isOperatorBefore) {
      let deleteStart = operatorStartIndex;
      while (deleteStart > 0 && isWhitespace(before[deleteStart - 1])) deleteStart--;
      before = before.slice(0, deleteStart);
    }
  }
  // Only remove old operator here; caller appends newOp separately
  return before;
}

/** Count unmatched opening parentheses in a string */
function countUnmatchedOpenParens(str) {
  let open = 0;
  let close = 0;
  for (const ch of str) {
    if (ch === '(') open++;
    if (ch === ')') close++;
  }
  return open - close;
}

export function insertTextCore(value, selectionStart, selectionEnd, text) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  let before = value.slice(0, start);
  const after = value.slice(end);

  if (isBinaryOperator(text)) {
    before = replaceOperator(before, text);
  }

  // If inserting closing paren and there's no matching open paren, prepend one at start
  if (text === ')') {
    const unmatchedInBefore = countUnmatchedOpenParens(before);
    const unmatchedInAfter = countUnmatchedOpenParens(after);
    const totalUnmatched = unmatchedInBefore + unmatchedInAfter;
    if (totalUnmatched <= 0) {
      before = '(' + before;
    }
  }

  const beforeLength = before.length;
  const textLength = text.length;
  const valueBeforeFormat = before + text + after;
  const caretBeforeFormat = beforeLength + textLength;

  const { text: formatted, caret: newCaret } = formatAll(valueBeforeFormat, caretBeforeFormat);
  return { value: formatted, selectionStart: newCaret, selectionEnd: newCaret };
}

export function backspaceCore(value, selectionStart, selectionEnd) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  let newValue = value;
  let newCursorPos = start;

  if (start !== end) {
    const before = newValue.slice(0, start);
    const after = newValue.slice(end);
    newValue = before + after;
    newCursorPos = start;
  }

  if (start === end && start > 0) {
    const charBefore = newValue[start - 1];
    if (isWhitespace(charBefore) && start > 1) {
      const charBeforeSpace = newValue[start - 2];
      const charAfter = newValue[start];

      if (isOperatorToken(charBeforeSpace)) {
        const { text, cursor } = removeOperatorBefore(newValue, start);
        newValue = text;
        newCursorPos = cursor;
      } else if (isOperatorToken(charAfter)) {
        let deleteEnd = start + 1;
        if (charAfter === '*' && newValue[start + 1] === '*') {
          deleteEnd = start + 2;
        }
        if (deleteEnd < newValue.length) {
          if (isWhitespace(newValue[deleteEnd])) {
            deleteEnd++;
          }
        }
        const before = newValue.slice(0, start - 1);
        const after = newValue.slice(deleteEnd);
        newValue = before + after;
        newCursorPos = start - 1;
      } else {
        const before = newValue.slice(0, start - 1);
        const after = newValue.slice(end);
        newValue = before + after;
        newCursorPos = start - 1;
      }
    } else {
      const before = newValue.slice(0, start - 1);
      const after = newValue.slice(end);
      newValue = before + after;
      newCursorPos = start - 1;
    }
  }

  const { text: formatted, caret: newCaret } = formatAll(newValue, newCursorPos);
  return { value: formatted, selectionStart: newCaret, selectionEnd: newCaret };
}

export function deleteCore(value, selectionStart, selectionEnd) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  let newValue = value;
  let newCursorPos = start;

  if (start !== end) {
    const before = newValue.slice(0, start);
    const after = newValue.slice(end);
    newValue = before + after;
    newCursorPos = start;
  } else if (start < newValue.length) {
    const before = newValue.slice(0, start);
    const after = newValue.slice(start + 1);
    newValue = before + after;
    newCursorPos = start;
  }

  const { text: formatted, caret: newCaret } = formatAll(newValue, newCursorPos);
  return { value: formatted, selectionStart: newCaret, selectionEnd: newCaret };
}
