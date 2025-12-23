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

test('formatting: große Zahlen mit NBSP und Dezimal-Komma', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    // Viele Ziffern -> Gruppierung mit NBSP
    await window.keyboard.type('1234567890123456');
    await expect(display).toHaveValue(new RegExp('1\\u00A0234\\u00A0567\\u00A0890\\u00A0123\\u00A0456$'));

    // Clear
    await window.keyboard.press('Escape');

    // Dezimal mit Komma und Gruppierung
    await window.keyboard.type('12345,6789');
    await expect(display).toHaveValue(new RegExp('12\\u00A0345,6789$'));
  } finally {
    await teardown(electronApp);
  }
});

test('Klammer-Handling: auto-prepend bei ) und mehrfachen )', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    // "5" + ")" -> "(5)"
    await window.keyboard.type('5');
    await window.keyboard.press(')');
    await expect(display).toHaveValue(/^\(5\)$/);

    // Clear und dann doppelte )
    await window.keyboard.press('Escape');
    await window.keyboard.type('5');
    await window.keyboard.type('))');
    await expect(display).toHaveValue(/^\(\(5\)\)$/);
  } finally {
    await teardown(electronApp);
  }
});

test('Historie: Eintrag nach Enter und Recall per Klick', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    const historyList = window.locator('#history-list');
    await display.click();

    await window.keyboard.type('2+3');
    await window.keyboard.press('Enter');

    // Warte auf den ersten History-Eintrag
    const firstItem = historyList.locator('li').first();
    await expect(firstItem).toHaveText(/2 \+ 3 = 5/);

    // Klick auf den Eintrag lädt den Ausdruck zurück ins Display
    await firstItem.click();
    await expect(display).toHaveValue(/2 \+ 3$/);
  } finally {
    await teardown(electronApp);
  }
});

test('Hotkeys: I (Kehrwert), N (Vorzeichen), M (letztes Ergebnis)', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();

    // I: Kehrwert von (2+2)
    await window.keyboard.type('2+2');
    await window.keyboard.press('i');
    await expect(display).toHaveValue(/\(1 \/ \(2 \+ 2\)\)\)?$/);

    // Enter -> Ergebnis 0,25
    await window.keyboard.press('Enter');
    await expect(display).toHaveValue(/0,25$/);

    // N: Vorzeichen toggeln
    await window.keyboard.press('n');
    await expect(display).toHaveValue(/^-0,25$/);
    await window.keyboard.press('n');
    await expect(display).toHaveValue(/^0,25$/);

    // M: letztes Ergebnis einfügen (z.B. 0,25 + 0,25)
    await window.keyboard.press('Escape');
    await window.keyboard.type('2+2');
    await window.keyboard.press('Enter'); // Ergebnis 4, speichere als letztes Ergebnis
    await window.keyboard.type('+');
    await window.keyboard.press('m');
    await expect(display).toHaveValue(/4 \+ 4$/);
  } finally {
    await teardown(electronApp);
  }
});
