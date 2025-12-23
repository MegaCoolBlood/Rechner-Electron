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

// Verifiziert, dass der eingegebene Text im Display sichtbar ist, auch ohne Overlay-Inhalte
test('Display zeigt eingegebenen Text sichtbar (weiß) an', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    const overlay = window.locator('#display-overlay');

    await display.click();
    await window.evaluate(() => {
      const el = document.getElementById('display');
      el.value = '123+456';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Sicherstellen, dass das Textarea den erwarteten Wert hat
    await expect(display).toHaveValue(/123 \+ 456/);

    // Textfarbe im Textarea ist transparent (Text kommt aus Overlay)
    const displayColor = await window.evaluate(() => getComputedStyle(document.getElementById('display')).color);
    expect(displayColor).toBe('rgba(0, 0, 0, 0)');

    // Warte bis Overlay Inhalte gerendert hat
    await expect.poll(async () => await overlay.innerHTML()).not.toEqual('');

    // Ghost-Spans im Overlay sind weiß (Basistext sichtbar)
    const ghostColor = await window.evaluate(() => {
      const overlayEl = document.getElementById('display-overlay');
      const ghost = overlayEl.querySelector('span.ghost');
      return ghost ? getComputedStyle(ghost).color : '';
    });
    expect(ghostColor).toBe('rgb(226, 232, 240)');
  } finally {
    await teardown(electronApp);
  }
});
