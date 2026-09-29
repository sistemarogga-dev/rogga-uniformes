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
const rects = zonas.map((z) => {
  const x = Math.round(z.x0 * tW), y = Math.round(z.y0 * tH);
  const w = Math.round((z.x1 - z.x0) * tW), h = Math.round((z.y1 - z.y0) * tH);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
}).join("");
const maskSvg = `<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg"><rect width="${tW}" height="${tH}" fill="black"/>${rects}</svg>`;

// ===== Reproduz EXATAMENTE o código atual do route.ts =====
const maskRgb = await sharp(Buffer.from(maskSvg)).png().toBuffer();
console.log("maskRgb channels:", (await sharp(maskRgb).metadata()).channels);

const maskAlpha = await sharp(maskRgb).extractChannel("red").negate().toBuffer();
console.log("maskAlpha channels:", (await sharp(maskAlpha).metadata()).channels);

try {
  const maskFinal = await sharp({
    create: { width: tW, height: tH, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).joinChannel(maskAlpha).png().toBuffer();
  const m = await sharp(maskFinal).metadata();
  console.log("maskFinal OK. channels:", m.channels, "size:", m.width, "x", m.height);
  const stats = await sharp(maskFinal).stats();
  const alpha = stats.channels[stats.channels.length - 1];
  console.log("Alpha (último canal) -> min:", alpha.min, "max:", alpha.max, "mean:", Math.round(alpha.mean));
} catch (e) {
  console.error("maskFinal FALHOU:", e.message);
}
