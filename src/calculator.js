import {
    isWhitespace,
    findLastNonWhitespace,
    formatDecimal,
    formatExpressionWithCaret,
    formatOperatorsWithCaret,
} from './formatting.mjs';

import { evaluateExpression } from './parser.mjs';
import { applySquareOp, applySqrtOp, applyReciprocalOp, insertTextCore, backspaceCore, deleteCore } from './calculator-core.mjs';

// Lazy-Ladung von Decimal.js, um den Initialstart zu verkürzen
let decimalReadyPromise;
function ensureDecimalReady() {
    if (!decimalReadyPromise) {
        const decimalUrl = new URL('../node_modules/decimal.js/decimal.mjs', import.meta.url);
        decimalReadyPromise = import(decimalUrl.href).then(({ default: DecimalLib }) => {
            DecimalLib.set({ precision: 50, rounding: DecimalLib.ROUND_HALF_UP });
            globalThis.Decimal = DecimalLib;
            return DecimalLib;
        });
    }
    return decimalReadyPromise;
}

class Calculator {
    constructor() {
        this.displayEl = document.getElementById('display');
        this.liveResultEl = document.getElementById('live-result');
        this.historyListEl = document.getElementById('history-list');
        this.history = [];
        this.resultDisplayed = false;
        this.lastResult = null;
        this.isReady = false;
        ensureDecimalReady().then(() => {
            this.isReady = true;
            this.refreshLiveResult();
        });
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Button clicks
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isReady) return;
                if (btn.dataset.char) {
                    this.append(btn.dataset.char);
                } else if (btn.dataset.action) {
                    this.handleAction(btn.dataset.action);
                }
            });
        });

        // Keyboard input on document
        document.addEventListener('keydown', (e) => {
            if (!this.isReady) return;
            const keyLower = (e.key || '').toLowerCase();
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
            if ('0123456789,+-*/()%'.includes(keyLower) || keyLower === '.') {
                e.preventDefault();
                const char = keyLower === '.' ? ',' : keyLower;
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
            if (keyLower === 'v' && e.ctrlKey) {
                e.preventDefault();
                this.pasteFromClipboard();
            }
            if (keyLower === 'm') {
                e.preventDefault();
                this.insertLastResult();
            }
            if (keyLower === 'q') {
                e.preventDefault();
                this.applySquare();
            }
            if (keyLower === 'r') {
                e.preventDefault();
                this.applySqrt();
            }
            if (keyLower === 'i') {
                e.preventDefault();
                this.handleAction('reciprocal');
            }
            if (keyLower === 'n') {
                e.preventDefault();
                this.handleAction('negate');
            }
            if (keyLower === 'c' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this.handleAction('copy-expr');
            } else if (keyLower === 'c' && e.ctrlKey) {
                e.preventDefault();
                this.handleAction('copy-result');
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
            if (!this.isReady) return;
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
        const result = deleteCore(el.value, start, end);
        el.value = result.value;
        el.selectionStart = el.selectionEnd = result.selectionStart;
        this.refreshLiveResult();
    }

    backspace() {
        const el = this.displayEl;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;

        const result = backspaceCore(el.value, start, end);
        el.value = result.value;
        el.selectionStart = el.selectionEnd = result.selectionStart;
        
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
        this.displayEl.value = applyReciprocalOp(expression);
        this.refreshLiveResult();
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
        // Interpret % als Modulo-Operator und füge ihn ein
        this.handleResultContinuation('%');
        this.insertText('%');
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
