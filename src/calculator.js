// Configure Decimal.js for high precision
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

class Calculator {
    constructor() {
        this.displayEl = document.getElementById('display');
        this.liveResultEl = document.getElementById('live-result');
        this.historyListEl = document.getElementById('history-list');
        this.history = [];
        this.resultDisplayed = false;
        this.lastResult = null;
        
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

        // Keyboard input on document
        document.addEventListener('keydown', (e) => {
            // Special handling for ^ (Dead Key) - may report as "Dead" or "^"
            if (e.key === '^' || e.key === 'Dead' || e.code === 'BracketLeft') {
                // Check if this is the circumflex/caret dead key
                // If it's just a dead key without composition, insert **
                if (e.key === '^' || (e.key === 'Dead' && e.location === 0)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleResultContinuation('**');
                    this.insertText('**');
                    return;
                }
            }
            
            // Text input with selection replacement support
            if ('0123456789,+-*/()'.includes(e.key) || e.key === '.') {
                e.preventDefault();
                const char = e.key === '.' ? ',' : e.key;
                this.handleResultContinuation(char);
                this.insertText(char === ',' ? ',' : char);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                this.evaluate();
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                this.backspace();
            }
            if (e.key === 'Delete') {
                e.preventDefault();
                this.delete();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.clear();
            }
            if (e.key === 'F6') {
                e.preventDefault();
                this.displayEl.focus();
            }
            if (e.key === 'v' && e.ctrlKey) {
                e.preventDefault();
                this.pasteFromClipboard();
            }
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.insertLastResult();
            }
        });
        
        // Specific handler for ^ on the display element (Dead Key handling)
        this.displayEl.addEventListener('keydown', (e) => {
            if (e.key === '^' || e.key === 'Dead' || e.code === 'BracketLeft') {
                if (e.key === '^' || (e.key === 'Dead' && e.location === 0)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleResultContinuation('**');
                    this.insertText('**');
                }
            }
        }, true); // Use capture phase
        
