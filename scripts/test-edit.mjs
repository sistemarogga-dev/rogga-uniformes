import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const openai = new OpenAI({ apiKey: env.match(/OPENAI_API_KEY=(.+)/)[1].trim() });

const regras = fs.readFileSync(path.join(__dirname, "regras.txt"), "utf8");
// MODO EDIÇÃO: base = arte já gerada (result-pipeline.png), sem nota "do zero"
const rawTemplate = fs.readFileSync(path.join(__dirname, "result-pipeline.png"));
const editPrompt = regras + "\n\nINSTRUÇÕES DESTA ARTE:\nDeixe a camisa polo na cor vermelha, mantendo todo o resto igual.";

const meta = await sharp(rawTemplate).metadata();
const tW = meta.width, tH = meta.height;
const pH = tH, pW = Math.round((tH * 2) / 3);
const padLeft = Math.round((pW - tW) / 2), padRight = pW - tW - padLeft;
const padded = await sharp(rawTemplate).extend({ left: padLeft, right: padRight, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0 } }).png().toBuffer();

console.log("Editando (base = arte existente)...");
const t0 = Date.now();
const res = await openai.images.edit({
  model: "gpt-image-1", image: [await toFile(padded, "base.png", { type: "image/png" })],
  prompt: editPrompt, n: 1, size: "1024x1536", quality: "high", input_fidelity: "high",
});
console.log(`Pronto em ${Math.round((Date.now() - t0) / 1000)}s`);
const imageBuffer = Buffer.from(res.data[0].b64_json, "base64");

const geradoFull = await sharp(imageBuffer).resize(pW, pH, { fit: "fill", kernel: sharp.kernel.lanczos3 }).extract({ left: padLeft, top: 0, width: tW, height: tH }).png().toBuffer();
const zonas = [{ x0: 0.04, y0: 0.245, x1: 0.96, y1: 0.49 }, { x0: 0.04, y0: 0.512, x1: 0.96, y1: 0.78 }];
const keepRects = zonas.map((z) => `<rect x="${Math.round(z.x0 * tW)}" y="${Math.round(z.y0 * tH)}" width="${Math.round((z.x1 - z.x0) * tW)}" height="${Math.round((z.y1 - z.y0) * tH)}" fill="white"/>`).join("");
const keepPng = await sharp(Buffer.from(`<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`)).png().toBuffer();
const overlay = await sharp(geradoFull).ensureAlpha().composite([{ input: keepPng, blend: "dest-in" }]).png().toBuffer();
const composto = await sharp(rawTemplate).composite([{ input: overlay }]).toBuffer();
await sharp(composto).resize(1080, 1920, { fit: "fill" }).png().toFile(path.join(__dirname, "result-edit.png"));
console.log("Salvo result-edit.png");
