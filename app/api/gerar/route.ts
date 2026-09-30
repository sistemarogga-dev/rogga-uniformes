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
  { produto: "polo (frente)", x: 200, y: 610 },
  { produto: "polo (costas)", x: 560, y: 640 },
  { produto: "camiseta (frente)", x: 95, y: 990 },
  { produto: "camiseta (costas)", x: 300, y: 1005 },
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

  // A BASE é sempre a arte de referência limpa: ela é o molde do layout e das posições
  // e tamanhos dos produtos. Na edição, a arte atual vai como SEGUNDA imagem (só para
  // copiar cores, logos, textos e fundos). Antes a arte atual era a base, e a cada
  // edição a IA "aproximava" um pouco os produtos — eles cresciam, encostavam nas
  // bordas dos quadros e começavam a se sobrepor.
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

  const quadrosDaRegiao = (editando && quadrosPedidos.length ? quadrosPedidos : ZONAS.map((z) => z.nome));
  const regiao = regiaoDosQuadros(quadrosDaRegiao);
  const nomesRecorte = ZONAS.filter((z) => quadrosDaRegiao.includes(z.nome)).map((z) => z.rotulo).join(", ");
  const notaRecorte = `
IMPORTANTE — RECORTE: as imagens da arte (referência${editando ? " e arte atual" : ""}) mostram SÓ um recorte da proposta: ${regiao === AREA_PRODUTOS ? "a área dos quatro quadros de produto" : `o(s) quadro(s) ${nomesRecorte}`}, sem o cabeçalho e o rodapé (eles são aplicados depois, automaticamente). Gere a imagem exatamente com este mesmo enquadramento do recorte — mesmas bordas, quadros e etiquetas nas mesmas posições. Não acrescente cabeçalho, título nem rodapé.`;
  const regraEnquadramento = `- Cada produto fica INTEIRO dentro do seu quadro, com folga das bordas, exatamente na posição e no tamanho da arte de referência: nada cortado pelas bordas dos quadros, sem aproximar (zoom) e sem um produto sobrepor o outro.`;

  // Edição: só os quadros pedidos mudam; os outros vêm da arte atual pixel a pixel
  const quadros = quadrosDaRegiao;
  const logosOriginais = editando ? await Promise.all(logosEnviados.map(async (f) => Buffer.from(await f.arrayBuffer()))) : [];
  const cores = arteAtual ? await medirCores(arteAtual).catch(() => "") : "";

  // Informações automáticas da edição (mudam a cada arte, por isso não ficam nas Configurações)
  const notaFresca = editando
    ? `
INFORMAÇÕES DESTA EDIÇÃO (automáticas):
- 1ª imagem: recorte da arte de referência da Rogga — serve SÓ como molde de posições, tamanhos e enquadramentos dos produtos. NÃO copie dela cores, logos, textos nem fundos.
- 2ª imagem: o mesmo recorte da ARTE ATUAL deste cliente — é dela que vêm as cores, as logos, os textos e os FUNDOS (imagens de contexto) de cada quadro. Mantenha tudo idêntico a ela, inclusive o fundo, a menos que o pedido mande trocar.${logosOriginais.length ? ` Imagens 3 em diante: os arquivos ORIGINAIS da logomarca do cliente — copie a logo exatamente destes arquivos, sem redesenhar, simplificar ou trocar nada.` : ""}
${cores ? `- Cores medidas na arte atual (mantenha exatamente, a menos que o pedido mude a cor): ${cores}.\n` : ""}- Quadros que podem mudar nesta edição: ${ZONAS.filter((z) => quadros.includes(z.nome)).map((z) => z.rotulo).join(", ")}. Nos demais quadros não mude nada.
${regraEnquadramento}`
    : `
${regraEnquadramento}`;
  const notaNova = editando ? "" : `
GEOMETRIA OBRIGATÓRIA (NÃO DESLOCAR NADA):
- A primeira imagem é o recorte da ARTE DE REFERÊNCIA da Rogga. O resultado deve ser IDÊNTICO a ela em layout: bordas douradas e etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) permanecem exatamente iguais.
- Os QUATRO quadros de produto têm posição e tamanho FIXOS: POLO PIQUET (quadro largo no topo), CAMISETA (meio à esquerda), BAGA PERSONALIZADA (embaixo à esquerda) e WINDBANNER (quadro alto à direita). Pinte SOMENTE dentro deles, sem ultrapassar as bordas.

O QUE MUDA (E SOMENTE ISSO):
1. Os PRODUTOS (MESMOS MODELOS DA REFERÊNCIA — não troque corte, gola, mangas, botões nem formato, a não ser que o designer peça): polo piquet (frente e costas), camiseta (frente e costas), bag de cordão (mochila saco) e windbanner (bandeira com base). Mesmo tipo de produto, mesma posição, mesmo tamanho, mesmo ângulo e mesmo enquadramento da referência — mudam apenas as cores e a personalização: troque cada "LOGO AQUI" pela logomarca do cliente (peito esquerdo e costas centralizada nas camisas; centralizada na bag e no windbanner).
   - Frente e costas da MESMA peça têm SEMPRE a mesma cor (a polo inteira numa cor, a camiseta inteira em outra).
   - Mantenha os detalhes de design dos produtos da referência, apenas recolorindo: as faixas diagonais decorativas na parte de baixo do windbanner, a etiqueta na barra das camisas, os cordões da bag.
   - Nas camisas, a logo da FRENTE é pequena, no peito esquerdo (do mesmo tamanho do "LOGO AQUI" da referência); a das COSTAS é grande e centralizada.
2. As IMAGENS DE CONTEXTO atrás dos produtos: novo cenário fotográfico ligado ao ramo do cliente, cobrindo 100% de cada quadro, com profundidade, desfoque natural e luz premium. Os produtos ficam nítidos em primeiro plano.
- Não reaproveite as cores e os fundos da referência; crie a versão do cliente.`;
  // Criação: regras rígidas + pedido. Edição: regras de edição + pedido (as regras
  // rígidas mandam escolher cores pela logomarca, o que contradiz "manter idêntico").
  const regrasUsadas = (editando ? regrasEdicao : regras).trim();
  const editPrompt = [
    regrasUsadas,
    regrasUsadas ? (editando ? "\nPEDIDO DO DESIGNER (altere SOMENTE isto):" : "\nINSTRUÇÕES DESTA ARTE:") : "",
    promptUser.trim(),
    notaNova,
    notaFresca,
    notaRecorte,
  ].filter(Boolean).join("\n").trim();

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
    // Ordem: 1ª recorte da referência (só molde do layout, vai pequeno), 2ª recorte da
    // arte atual (só na edição), logos originais e anexos — tudo reduzido.
    const [refRecorte, atualRecorte, logosRed, anexosRed] = await Promise.all([
      recortar(base, regiao, 768),
      arteAtual ? recortar(arteAtual, regiao, 1024) : null,
      Promise.all(logosOriginais.map((b) => reduzir(b, 512))),
      Promise.all(anexos.map((a) => reduzir(a.buffer, 1024))),
    ]);
    const files = await Promise.all([
      toFile(refRecorte, "referencia.jpg", { type: "image/jpeg" }),
      ...(atualRecorte ? [toFile(atualRecorte, "arte-atual.jpg", { type: "image/jpeg" })] : []),
      ...logosRed.map((b, i) => toFile(b, `logo-original-${i + 1}.png`, { type: "image/png" })),
      ...anexosRed.map((b, i) => toFile(b, `imagem-${i + 1}.png`, { type: "image/png" })),
    ].slice(0, 16));
    const r = await openai.images.edit({
      model: modelo,
      image: files.length === 1 ? files[0] : files,
      prompt: editPrompt,
      n: 1,
      size: `${w}x${h}`,
      quality: qualidade,
      // gpt-image-2 já trabalha em alta fidelidade e recusa este parâmetro
      ...(modelo.startsWith("gpt-image-2") ? {} : { input_fidelity: "high" }),
      output_format: "jpeg",
      output_compression: 95,
    } as OpenAI.Images.ImageEditParamsNonStreaming);
    const b64 = r.data?.[0]?.b64_json;
    if (!b64) throw new Error("Falha ao gerar imagem.");
    console.log(`[gerar] ${modelo} ${w}x${h} uso:`, JSON.stringify(r.usage ?? {}));
    return { buffer: Buffer.from(b64, "base64"), uso: r.usage, tamanho: `${w}x${h}` };
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
          uso: gerada.uso ? { ...gerada.uso, tamanho: gerada.tamanho } : undefined,
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
