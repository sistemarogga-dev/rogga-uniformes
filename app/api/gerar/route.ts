import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";
// A geração de imagem pode passar de 1 minuto em qualidade alta.
export const maxDuration = 300;

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inicio = Date.now();

  try {
    const formData = await request.formData();
    const regras = (formData.get("regras") as string) || "";
    const promptUser = (formData.get("prompt") as string) || "";
    const usarMascara = (formData.get("usarMascara") as string) !== "false";
    // "rapida" (quality medium, padrão) ou "maxima" (quality high)
    const qualidade = (formData.get("qualidade") as string) === "maxima" ? "high" : "medium";
    const imagens = formData.getAll("imagens") as File[];
    // Edição de uma arte existente: usa a arte enviada como base no lugar do template.
    const baseImage = formData.get("baseImage") as string | null;

    if (!promptUser.trim()) {
      return Response.json({ error: "Escreva o prompt da arte que deseja gerar." }, { status: 400 });
    }

    // Imagem-base: a arte enviada (modo edição) OU o template fixo.
    let rawTemplate: Buffer;
    if (baseImage && baseImage.startsWith("data:")) {
      rawTemplate = Buffer.from(baseImage.split(",")[1], "base64");
    } else {
      const templatePath = path.join(process.cwd(), "public", "template.png");
      if (!fs.existsSync(templatePath)) {
        return Response.json({ error: "Template não encontrado. Salve o arquivo template.png na pasta public." }, { status: 500 });
      }
      rawTemplate = fs.readFileSync(templatePath);
    }

    // Monta o prompt final = regras rígidas + instruções desta arte
    const notaFresca = baseImage
      ? `
MODO EDIÇÃO (MUITO IMPORTANTE):
- A primeira imagem é a arte atual. Altere SOMENTE o que foi pedido acima.
- Todo o resto permanece IDÊNTICO: mesmos modelos de produto (corte, gola, mangas, botões, formato da bag e do windbanner), mesmas cores, mesmos logos, mesmos fundos, mesmas posições e enquadramentos.`
      : `
GEOMETRIA OBRIGATÓRIA (NÃO DESLOCAR NADA):
- A primeira imagem é a ARTE DE REFERÊNCIA da Rogga. O resultado deve ser IDÊNTICO a ela em layout: cabeçalho, título, subtítulo, bordas douradas, etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) e rodapé permanecem exatamente iguais.
- Os QUATRO quadros de produto têm posição e tamanho FIXOS: POLO PIQUET (quadro largo no topo), CAMISETA (meio à esquerda), BAGA PERSONALIZADA (embaixo à esquerda) e WINDBANNER (quadro alto à direita). Pinte SOMENTE dentro deles, sem ultrapassar as bordas.

O QUE MUDA (E SOMENTE ISSO):
1. Os PRODUTOS (MESMOS MODELOS DA REFERÊNCIA — não troque corte, gola, mangas, botões nem formato, a não ser que o designer peça): polo piquet (frente e costas), camiseta (frente e costas), bag de cordão (mochila saco) e windbanner (bandeira com base). Mesmo tipo de produto, mesma posição, mesmo tamanho, mesmo ângulo e mesmo enquadramento da referência — mudam apenas as cores e a personalização: troque cada "LOGO AQUI" pela logomarca do cliente (peito esquerdo e costas centralizada nas camisas; centralizada na bag e no windbanner).
2. As IMAGENS DE CONTEXTO atrás dos produtos: novo cenário fotográfico ligado ao ramo do cliente, cobrindo 100% de cada quadro, com profundidade, desfoque natural e luz premium. Os produtos ficam nítidos em primeiro plano.
- Não reaproveite as cores e os fundos da referência; crie a versão do cliente.`;
    const editPrompt = [
      regras.trim(),
      regras.trim() ? "\nINSTRUÇÕES DESTA ARTE:" : "",
      promptUser.trim(),
      notaFresca,
    ].filter(Boolean).join("\n").trim();
    const templateMeta = await sharp(rawTemplate).metadata();
    const tW = templateMeta.width ?? 900;
    const tH = templateMeta.height ?? 1600;

    // Base da recolagem: o template CHEIO (com camisas/fundo). Assim qualquer "sobra"
    // dentro do quadro é preenchida pelo fundo do template — nunca por branco.
    const baseComposite = rawTemplate;

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

    // ─── EDIT ────────────────────────────────────────────────────────────────────
    // Edição LIMPA (sem máscara): o modelo redesenha os produtos de forma holística e
    // fiel (como no ChatGPT). A preservação do layout é feita depois, recolando só os
    // quadros de produto no template original. input_fidelity:high mantém logos e
    // modelos de produto fiéis à referência.
    const gerarImagem = async (modelo: string) => {
      const { w, h } = tamanhoDe(modelo);
      const base = await sharp(rawTemplate)
        .resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      const files = await Promise.all([
        toFile(base, "template.png", { type: "image/png" }),
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
      } as Parameters<typeof openai.images.edit>[0];
      const response = (await openai.images.edit(params)) as { data?: Array<{ b64_json?: string }> };
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("Falha ao gerar imagem.");
      return Buffer.from(b64, "base64");
    };

    // Se o modelo novo não estiver disponível na conta, cai para o gpt-image-1.5.
    const gerarComFallback = async () => {
      try {
        return await gerarImagem(MODELO);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (MODELO !== "gpt-image-1.5" && (status === 400 || status === 403 || status === 404)) {
          console.warn(`[gerar] ${MODELO} falhou (${status}), usando gpt-image-1.5:`, (e as Error).message);
          return gerarImagem("gpt-image-1.5");
        }
        throw e;
      }
    };

    const [imageBuffer, { logomarca, categoria }] = await Promise.all([gerarComFallback(), analisarLogo()]);

    // Volta ao tamanho do template (desfaz o esticamento, se houve).
    const geradoFull = await sharp(imageBuffer)
      .resize(tW, tH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    // ─── ZONAS EDITÁVEIS ─────────────────────────────────────────────────────────
    // Os 4 quadros de produto da arte de referência (public/template.png, 900x1600).
    // O resto (cabeçalho, bordas douradas, rodapé) é preservado. Cada quadro tem uma
    // etiqueta no canto superior esquerdo (POLO PIQUET etc.) que também é preservada:
    // tab = [x do topo da diagonal, x da base da diagonal, y da base da etiqueta].
    const REF_W = 900, REF_H = 1600;
    const zonas = [
      { x0: 23, y0: 255, x1: 880, y1: 717, tab: [248, 215, 302] },   // POLO PIQUET
      { x0: 23, y0: 737, x1: 463, y1: 1058, tab: [218, 188, 782] },  // CAMISETA
      { x0: 483, y0: 737, x1: 880, y1: 1396, tab: [698, 668, 782] }, // WINDBANNER
      { x0: 23, y0: 1079, x1: 463, y1: 1396, tab: [328, 298, 1126] }, // BAGA PERSONALIZADA
    ];

    let composto: Buffer;
    if (usarMascara) {
      // Recorta SÓ os quadros de produto da arte gerada e cola de volta no template.
      // Assim cabeçalho, etiquetas, bordas e rodapé ficam pixel-perfeito iguais ao original.
      const sx = tW / REF_W, sy = tH / REF_H;
      const rad = Math.round(12 * sx); // cantos arredondados iguais aos dos quadros
      const keepRects = zonas
        .map((z) => {
          const x = Math.round(z.x0 * sx), y = Math.round(z.y0 * sy);
          const w = Math.round((z.x1 - z.x0) * sx), h = Math.round((z.y1 - z.y0) * sy);
          return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ry="${rad}" fill="white"/>`;
        })
        .join("");
      const tabs = zonas
        .map((z) => {
          const [xTopo, xBase, yBase] = z.tab;
          const pts = [[z.x0 - 2, z.y0 - 2], [xTopo - 2, z.y0 - 2], [xBase - 2, yBase], [z.x0 - 2, yBase]]
            .map(([x, y]) => `${Math.round(x * sx)},${Math.round(y * sy)}`)
            .join(" ");
          return `<polygon points="${pts}" fill="white"/>`;
        })
        .join("");
      const svg = (conteudo: string) =>
        Buffer.from(`<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${conteudo}</svg>`);
      // Máscara KEEP = quadros MENOS as etiquetas (dest-out recorta as etiquetas)
      const keepPng = await sharp(svg(keepRects))
        .composite([{ input: svg(tabs), blend: "dest-out" }])
        .png()
        .toBuffer();
      // overlay = arte gerada visível APENAS nos quadros de produto (blend dest-in)
      const overlay = await sharp(geradoFull)
        .ensureAlpha()
        .composite([{ input: keepPng, blend: "dest-in" }])
        .png()
        .toBuffer();
      composto = await sharp(baseComposite)
        .composite([{ input: overlay }])
        .toBuffer();
    } else {
      composto = geradoFull;
    }

    // Redimensiona para 1080x1920 (9:16). Sai em JPEG de alta qualidade para caber no
    // limite de ~4,5 MB por requisição/resposta da Vercel (um PNG passaria disso).
    const finalImg = await sharp(composto)
      .resize(1080, 1920, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    const url = `data:image/jpeg;base64,${finalImg.toString("base64")}`;

    const tempoMs = Date.now() - inicio;

    return Response.json({ url, prompt: editPrompt, logomarca, categoria, tempoMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
