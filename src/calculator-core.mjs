import {
  isWhitespace,
  findLastNonWhitespace,
  formatExpressionWithCaret,
  formatOperatorsWithCaret,
} from './formatting.mjs';

export function formatAll(value, caret) {
  const { text: numbersFormatted, caret: caretAfterNumbers } = formatExpressionWithCaret(value, caret);
  return formatOperatorsWithCaret(numbersFormatted, caretAfterNumbers);
}

function isBinaryOperator(op) {
  return ['+', '-', '*', '/', '**'].includes(op);
}

export function insertTextCore(value, selectionStart, selectionEnd, text) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  let before = value.slice(0, start);
  const after = value.slice(end);

  const lastNonSpaceIndex = findLastNonWhitespace(before, before.length - 1);
  if (lastNonSpaceIndex >= 0) {
    const lastChar = before[lastNonSpaceIndex];
    let isOperatorBefore = false;
    let operatorStartIndex = lastNonSpaceIndex;

    if (isBinaryOperator(text)) {
      if (lastChar === '*' && lastNonSpaceIndex > 0 && before[lastNonSpaceIndex - 1] === '*') {
        isOperatorBefore = true;
        operatorStartIndex = lastNonSpaceIndex - 1;
      } else if ('+-*/'.includes(lastChar)) {
        isOperatorBefore = true;
      }
    }

    if (isOperatorBefore) {
      let deleteStart = operatorStartIndex;
      while (deleteStart > 0 && isWhitespace(before[deleteStart - 1])) {
        deleteStart--;
      }
      before = before.slice(0, deleteStart);
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

      if ('+-*/'.includes(charBeforeSpace)) {
        let deleteStart = start - 2;
        let deleteEnd = start;
        if (start > 2 && newValue.slice(start - 3, start - 1) === '**') {
          deleteStart = start - 3;
        }
        if (deleteStart > 0 && isWhitespace(newValue[deleteStart - 1])) {
          deleteStart--;
        }
        if (deleteEnd < newValue.length) {
          if (isWhitespace(newValue[deleteEnd])) {
            deleteEnd++;
          }
        }
        const before = newValue.slice(0, deleteStart);
        const after = newValue.slice(deleteEnd);
        newValue = before + after;
        newCursorPos = deleteStart;
      } else if ('+-*/'.includes(charAfter)) {
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
