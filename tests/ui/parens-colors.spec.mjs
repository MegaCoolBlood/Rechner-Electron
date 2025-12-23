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

test('Overlay färbt Klammern mit Spans', async () => {
  const { electronApp, window } = await launchApp();
  try {
    const display = window.locator('#display');
    const overlay = window.locator('#display-overlay');

    await display.click();
    // Direkt setzen + Input-Event auslösen, um Timing-Rennen zu vermeiden
    await window.evaluate(() => {
      const el = document.getElementById('display');
      el.value = '(1+(2*(3-4)))';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Warte kurz auf DOM-Update des Overlays
    await expect(overlay).toBeVisible();

    // Warte bis das Overlay Inhalte erzeugt hat
    await expect.poll(async () => await overlay.innerHTML()).not.toEqual('');

    const html = await overlay.innerHTML();

    // Es sollten farbige Klammer-Spans vorhanden sein
    expect(html).toContain('<span style="color:');
    expect(html).toContain('>(</span>');
    expect(html).toContain('>)</span>');

    // Ghost-Spans existieren (sind aber transparent), Text kommt aus Textarea
    expect(html).toContain('<span class="ghost">1</span>');

    // Mindestens eine der definierten CSS-Variablen (mit Fallback) sollte verwendet worden sein
    expect(html).toMatch(/var\(--paren-(1|2|3|4|5),\s*#[0-9a-fA-F]{6}\)/);

    // Prüfe die tatsächliche berechnete Farbe des ersten farbigen Klammer-Spans
    const computedColor = await window.evaluate(() => {
      const overlayEl = document.getElementById('display-overlay');
      const span = overlayEl.querySelector('span[style*="color:"]');
      return span ? getComputedStyle(span).color : '';
    });
    // Sollte weder transparent noch die Standard-Textfarbe sein
    expect(computedColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(computedColor).not.toBe('rgb(226, 232, 240)'); // #e2e8f0
    // Sollte auch nicht die Hintergrundfarbe sein
    expect(computedColor).not.toBe('rgb(11, 18, 35)'); // #0b1223

    // Prüfe Hintergrundfarbe des Display-Wrappers
    const bgColor = await window.evaluate(() => {
      const wrapper = document.querySelector('.display-wrapper');
      return wrapper ? getComputedStyle(wrapper).backgroundColor : '';
    });
    expect(bgColor).toBe('rgb(11, 18, 35)'); // #0b1223

    // Ghost-Spans sind weiß (Overlay rendert Basistext)
    const ghostColor = await window.evaluate(() => {
      const overlayEl = document.getElementById('display-overlay');
      const ghost = overlayEl.querySelector('span.ghost');
      return ghost ? getComputedStyle(ghost).color : '';
    });
    expect(ghostColor).toBe('rgb(226, 232, 240)');

    // Text im Textarea ist transparent (Text kommt aus dem Overlay)
    const displayColor = await window.evaluate(() => getComputedStyle(document.getElementById('display')).color);
    expect(displayColor).toBe('rgba(0, 0, 0, 0)');

    // Ziffern (Ghost-Spans) haben die Standard-Textfarbe, nicht die Klammerfarbe
    const digitColor = await window.evaluate(() => {
      const overlayEl = document.getElementById('display-overlay');
      // Suche nach einem Ghost-Span, der eine Ziffer enthält
      const ghosts = overlayEl.querySelectorAll('span.ghost');
      for (const ghost of ghosts) {
        if (/\d/.test(ghost.textContent)) {
          return getComputedStyle(ghost).color;
        }
      }
      return '';
    });
    expect(digitColor).toBe('rgb(226, 232, 240)'); // Standardfarbe, nicht Klammerfarbe
    
    // Prüfe, dass Ghost-Spans nicht transparent sind (sichtbar)
    expect(digitColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(digitColor).not.toBe('transparent');
  } finally {
    await teardown(electronApp);
  }
});
