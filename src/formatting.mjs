// Formatting utilities for numbers, caret mapping, and operator spacing
import { NBSP, normalizeNumericInput, decimalSeparator } from './locale.mjs';
import { findNumberTokens } from './tokenizer-lenient.mjs';
import { isOperatorToken } from './operators.mjs';

export function isWhitespace(char) {
    return char === ' ' || char === NBSP;
}

export function findLastNonWhitespace(str, fromIndex) {
    for (let i = fromIndex; i >= 0; i--) {
        if (!isWhitespace(str[i])) {
            return i;
        }
    }
    return -1;
}

export function formatIntegerWithSeparators(intDigits) {
    return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatNumberPart(numStr, includeFrac = true) {
    const [intPart, fracPart = ''] = numStr.split('.');
    const sign = intPart.startsWith('-') ? '-' : '';
    const intDigits = intPart.replace('-', '');
    const groupedInt = formatIntegerWithSeparators(intDigits);

    if (!includeFrac || !fracPart || fracPart === '0') {
        return sign + groupedInt;
    }

    const trimmedFrac = fracPart.replace(/0+$/, '');
    return sign + groupedInt + decimalSeparator() + trimmedFrac;
}

export function formatDecimal(decimal, DecimalCtor = globalThis.Decimal) {
    if (!decimal || !decimal.isFinite || !decimal.isFinite()) return 'Fehler';
    const str = decimal.toFixed();
    return formatNumberPart(str, true);
}

export function formatNumberString(raw, DecimalCtor = globalThis.Decimal) {
    const normalized = normalizeNumericInput(raw);

    // Preserve partially typed decimals during input (e.g., "0." or "0,0")
    if (normalized.includes('.')) {
        const parts = normalized.split('.');
        if (parts.length === 2) {
            const intPart = parts[0] || '0';
            const fracPart = parts[1];

            const sign = intPart.startsWith('-') ? '-' : '';
            const intDigits = intPart.replace('-', '');
            const groupedInt = formatIntegerWithSeparators(intDigits);
            return sign + groupedInt + ',' + fracPart;
        }
    }

    try {
        const decimal = new DecimalCtor(normalized);
        if (decimal.isInteger()) {
            const str = decimal.toFixed(0);
            return formatNumberPart(str, false);
        }
        return formatDecimal(decimal, DecimalCtor);
    } catch {
        return raw;
    }
}

export function formatExpressionWithCaret(value, caret) {
    let result = '';
    let newCaret = caret;
    let pos = 0;
    const tokens = findNumberTokens(value);
    for (const t of tokens) {
        const tokenStart = t.start;
        const token = t.raw;
        const tokenEnd = t.end;

        // Append non-number segment
        if (pos < tokenStart) {
            const segment = value.slice(pos, tokenStart);
            result += segment;
            if (caret >= pos && caret <= tokenStart) {
                newCaret = result.length - (tokenStart - caret);
            }
        }

        const formatted = formatNumberString(token);
        result += formatted;

        if (caret >= tokenStart && caret <= tokenEnd) {
            const offsetInToken = caret - tokenStart;
            const tokenBefore = token.slice(0, offsetInToken);
            if (tokenBefore.length === 0) {
                newCaret = result.length - formatted.length;
            } else {
                const formattedBefore = formatNumberString(tokenBefore);
                newCaret = result.length - formatted.length + formattedBefore.length;
            }
        } else if (caret > tokenEnd) {
            const delta = formatted.length - token.length;
            newCaret += delta;
        }

        pos = tokenEnd;
    }

    if (pos < value.length) {
        const segment = value.slice(pos);
        result += segment;
        if (caret >= pos) {
            newCaret = result.length - (value.length - caret);
        }
    }

    newCaret = Math.max(0, Math.min(result.length, newCaret));
    return { text: result, caret: newCaret };
}

export function formatOperatorsWithCaret(value, caret) {
    let result = '';
    let newCaret = caret;
    const len = value.length;

    const prevNonSpace = (pos) => {
        const index = findLastNonWhitespace(value, pos - 1);
        return index >= 0 ? value[index] : '';
    };

    let i = 0;
    while (i < len) {
        let token = null;
        if (value.startsWith('**', i)) {
            token = '**';
        } else {
            const ch = value[i];
            if (isOperatorToken(ch)) token = ch;
        }

        if (!token) {
            result += value[i];
            i += 1;
            continue;
        }

        const tokenStart = i;
        const tokenEnd = tokenStart + token.length;
        const prevChar = result.length > 0 ? result[result.length - 1] : '';
        const prevCh = prevNonSpace(tokenStart);

        const isUnary = (token === '+' || token === '-') && (!prevCh || '(*+/'.includes(prevCh));

        // Remove trailing space before operator if present (but only one, to preserve number formatting)
        let spaceBefore = 0;
        if (!isUnary && isWhitespace(prevChar)) {
            result = result.slice(0, -1);
            spaceBefore = 1;
        }

        const replacement = isUnary ? token : ` ${token} `;
        const resultBeforeOperator = result.length;

        if (caret >= tokenStart && caret <= tokenEnd) {
            if (isUnary) {
                const offsetInToken = caret - tokenStart;
                newCaret = resultBeforeOperator + offsetInToken;
            } else {
                newCaret = resultBeforeOperator + replacement.length;
            }
        } else if (caret > tokenEnd) {
            const delta = replacement.length - token.length - spaceBefore;
            newCaret += delta;
        } /* c8 ignore next 2 -- caret cannot fall strictly between integer positions */ else if (caret > tokenStart - spaceBefore && caret < tokenStart) {
            newCaret = resultBeforeOperator + (isUnary ? 0 : 1);
        }
        result += replacement;
        i += token.length;
    }

    // Remove duplicate spaces and adjust caret position
    i = result.length - 1;
    while (i > 0) {
        if (isWhitespace(result[i]) && isWhitespace(result[i - 1])) {
            result = result.slice(0, i) + result.slice(i + 1);
            if (newCaret > i) {
                newCaret--;
            }
        }
        i -= 1;
    }

    return { text: result, caret: newCaret };
}
