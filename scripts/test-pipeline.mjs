import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const key = env.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
const openai = new OpenAI({ apiKey: key });

const regras = fs.readFileSync(path.join(__dirname, "regras.txt"), "utf8");
const promptArte = "Faça a arte de uniformes da empresa 'MW Instalações e Manutenções' (ramo de climatização / ar-condicionado / refrigeração). Combinação automática de cores alternando a polo e a camiseta. Aplique a logomarca enviada no peito esquerdo (frente) e centralizada nas costas (verso) das duas peças. Coloque uma estampa abstrata refinada na parte de baixo da camiseta. Vendedor: Manassés.";
const notaFresca = `
IMPORTANTE — PREENCHIMENTO DOS 2 RETÂNGULOS CENTRAIS:
- Recrie do ZERO o conteúdo dos 2 retângulos centrais: novas camisas (polo frente/costas e camiseta frente/costas), novas estampas, os logos aplicados e uma nova imagem de fundo de contexto.
- Cada retângulo deve ser preenchido COMPLETAMENTE, de borda a borda, SEM nenhuma área branca ou vazia: a imagem de fundo de contexto cobre 100% do retângulo (incluindo cantos e a parte de baixo) e as camisas ficam em primeiro plano, nítidas — exatamente como no modelo padrão.
- Não reaproveite as camisas que já estão no template; desenhe camisas e cenário novos para esta arte.`;
const editPrompt = regras + "\n\nINSTRUÇÕES DESTA ARTE:\n" + promptArte + "\n" + notaFresca;

// 1) Template (base que a IA edita) + moldura vazia (base da recolagem)
const rawTemplate = fs.readFileSync(path.join(root, "public", "template.png"));
const molduraVazia = fs.readFileSync(path.join(root, "public", "moldura.png"));
const meta = await sharp(rawTemplate).metadata();
const tW = meta.width, tH = meta.height;
const pH = tH, pW = Math.round((tH * 2) / 3);
const padLeft = Math.round((pW - tW) / 2), padRight = pW - tW - padLeft;
const paddedTemplate = await sharp(rawTemplate)
  .extend({ left: padLeft, right: padRight, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0 } })
  .png().toBuffer();

// 2) Logo
const logoBuf = fs.readFileSync(path.join(root, "..", "..", "Desktop", "MW INSTALAÇÕES.PNG.jpeg"));

const imageFiles = [
  await toFile(paddedTemplate, "template.png", { type: "image/png" }),
  await toFile(logoBuf, "logo.jpg", { type: "image/jpeg" }),
];

// 3) Edição limpa
console.log("Gerando (sem máscara)...");
const t0 = Date.now();
const res = await openai.images.edit({
  model: "gpt-image-1", image: imageFiles, prompt: editPrompt,
  n: 1, size: "1024x1536", quality: "high", input_fidelity: "high",
});
console.log(`Pronto em ${Math.round((Date.now() - t0) / 1000)}s`);
const imageBuffer = Buffer.from(res.data[0].b64_json, "base64");

// 4) Moldura -> 9:16
const geradoFull = await sharp(imageBuffer)
  .resize(pW, pH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .extract({ left: padLeft, top: 0, width: tW, height: tH })
  .png().toBuffer();

// 5) Recolagem dest-in das camisas
const zonas = [
  { x0: 0.035, y0: 0.205, x1: 0.965, y1: 0.438 },
  { x0: 0.035, y0: 0.475, x1: 0.965, y1: 0.730 },
];
const rad = Math.round(0.028 * tW);
const keepRects = zonas.map((z) => {
  const x = Math.round(z.x0 * tW), y = Math.round(z.y0 * tH);
  const w = Math.round((z.x1 - z.x0) * tW), h = Math.round((z.y1 - z.y0) * tH);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ry="${rad}" fill="white"/>`;
}).join("");
const keepPng = await sharp(Buffer.from(`<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`)).png().toBuffer();
const overlay = await sharp(geradoFull).ensureAlpha().composite([{ input: keepPng, blend: "dest-in" }]).png().toBuffer();
const composto = await sharp(rawTemplate).composite([{ input: overlay }]).toBuffer();

// 6) 1080x1920
await sharp(composto).resize(1080, 1920, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toFile(path.join(__dirname, "result-pipeline.png"));
console.log("Salvo result-pipeline.png");