        // Handle case where ^ is followed by nothing (waits and then gets replaced)
        let lastDeadKeyTime = 0;
        this.displayEl.addEventListener('keyup', (e) => {
            if (e.key === '^' || e.key === 'Dead' || e.code === 'BracketLeft') {
                lastDeadKeyTime = Date.now();
                // If no input event occurs within 100ms, the dead key was pressed alone
                setTimeout(() => {
                    if (Date.now() - lastDeadKeyTime > 90) {
                        // Dead key was pressed alone, insert **
                        if (!this.displayEl.value.includes('^')) {
                            this.handleResultContinuation('**');
                            this.insertText('**');
                        }
                    }
                }, 100);
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

        // Display input - with dead key handling
        this.displayEl.addEventListener('input', () => {
            // Handle dead key "^" - if it appears in the input, replace it with **
            if (this.displayEl.value.includes('^')) {
                const cursorPos = this.displayEl.selectionStart || this.displayEl.value.length;
                // Count how many ^ are before the cursor to adjust cursor position
                const beforeCursor = this.displayEl.value.slice(0, cursorPos);
                const caretCountBefore = (beforeCursor.match(/\^/g) || []).length;
                
                // Replace all ^ with **
                this.displayEl.value = this.displayEl.value.replace(/\^/g, '**');
                
                // Adjust cursor position (each ^ becomes **, so add 1 for each)
                const newCursorPos = cursorPos + caretCountBefore;
                this.displayEl.selectionStart = this.displayEl.selectionEnd = newCursorPos;
            }
            this.formatDisplay();
            this.refreshLiveResult();
        });
    }

    append(value) {
        this.handleResultContinuation(value);
        this.insertText(value);
    }

    insertText(text) {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        let before = el.value.slice(0, start);
        const after = el.value.slice(end);
        
        // Check if inserting an operator after another operator
        const isBinaryOperator = (op) => {
            return ['+', '-', '*', '/', '**'].includes(op);
        };
        
        if (isBinaryOperator(text)) {
            // Find last non-space character before cursor
            const lastNonSpaceIndex = this.findLastNonWhitespace(before, before.length - 1);
            
            if (lastNonSpaceIndex >= 0) {
                const lastChar = before[lastNonSpaceIndex];
                let isOperatorBefore = false;
                let operatorStartIndex = lastNonSpaceIndex;
                
                // Check for ** operator
                if (lastChar === '*' && lastNonSpaceIndex > 0 && before[lastNonSpaceIndex - 1] === '*') {
                    isOperatorBefore = true;
                    operatorStartIndex = lastNonSpaceIndex - 1;
                } else if ('+-*/'.includes(lastChar)) {
                    isOperatorBefore = true;
                }
                
                // If there's an operator before cursor, replace it
                if (isOperatorBefore) {
                    // Remove operator and trailing spaces
                    let deleteStart = operatorStartIndex;
                    
                    // Remove leading spaces before operator
                    while (deleteStart > 0 && this.isWhitespace(before[deleteStart - 1])) {
                        deleteStart--;
                    }
                    
                    before = before.slice(0, deleteStart);
                }
            }
        }
        
        // Calculate cursor position BEFORE formatting to ensure it's at the end of the inserted text
        const beforeLength = before.length;
        const textLength = text.length;
        const valueBeforeFormat = before + text + after;
        
        // Set value first without formatting to ensure correct cursor placement
        el.value = valueBeforeFormat;
        el.selectionStart = el.selectionEnd = beforeLength + textLength;
        
        // Now format the display (this will adjust cursor position appropriately)
        this.formatDisplay();
        this.refreshLiveResult();
    }

    clear() {
        this.displayEl.value = '';
        this.liveResultEl.textContent = '';
        this.resultDisplayed = false;
    }

    pasteFromClipboard() {
        navigator.clipboard.readText().then(text => {
            if (text) {
                this.insertText(text);
            }
        }).catch(err => {
            console.error('Failed to read clipboard:', err);
        });
    }

    delete() {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;

        if (start !== end) {
            // Delete selection
            const before = el.value.slice(0, start);
            const after = el.value.slice(end);
            el.value = before + after;
            el.selectionStart = el.selectionEnd = start;
        } else if (start < el.value.length) {
            // Delete character after cursor
            const before = el.value.slice(0, start);
            const after = el.value.slice(start + 1);
            el.value = before + after;
            el.selectionStart = el.selectionEnd = start;
        }
        // If cursor is at the end and nothing is selected, do nothing
        
        this.formatDisplay();
        this.refreshLiveResult();
    }

    backspace() {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;

        // Store value before formatting to track deletion
        const valueBefore = el.value;
        let newCursorPos = start;

        if (start !== end) {
            // Delete selection
            const before = el.value.slice(0, start);
            const after = el.value.slice(end);
            el.value = before + after;
            newCursorPos = start;
        } else if (start > 0) {
            const charBefore = el.value[start - 1];
            
            // Check if deleting a space that's part of operator formatting
            if (this.isWhitespace(charBefore) && start > 1) {
                const charBeforeSpace = el.value[start - 2];
                const charAfter = el.value[start];
                
                // If space is after an operator, delete operator + surrounding spaces
                if ('+-*/'.includes(charBeforeSpace) || (start > 2 && el.value.slice(start - 3, start - 1) === '**')) {
                    let deleteStart = start - 2;
                    let deleteEnd = start;
                    
                    // Handle ** operator
                    if (start > 2 && el.value.slice(start - 3, start - 1) === '**') {
                        deleteStart = start - 3;
                    }
                    
                    // Remove leading space if present
                    if (deleteStart > 0 && this.isWhitespace(el.value[deleteStart - 1])) {
                        deleteStart--;
                    }
                    
                    // Remove trailing space if present
                    if (deleteEnd < el.value.length && this.isWhitespace(el.value[deleteEnd])) {
                        deleteEnd++;
                    }
                    
                    const before = el.value.slice(0, deleteStart);
                    const after = el.value.slice(deleteEnd);
                    el.value = before + after;
                    newCursorPos = deleteStart;
                } else if ('+-*/'.includes(charAfter) || (charAfter === '*' && el.value[start + 1] === '*')) {
                    // If space is before an operator, delete space + operator + trailing space
                    let deleteEnd = start + 1;
                    
                    // Handle ** operator
                    if (charAfter === '*' && el.value[start + 1] === '*') {
                        deleteEnd = start + 2;
                    }
                    
                    // Remove trailing space if present
                    if (deleteEnd < el.value.length && this.isWhitespace(el.value[deleteEnd])) {
                        deleteEnd++;
                    }
                    
                    const before = el.value.slice(0, start - 1);
                    const after = el.value.slice(deleteEnd);
                    el.value = before + after;
                    newCursorPos = start - 1;
                } else {
                    // Normal space deletion
                    const before = el.value.slice(0, start - 1);
                    const after = el.value.slice(end);
                    el.value = before + after;
                    newCursorPos = start - 1;
                }
            } else {
                // Delete single character before cursor
                const before = el.value.slice(0, start - 1);
                const after = el.value.slice(end);
                el.value = before + after;
                newCursorPos = start - 1;
            }
        }

        // Format and restore cursor position
        const unformatted = el.value;
        this.formatDisplay();
        
        // After formatting, try to maintain relative cursor position
        // by counting non-space characters before cursor
        const nonSpacesBefore = unformatted.slice(0, newCursorPos).replace(/\s/g, '').length;
        let count = 0;
        let targetPos = 0;
        for (let i = 0; i < el.value.length; i++) {
            if (el.value[i] !== ' ') {
                count++;
                if (count === nonSpacesBefore) {
                    targetPos = i + 1;
                    break;
                }
            }
        }
        if (count < nonSpacesBefore) targetPos = el.value.length;
        
        el.selectionStart = el.selectionEnd = targetPos;
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
            this.resultDisplayed = true;
            this.lastResult = resultStr;
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

    // Helper function to format integer part with thousand separators (non-breaking spaces)
    formatIntegerWithSeparators(intDigits) {
        return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    }

    // Helper function to check if a character is a whitespace (normal or non-breaking space)
    isWhitespace(char) {
        return char === ' ' || char === '\u00A0';
    }

    // Helper function to find the last non-whitespace character in a string from a given position
    findLastNonWhitespace(str, fromIndex) {
        for (let i = fromIndex; i >= 0; i--) {
            if (!this.isWhitespace(str[i])) {
                return i;
            }
        }
        return -1;
    }

    // Helper function to format a number part with sign and grouped integers
    formatNumberPart(numStr, includeFrac = true) {
        const [intPart, fracPart = ''] = numStr.split('.');
        const sign = intPart.startsWith('-') ? '-' : '';
        const intDigits = intPart.replace('-', '');
        const groupedInt = this.formatIntegerWithSeparators(intDigits);
        
        if (!includeFrac || !fracPart || fracPart === '0') {
            return sign + groupedInt;
        }
        
        const trimmedFrac = fracPart.replace(/0+$/, '');
        return sign + groupedInt + ',' + trimmedFrac;
    }

    refreshLiveResult() {
        const expression = this.displayEl.value.trim();
        if (!expression) {
            this.liveResultEl.textContent = '';
            this.liveResultEl.removeAttribute('title');
            return;
        }

        try {
            const result = this.evaluateExpression(expression);
            const resultStr = this.formatDecimal(result);
            this.liveResultEl.textContent = resultStr;
            this.liveResultEl.setAttribute('title', resultStr);
        } catch (error) {
            this.liveResultEl.textContent = '…';
            this.liveResultEl.removeAttribute('title');
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
            
            // Check if '-' is a negative number or a binary operator
            // It's a negative number only if:
            // - It's at the start, OR
            // - The previous token is an operator (but not ')'), OR
            // - The previous token is '('
            const isNegativeNumber = expr[i] === '-' && /[\d]/.test(expr[i + 1]) && (
                tokens.length === 0 ||
                (tokens[tokens.length - 1].type === 'operator' && tokens[tokens.length - 1].value !== ')')
            );
            
            // Numbers (including decimals and negative)
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
            
            // Power operator (check before single *)
            if (expr.startsWith('**', i)) {
                tokens.push({ type: 'operator', value: '**' });
                i += 2;
                continue;
            }
            
            // Operators and parentheses
            if ('+-*/()'.includes(expr[i])) {
                tokens.push({ type: 'operator', value: expr[i] });
                i++;
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
        return this.formatNumberPart(str, true);
    }

    formatNumberString(raw) {
        const normalized = raw.replace(/\s+/g, '').replace(/,/g, '.');
        
        // Don't format incomplete decimal numbers during input
        // (e.g., "0.", "0.0", "0.03" should stay as is during typing)
        if (normalized.includes('.')) {
            const parts = normalized.split('.');
            if (parts.length === 2) {
                const intPart = parts[0] || '0';
                const fracPart = parts[1];
                
                // Format integer part with thousand separators
                const sign = intPart.startsWith('-') ? '-' : '';
                const intDigits = intPart.replace('-', '');
                const groupedInt = this.formatIntegerWithSeparators(intDigits);
                
                // Keep fractional part as-is during input (preserve leading zeros)
                return sign + groupedInt + ',' + fracPart;
            }
        }
        
        // For whole numbers, use Decimal formatting
        try {
            const decimal = new Decimal(normalized);
            if (decimal.isInteger()) {
                const str = decimal.toFixed(0);
                return this.formatNumberPart(str, false);
            }
            return this.formatDecimal(decimal);
        } catch {
            return raw;
        }
    }

    formatExpressionWithCaret(value, caret) {
        let result = '';
        let newCaret = caret;
        let pos = 0;
        // Updated regex to allow incomplete decimals like "0," or "0,0" during input
        const regex = /-?\d[\d\s]*(?:,\d*)?/g;
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
                
                // Don't try to format incomplete/empty strings
                if (tokenBefore.length === 0) {
                    newCaret = result.length - formatted.length;
                } else {
                    const formattedBefore = this.formatNumberString(tokenBefore);
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

    handleResultContinuation(char) {
        if (!this.resultDisplayed) return;
        
        const isOperator = '+-*/'.includes(char) || char === '**' || char.includes('*');
        const isNumber = '0123456789,.'.includes(char);
        
        if (isNumber) {
            // Clear display for new number
            this.displayEl.value = '';
            this.resultDisplayed = false;
        } else if (isOperator) {
            // Keep result, append operator
            this.resultDisplayed = false;
        }
    }

    insertLastResult() {
        if (this.lastResult) {
            this.resultDisplayed = false;
            this.insertText(this.lastResult);
        }
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
            const index = this.findLastNonWhitespace(value, pos - 1);
            return index >= 0 ? value[index] : '';
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
            const tokenEnd = tokenStart + token.length;
            const prevChar = result.length > 0 ? result[result.length - 1] : '';
            const prevCh = prevNonSpace(tokenStart);
            
            const isUnary = (token === '+' || token === '-') && (!prevCh || '(*+/'.includes(prevCh));
            
            // Remove trailing space if present (but only one, to preserve number formatting)
            let spaceBefore = 0;
            if (!isUnary && this.isWhitespace(prevChar)) {
                result = result.slice(0, -1);
                spaceBefore = 1;
            }
            
            const replacement = isUnary ? token : ` ${token} `;
            const resultBeforeOperator = result.length;
            
            // Adjust caret for removed/added space before operator
            if (caret >= tokenStart && caret <= tokenEnd) {
                // Cursor is inside or at the end of the operator token
                if (isUnary) {
                    // For unary operators, maintain relative position
                    const offsetInToken = caret - tokenStart;
                    newCaret = resultBeforeOperator + offsetInToken;
                } else {
                    // For binary operators, place cursor after the operator (including trailing space)
                    newCaret = resultBeforeOperator + replacement.length;
                }
            } else if (caret > tokenEnd) {
                // Cursor is after the token
                const delta = replacement.length - token.length - spaceBefore;
                newCaret += delta;
            } else if (caret > tokenStart - spaceBefore && caret < tokenStart) {
                // Cursor is in the space before the operator
                newCaret = resultBeforeOperator + (isUnary ? 0 : 1);
            }
            result += replacement;
            i += token.length;
        }
        
        // Remove duplicate spaces and adjust caret position
        i = result.length - 1;
        while (i > 0) {
            if (this.isWhitespace(result[i]) && this.isWhitespace(result[i - 1])) {
                result = result.slice(0, i) + result.slice(i + 1);
                // Adjust caret if it's after the removed space
                if (newCaret > i) {
                    newCaret--;
                }
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
