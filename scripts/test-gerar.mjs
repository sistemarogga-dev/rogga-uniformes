import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// 1) Cria um logo fictício (autopeças TURBOMAX) — azul + laranja
const logoSvg = `<svg width="700" height="700" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="700" fill="white"/>
  <circle cx="350" cy="270" r="170" fill="#0B5FA5"/>
  <circle cx="350" cy="270" r="170" fill="none" stroke="#F2750A" stroke-width="16"/>
  <path d="M260 270 L350 180 L440 270 L400 270 L400 360 L300 360 L300 270 Z" fill="#F2750A"/>
  <text x="350" y="510" font-family="Arial, sans-serif" font-size="92" font-weight="bold" fill="#0B5FA5" text-anchor="middle">TURBOMAX</text>
  <text x="350" y="585" font-family="Arial, sans-serif" font-size="46" fill="#F2750A" text-anchor="middle" letter-spacing="8">AUTO CENTER</text>
</svg>`;

const logoBuffer = await sharp(Buffer.from(logoSvg)).png().toBuffer();
fs.writeFileSync(path.join(__dirname, "logo-ficticio.png"), logoBuffer);
console.log("Logo fictício criado.");

// 2) Regras rígidas (mesmas do app)
const regras = `REGRAS RÍGIDAS:
Analise calmamente a imagem modelo (template) = Proposta Uniformes Padrão.png usada como base e também analise as regras rígidas numeradas abaixo. Utilize o modelo como padrão para fazer todas as artes de uniformes. Nunca, em hipótese alguma, descumpra alguma regra rígida.

1- Toda imagem tem que ser no tamanho 9:16 (story).
2- Sempre que eu te mandar logomarcas, você deve colocá-las no peito e nas costas, substituindo o mesmo lugar do quadro e do círculo vermelho escrito "logo".
3- Combinação automática de cores: escolha as cores das camisas se baseando no logotipo do cliente, levando em conta o ramo profissional da empresa e sua identidade visual.
4- Se eu mandar o prompt de "combinação detalhada de cores", você deve cancelar a "combinação automática de cores".
5- Tanto a parte interna quanto a parte externa da carcela da camisa polo devem ser na mesma cor do tronco da camisa polo.
6- A camisa polo deve ter apenas 2 botões.
7- Não faça golas com detalhes como listras e estampas.
8- Preserve todos os detalhes do background da imagem e só faça edições nas camisas.
9- Adicione, nos quadros da polo e da camiseta, um fundo contextual cinematográfico atrás das camisas, ligado ao ramo do cliente. Use profundidade, luz dramática, brilho e cores em contraste com a cor do tronco, mantendo camisas e logos nítidos em primeiro plano.
10- IMPORTANTE: Não mude mais nada do layout desse mockup. Toda edição solicitada deverá ser feita somente nas camisas ou no quadro de fundo das camisas.`;

const prompt = "Combinação automática de cores baseada no logo enviado. Coloque o logo no peito esquerdo (frente) e centralizado nas costas (verso) das duas camisas.";

// 3) Monta o formulário e chama a API
const form = new FormData();
form.append("regras", regras);
form.append("prompt", prompt);
form.append("usarMascara", "true");
form.append("imagens", new Blob([logoBuffer], { type: "image/png" }), "logo-ficticio.png");

console.log("Chamando /api/gerar ... (pode levar até ~60s)");
const t0 = Date.now();
const res = await fetch("http://localhost:3000/api/gerar", { method: "POST", body: form });
const data = await res.json();
console.log(`Resposta em ${Math.round((Date.now() - t0) / 1000)}s. HTTP ${res.status}`);

if (data.error) {
  console.error("ERRO:", data.error);
  process.exit(1);
}

console.log("Logomarca detectada:", JSON.stringify(data.logomarca));

const base64 = data.url.replace(/^data:image\/png;base64,/, "");
fs.writeFileSync(path.join(__dirname, "test-result.png"), Buffer.from(base64, "base64"));
console.log("Imagem salva em scripts/test-result.png");
