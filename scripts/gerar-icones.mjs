// Gera favicon e ícones do app (PWA) da demonstração GuIA Dados: quadrado
// violeta com a linha de crescimento da marca.
// Uso: node scripts/gerar-icones.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const VIOLETA = "#7C5CFF";

function svg({ size = 512, radius = 0.22, pad = 0.2 } = {}) {
  const p = size * pad;
  const w = size - 2 * p;
  const pts = [
    [0, 0.82],
    [0.3, 0.58],
    [0.55, 0.68],
    [1, 0.12],
  ].map(([x, y]) => [p + x * w, p + y * w]);
  const d = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const sw = size * 0.085;
  const dots = pts
    .slice(1)
    .map(
      ([x, y], i) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(sw * (i === 2 ? 0.95 : 0.7)).toFixed(1)}" fill="#fff"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="${VIOLETA}"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

writeFileSync("src/app/icon.svg", svg({ size: 64 }));

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(file, size, opts) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg({ size, ...opts })}</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
}
await png("src/app/apple-icon.png", 180, { radius: 0 });
await png("public/icons/icon-192.png", 192);
await png("public/icons/icon-512.png", 512);
await png("public/icons/maskable-512.png", 512, { radius: 0, pad: 0.28 });
await browser.close();
