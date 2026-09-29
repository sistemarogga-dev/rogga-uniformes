import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";
// A geração com gpt-image-1 (quality high) pode passar de 1 minuto.
export const maxDuration = 300;

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inicio = Date.now();

  try {
    const formData = await request.formData();
    const regras = (formData.get("regras") as string) || "";
    const promptUser = (formData.get("prompt") as string) || "";
    const usarMascara = (formData.get("usarMascara") as string) !== "false";
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
      ? "" // modo edição: ajustar só o que foi pedido, sem refazer tudo
      : `
GEOMETRIA OBRIGATÓRIA (NÃO DESLOCAR NADA):
- A primeira imagem é a ARTE DE REFERÊNCIA da Rogga. O resultado deve ser IDÊNTICO a ela em layout: cabeçalho, título, subtítulo, bordas douradas, etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) e rodapé permanecem exatamente iguais.
- Os QUATRO quadros de produto têm posição e tamanho FIXOS: POLO PIQUET (quadro largo no topo), CAMISETA (meio à esquerda), BAGA PERSONALIZADA (embaixo à esquerda) e WINDBANNER (quadro alto à direita). Pinte SOMENTE dentro deles, sem ultrapassar as bordas.

O QUE MUDA (E SOMENTE ISSO):
1. Os PRODUTOS: polo piquet (frente e costas), camiseta (frente e costas), bag de cordão (mochila saco) e windbanner (bandeira com base). Mesmo tipo de produto, mesma posição, mesmo tamanho, mesmo ângulo e mesmo enquadramento da referência — mudam apenas as cores e a personalização: troque cada "LOGO AQUI" pela logomarca do cliente (peito esquerdo e costas centralizada nas camisas; centralizada na bag e no windbanner).
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

    // ─── AJUSTE 9:16 → 2:3 (POR ESTICAMENTO, SEM BARRAS) ─────────────────────────
    // A gpt-image-1 só gera em 2:3 (1024×1536). Em vez de adicionar barras pretas
    // laterais (que o modelo às vezes "invade", deslocando todo o layout e jogando as
    // camisas/fundo para fora dos retângulos), nós ESTICAMOS o template 9:16 para 2:3.
    // Como não há barras, o modelo não tem para onde vazar e o alinhamento fica
    // determinístico: na saída basta desfazer o esticamento (resize de volta a 9:16).
    const GEN_W = 1024, GEN_H = 1536; // tamanho 2:3 gerado pela gpt-image-1
    const stretchedTemplate = await sharp(rawTemplate)
      .resize(GEN_W, GEN_H, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    // ─── IMAGENS PARA O EDIT ────────────────────────────────────────────────────
    // Primeiro o template (base), depois todas as imagens enviadas pelo usuário.
    const images: Buffer[] = [stretchedTemplate];
    const names: string[] = ["template.png"];
    const types: string[] = ["image/png"];

    let primeiraImagem: { buffer: Buffer; type: string } | null = null;

    for (let i = 0; i < imagens.length; i++) {
      const f = imagens[i];
      if (f && typeof f === "object" && "size" in f && f.size > 0) {
        const buf = Buffer.from(await f.arrayBuffer());
        images.push(buf);
        names.push(`imagem-${i + 1}.png`);
        types.push(f.type || "image/png");
        if (!primeiraImagem) primeiraImagem = { buffer: buf, type: f.type || "image/png" };
      }
    }

    // Detectar nome da marca e categoria/ramo pelo primeiro logo
    let logomarca = "Logomarca";
    let categoria = "Outros";
    if (primeiraImagem) {
      try {
        const base64 = primeiraImagem.buffer.toString("base64");
        const vision = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${primeiraImagem.type};base64,${base64}` } },
              { type: "text", text: 'Analise este logotipo. Responda APENAS com um JSON no formato {"nome":"...","categoria":"..."}. "nome" = nome da marca/empresa (se ilegível, use "Cliente"). "categoria" = ramo/segmento em 1-2 palavras em português (ex: Climatização, Construção, Restaurante, Oficina, Clínica, Academia, Transporte, Tecnologia, Comércio). Nada além do JSON.' },
            ],
          }],
          max_tokens: 60,
        });
        const txt = vision.choices[0]?.message?.content?.trim() || "";
        const json = txt.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(json);
        if (parsed.nome) logomarca = String(parsed.nome).replace(/^["']|["']$/g, "").slice(0, 60);
        if (parsed.categoria) categoria = String(parsed.categoria).slice(0, 40);
      } catch {
        // se falhar, mantém os padrões
      }
    }

    const imageFiles = await Promise.all(
      images.map((buf, i) => toFile(buf, names[i], { type: types[i] }))
    );
    const imageInput = imageFiles.length === 1 ? imageFiles[0] : imageFiles;

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

    // ─── EDIT ────────────────────────────────────────────────────────────────────
    // Edição LIMPA (sem máscara): o modelo redesenha os produtos de forma holística e
    // fiel (como no ChatGPT). A preservação do layout é feita depois, recolando só os
    // quadros de produto no template original. input_fidelity:high mantém logos nítidos.
    const editParams: Parameters<typeof openai.images.edit>[0] = {
      model: "gpt-image-1",
      image: imageInput,
      prompt: editPrompt,
      n: 1,
      size: "1024x1536",
      quality: "high",
      input_fidelity: "high",
    } as Parameters<typeof openai.images.edit>[0];

    const response = (await openai.images.edit(editParams)) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };

    const item = response.data?.[0];
    let imageBuffer: Buffer | undefined;

    if (item?.b64_json) {
      imageBuffer = Buffer.from(item.b64_json, "base64");
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    if (!imageBuffer) return Response.json({ error: "Falha ao gerar imagem." }, { status: 500 });

    // A saída vem em 2:3 (esticada). Desfaz o esticamento voltando ao 9:16 original
    // (resize direto para tW×tH). Como não houve barras, cada pixel volta à sua posição.
    const geradoFull = await sharp(imageBuffer)
      .resize(tW, tH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

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
