import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const regras = fs.readFileSync(path.join(__dirname, "regras.txt"), "utf8");
const promptArte = "Faça a arte de uniformes da empresa 'MW Instalações e Manutenções' (ramo de climatização / ar-condicionado / refrigeração). Combinação automática de cores alternando a polo e a camiseta. Aplique a logomarca enviada no peito esquerdo (frente) e centralizada nas costas (verso) das duas peças. Coloque uma estampa abstrata refinada na parte de baixo da camiseta. Vendedor: Manassés.";

const logoBuf = fs.readFileSync(path.join(root, "..", "..", "Desktop", "MW INSTALAÇÕES.PNG.jpeg"));

const form = new FormData();
form.append("regras", regras);
form.append("prompt", promptArte);
form.append("usarMascara", "true");
form.append("imagens", new Blob([logoBuf], { type: "image/jpeg" }), "mw.jpg");

console.log("Chamando /api/gerar com o logo da MW...");
const t0 = Date.now();
const res = await fetch("http://localhost:3000/api/gerar", { method: "POST", body: form });
const data = await res.json();
console.log(`Resposta em ${Math.round((Date.now() - t0) / 1000)}s. HTTP ${res.status}`);
if (data.error) { console.error("ERRO:", data.error); process.exit(1); }
console.log("Logomarca detectada:", JSON.stringify(data.logomarca));

const b64 = data.url.replace(/^data:image\/png;base64,/, "");
fs.writeFileSync(path.join(__dirname, "result-mw.png"), Buffer.from(b64, "base64"));
const m = await sharp(path.join(__dirname, "result-mw.png")).metadata();
console.log(`Salvo result-mw.png. Dimensões: ${m.width}x${m.height} (${(m.width / m.height).toFixed(4)})`);
