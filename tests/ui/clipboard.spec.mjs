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

async function stubClipboard(window, { readTextValue } = {}) {
  await window.evaluate((readTextValueInner) => {
    const stub = {
      _buf: null,
      writeText: (t) => { window.__copied = t; stub._buf = t; return Promise.resolve(); },
      readText: () => Promise.resolve(readTextValueInner ?? stub._buf ?? '')
    };
    try {
      // Versuche vorhandene Methoden zu überschreiben
      if (navigator.clipboard) {
        navigator.clipboard.writeText = stub.writeText;
        navigator.clipboard.readText = stub.readText;
      } else {
        Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
      }
    } catch {
      // Fallback: direkt definieren
      Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
    }
  }, readTextValue);
}

test('Copy Result: Ctrl+C kopiert berechnetes Ergebnis', async () => {
  const { electronApp, window } = await launchApp();
  try {
    await stubClipboard(window);
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('2+3');
    await window.keyboard.press('Control+C');

    const copied = await window.evaluate(() => window.__copied);
    expect(copied).toBe('5');
  } finally {
    await teardown(electronApp);
  }
});

test('Copy Expression: Ctrl+Shift+C kopiert formatierten Ausdruck', async () => {
  const { electronApp, window } = await launchApp();
  try {
    await stubClipboard(window);
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.type('12+34'); // wird zu "12 + 34"
    await window.keyboard.press('Control+Shift+C');

    const copied = await window.evaluate(() => window.__copied);
    expect(copied).toBe('12 + 34');
  } finally {
    await teardown(electronApp);
  }
});

test('Paste: Ctrl+V fügt aus Clipboard ein und formatiert (Modulo)', async () => {
  const { electronApp, window } = await launchApp();
  try {
    await stubClipboard(window, { readTextValue: '7%3' });
    const display = window.locator('#display');
    await display.click();

    await window.keyboard.press('Control+V');

    await expect(display).toHaveValue(/7 % 3$/);
    const live = window.locator('#live-result');
    await expect(live).toHaveText(/1/);
  } finally {
    await teardown(electronApp);
  }
});
