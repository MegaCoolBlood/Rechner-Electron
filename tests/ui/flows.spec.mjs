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

async function waitForReady(window) {
  // Warten bis Decimal geladen ist (isReady true)
  for (let i = 0; i < 50; i++) {
    const ready = await window.evaluate(() => !!window.Decimal);
    if (ready) return;
    await new Promise(r => setTimeout(r, 50));
  }
}

test('Historie: Recall und weiterrechnen (+4) aktualisiert Live-Ergebnis zu 9', async () => {
  const { electronApp, window } = await launchApp();
  try {
    await waitForReady(window);
    const display = window.locator('#display');
    const live = window.locator('#live-result');
    const historyList = window.locator('#history-list');

    await display.click();
    await window.keyboard.type('2+3');
    await window.keyboard.press('Enter');

    const firstItem = historyList.locator('li').first();
    await expect(firstItem).toHaveText(/2 \+ 3 = 5/);

    await firstItem.click();
    await expect(display).toHaveValue(/2 \+ 3$/);

    await window.keyboard.type('+4');
    await expect(display).toHaveValue(/2 \+ 3 \+ 4$/);
    await expect(live).toHaveText(/9/);
  } finally {
    await teardown(electronApp);
  }
});

test('F6 fokussiert das Display-Textfeld', async () => {
  const { electronApp, window } = await launchApp();
  try {
    await waitForReady(window);
    // Fokus bewusst vom Display nehmen: auf History-Titel klicken
    const title = window.locator('.history-title');
    await title.click();

    await window.keyboard.press('F6');

    const activeId = await window.evaluate(() => document.activeElement?.id || '');
    expect(activeId).toBe('display');
  } finally {
    await teardown(electronApp);
  }
});

