import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const img = path.join(__dirname, "test-result.png");
const meta = await sharp(img).metadata();
const W = meta.width, H = meta.height;

const crop = async (name, x0, y0, x1, y1) => {
  await sharp(img)
    .extract({
      left: Math.round(x0 * W), top: Math.round(y0 * H),
      width: Math.round((x1 - x0) * W), height: Math.round((y1 - y0) * H),
    })
    .png()
    .toFile(path.join(__dirname, name));
};

// Polo FRENTE (cima-esquerda) — botões, carcela, gola
await crop("crop-polo-frente.png", 0.04, 0.245, 0.52, 0.49);
// Seção de baixo inteira — tipo de camisa e ordem frente/verso
await crop("crop-baixo.png", 0.04, 0.5, 0.96, 0.81);
console.log("Crops gerados.");
