// Configure Decimal.js for high precision
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

class Calculator {
    constructor() {
        this.displayEl = document.getElementById('display');
        this.liveResultEl = document.getElementById('live-result');
        this.historyListEl = document.getElementById('history-list');
        this.history = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Button clicks
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (btn.dataset.char) {
                    this.append(btn.dataset.char);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        });

        // Keyboard input
        document.addEventListener('keydown', (e) => {
            // Text input with selection replacement support
            if ('0123456789,+-*/()'.includes(e.key) || e.key === '.') {
                e.preventDefault();
                const char = e.key === '.' ? ',' : e.key;
                this.insertText(char === ',' ? ',' : char);
            }
            if (e.key === '^') {
                e.preventDefault();
                this.insertText('**');
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                this.evaluate();
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                this.backspace();
            }
            if (e.key === 'Delete' || e.key === 'Escape') {
                e.preventDefault();
                this.clear();
            }
        });

        // Titlebar buttons
        document.getElementById('minimize-btn').addEventListener('click', () => {
            window.electron?.minimize?.();
        });

        document.getElementById('maximize-btn').addEventListener('click', () => {
            window.electron?.maximize?.();
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            window.electron?.close?.();
        });

        // History click
        this.historyListEl.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const index = Array.from(this.historyListEl.children).indexOf(e.target);
                if (index >= 0 && index < this.history.length) {
                    this.displayEl.value = this.history[index].expression;
                    this.refreshLiveResult();
                }
            }
        });

        // Display input
        this.displayEl.addEventListener('input', () => {
            this.formatDisplay();
            this.refreshLiveResult();
        });
    }

    append(value) {
        this.insertText(value);
    }

    insertText(text) {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        el.value = before + text + after;
        const cursorPos = start + text.length;
        el.selectionStart = el.selectionEnd = cursorPos;
        this.formatDisplay();
        this.refreshLiveResult();
    }

    clear() {
        this.displayEl.value = '';
        this.liveResultEl.textContent = '';
    }

    backspace() {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;

        if (start !== end) {
            // Delete selection
            const before = el.value.slice(0, start);
            const after = el.value.slice(end);
            el.value = before + after;
            el.selectionStart = el.selectionEnd = start;
        } else if (start > 0) {
            // Delete single character before cursor
            const before = el.value.slice(0, start - 1);
            const after = el.value.slice(end);
            el.value = before + after;
            el.selectionStart = el.selectionEnd = start - 1;
        }

        this.formatDisplay();
        this.refreshLiveResult();
    }

    negate() {
        let current = this.displayEl.value.trim();
        if (!current) {
            this.displayEl.value = '-';
        } else if (current.startsWith('-')) {
            this.displayEl.value = current.slice(1);
        } else {
            this.displayEl.value = '-' + current;
        }
        this.refreshLiveResult();
    }

    evaluate() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const result = this.evaluateExpression(expression);
            const resultStr = this.formatDecimal(result);
            this.displayEl.value = resultStr;
            this.addToHistory(expression, resultStr);
            this.liveResultEl.textContent = '';
        } catch (error) {
            this.liveResultEl.textContent = '…';
        }
    }

    applyReciprocal() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const value = this.evaluateExpression(expression);
            if (value.isZero()) throw new Error('Division durch 0');
            const result = new Decimal(1).div(value);
            this.displayEl.value = this.formatDecimal(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applySquare() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const value = this.evaluateExpression(expression);
            const result = value.pow(2);
            this.displayEl.value = this.formatDecimal(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applySqrt() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const value = this.evaluateExpression(expression);
            if (value.isNegative()) throw new Error('Wurzel aus negativer Zahl');
            const result = value.sqrt();
            this.displayEl.value = this.formatDecimal(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applyPercent() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const value = this.evaluateExpression(expression);
            const result = value.div(100);
            this.displayEl.value = this.formatDecimal(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    copyExpression() {
        const expression = this.displayEl.value.trim();
        if (expression) {
            navigator.clipboard.writeText(expression).catch(() => {
                alert('Konnte nicht in Zwischenablage kopieren');
            });
        }
    }

    copyResult() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const result = this.evaluateExpression(expression);
            const resultStr = this.formatDecimal(result);
            navigator.clipboard.writeText(resultStr).catch(() => {
                alert('Konnte nicht in Zwischenablage kopieren');
            });
        } catch (error) {
            alert('Fehler beim Kopieren');
        }
    }

    formatNumber(value) {
        if (!isFinite(value)) return 'Fehler';

        // Format with max 12 decimal digits, no scientific notation
        const formatter = new Intl.NumberFormat('en-US', {
            useGrouping: false,
            maximumFractionDigits: 12,
        });

        const base = formatter.format(value);
        const [intPartRaw, fracPartRaw = ''] = base.split('.');
        const sign = intPartRaw.startsWith('-') ? '-' : '';
        const intDigits = intPartRaw.replace('-', '');
        const groupedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const trimmedFrac = fracPartRaw.replace(/0+$/, '');

        if (!trimmedFrac) return sign + groupedInt;
        return sign + groupedInt + ',' + trimmedFrac;
    }

    refreshLiveResult() {
        const expression = this.displayEl.value.trim();
        if (!expression) {
            this.liveResultEl.textContent = '';
            return;
        }

        try {
            const result = this.evaluateExpression(expression);
            this.liveResultEl.textContent = this.formatDecimal(result);
        } catch (error) {
            this.liveResultEl.textContent = '…';
        }
    }

    addToHistory(expression, result) {
        if (!expression) return;
        
        this.history.unshift({ expression, result });
        
        // Limit history to 50 items
        if (this.history.length > 50) {
            this.history.pop();
        }

        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        this.historyListEl.innerHTML = '';
        this.history.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = `${item.expression} = ${item.result}`;
            this.historyListEl.appendChild(li);
        });
    }

    handleAction(action) {
        switch (action) {
            case 'clear':
                this.clear();
                break;
            case 'backspace':
                this.backspace();
                break;
            case 'negate':
                this.negate();
                break;
            case 'reciprocal':
                this.applyReciprocal();
                break;
            case 'square':
                this.applySquare();
                break;
            case 'sqrt':
                this.applySqrt();
                break;
            case 'percent':
                this.applyPercent();
                break;
            case 'power':
                this.append('**');
                break;
            case 'evaluate':
                this.evaluate();
                break;
            case 'copy-expr':
                this.copyExpression();
                break;
            case 'copy-result':
                this.copyResult();
                break;
        }
    }

    sanitizeExpression(expression) {
        // Remove spaces and normalize decimal separator for JS
        return expression.replace(/\s+/g, '').replace(/,/g, '.');
    }

    evaluateExpression(expression) {
        const sanitized = this.sanitizeExpression(expression);
        
        // Parse and evaluate using Decimal.js
        const tokens = this.tokenize(sanitized);
        const result = this.evaluateTokens(tokens);
        
        return result;
    }

    tokenize(expr) {
        const tokens = [];
        let i = 0;
        
        while (i < expr.length) {
            // Skip whitespace
            if (/\s/.test(expr[i])) {
                i++;
                continue;
            }
            
            // Numbers (including decimals and negative)
            if (/[\d.]/.test(expr[i]) || (expr[i] === '-' && /[\d]/.test(expr[i + 1]))) {
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
            
            // Operators and parentheses
            if ('+-*/()'.includes(expr[i])) {
                tokens.push({ type: 'operator', value: expr[i] });
                i++;
                continue;
            }
            
            // Power operator
            if (expr.startsWith('**', i)) {
                tokens.push({ type: 'operator', value: '**' });
                i += 2;
                continue;
            }
            
            i++;
        }
        
        return tokens;
    }

    evaluateTokens(tokens) {
        // Simple recursive descent parser
        let pos = 0;
        
        const parseExpression = () => {
            let left = parseTerm();
            
            while (pos < tokens.length && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
                const op = tokens[pos++].value;
                const right = parseTerm();
                left = op === '+' ? left.plus(right) : left.minus(right);
            }
            
            return left;
        };
        
        const parseTerm = () => {
            let left = parseFactor();
            
            while (pos < tokens.length && (tokens[pos].value === '*' || tokens[pos].value === '/')) {
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

    formatDecimal(decimal) {
        if (!decimal || !decimal.isFinite || !decimal.isFinite()) return 'Fehler';
        
        const str = decimal.toFixed();
        const [intPart, fracPart = ''] = str.split('.');
        const sign = intPart.startsWith('-') ? '-' : '';
        const intDigits = intPart.replace('-', '');
        const groupedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        
        if (!fracPart || fracPart === '0') return sign + groupedInt;
        
        const trimmedFrac = fracPart.replace(/0+$/, '');
        return sign + groupedInt + ',' + trimmedFrac;
    }

    formatNumberString(raw) {
        const normalized = raw.replace(/\s+/g, '').replace(/,/g, '.');
        try {
            const decimal = new Decimal(normalized);
            return this.formatDecimal(decimal);
        } catch {
            return raw;
        }
    }

    formatExpressionWithCaret(value, caret) {
        let result = '';
        let newCaret = caret;
        let pos = 0;
        const regex = /-?\d[\d\s]*(?:,\d+)?/g;
        let match;

        while ((match = regex.exec(value)) !== null) {
            const tokenStart = match.index;
            const token = match[0];
            const tokenEnd = tokenStart + token.length;

            // Append non-number segment
            if (pos < tokenStart) {
                const segment = value.slice(pos, tokenStart);
                result += segment;
                if (caret >= pos && caret <= tokenStart) {
                    newCaret = result.length - (tokenStart - caret);
                }
            }

            const formatted = this.formatNumberString(token);
            result += formatted;

            if (caret >= tokenStart && caret <= tokenEnd) {
                // Caret inside token: map using partial formatting of substring
                const offsetInToken = caret - tokenStart;
                const tokenBefore = token.slice(0, offsetInToken);
                const formattedBefore = this.formatNumberString(tokenBefore || '0').replace(/^0+\s*/, '');
                newCaret = result.length - formatted.length + formattedBefore.length;
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

    formatDisplay() {
        const el = this.displayEl;
        const caret = el.selectionStart ?? el.value.length;
        const { text: numbersFormatted, caret: caretAfterNumbers } = this.formatExpressionWithCaret(el.value, caret);
        const { text, caret: newCaret } = this.formatOperatorsWithCaret(numbersFormatted, caretAfterNumbers);
        el.value = text;
        el.selectionStart = el.selectionEnd = newCaret;
    }

    formatOperatorsWithCaret(value, caret) {
        let result = '';
        let newCaret = caret;
        const len = value.length;

        const prevNonSpace = (pos) => {
            for (let i = pos - 1; i >= 0; i -= 1) {
                if (value[i] !== ' ') return value[i];
            }
            return '';
        };

        let i = 0;
        while (i < len) {
            let token = null;
            if (value.startsWith('**', i)) {
                token = '**';
            } else {
                const ch = value[i];
                if ('+-*/'.includes(ch)) token = ch;
            }

            if (!token) {
                result += value[i];
                i += 1;
                continue;
            }

            const tokenStart = i;
            const prevChar = result.length > 0 ? result[result.length - 1] : '';
            const prevCh = prevNonSpace(tokenStart);
            
            const isUnary = (token === '+' || token === '-') && (!prevCh || '(*+/'.includes(prevCh));
            
            // Remove trailing space if present (but only one, to preserve number formatting)
            let spaceBefore = 0;
            if (!isUnary && prevChar === ' ') {
                result = result.slice(0, -1);
                spaceBefore = 1;
            }
            
            const replacement = isUnary ? token : ` ${token} `;
            
            // Adjust caret for removed/added space before operator
            if (caret > tokenStart - spaceBefore && caret <= tokenStart) {
                newCaret = result.length + (isUnary ? 0 : 1);
            } else if (caret > tokenStart) {
                const delta = replacement.length - token.length - spaceBefore;
                newCaret += delta;
            }
            result += replacement;
            i += token.length;
        }
        i = result.length - 1;
        while (i > 0) {
            if (result[i] === ' ' && result[i - 1] === ' ') {
                result = result.slice(0, i) + result.slice(i + 1);
            }
            i -= 1;
        }


        return { text: result, caret: newCaret };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Calculator();
});
