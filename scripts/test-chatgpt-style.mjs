import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Lê a chave do .env.local
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const key = env.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
const openai = new OpenAI({ apiKey: key });

const regras = fs.readFileSync(path.join(__dirname, "regras.txt"), "utf8");
const promptArte = "Faça a arte de uniformes da empresa 'MW Instalações e Manutenções' (ramo de climatização / ar-condicionado / refrigeração). Combinação automática de cores alternando a polo e a camiseta. Aplique a logomarca enviada no peito esquerdo (frente) e centralizada nas costas (verso) das duas peças. Coloque uma estampa abstrata refinada na parte de baixo da camiseta. Vendedor: Manassés.";
const prompt = regras + "\n\nINSTRUÇÕES DESTA ARTE:\n" + promptArte;

const templateBuf = fs.readFileSync(path.join(root, "public", "template.png"));
const logoBuf = fs.readFileSync(path.join(root, "..", "..", "Desktop", "MW INSTALAÇÕES.PNG.jpeg"));

const templateFile = await toFile(templateBuf, "template.png", { type: "image/png" });
const logoFile = await toFile(logoBuf, "logo.jpg", { type: "image/jpeg" });

console.log("Chamando edição estilo ChatGPT (sem máscara, sem moldura)...");
const t0 = Date.now();
const res = await openai.images.edit({
  model: "gpt-image-1",
  image: [templateFile, logoFile],
  prompt,
  n: 1,
  size: "auto",
  quality: "high",
  input_fidelity: "high",
});
console.log(`Pronto em ${Math.round((Date.now() - t0) / 1000)}s`);

const b64 = res.data[0].b64_json;
fs.writeFileSync(path.join(__dirname, "result-chatgpt-style.png"), Buffer.from(b64, "base64"));

// dimensões
import sharp from "sharp";
const m = await sharp(path.join(__dirname, "result-chatgpt-style.png")).metadata();
console.log(`Salvo. Dimensões: ${m.width}x${m.height} (proporção ${(m.width / m.height).toFixed(4)})`);
