// PWA アイコンを生成する(初回・デザイン変更時のみ実行し、生成物をコミットする)
//   npx tsx scripts/generate-icons.ts

import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(import.meta.dirname, "..", "public", "icons");
const ICONS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

const browser = await chromium.launch();
for (const { file, size, maskable } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // maskable は全面塗り(OS 側で角丸にする)、通常は角丸 + 余白なし
  const radius = maskable ? 0 : size * 0.22;
  const glyph = size * (maskable ? 0.5 : 0.62);
  await page.setContent(`<html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:#0066cc;border-radius:${radius}px;display:flex;align-items:center;justify-content:center">
      <span style="color:#fff;font-size:${glyph}px;font-weight:700;font-family:'Hiragino Mincho ProN','YuMincho',serif;line-height:1">字</span>
    </div></body></html>`);
  await page.screenshot({ path: join(OUT, file), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("アイコンを生成しました");
