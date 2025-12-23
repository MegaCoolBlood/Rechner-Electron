import {
    isWhitespace,
    findLastNonWhitespace,
    formatDecimal,
    formatExpressionWithCaret,
    formatOperatorsWithCaret,
} from './formatting.mjs';

import { evaluateExpression } from './parser.mjs';
import { applySquareOp, applySqrtOp, insertTextCore } from './calculator-core.mjs';

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
        
        const result = insertTextCore(el.value, start, end, text);
        el.value = result.value;
        el.selectionStart = el.selectionEnd = result.selectionStart;
        
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
            if (isWhitespace(charBefore) && start > 1) {
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
                    if (deleteStart > 0 && isWhitespace(el.value[deleteStart - 1])) {
                        deleteStart--;
                    }
                    
                    // Remove trailing space if present
                    if (deleteEnd < el.value.length && isWhitespace(el.value[deleteEnd])) {
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
                    if (deleteEnd < el.value.length && isWhitespace(el.value[deleteEnd])) {
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
        // Realign caret based on non-whitespace characters (spaces or NBSPs should be ignored)
        const nonSpacesBefore = unformatted
            .slice(0, newCursorPos)
            .split('')
            .filter((ch) => !isWhitespace(ch))
            .length;

        let count = 0;
        let targetPos = 0;
        for (let i = 0; i < el.value.length; i++) {
            if (!isWhitespace(el.value[i])) {
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
            const result = evaluateExpression(expression);
            const resultStr = formatDecimal(result);
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
            const value = evaluateExpression(expression);
            if (value.isZero()) throw new Error('Division durch 0');
            const result = new Decimal(1).div(value);
            this.displayEl.value = formatDecimal(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applySquare() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;
        this.displayEl.value = applySquareOp(expression);
        this.refreshLiveResult();
    }

    applySqrt() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;
        this.displayEl.value = applySqrtOp(expression);
        this.refreshLiveResult();
    }

    applyPercent() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const value = evaluateExpression(expression);
            const result = value.div(100);
            this.displayEl.value = formatDecimal(result);
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
            const result = evaluateExpression(expression);
            const resultStr = formatDecimal(result);
            navigator.clipboard.writeText(resultStr).catch(() => {
                alert('Konnte nicht in Zwischenablage kopieren');
            });
        } catch (error) {
            alert('Fehler beim Kopieren');
        }
    }

    refreshLiveResult() {
        const expression = this.displayEl.value.trim();
        if (!expression) {
            this.liveResultEl.textContent = '';
            this.liveResultEl.removeAttribute('title');
            return;
        }

        try {
            const result = evaluateExpression(expression);
            const resultStr = formatDecimal(result);
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
        const { text: numbersFormatted, caret: caretAfterNumbers } = formatExpressionWithCaret(el.value, caret);
        const { text, caret: newCaret } = formatOperatorsWithCaret(numbersFormatted, caretAfterNumbers);
        el.value = text;
        el.selectionStart = el.selectionEnd = newCaret;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Calculator();
});
