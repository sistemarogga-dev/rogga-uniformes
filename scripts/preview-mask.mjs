import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const templatePath = path.join(root, "public", "template.png");
const meta = await sharp(templatePath).metadata();
const W = meta.width, H = meta.height;

// Áreas editáveis como FRAÇÕES do template (x0,y0,x1,y1)
// Ajuste estes valores até os retângulos cobrirem só os quadros das camisas.
const zonas = [
  { x0: 0.04, y0: 0.245, x1: 0.96, y1: 0.49 },   // quadro POLO
  { x0: 0.04, y0: 0.512, x1: 0.96, y1: 0.78 },   // quadro CAMISETA
];

const rects = zonas.map(z => {
  const x = Math.round(z.x0 * W), y = Math.round(z.y0 * H);
  const w = Math.round((z.x1 - z.x0) * W), h = Math.round((z.y1 - z.y0) * H);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="red" fill-opacity="0.4" stroke="red" stroke-width="8"/>`;
}).join("");

const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;

await sharp(templatePath)
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .png()
  .toFile(path.join(root, "scripts", "preview-mask.png"));

console.log(`Prévia gerada (${W}x${H}). Zonas:`, JSON.stringify(zonas));
