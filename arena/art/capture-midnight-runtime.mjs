import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const require = createRequire(new URL('../e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1300 }, deviceScaleFactor: 1 });
  await page.goto(process.env.ARENA_URL ? `${process.env.ARENA_URL}/animation-lab` : 'http://127.0.0.1:5173/animation-lab');
  await page.getByRole('img').first().waitFor();
  await page.getByLabel('行走发型').selectOption('midnight');
  await page.getByRole('button', { name: '暂停动画' }).click();
  const captured = [];
  for (const outfit of ['scholar', 'warden']) {
    await page.getByLabel('行走衣装').selectOption(outfit);
    const poses = new Set();
    for (let frame = 0; frame < 4; frame++) {
      const styles = await page.locator('.animated-hair').evaluateAll(nodes => nodes.map(node => node.getAttribute('style')));
      if (styles.length !== 8 || styles.some(style => !style.includes('midnight'))) throw new Error('Wrong hair layers');
      styles.forEach(style => poses.add(style));
      await page.getByRole('button', { name: '下一帧' }).click();
    }
    if (poses.size !== 32) throw new Error(`${outfit}: only ${poses.size}/32 distinct runtime poses`);
    await page.evaluate(async () => {
      const urls = [...document.querySelectorAll('.animated-hair, .animated-outfit, .animated-weapon')].map(node =>
        getComputedStyle(node).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]).filter(Boolean);
      await Promise.all(urls.map(url => new Promise((resolve, reject) => {
        const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = url;
      })));
    });
    captured.push(await page.locator('main').screenshot());
    console.log(`PASS ${outfit}: all 32 midnight runtime poses`);
  }
  const images = await Promise.all(captured.map(input => sharp(input).metadata()));
  await sharp({ create: { width: images[0].width * 2, height: Math.max(...images.map(image => image.height)), channels: 4, background: '#18272c' } })
    .composite(captured.map((input, index) => ({ input, left: index * images[0].width, top: 0 }))).png()
    .toFile(fileURLToPath(new URL('../../wiki/tiddlers/竞技场2026-11-14午夜发纸娃娃实机.png', import.meta.url)));
} finally { await browser.close(); }
