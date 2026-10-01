import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { exigirAcesso, passouDoLimite } from "@/lib/acesso";
import { bufferDaArte, caminhoValido } from "@/lib/artes";

export const dynamic = "force-dynamic";
// A geração de imagem pode passar de 1 minuto.
export const maxDuration = 300;

// A resposta é um fluxo NDJSON (uma linha JSON por evento):
//   { tipo: "final", url, prompt, logomarca, categoria, tempoMs, timestamp, uso }
// Nada é guardado na nuvem: a arte volta para a conversa, no navegador do designer.
//   { tipo: "erro", error }

// ─── ZONAS EDITÁVEIS ───────────────────────────────────────────────────────────
// Os 4 quadros de produto da arte de referência (public/template.png, 900x1600).
// O resto (cabeçalho, bordas douradas, rodapé) é preservado. Cada quadro tem uma
// etiqueta no canto superior esquerdo (POLO PIQUET etc.) que também é preservada:
// tab = [x do topo da diagonal, x da base da diagonal, y da base da etiqueta].
const REF_W = 900, REF_H = 1600;
const ZONAS = [
  { nome: "polo", rotulo: "POLO PIQUET", x0: 23, y0: 255, x1: 880, y1: 717, tab: [248, 215, 302] },
  { nome: "camiseta", rotulo: "CAMISETA", x0: 23, y0: 737, x1: 463, y1: 1058, tab: [218, 188, 782] },
  { nome: "windbanner", rotulo: "WINDBANNER", x0: 483, y0: 737, x1: 880, y1: 1396, tab: [698, 668, 782] },
  { nome: "bag", rotulo: "BAGA PERSONALIZADA", x0: 23, y0: 1079, x1: 463, y1: 1396, tab: [328, 298, 1126] },
];

// ─── ECONOMIA ──────────────────────────────────────────────────────────────────
// A OpenAI cobra pelos pixels gerados e pelas imagens enviadas. Por isso a IA NÃO
// gera a arte inteira: cabeçalho e rodapé vêm prontos da referência. Ela gera só um
// RECORTE — na criação, a área dos 4 quadros; na edição, só os quadros que mudam —
// e o recorte é colado de volta no lugar. As imagens enviadas também vão reduzidas.
type Regiao = { x: number; y: number; w: number; h: number }; // coordenadas 900x1600
const AREA_PRODUTOS: Regiao = { x: 11, y: 240, w: 878, h: 1170 }; // 3:4 → gera 864x1152
// Preços oficiais em US$ por MILHÃO de tokens (platform.openai.com/docs/pricing, out/2026):
// texto enviado, imagem enviada, imagem gerada e texto gerado. Mostra o custo de cada arte.
const PRECOS: Record<string, { texto: number; imagem: number; saida: number; saidaTexto: number }> = {
  "gpt-image-2": { texto: 5, imagem: 8, saida: 30, saidaTexto: 30 },
  "gpt-image-1.5": { texto: 5, imagem: 8, saida: 32, saidaTexto: 10 },
  "gpt-image-1-mini": { texto: 2, imagem: 2.5, saida: 8, saidaTexto: 8 },
};
type Uso = {
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  output_tokens?: number;
  output_tokens_details?: { image_tokens?: number; text_tokens?: number };
};
const custoEmDolar = (modelo: string, u?: Uso) => {
  const p = PRECOS[Object.keys(PRECOS).find((m) => modelo.startsWith(m)) ?? ""];
  if (!u || !p) return undefined;
  const ent = u.input_tokens_details || {};
  const sai = u.output_tokens_details;
  const saida = sai ? (sai.image_tokens || 0) * p.saida + (sai.text_tokens || 0) * p.saidaTexto : (u.output_tokens || 0) * p.saida;
  return ((ent.text_tokens || 0) * p.texto + (ent.image_tokens || 0) * p.imagem + saida) / 1e6;
};
const PIXELS_MIN = 655_360; // menor imagem que o gpt-image-2 aceita
const MARGEM = 10;

