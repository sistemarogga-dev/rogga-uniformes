import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { sessaoAtual } from "@/lib/sessao-servidor";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Exige login
  const sessao = await sessaoAtual();
  if (!sessao) return Response.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });

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
- NÃO mova, NÃO redimensione, NÃO reposicione e NÃO reescale NENHUM elemento do layout. Cada coisa permanece EXATAMENTE na mesma posição e tamanho do modelo recebido (cabeçalho, rodapé, bordas e os dois retângulos).
- Os DOIS retângulos das camisas têm posição e tamanho FIXOS. Pinte SOMENTE dentro deles, respeitando as mesmas bordas, os mesmos limites e os mesmos cantos arredondados do modelo. Nada pode ultrapassar a borda de cada retângulo.

PREENCHIMENTO DOS 2 RETÂNGULOS CENTRAIS:
- Recrie do ZERO o conteúdo dos 2 retângulos centrais: novas camisas (polo frente/costas e camiseta frente/costas), novas estampas, os logos aplicados e uma nova imagem de fundo de contexto.
- Cada retângulo deve ser preenchido COMPLETAMENTE, de borda a borda DENTRO do próprio retângulo, SEM nenhuma área branca ou vazia: a imagem de fundo de contexto cobre 100% do retângulo (incluindo cantos e a parte de baixo) e as camisas ficam em primeiro plano, nítidas, com folga das bordas — exatamente como no modelo padrão.
- Não reaproveite as camisas que já estão no template; desenhe camisas e cenário novos para esta arte.`;
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
    // Apenas os quadros das camisas. O resto (cabeçalho, rodapé, divisória, barra de
    // diferenciais, bordas) é preservado. Frações do template (calibradas em
    // scripts/preview-mask.mjs).
    const zonas = [
      { x0: 0.035, y0: 0.205, x1: 0.965, y1: 0.438 },  // quadro POLO
      { x0: 0.035, y0: 0.475, x1: 0.965, y1: 0.730 },  // quadro CAMISETA
    ];

    // ─── EDIT ────────────────────────────────────────────────────────────────────
    // Edição LIMPA (sem máscara): o modelo redesenha as camisas de forma holística e
    // fiel (como no ChatGPT). A preservação do layout é feita depois, recolando só os
    // quadros das camisas no template original. input_fidelity:high mantém logos nítidos.
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
      // Recorta SÓ as camisas da arte gerada e cola de volta no template original.
      // Assim cabeçalho, rodapé e textos ficam pixel-perfeito iguais ao original.
      // Máscara KEEP: fundo transparente + retângulos brancos opacos nas camisas.
      const rad = Math.round(0.028 * tW); // cantos arredondados iguais aos do retângulo
      const keepRects = zonas
        .map((z) => {
          const x = Math.round(z.x0 * tW), y = Math.round(z.y0 * tH);
          const w = Math.round((z.x1 - z.x0) * tW), h = Math.round((z.y1 - z.y0) * tH);
          return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ry="${rad}" fill="white"/>`;
        })
        .join("");
      const keepSvg = `<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">${keepRects}</svg>`;
      const keepPng = await sharp(Buffer.from(keepSvg)).png().toBuffer();
      // overlay = arte gerada visível APENAS nas zonas das camisas (blend dest-in)
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

    // Redimensiona para 1080x1920 (9:16) — tamanho final pedido nas regras.
    const finalImg = await sharp(composto)
      .resize(1080, 1920, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6, quality: 100 })
      .toBuffer();

    const url = `data:image/png;base64,${finalImg.toString("base64")}`;

    // Registra a métrica desta geração (não bloqueia a resposta se falhar)
    const tempoMs = Date.now() - inicio;
    try {
      await getSupabase().from("geracoes").insert({
        designer_username: sessao.username,
        empresa: baseImage ? `${logomarca} (edição)` : logomarca,
        categoria,
        tempo_ms: tempoMs,
      });
    } catch {
      // se o registro falhar, não impede a entrega da arte
    }

    return Response.json({ url, prompt: editPrompt, logomarca, categoria, tempoMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
