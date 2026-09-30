import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { exigirAcesso, passouDoLimite } from "@/lib/acesso";
import { bufferDaArte, caminhoValido, salvarArteNuvem, type ArteSalva } from "@/lib/artes";

export const dynamic = "force-dynamic";
// A geração de imagem pode passar de 1 minuto em qualidade alta.
export const maxDuration = 300;

// A resposta é um fluxo NDJSON (uma linha JSON por evento), para o designer ver a arte
// se formando:
//   { tipo: "parcial", url }  → prévia (pode vir 0, 1 ou 2 vezes)
//   { tipo: "final", url, prompt, logomarca, categoria, tempoMs, timestamp, arte }
//   { tipo: "erro", error }

// ─── ZONAS EDITÁVEIS ───────────────────────────────────────────────────────────
// Os 4 quadros de produto da arte de referência (public/template.png, 900x1600).
// O resto (cabeçalho, bordas douradas, rodapé) é preservado. Cada quadro tem uma
// etiqueta no canto superior esquerdo (POLO PIQUET etc.) que também é preservada:
// tab = [x do topo da diagonal, x da base da diagonal, y da base da etiqueta].
const REF_W = 900, REF_H = 1600;
const ZONAS = [
  { x0: 23, y0: 255, x1: 880, y1: 717, tab: [248, 215, 302] },   // POLO PIQUET
  { x0: 23, y0: 737, x1: 463, y1: 1058, tab: [218, 188, 782] },  // CAMISETA
  { x0: 483, y0: 737, x1: 880, y1: 1396, tab: [698, 668, 782] }, // WINDBANNER
  { x0: 23, y0: 1079, x1: 463, y1: 1396, tab: [328, 298, 1126] }, // BAGA PERSONALIZADA
];

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
async function mascaraDosQuadros(tW: number, tH: number) {
  const sx = tW / REF_W, sy = tH / REF_H;
  const rad = Math.round(12 * sx); // cantos arredondados iguais aos dos quadros
  const keepRects = ZONAS
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
  // "rapida" (quality medium, padrão) ou "maxima" (quality high)
  const qualidade = (formData.get("qualidade") as string) === "maxima" ? "high" : "medium";
  const vendedor = ((formData.get("vendedor") as string) || "").slice(0, 40);
  const imagens = formData.getAll("imagens") as File[];
  // Edição: a arte-base vem do histórico (basePath) ou como data URL (baseImage).
  const basePath = (formData.get("basePath") as string) || "";
  const baseImage = formData.get("baseImage") as string | null;
  const logomarcaBase = ((formData.get("logomarcaBase") as string) || "").slice(0, 60);

  if (!promptUser.trim()) {
    return Response.json({ error: "Escreva o prompt da arte que deseja gerar." }, { status: 400 });
  }

  // A BASE é sempre a arte de referência limpa: ela é o molde do layout e das posições
  // e tamanhos dos produtos. Na edição, a arte atual vai como SEGUNDA imagem (só para
  // copiar cores, logos, textos e fundos). Antes a arte atual era a base, e a cada
  // edição a IA "aproximava" um pouco os produtos — eles cresciam, encostavam nas
  // bordas dos quadros e começavam a se sobrepor.
  let arteAtual: Buffer | null = null;
  if (basePath && caminhoValido(basePath)) arteAtual = await bufferDaArte(basePath).catch(() => null);
  else if (baseImage?.startsWith("data:")) arteAtual = Buffer.from(baseImage.split(",")[1], "base64");
  const editando = !!arteAtual;
  const templatePath = path.join(process.cwd(), "public", "template.png");
  if (!fs.existsSync(templatePath)) {
    return Response.json({ error: "Template não encontrado. Salve o arquivo template.png na pasta public." }, { status: 500 });
  }
  const base = fs.readFileSync(templatePath);

  const regraEnquadramento = `- Cada produto fica INTEIRO dentro do seu quadro, com folga das bordas, exatamente na posição e no tamanho da arte de referência: nada cortado pelas bordas dos quadros, sem aproximar (zoom) e sem um produto sobrepor o outro.`;

  // Monta o prompt final = regras rígidas + instruções desta arte
  const notaFresca = editando
    ? `
MODO EDIÇÃO (MUITO IMPORTANTE):
- A PRIMEIRA imagem é a arte de referência da Rogga: ela define o layout e as posições, tamanhos e enquadramentos de cada produto. A SEGUNDA imagem é a arte atual deste cliente.
- Recrie a arte atual — mesmos modelos de produto (corte, gola, mangas, botões, formato da bag e do windbanner), mesmas cores, mesmas logomarcas e textos aplicados, mesmos fundos — aplicando SOMENTE a alteração pedida acima.
${regraEnquadramento}`
    : `
${regraEnquadramento}`;
  const notaNova = editando ? "" : `
GEOMETRIA OBRIGATÓRIA (NÃO DESLOCAR NADA):
- A primeira imagem é a ARTE DE REFERÊNCIA da Rogga. O resultado deve ser IDÊNTICO a ela em layout: cabeçalho, título, subtítulo, bordas douradas, etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) e rodapé permanecem exatamente iguais.
- Os QUATRO quadros de produto têm posição e tamanho FIXOS: POLO PIQUET (quadro largo no topo), CAMISETA (meio à esquerda), BAGA PERSONALIZADA (embaixo à esquerda) e WINDBANNER (quadro alto à direita). Pinte SOMENTE dentro deles, sem ultrapassar as bordas.

O QUE MUDA (E SOMENTE ISSO):
1. Os PRODUTOS (MESMOS MODELOS DA REFERÊNCIA — não troque corte, gola, mangas, botões nem formato, a não ser que o designer peça): polo piquet (frente e costas), camiseta (frente e costas), bag de cordão (mochila saco) e windbanner (bandeira com base). Mesmo tipo de produto, mesma posição, mesmo tamanho, mesmo ângulo e mesmo enquadramento da referência — mudam apenas as cores e a personalização: troque cada "LOGO AQUI" pela logomarca do cliente (peito esquerdo e costas centralizada nas camisas; centralizada na bag e no windbanner).
   - Frente e costas da MESMA peça têm SEMPRE a mesma cor (a polo inteira numa cor, a camiseta inteira em outra).
   - Mantenha os detalhes de design dos produtos da referência, apenas recolorindo: as faixas diagonais decorativas na parte de baixo do windbanner, a etiqueta na barra das camisas, os cordões da bag.
   - Nas camisas, a logo da FRENTE é pequena, no peito esquerdo (do mesmo tamanho do "LOGO AQUI" da referência); a das COSTAS é grande e centralizada.
2. As IMAGENS DE CONTEXTO atrás dos produtos: novo cenário fotográfico ligado ao ramo do cliente, cobrindo 100% de cada quadro, com profundidade, desfoque natural e luz premium. Os produtos ficam nítidos em primeiro plano.
- Não reaproveite as cores e os fundos da referência; crie a versão do cliente.`;
  const editPrompt = [
    regras.trim(),
    regras.trim() ? "\nINSTRUÇÕES DESTA ARTE:" : "",
    promptUser.trim(),
    notaNova,
    notaFresca,
  ].filter(Boolean).join("\n").trim();

  const meta = await sharp(base).metadata();
  const tW = meta.width ?? 900;
  const tH = meta.height ?? 1600;
  const keepPng = usarMascara ? await mascaraDosQuadros(tW, tH) : null;

  // Recola SÓ os quadros de produto da arte gerada sobre a base. Assim cabeçalho,
  // etiquetas, bordas e rodapé ficam pixel-perfeito iguais ao original.
  const compor = async (gerado: Buffer, saida: { w: number; h: number; q: number }) => {
    const cheio = await sharp(gerado).resize(tW, tH, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
    let composto = cheio;
    if (keepPng) {
      const overlay = await sharp(cheio).ensureAlpha().composite([{ input: keepPng, blend: "dest-in" }]).png().toBuffer();
      composto = await sharp(base).composite([{ input: overlay }]).png().toBuffer();
    }
    return sharp(composto)
      .resize(saida.w, saida.h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: saida.q, mozjpeg: true })
      .toBuffer();
  };

  // ─── TAMANHO DE GERAÇÃO ─────────────────────────────────────────────────────
  // gpt-image-2 aceita tamanho livre: geramos direto em 9:16 (1008x1792, múltiplos de
  // 16), sem distorcer o template. Os modelos antigos só geram 2:3 (1024x1536): nesse
  // caso o template é ESTICADO para 2:3 e a saída é desesticada de volta.
  const MODELO = process.env.IMAGE_MODEL || "gpt-image-2";
  const tamanhoDe = (modelo: string) =>
    modelo.startsWith("gpt-image-2") ? { w: 1008, h: 1792 } : { w: 1024, h: 1536 };

  // ─── IMAGENS DO USUÁRIO ─────────────────────────────────────────────────────
  const anexos: Array<{ buffer: Buffer; type: string }> = [];
  for (const f of imagens) {
    if (f && typeof f === "object" && "size" in f && f.size > 0) {
      anexos.push({ buffer: Buffer.from(await f.arrayBuffer()), type: f.type || "image/png" });
    }
  }

  // Detectar nome da marca e categoria/ramo pelo primeiro logo (roda em paralelo
  // com a geração da imagem, para não somar tempo).
  const analisarLogo = async () => {
    const r = { logomarca: "Logomarca", categoria: "Outros" };
    if (!anexos.length) return r;
    try {
      const vision = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${anexos[0].type};base64,${anexos[0].buffer.toString("base64")}` } },
            { type: "text", text: 'Analise este logotipo. Responda APENAS com um JSON no formato {"nome":"...","categoria":"..."}. "nome" = nome da marca/empresa (se ilegível, use "Cliente"). "categoria" = ramo/segmento em 1-2 palavras em português (ex: Climatização, Construção, Restaurante, Oficina, Clínica, Academia, Transporte, Tecnologia, Comércio). Nada além do JSON.' },
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

  // ─── EDIT ──────────────────────────────────────────────────────────────────
  // Edição LIMPA (sem máscara): o modelo redesenha os produtos de forma holística e
  // fiel (como no ChatGPT). A preservação do layout é feita depois, em compor().
  // Em modo stream a OpenAI manda prévias (partial_images) antes da imagem final.
  const gerarImagem = async (modelo: string, stream: boolean, onParcial: (b: Buffer) => void) => {
    const { w, h } = tamanhoDe(modelo);
    const baseRedim = await sharp(base).resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
    // Ordem: 1ª referência (molde do layout), 2ª arte atual (só na edição), depois anexos
    const atualRedim = arteAtual
      ? await sharp(arteAtual).resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toBuffer()
      : null;
    const files = await Promise.all([
      toFile(baseRedim, "template.png", { type: "image/png" }),
      ...(atualRedim ? [toFile(atualRedim, "arte-atual.png", { type: "image/png" })] : []),
      ...anexos.map((a, i) => toFile(a.buffer, `imagem-${i + 1}.png`, { type: a.type })),
    ]);
    const params = {
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
      ...(stream ? { stream: true, partial_images: 2 } : {}),
    };
    if (stream) {
      const eventos = await openai.images.edit(params as OpenAI.Images.ImageEditParamsStreaming);
      for await (const ev of eventos) {
        if (ev.type === "image_edit.partial_image") onParcial(Buffer.from(ev.b64_json, "base64"));
        else if (ev.type === "image_edit.completed") return Buffer.from(ev.b64_json, "base64");
      }
      throw new Error("Falha ao gerar imagem.");
    }
    const r = await openai.images.edit(params as OpenAI.Images.ImageEditParamsNonStreaming);
    const b64 = r.data?.[0]?.b64_json;
    if (!b64) throw new Error("Falha ao gerar imagem.");
    return Buffer.from(b64, "base64");
  };

  // Tentativas em ordem: modelo novo com prévia → sem prévia → gpt-image-1.5.
  // Só troca de tentativa em erro de "não suportado" (400/403/404) e antes de qualquer prévia.
  const gerarComFallback = async (onParcial: (b: Buffer) => void) => {
    const tentativas: Array<[string, boolean]> = [[MODELO, true], [MODELO, false]];
    if (MODELO !== "gpt-image-1.5") tentativas.push(["gpt-image-1.5", true], ["gpt-image-1.5", false]);
    let houvePrevia = false;
    let ultimoErro: unknown;
    for (const [modelo, stream] of tentativas) {
      try {
        return await gerarImagem(modelo, stream, (b) => { houvePrevia = true; onParcial(b); });
      } catch (e) {
        ultimoErro = e;
        const status = (e as { status?: number }).status;
        if (houvePrevia || !(status === 400 || status === 403 || status === 404)) throw e;
        console.warn(`[gerar] ${modelo} (stream=${stream}) falhou (${status}):`, (e as Error).message);
      }
    }
    throw ultimoErro;
  };

  const enc = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enviar = (obj: object) => ctrl.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        // Prévias em ordem, sem travar a geração
        let filaPrevia = Promise.resolve();
        const onParcial = (b: Buffer) => {
          filaPrevia = filaPrevia.then(async () => {
            const jpg = await compor(b, { w: 540, h: 960, q: 70 });
            enviar({ tipo: "parcial", url: `data:image/jpeg;base64,${jpg.toString("base64")}` });
          }).catch(() => {});
        };

        const [imageBuffer, analise] = await Promise.all([gerarComFallback(onParcial), analisarLogo()]);
        await filaPrevia;

        // Redimensiona para 1080x1920 (9:16). JPEG de alta qualidade para caber no
        // limite de ~4,5 MB por resposta da Vercel (um PNG passaria disso).
        const finalImg = await compor(imageBuffer, { w: 1080, h: 1920, q: 92 });
        const logomarca = anexos.length ? analise.logomarca : (logomarcaBase || analise.logomarca);
        const timestamp = Date.now();

        // Salva no histórico compartilhado. Se falhar, a arte ainda chega ao designer.
        let arte: ArteSalva | null = null;
        try {
          arte = await salvarArteNuvem(finalImg, { timestamp, logomarca, vendedor });
        } catch (e) {
          console.error("[gerar] não salvou no histórico:", (e as Error).message);
        }

        enviar({
          tipo: "final",
          url: `data:image/jpeg;base64,${finalImg.toString("base64")}`,
          prompt: editPrompt,
          logomarca,
          categoria: analise.categoria,
          tempoMs: Date.now() - inicio,
          timestamp,
          arte,
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