/** Recorte a gerar: a área dos produtos, ou só a volta dos quadros pedidos. */
function regiaoDosQuadros(quadros: string[]): Regiao {
  const zs = ZONAS.filter((z) => quadros.includes(z.nome));
  if (!zs.length || zs.length === ZONAS.length) return AREA_PRODUTOS;
  const x0 = Math.max(0, Math.min(...zs.map((z) => z.x0)) - MARGEM);
  const y0 = Math.max(0, Math.min(...zs.map((z) => z.y0)) - MARGEM);
  const x1 = Math.min(REF_W, Math.max(...zs.map((z) => z.x1)) + MARGEM);
  const y1 = Math.min(REF_H, Math.max(...zs.map((z) => z.y1)) + MARGEM);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Tamanho de geração do recorte: mesma proporção, ~1 pixel gerado por pixel da referência. */
function tamanhoDoRecorte(modelo: string, r: Regiao) {
  const prop = Math.min(3, Math.max(1 / 3, r.w / r.h));
  // Os modelos antigos só geram 3 tamanhos fixos (o recorte é esticado e desesticado)
  if (!modelo.startsWith("gpt-image-2")) {
    return prop > 1.2 ? { w: 1536, h: 1024 } : prop < 0.83 ? { w: 1024, h: 1536 } : { w: 1024, h: 1024 };
  }
  if (r === AREA_PRODUTOS) return { w: 864, h: 1152 };
  const px = Math.max(PIXELS_MIN, r.w * r.h);
  const w = Math.ceil(Math.sqrt(px * prop) / 16) * 16;
  let h = Math.ceil(w / prop / 16) * 16;
  while (w * h < PIXELS_MIN) h += 16;
  return { w, h };
}

/** Recorta a região de uma imagem (de qualquer tamanho) e reduz para caber em "max" px. */
async function recortar(img: Buffer, r: Regiao, max: number) {
  const m = await sharp(img).metadata();
  const sx = (m.width ?? REF_W) / REF_W, sy = (m.height ?? REF_H) / REF_H;
  return sharp(img)
    .extract({ left: Math.round(r.x * sx), top: Math.round(r.y * sy), width: Math.round(r.w * sx), height: Math.round(r.h * sy) })
    .resize(max, max, { fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** Reduz uma imagem enviada (logo, anexo) para no máximo "max" px no lado maior. */
const reduzir = (img: Buffer, max: number) =>
  sharp(img).resize(max, max, { fit: "inside", withoutEnlargement: true }).png().toBuffer();

// Pontos do corpo de cada produto (coordenadas da referência 900x1600, longe das logos)
// onde a cor é medida na arte atual antes de uma edição.
const PONTOS_COR: Array<{ produto: string; x: number; y: number }> = [
  { produto: "polo front", x: 200, y: 610 },
  { produto: "polo back", x: 560, y: 640 },
  { produto: "t-shirt front", x: 95, y: 990 },
  { produto: "t-shirt back", x: 300, y: 1005 },
  { produto: "windbanner", x: 700, y: 880 },
  { produto: "bag", x: 215, y: 1205 },
];

/** Cor de cada produto na arte atual (mediana de um quadradinho em cada ponto). */
async function medirCores(arte: Buffer): Promise<string> {
  const { data } = await sharp(arte).resize(REF_W, REF_H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return PONTOS_COR.map(({ produto, x, y }) => {
    const canais: number[][] = [[], [], []];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const i = ((y + dy) * REF_W + (x + dx)) * 3;
      for (let k = 0; k < 3; k++) canais[k].push(data[i + k]);
    }
    const med = canais.map((v) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)]);
    return `${produto} #${med.map(hex).join("").toUpperCase()}`;
  }).join(", ");
}

/**
 * Formato EXATO das etiquetas (POLO PIQUET etc.), lido pixel a pixel da arte de
 * referência: em cada linha da etiqueta, vai da borda esquerda até o último pixel
 * azul-marinho. Assim a diagonal e o canto arredondado de baixo saem perfeitos, sem
 * sobrar nenhum pedaço do fundo antigo em volta. Resultado: RGBA 900x1600, alfa 255
 * dentro das etiquetas. Calculado uma vez por servidor.
 */
let etiquetasCache: Promise<Buffer> | null = null;
function formatoDasEtiquetas(): Promise<Buffer> {
  etiquetasCache ??= (async () => {
    const ref = await sharp(path.join(process.cwd(), "public", "template.png"))
      .resize(REF_W, REF_H, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const azulMarinho = (x: number, y: number) => {
      const i = (y * REF_W + x) * 3;
      const r = ref[i], g = ref[i + 1], b = ref[i + 2];
      return r < 70 && g < 80 && b < 150 && b > r + 15;
    };
    const rgba = Buffer.alloc(REF_W * REF_H * 4);
    for (const z of ZONAS) {
      const [xTopo, xBase, yBase] = z.tab;
      for (let y = z.y0 - 2; y <= yBase + 4; y++) {
        // Só procura até a diagonal esperada (+ folga): o que for azul além dela é
        // produto (ex: a gola da polo), não etiqueta.
        const t = Math.min(1, Math.max(0, (y - z.y0) / (yBase - z.y0)));
        const limite = Math.round(xTopo + (xBase - xTopo) * t) + 5;
        let fim = -1;
        for (let x = z.x0; x <= limite; x++) if (azulMarinho(x, y)) fim = x;
        if (fim < z.x0 + 20) continue; // linha sem etiqueta (abaixo dela)
        for (let x = z.x0 - 3; x <= fim; x++) rgba[(y * REF_W + x) * 4 + 3] = 255;
      }
    }
    return sharp(rgba, { raw: { width: REF_W, height: REF_H, channels: 4 } }).png().toBuffer();
  })();
  return etiquetasCache;
}

/** Máscara KEEP (branco = quadros de produto, menos as etiquetas) no tamanho da base. */
async function mascaraDosQuadros(tW: number, tH: number, quadros: string[] = ZONAS.map((z) => z.nome)) {
  const sx = tW / REF_W, sy = tH / REF_H;
  const rad = Math.round(12 * sx); // cantos arredondados iguais aos dos quadros
  const keepRects = ZONAS
    .filter((z) => quadros.includes(z.nome))
    .map((z) => {
      const x = Math.round(z.x0 * sx), y = Math.round(z.y0 * sy);
      const w = Math.round((z.x1 - z.x0) * sx), h = Math.round((z.y1 - z.y0) * sy);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ry="${rad}" fill="white"/>`;
    })
    .join("");
  const svg = Buffer.from(`<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`);
  // Etiquetas no tamanho da base, com a borda levemente suavizada (sem serrilhado)
  const etiquetas = await sharp(await formatoDasEtiquetas())
    .resize(tW, tH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .blur(0.6)
    .png()
    .toBuffer();
  // dest-out recorta as etiquetas de dentro dos quadros
  return sharp(svg).composite([{ input: etiquetas, blend: "dest-out" }]).png().toBuffer();
}

export async function POST(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  if (passouDoLimite(request)) {
    return Response.json({ error: "Limite de gerações por hora atingido. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inicio = Date.now();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const regras = (formData.get("regras") as string) || "";
  const promptUser = (formData.get("prompt") as string) || "";
  const usarMascara = (formData.get("usarMascara") as string) !== "false";
  // "low" (padrão, bem mais barata) ou "medium" — escolhida na caixa de mensagem
  const qualidade: "low" | "medium" = (formData.get("qualidade") as string) === "medium" ? "medium" : "low";
  const imagens = formData.getAll("imagens") as File[];
  // Edição: a arte-base vem como data URL (baseImage) ou, se for uma arte antiga da nuvem, pelo caminho (basePath).
  const basePath = (formData.get("basePath") as string) || "";
  const baseImage = formData.get("baseImage") as string | null;
  const logomarcaBase = ((formData.get("logomarcaBase") as string) || "").slice(0, 60);
  // Edição: regras de edição (Configurações), quadros que podem mudar e logos originais
  const regrasEdicao = (formData.get("regrasEdicao") as string) || "";
  const quadrosPedidos = ((formData.get("quadros") as string) || "").split(",").filter((q) => ZONAS.some((z) => z.nome === q));
  // Logos originais do cliente (guardados na conversa), reenviados em toda edição
  const logosEnviados = (formData.getAll("logosOriginais") as File[]).filter((f) => f && typeof f === "object" && f.size > 0).slice(0, 4);

  if (!promptUser.trim()) {
    return Response.json({ error: "Escreva o prompt da arte que deseja gerar." }, { status: 400 });
  }

  // Criação: a IA recebe o recorte da arte de referência (molde do layout).
  // Edição: recebe só o recorte da ARTE ATUAL com os quadros que mudam; o resto da arte
  // é recolado pixel a pixel, então os produtos não "crescem" a cada edição.
  let arteAtual: Buffer | null = null;
  if (baseImage?.startsWith("data:")) arteAtual = Buffer.from(baseImage.split(",")[1], "base64");
  else if (basePath && caminhoValido(basePath)) {
    arteAtual = await bufferDaArte(basePath).catch(() => null);
    // Nunca transformar uma edição em arte nova sem avisar (era o que "alucinava")
    if (!arteAtual) {
      return Response.json({
        error: "Não consegui abrir a arte para editar (o armazenamento do histórico está indisponível). Baixe a arte e anexe-a na mensagem para editar.",
      }, { status: 503 });
    }
  }
  const editando = !!arteAtual;
  const templatePath = path.join(process.cwd(), "public", "template.png");
  if (!fs.existsSync(templatePath)) {
    return Response.json({ error: "Template não encontrado. Salve o arquivo template.png na pasta public." }, { status: 500 });
  }
  const base = fs.readFileSync(templatePath);

  // ─── PROMPT (em inglês: menos tokens = menos custo) ─────────────────────────
  // As regras (Configurações) dizem O QUE fazer; aqui vão só as informações desta
  // geração: o papel de cada imagem, o recorte, as cores medidas e os anexos numerados.
  const quadrosDaRegiao = (editando && quadrosPedidos.length ? quadrosPedidos : ZONAS.map((z) => z.nome));
  const regiao = regiaoDosQuadros(quadrosDaRegiao);
  const quadros = quadrosDaRegiao; // na edição, só estes quadros mudam; os outros vêm da arte atual pixel a pixel
  const nomesQuadros = ZONAS.filter((z) => quadros.includes(z.nome)).map((z) => z.rotulo).join(", ");
  const logosOriginais = editando ? await Promise.all(logosEnviados.map(async (f) => Buffer.from(await f.arrayBuffer()))) : [];
  const cores = arteAtual ? await medirCores(arteAtual).catch(() => "") : "";

  // Anexos numerados como o designer vê na tela ("anexo 1: peito esquerdo")
  const qtdAnexos = imagens.filter((f) => f && typeof f === "object" && "size" in f && f.size > 0).length;
  const numerosAnexos = ((formData.get("numerosAnexos") as string) || "").split(",").map(Number);
  const numeroDoAnexo = (i: number) => (Number.isInteger(numerosAnexos[i]) && numerosAnexos[i] > 0 ? numerosAnexos[i] : i + 1);
  // Ordem das imagens: 1 = referência (criação) OU arte atual (edição); depois logos
  // originais (edição) e anexos. Na edição a referência NÃO vai: o recorte da arte atual
  // já tem o mesmo layout, e com a referência junto a IA chegava a copiar o "LOGO AQUI".
  const primeiraLogo = 2;
  const primeiroAnexo = primeiraLogo + logosOriginais.length;
  const faixa = (de: number, qtd: number) => (qtd > 1 ? `Images ${de}-${de + qtd - 1}` : `Image ${de}`);
  // "ANEXO 1" vira "the logo from image 4": com a palavra no prompt, a IA chegava a
  // ESCREVER "ANEXO 1" na camisa em vez de aplicar a imagem.
  const imagemDoNumero = new Map(Array.from({ length: qtdAnexos }, (_, i) => [numeroDoAnexo(i), primeiroAnexo + i]));
  const pedido = promptUser.trim().replace(/\banexos?\s*(\d+)\b/gi, (txt, n) =>
    imagemDoNumero.has(Number(n)) ? `the logo from image ${imagemDoNumero.get(Number(n))}` : txt);

  const linhas: string[] = [
    (editando ? regrasEdicao : regras).trim(),
    "",
    editando ? "REQUEST (change ONLY this):" : "THIS ART:",
    pedido,
    "",
    "IMAGES:",
    editando
      ? "- Image 1: crop of the CURRENT ART (the art the designer clicked Edit on, NOT the Rogga template) = the base. Keep it identical (layout, product positions and sizes, colors, logos, texts, backgrounds) except for the request."
      : "- Image 1: crop of the Rogga template (layout to keep).",
  ];
  if (editando) {
    if (logosOriginais.length) linhas.push(`- ${faixa(primeiraLogo, logosOriginais.length)}: ORIGINAL client logo files. Copy the logo exactly from them.`);
  }
  if (qtdAnexos) {
    linhas.push(`- ${faixa(primeiroAnexo, qtdAnexos)}: designer's attachments (logos or artwork). When the request names an image, print exactly that image (no redrawing) ONLY on the stated product and spot — once, not mirrored to other spots. Never write the words "image" or "anexo" on the products. What the request does not mention (back logo, other products, background) stays ${editando ? "identical to the current art" : "as the rules say"}.`);
    linhas.push(`  Shirt sides are from the WEARER's view: "left chest/sleeve" appears on the viewer's RIGHT in the front view; "right chest/sleeve" on the viewer's LEFT.`);
  }
  if (editando) {
    if (cores) linhas.push(`- Measured colors of the current art (keep unless the request changes them): ${cores}.`);
    linhas.push(`- Panels allowed to change: ${nomesQuadros}. Nothing else changes.`);
  }
  linhas.push(
    "",
    `CROP: the images show only ${regiao === AREA_PRODUTOS ? "the four product panels" : `the panel(s) ${nomesQuadros}`} of the proposal; header and footer are added later. Output exactly this framing: same borders, panels and labels in the same places. No header, title or footer.`,
    `Each product fully inside its panel with margin, same position and size as image 1: no cropping, no zoom, no overlap. The text "LOGO AQUI" is only a placeholder and never appears${editando ? "; logos in the current art stay" : ""}.`,
  );
  const editPrompt = linhas.join("\n").trim();

  // Camada de baixo da composição: na criação, a referência; na edição, a ARTE ATUAL
  // no tamanho original — assim os quadros que não mudam saem idênticos, pixel a pixel.
  const camadaBase = arteAtual ?? base;
  const meta = await sharp(camadaBase).metadata();
  const tW = meta.width ?? 900;
  const tH = meta.height ?? 1600;
  const keepPng = usarMascara || editando ? await mascaraDosQuadros(tW, tH, quadros) : null;

  // Recola SÓ os quadros de produto da arte gerada sobre a base. Assim cabeçalho,
  // etiquetas, bordas e rodapé ficam pixel-perfeito iguais ao original.
  const compor = async (gerado: Buffer, saida: { w: number; h: number; q: number }) => {
    const sx = tW / REF_W, sy = tH / REF_H;
    const left = Math.round(regiao.x * sx), top = Math.round(regiao.y * sy);
    const recorte = await sharp(gerado)
      .resize(Math.min(tW - left, Math.round(regiao.w * sx)), Math.min(tH - top, Math.round(regiao.h * sy)), { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png().toBuffer();
    const cheio = await sharp(camadaBase).composite([{ input: recorte, left, top }]).png().toBuffer();
    let composto = cheio;
    if (keepPng) {
      const overlay = await sharp(cheio).ensureAlpha().composite([{ input: keepPng, blend: "dest-in" }]).png().toBuffer();
      composto = await sharp(camadaBase).composite([{ input: overlay }]).png().toBuffer();
    }
    return sharp(composto)
      .resize(saida.w, saida.h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: saida.q, mozjpeg: true })
      .toBuffer();
  };

  const MODELO = process.env.IMAGE_MODEL || "gpt-image-2";

  // ─── IMAGENS DO USUÁRIO ─────────────────────────────────────────────────────
  const anexos: Array<{ buffer: Buffer; type: string }> = [];
  for (const f of imagens) {
    if (f && typeof f === "object" && "size" in f && f.size > 0) {
      anexos.push({ buffer: Buffer.from(await f.arrayBuffer()), type: f.type || "image/png" });
    }
  }

  // Detectar nome da marca e categoria/ramo pelo primeiro logo (roda em paralelo
  // com a geração da imagem, para não somar tempo).
  // Na edição, o nome vem da arte editada; se ela veio anexada (sem nome conhecido),
  // o nome é lido na própria proposta — não no primeiro anexo, que pode ser outro logo.
  const analisarLogo = async () => {
    const r = { logomarca: "Logomarca", categoria: "Outros" };
    const lerDaProposta = editando && !logomarcaBase && !!arteAtual;
    if (editando && !lerDaProposta) return r;
    if (!lerDaProposta && !anexos.length) return r;
    const imagem = lerDaProposta
      ? `data:image/jpeg;base64,${(await sharp(arteAtual!).resize(540, 960).jpeg({ quality: 80 }).toBuffer()).toString("base64")}`
      : `data:${anexos[0].type};base64,${anexos[0].buffer.toString("base64")}`;
    const pergunta = lerDaProposta
      ? "Esta é uma proposta de uniformes. Olhe a logomarca aplicada nos uniformes (não o cabeçalho \"ROGGA Uniformes\")."
      : "Analise este logotipo.";
    try {
      const vision = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imagem } },
            { type: "text", text: pergunta + ' Responda APENAS com um JSON no formato {"nome":"...","categoria":"..."}. "nome" = nome da marca/empresa (se ilegível, use "Cliente"). "categoria" = ramo/segmento em 1-2 palavras em português (ex: Climatização, Construção, Restaurante, Oficina, Clínica, Academia, Transporte, Tecnologia, Comércio). Nada além do JSON.' },
          ],
        }],
        max_tokens: 60,
      });
      const txt = vision.choices[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      if (parsed.nome) r.logomarca = String(parsed.nome).replace(/^["']|["']$/g, "").slice(0, 60);
      if (parsed.categoria) r.categoria = String(parsed.categoria).slice(0, 40);
    } catch {
      // se falhar, mantém os padrões
    }
    return r;
  };

  // ─── GERAÇÃO ────────────────────────────────────────────────────────────────
  // Sem prévias (partial_images): cada prévia também era cobrada.
  const gerarImagem = async (modelo: string) => {
    const { w, h } = tamanhoDoRecorte(modelo, regiao);
    // Ordem: 1ª recorte da referência (criação) ou da arte atual (edição), depois logos
    // originais e anexos.
    // Custo: a OpenAI reduz cada imagem para no máx. 512px no lado maior e cobra 1 token
    // a cada 16x16 px (512x512 = 1.024 tokens; 384x384 = 576). Por isso a referência e
    // os logos vão em 384px; a arte atual vai em 512 (é a base da edição).
    const [primeira, logosRed, anexosRed] = await Promise.all([
      arteAtual ? recortar(arteAtual, regiao, 512) : recortar(base, regiao, 384),
      Promise.all(logosOriginais.map((b) => reduzir(b, 384))),
      Promise.all(anexos.map((a) => reduzir(a.buffer, 384))),
    ]);
    const files = await Promise.all([
      toFile(primeira, arteAtual ? "arte-atual.jpg" : "referencia.jpg", { type: "image/jpeg" }),
      ...logosRed.map((b, i) => toFile(b, `logo-original-${i + 1}.png`, { type: "image/png" })),
      ...anexosRed.map((b, i) => toFile(b, `anexo-${numeroDoAnexo(i)}.png`, { type: "image/png" })),
    ].slice(0, 16));
    const r = await openai.images.edit({
      model: modelo,
      image: files.length === 1 ? files[0] : files,
      prompt: editPrompt,
      n: 1,
      size: `${w}x${h}`,
      quality: qualidade,
      // Só o gpt-image-1/1.5 aceitam este parâmetro (o 2 já trabalha em alta fidelidade e
      // o 1-mini o recusa). No 1.5 ele multiplica os tokens das imagens enviadas (~10 mil).
      ...(/^gpt-image-1(\.5)?($|-\d{4})/.test(modelo) ? { input_fidelity: "high" } : {}),
      output_format: "jpeg",
      output_compression: 95,
    } as OpenAI.Images.ImageEditParamsNonStreaming);
    const b64 = r.data?.[0]?.b64_json;
    if (!b64) throw new Error("Falha ao gerar imagem.");
    console.log(`[gerar] ${modelo} ${w}x${h} uso:`, JSON.stringify(r.usage ?? {}));
    return { buffer: Buffer.from(b64, "base64"), uso: r.usage, tamanho: `${w}x${h}`, modelo, custoUsd: custoEmDolar(modelo, r.usage as Uso) };
  };

  // Se o modelo principal não estiver disponível (400/403/404), tenta o gpt-image-1.5
  const gerarComFallback = async () => {
    try {
      return await gerarImagem(MODELO);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (MODELO === "gpt-image-1.5" || !(status === 400 || status === 403 || status === 404)) throw e;
      console.warn(`[gerar] ${MODELO} falhou (${status}):`, (e as Error).message);
      return gerarImagem("gpt-image-1.5");
    }
  };

  const enc = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enviar = (obj: object) => ctrl.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const [gerada, analise] = await Promise.all([gerarComFallback(), analisarLogo()]);
        const imageBuffer = gerada.buffer;

        // Redimensiona para 1080x1920 (9:16). JPEG de alta qualidade para caber no
        // limite de ~4,5 MB por resposta da Vercel (um PNG passaria disso).
        const finalImg = await compor(imageBuffer, { w: 1080, h: 1920, q: 94 });
        const logomarca = editando ? (logomarcaBase || analise.logomarca) : anexos.length ? analise.logomarca : (logomarcaBase || analise.logomarca);
        const timestamp = Date.now();


        enviar({
          tipo: "final",
          url: `data:image/jpeg;base64,${finalImg.toString("base64")}`,
          prompt: editPrompt,
          logomarca,
          categoria: analise.categoria,
          tempoMs: Date.now() - inicio,
          timestamp,
          uso: gerada.uso ? { ...gerada.uso, tamanho: gerada.tamanho, modelo: gerada.modelo } : undefined,
          custoUsd: gerada.custoUsd,
        });
      } catch (err: unknown) {
        enviar({ tipo: "erro", error: err instanceof Error ? err.message : "Erro desconhecido." });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(corpo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
