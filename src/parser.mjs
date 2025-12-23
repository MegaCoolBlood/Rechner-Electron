// Parsing and evaluation utilities for expressions
import { isAddSub, isMulDiv, isOperatorToken } from './operators.mjs';

export function sanitizeExpression(expression) {
    return expression.replace(/\s+/g, '').replace(/,/g, '.');
}

export function tokenize(expr) {
    const tokens = [];
    let i = 0;

    while (i < expr.length) {
        if (/\s/.test(expr[i])) {
            i++;
            continue;
        }

        const isNegativeNumber = expr[i] === '-' && /[\d]/.test(expr[i + 1]) && (
            tokens.length === 0 ||
            (tokens[tokens.length - 1].type === 'operator' && tokens[tokens.length - 1].value !== ')')
        );

        if (/[\d.]/.test(expr[i]) || isNegativeNumber) {
            let num = '';
            if (expr[i] === '-') {
                num += '-';
                i++;
            }
            while (i < expr.length && /[\d.]/.test(expr[i])) {
                num += expr[i];
                i++;
            }
            tokens.push({ type: 'number', value: num });
            continue;
        }

        if (expr.startsWith('**', i)) {
            tokens.push({ type: 'operator', value: '**' });
            i += 2;
            continue;
        }

        if (isOperatorToken(expr[i]) || '()'.includes(expr[i])) {
            tokens.push({ type: 'operator', value: expr[i] });
            i++;
            continue;
        }

        i++;
    }

    return tokens;
}

export function evaluateTokens(tokens) {
    let pos = 0;

    const parseExpression = () => {
        let left = parseTerm();

        while (pos < tokens.length && isAddSub(tokens[pos].value)) {
            const op = tokens[pos++].value;
            const right = parseTerm();
            left = op === '+' ? left.plus(right) : left.minus(right);
        }

        return left;
    };

    const parseTerm = () => {
        let left = parseFactor();

        while (pos < tokens.length && isMulDiv(tokens[pos].value)) {
            const op = tokens[pos++].value;
            const right = parseFactor();
            left = op === '*' ? left.times(right) : left.div(right);
        }

        return left;
    };

    const parseFactor = () => {
        let left = parsePower();
        return left;
    };

    const parsePower = () => {
        let left = parseUnary();

        if (pos < tokens.length && tokens[pos].value === '**') {
            pos++;
            const right = parsePower();
            left = left.pow(right);
        }

        return left;
    };

    const parseUnary = () => {
        if (pos < tokens.length && tokens[pos].value === '-') {
            pos++;
            return parseUnary().neg();
        }
        if (pos < tokens.length && tokens[pos].value === '+') {
            pos++;
            return parseUnary();
        }
        return parsePrimary();
    };

    const parsePrimary = () => {
        if (tokens[pos].type === 'number') {
            return new Decimal(tokens[pos++].value);
        }

        if (tokens[pos].value === '(') {
            pos++;
            const result = parseExpression();
            if (tokens[pos]?.value === ')') pos++;
            return result;
        }

        throw new Error('Unexpected token: ' + tokens[pos]?.value);
    };

    return parseExpression();
}

export function evaluateExpression(expression) {
    const sanitized = sanitizeExpression(expression);
    const tokens = tokenize(sanitized);
    return evaluateTokens(tokens);
}
