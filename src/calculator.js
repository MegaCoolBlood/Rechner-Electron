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
                const char = e.key === ',' ? '.' : e.key;
                this.insertText(char);
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
            // Replace German decimal separator with JavaScript decimal
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const result = Function('"use strict"; return (' + jsExpression + ')')();
            
            const resultStr = this.formatNumber(result);
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
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const value = Function('"use strict"; return (' + jsExpression + ')')();
            
            if (value === 0) throw new Error('Division durch 0');
            const result = 1 / value;
            this.displayEl.value = this.formatNumber(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applySquare() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const value = Function('"use strict"; return (' + jsExpression + ')')();
            
            const result = value * value;
            this.displayEl.value = this.formatNumber(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applySqrt() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const value = Function('"use strict"; return (' + jsExpression + ')')();
            
            if (value < 0) throw new Error('Wurzel aus negativer Zahl');
            const result = Math.sqrt(value);
            this.displayEl.value = this.formatNumber(result);
            this.refreshLiveResult();
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    }

    applyPercent() {
        const expression = this.displayEl.value.trim();
        if (!expression) return;

        try {
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const value = Function('"use strict"; return (' + jsExpression + ')')();
            
            const result = value / 100;
            this.displayEl.value = this.formatNumber(result);
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
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const result = Function('"use strict"; return (' + jsExpression + ')')();
            
            const resultStr = this.formatNumber(result);
            navigator.clipboard.writeText(resultStr).catch(() => {
                alert('Konnte nicht in Zwischenablage kopieren');
            });
        } catch (error) {
            alert('Fehler beim Kopieren');
        }
    }

    formatNumber(value) {
        if (!isFinite(value)) return 'Fehler';
        
        if (Number.isInteger(value)) {
            return value.toLocaleString('de-DE');
        }

        // Format with max 12 significant digits
        let str = value.toPrecision(12);
        
        // Replace . with , for German locale
        str = str.replace('.', ',');
        
        // Add thousands separator
        const parts = str.split(',');
        parts[0] = parseInt(parts[0]).toLocaleString('de-DE');
        return parts.join(',');
    }

    refreshLiveResult() {
        const expression = this.displayEl.value.trim();
        if (!expression) {
            this.liveResultEl.textContent = '';
            return;
        }

        try {
            const jsExpression = expression.replace(/,/g, '.');
            // eslint-disable-next-line no-eval
            const result = Function('"use strict"; return (' + jsExpression + ')')();
            
            this.liveResultEl.textContent = this.formatNumber(result);
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Calculator();
});
