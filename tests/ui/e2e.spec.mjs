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

test('live result updates for 2+2 and modulo', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();
    await window.keyboard.type('2+2');
    const live = window.locator('#live-result');
    await expect(live).toHaveText(/4/);

    // Clear
    await window.keyboard.press('Escape');

    // Modulo
    await window.keyboard.type('7%3');
    await expect(live).toHaveText(/1/);
  } finally {
    await teardown(electronApp);
  }
});

test('hotkeys: Q for square and R for sqrt', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    await display.click();
    await window.keyboard.type('2+2');
    await window.keyboard.press('q');
    await expect(display).toHaveValue(/\(2 \+ 2\) \*\* 2/);

    await window.keyboard.press('r');
    await expect(display).toHaveValue(/\) \*\* \(1\/2\)\)?$/);
  } finally {
    await teardown(electronApp);
  }
});
