import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const templatePath = path.join(root, "public", "template.png");
const meta = await sharp(templatePath).metadata();
const tW = meta.width, tH = meta.height;

const zonas = [
  { x0: 0.04, y0: 0.245, x1: 0.96, y1: 0.49 },
  { x0: 0.04, y0: 0.512, x1: 0.96, y1: 0.78 },
];

// "Gerado" fake = imagem vermelha sólida do tamanho do template
const fakeGerado = await sharp({
  create: { width: tW, height: tH, channels: 3, background: { r: 220, g: 30, b: 30 } },
}).png().toBuffer();

// Máscara KEEP: fundo transparente + retângulos brancos OPACOS nas camisas
const keepRects = zonas.map((z) => {
  const x = Math.round(z.x0 * tW), y = Math.round(z.y0 * tH);
  const w = Math.round((z.x1 - z.x0) * tW), h = Math.round((z.y1 - z.y0) * tH);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
}).join("");
const keepSvg = `<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`;
const keepPng = await sharp(Buffer.from(keepSvg)).png().toBuffer();

// overlay = fakeGerado visível APENAS nas zonas (dest-in)
const overlay = await sharp(fakeGerado)
  .ensureAlpha()
  .composite([{ input: keepPng, blend: "dest-in" }])
  .png()
  .toBuffer();

// final = template + overlay
await sharp(templatePath)
  .composite([{ input: overlay }])
  .png()
  .toFile(path.join(__dirname, "check-composite.png"));

console.log("ok");
