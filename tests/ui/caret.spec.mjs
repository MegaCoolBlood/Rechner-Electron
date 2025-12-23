import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

async function launchApp() {
  const electronApp = await electron.launch({ args: [path.join(projectRoot, 'src', 'main.js')] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#display');
  return { electronApp, window };
}

async function teardown(electronApp) {
  await electronApp.close();
}

test('Caret bleibt am eingefügten Digit in formatierten Zahlen', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();
    await window.keyboard.type('1234567');

    // Erwartete Gruppierung: 1\u00A0234\u00A0567
    await expect(display).toHaveValue(/1\u00A0234\u00A0567$/);

    // Caret in die Mitte setzen (nach "1\u00A0") und '9' tippen
    const caretAfter = await window.evaluate(() => {
      const el = document.querySelector('#display');
      // Setze Caret hinter die ersten 2 Zeichen ("1" und NBSP)
      el.selectionStart = el.selectionEnd = 2;
      return el.selectionStart;
    });
    expect(caretAfter).toBe(2);

    await window.keyboard.type('9');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      return { value: el.value, caret: el.selectionStart, prev: el.value[el.selectionStart - 1] };
    });

    // Der Wert sollte nun "19\u00A0234\u00A0567" entsprechen und das Zeichen vor dem Caret ist '9'.
    expect(state.value).toMatch(/19\u00A0234\u00A0567$/);
    expect(state.prev).toBe('9');
  } finally {
    await teardown(electronApp);
  }
});

test('Caret nach Einfügen von ** via ^ Dead-Key', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();
    await window.keyboard.type('2+2');

    // ^ sollte zu ** werden und Caret danach stehen
    await window.keyboard.press('^');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      const idx = el.selectionStart;
      return { value: el.value, caret: idx, last3: el.value.slice(idx - 3, idx) };
    });

    // Erwartet: "2 + 2 ** " (Spacing um Operatoren), Caret am Ende, letzte 3 Zeichen sind "** "
    expect(state.value).toMatch(/2 \+ 2 \*\* $/);
    expect(state.last3).toBe('** ');
  } finally {
    await teardown(electronApp);
  }
});

test('Caret nach Operator-Spacing: "+" fügt Leerzeichen und Caret bleibt am Ende', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('2');
    await window.keyboard.type('+');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      return { value: el.value, caret: el.selectionStart };
    });

    // Erwartet: "2 + " (mit Leerzeichen) und Caret am Ende
    expect(state.value.endsWith(' + ')).toBeTruthy();
    expect(state.caret).toBe(state.value.length);
  } finally {
    await teardown(electronApp);
  }
});

test('Backspace entfernt Operator-Chunk (" + ") und setzt Caret korrekt', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('2');
    await window.keyboard.type('+'); // ergibt "2 + "
    await expect(display).toHaveValue(/2 \+ $/);

    // Backspace: sollte gesamten Operator-Chunk entfernen
    await window.keyboard.press('Backspace');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      return { value: el.value, caret: el.selectionStart };
    });

    expect(state.value).toBe('2');
    expect(state.caret).toBe(state.value.length);
  } finally {
    await teardown(electronApp);
  }
});

test('Delete entfernt Operator-Chunk vor dem Caret (" + ") und Caret bleibt', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('2+3'); // ergibt "2 + 3"
    await expect(display).toHaveValue(/2 \+ 3$/);

    // Caret direkt vor das "+" setzen (Position 2)
    await window.evaluate(() => {
      const el = document.querySelector('#display');
      // Index 2 ist das '+' in "2 + 3"
      el.selectionStart = el.selectionEnd = 2;
    });

    await window.keyboard.press('Delete');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      return { value: el.value, caret: el.selectionStart };
    });

    // Erwartet: Operator-Chunk entfernt -> "23", Caret landet vor der ehemaligen Stelle (Index 1)
    expect(state.value).toBe('23');
    expect(state.caret).toBe(1);
  } finally {
    await teardown(electronApp);
  }
});

test('Backspace entfernt Power-Operator "** " als Einheit', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('2');
    await window.keyboard.press('^'); // ergibt "2 ** " und Caret am Ende
    await expect(display).toHaveValue(/2 \*\* $/);

    await window.keyboard.press('Backspace');

    const state = await window.evaluate(() => {
      const el = document.querySelector('#display');
      return { value: el.value, caret: el.selectionStart };
    });

    expect(state.value).toBe('2');
    expect(state.caret).toBe(1);
  } finally {
    await teardown(electronApp);
  }
});
