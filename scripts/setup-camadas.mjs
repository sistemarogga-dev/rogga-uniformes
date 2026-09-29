import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const desktop = path.join(root, "..", "..", "Desktop");

const W = 2160, H = 3840; // resolução de trabalho (9:16)

const molduraSrc = path.join(desktop, "Layout padrão de fundo que não pode ser mudado.png");
const camisasSrc = path.join(desktop, "Camisas e fundo de contexto do box das camisas que deve ser mudado.png");

// Quadros (zonas editáveis) como frações — calibrar até cobrir o interior dos quadros.
const zonas = [
  { x0: 0.035, y0: 0.205, x1: 0.965, y1: 0.438 }, // quadro POLO
  { x0: 0.035, y0: 0.475, x1: 0.965, y1: 0.730 }, // quadro CAMISETA
];

// Raio dos cantos arredondados (para encaixar na borda dourada do retângulo)
const RAD = Math.round(0.028 * W);

// 1) moldura.png (camada fixa) em 2160x3840
const moldura = await sharp(molduraSrc).resize(W, H, { fit: "fill" }).png().toBuffer();
await sharp(moldura).toFile(path.join(root, "public", "moldura.png"));

// 2) template.png = moldura + camisas (só nas zonas) → base que a IA edita
const camisas = await sharp(camisasSrc).resize(W, H, { fit: "fill" }).png().toBuffer();
const keepRects = zonas.map((z) => {
  const x = Math.round(z.x0 * W), y = Math.round(z.y0 * H);
  const w = Math.round((z.x1 - z.x0) * W), h = Math.round((z.y1 - z.y0) * H);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${RAD}" ry="${RAD}" fill="white"/>`;
}).join("");
const keepPng = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`)).png().toBuffer();
const camisasNasZonas = await sharp(camisas).ensureAlpha().composite([{ input: keepPng, blend: "dest-in" }]).png().toBuffer();
await sharp(moldura).composite([{ input: camisasNasZonas }]).png().toFile(path.join(root, "public", "template.png"));

// 3) Prévia das zonas sobre a moldura
const rects = zonas.map((z) => {
  const x = Math.round(z.x0 * W), y = Math.round(z.y0 * H);
  const w = Math.round((z.x1 - z.x0) * W), h = Math.round((z.y1 - z.y0) * H);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${RAD}" ry="${RAD}" fill="red" fill-opacity="0.4" stroke="red" stroke-width="6"/>`;
}).join("");
await sharp(moldura)
  .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`), top: 0, left: 0 }])
  .png().toFile(path.join(__dirname, "preview-zonas.png"));

console.log("moldura.png criada e preview-zonas.png gerada.", JSON.stringify(zonas));
