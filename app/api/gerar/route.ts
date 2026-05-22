import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";

interface CoresDetalhadas {
  poloTronco: string; poloGola: string;
  camisetaTronco: string; camisetaMangas: string; camisetaGola: string; camisetaPunho: string;
}

interface Detalhes {
  alternarCores: boolean;
  golaV: boolean;
  mangaLonga: boolean;
  usarEstampa: string;
  usarLogo2: string;
  mudarCoresEstampa: string;
  punhoBarra: string;
  bandeiras: string;
  logo2OutroPeito: string;
}

function buildPrompt(params: {
  cliente: string; vendedor: string; tipoCores: string;
  cores: CoresDetalhadas; detalhes: Detalhes; logoAnalysis: string;
  temLogo: boolean; temLogo2: boolean; temEstampa: boolean;
}): string {
  const { cliente, vendedor, tipoCores, cores, detalhes, logoAnalysis, temLogo, temLogo2, temEstampa } = params;

  // === REGRA MÁXIMA: PRESERVAÇÃO TOTAL DO TEMPLATE ===
  let prompt = `You are a professional uniform designer editing a ROGGA UNIFORMES proposal template. Client: "${cliente}".

CRITICAL — THIS IS AN IMAGE EDIT, NOT A NEW IMAGE GENERATION:
You must preserve the exact template structure and only modify the shirts inside it.

PRESERVE UNCHANGED — PIXEL-PERFECT:
• Background: cream/off-white color throughout
• Top header: ROGGA Uniformes logo (RG monogram in blue circle + text) — do NOT touch
• Decorative elements: all golden/yellow borders, corner ornaments, diagonal accent lines
• Title: "PROPOSTA DE UNIFORMES" in bold dark text
• Subtitle: "CONFORTO, QUALIDADE E PROFISSIONALISMO" in gold/orange
• Golden horizontal divider line under the subtitle
• Section headers: navy blue bars with "CAMISA POLO" and "CAMISETA GOLA REDONDA" text
• Rounded rectangle frames around each shirt section
• Labels: "FRENTE" and "VERSO" under each shirt
• Left sidebar icons in each section: TECIDO PREMIUM, CONFORTO E RESPIRABILIDADE, DURABILIDADE E RESISTÊNCIA, CAIMENTO PERFEITO — keep all 4 icons and labels exactly
• Bottom features bar: ALTA QUALIDADE, PERSONALIZAÇÃO, PRAZO ÁGIL, ATENDIMENTO with icons
• Footer: the DARK NAVY BLUE bar at the very bottom — MUST be preserved with globe icon + "roggauniformes.com.br", Instagram icon + "@roggauniformes", and person icon + seller name — this entire bar is mandatory
${vendedor ? `• Footer seller name: inside the footer bar, change the seller name to "${vendedor}"` : "• Footer seller name: keep exactly as shown in the template"}
• Corner ornaments: the golden diagonal accent lines in the top-left and top-right corners must remain unchanged

MODIFY ONLY — THE 4 SHIRT VIEWS:
1. POLO FRONT (frente) — left shirt in top section
2. POLO BACK (verso) — right shirt in top section
3. T-SHIRT FRONT (frente) — left shirt in bottom section
4. T-SHIRT BACK (verso) — right shirt in bottom section\n\n`;

  // === CORES ===
  if (tipoCores === "automatica") {
    prompt += `SHIRT COLORS (automatic — based on the client logo):\n`;
    prompt += `- Analyze the provided logo to extract the brand's main color (A) and secondary color (B).\n`;
    if (detalhes.alternarCores) {
      prompt += `- POLO: body and sleeves in color A, collar and cuffs in color B.\n`;
      prompt += `- T-SHIRT: body and sleeves in color B, collar/accents in color A.\n`;
    } else {
      prompt += `- Both shirts: body in color A, accents/collar in color B.\n`;
    }
    prompt += `- If the logo represents a well-known brand, you may incorporate subtle brand-themed design elements or patterns on the t-shirt (like stripes, geometric shapes, or a brand-inspired graphic) while keeping the polo clean and professional.\n`;
    if (logoAnalysis) prompt += `Logo analysis: ${logoAnalysis}\n`;
  } else {
    prompt += `SHIRT COLORS (specific):\n`;
    prompt += `POLO SHIRT:\n`;
    if (cores.poloTronco) prompt += `- Body and sleeves: ${cores.poloTronco}\n`;
    if (cores.poloGola) prompt += `- Collar and cuffs: ${cores.poloGola}\n`;
    prompt += `T-SHIRT:\n`;
    if (cores.camisetaTronco) prompt += `- Body: ${cores.camisetaTronco}\n`;
    if (cores.camisetaMangas) prompt += `- Sleeves: ${cores.camisetaMangas}\n`;
    else if (cores.camisetaTronco) prompt += `- Sleeves: same as body (${cores.camisetaTronco})\n`;
    if (cores.camisetaGola) prompt += `- Collar: ${cores.camisetaGola}\n`;
    if (cores.camisetaPunho) prompt += `- Cuffs: ${cores.camisetaPunho}\n`;
  }
  prompt += `\n`;

  // === LOGOS ===
  if (temLogo) {
    prompt += `CLIENT LOGO PLACEMENT (use the provided logo image):\n`;
    prompt += `- Remove the background from the client logo.\n`;
    prompt += `- Place the logo INSIDE the red circle on the POLO FRONT (left chest area) — fit it inside, replacing the "Logo" placeholder text.\n`;
    prompt += `- Place the logo INSIDE the red rectangle on the POLO BACK — fit it inside, replacing the "Logo" placeholder text.\n`;
    prompt += `- Place the logo INSIDE the red circle on the T-SHIRT FRONT (left chest area) — fit it inside, replacing the "Logo" placeholder text.\n`;
    prompt += `- Place the logo INSIDE the red rectangle on the T-SHIRT BACK — fit it inside, replacing the "Logo" placeholder text.\n`;
    prompt += `- The red circles and rectangles are placement guides — after placing the logo, they can be removed.\n`;
    prompt += `- Logos on sleeves: FRONT views only, not on back views.\n\n`;
  }

  // === DETALHES OPCIONAIS ===
  const detalhesList: string[] = [];

  if (detalhes.golaV) detalhesList.push("Change the T-SHIRT collar from round neck to V-neck.");
  if (detalhes.mangaLonga) detalhesList.push("Change the T-SHIRT to long sleeves with cuffs matching the sleeve color.");

  if (temEstampa && detalhes.usarEstampa) {
    const target = detalhes.usarEstampa === "polo" ? "the polo shirt" : detalhes.usarEstampa === "camiseta" ? "the t-shirt" : "both shirts";
    let d = `Apply the provided stamp/design image onto ${target} (front view only).`;
    if (detalhes.mudarCoresEstampa) d += ` Recolor the stamp to: ${detalhes.mudarCoresEstampa}.`;
    detalhesList.push(d);
  }

  if (temLogo2 && detalhes.usarLogo2) {
    const target = detalhes.usarLogo2 === "polo" ? "the polo shirt" : detalhes.usarLogo2 === "camiseta" ? "the t-shirt" : "both shirts";
    detalhesList.push(`Place the second provided logo on ${target}.`);
  }

  if (detalhes.punhoBarra) detalhesList.push(`Add a thin contrasting stripe/bar at the cuffs of: ${detalhes.punhoBarra}.`);
  if (detalhes.bandeiras) detalhesList.push(`Add flag patch(es) on the sleeve(s) — FRONT views only, NOT on back views: ${detalhes.bandeiras}.`);
  if (detalhes.logo2OutroPeito && temLogo2) detalhesList.push(`Also place the second logo on the right chest side (opposite the main logo) on: ${detalhes.logo2OutroPeito}.`);

  if (detalhesList.length > 0) {
    prompt += `ADDITIONAL SHIRT MODIFICATIONS:\n`;
    detalhesList.forEach((d, i) => { prompt += `${i + 1}. ${d}\n`; });
    prompt += `\n`;
  }

  // === REGRAS DAS CAMISAS ===
  prompt += `POLO SHIRT RULES (mandatory):
- Exactly 2 buttons on the placket — no more, no less
- The button placket (carcela), both inside and outside, must be the EXACT SAME color as the polo body
- Collar: PLAIN and CLEAN — no stripes, no patterns, no decorations
- Keep the realistic 3D shirt mockup style — photorealistic fabric texture

T-SHIRT RULES (mandatory):
- Collar: PLAIN and CLEAN — no stripes or patterns (unless V-neck was requested)
- Keep the realistic 3D shirt mockup style — photorealistic fabric texture

LOGO PLACEMENT RULES:
- On FRONT views: logo goes on the LEFT chest (from viewer's perspective)
- On BACK views: logo goes centered on the upper back
- Logos on sleeves: FRONT views only, never on back views
- Red placement circles/rectangles in template are guides — place logo inside them

FINAL CRITICAL REMINDER:
The template is the base image. Every single element OUTSIDE the shirt silhouettes must remain pixel-identical to the input. Only the shirt fabric, color and logo placement should change.`;

  return prompt;
}

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await request.formData();
    const logo = formData.get("logo") as File | null;
    const logo2 = formData.get("logo2") as File | null;
    const estampa = formData.get("estampa") as File | null;
    const cliente = (formData.get("cliente") as string) || "";
    const vendedor = (formData.get("vendedor") as string) || "";
    const tipoCores = (formData.get("tipoCores") as string) || "automatica";
    const cores: CoresDetalhadas = JSON.parse((formData.get("cores") as string) || "{}");
    const detalhes: Detalhes = JSON.parse((formData.get("detalhes") as string) || "{}");

    if (!cliente.trim()) return Response.json({ error: "Informe o nome do cliente." }, { status: 400 });

    // Verificar template
    const templatePath = path.join(process.cwd(), "public", "template.png");
    if (!fs.existsSync(templatePath)) {
      return Response.json({ error: "Template não encontrado. Salve o arquivo template.png na pasta public." }, { status: 500 });
    }

    // Analisar logo com GPT-4o vision
    let logoAnalysis = "";
    let logoBuffer: Buffer | null = null;
    let logo2Buffer: Buffer | null = null;
    let estampaBuffer: Buffer | null = null;

    if (logo && logo.size > 0) {
      logoBuffer = Buffer.from(await logo.arrayBuffer());
      const base64 = logoBuffer.toString("base64");
      const mime = logo.type || "image/png";
      const vision = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user", content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: "Analyze this company logo: 1) Main and secondary colors with names and hex codes, 2) Visual style, 3) Company sector/industry. Be concise." }
          ]
        }],
        max_tokens: 300,
      });
      logoAnalysis = vision.choices[0]?.message?.content ?? "";
    }

    if (logo2 && logo2.size > 0) logo2Buffer = Buffer.from(await logo2.arrayBuffer());
    if (estampa && estampa.size > 0) estampaBuffer = Buffer.from(await estampa.arrayBuffer());

    // Montar prompt
    const editPrompt = buildPrompt({
      cliente, vendedor, tipoCores, cores, detalhes, logoAnalysis,
      temLogo: !!logoBuffer, temLogo2: !!logo2Buffer, temEstampa: !!estampaBuffer,
    });

    // Carregar template original
    const rawTemplate = fs.readFileSync(templatePath);
    const templateMeta = await sharp(rawTemplate).metadata();
    const tW = templateMeta.width ?? 900;
    const tH = templateMeta.height ?? 1600;

    // ─── MÁSCARA ────────────────────────────────────────────────────────────────
    // Regra: alpha=0 (transparente) = IA pode editar | alpha=255 (opaco) = preservar
    // Zonas editáveis = apenas as camisas dentro de cada seção.
    // Tudo fora (header, ícones, rodapé, bordas douradas) fica PRETO = preservado.
    //
    // Posições aproximadas no template 900×1600:
    //   Polo shirts:     y 330–730, x 120–880
    //   Camiseta shirts: y 820–1270, x 120–880
    // ────────────────────────────────────────────────────────────────────────────
    const scaleX = tW / 900;
    const scaleY = tH / 1600;
    const rx = (v: number) => Math.round(v * scaleX);
    const ry = (v: number) => Math.round(v * scaleY);

    // SVG da máscara: fundo preto (preservar tudo), retângulos brancos nas áreas das camisas
    const maskSvg = `<svg width="${tW}" height="${tH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${tW}" height="${tH}" fill="black"/>
      <rect x="${rx(120)}" y="${ry(330)}" width="${rx(760)}" height="${ry(400)}" fill="white"/>
      <rect x="${rx(120)}" y="${ry(820)}" width="${rx(760)}" height="${ry(450)}" fill="white"/>
    </svg>`;

    // Converter SVG para PNG RGBA (branco=alpha 255, preto=alpha 255)
    // Depois inverter: branco → alpha 0 (editável), preto → alpha 255 (preservar)
    const maskRgb = await sharp(Buffer.from(maskSvg)).png().toBuffer();
    // Extrair canal R como máscara de alpha e inverter (branco→0, preto→255)
    const maskAlpha = await sharp(maskRgb)
      .extractChannel("red")
      .negate()   // inverte: branco(255)→0, preto(0)→255
      .toBuffer();
    // Montar imagem RGBA: pixels pretos com alpha variável
    const maskFinal = await sharp({
      create: { width: tW, height: tH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .joinChannel(maskAlpha)
      .png()
      .toBuffer();

    // ─── IMAGENS PARA O EDIT ────────────────────────────────────────────────────
    const images: Parameters<typeof toFile>[0][] = [rawTemplate];
    const names = ["template.png"];
    const types = ["image/png"];

    if (logoBuffer) { images.push(logoBuffer); names.push("logo.png"); types.push(logo?.type || "image/png"); }
    if (logo2Buffer) { images.push(logo2Buffer); names.push("logo2.png"); types.push(logo2?.type || "image/png"); }
    if (estampaBuffer) { images.push(estampaBuffer); names.push("estampa.png"); types.push(estampa?.type || "image/png"); }

    const imageFiles = await Promise.all(images.map((buf, i) => toFile(buf as Buffer, names[i], { type: types[i] })));
    const maskFile = await toFile(maskFinal, "mask.png", { type: "image/png" });

    const imageInput = imageFiles.length === 1 ? imageFiles[0] : imageFiles;

    // Editar template com máscara (somente áreas das camisas são editáveis)
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageInput,
      mask: maskFile,
      prompt: editPrompt,
      n: 1,
      size: "auto",
      quality: "high",
    } as Parameters<typeof openai.images.edit>[0]) as { data?: Array<{ url?: string; b64_json?: string }> };

    const item = response.data?.[0];
    let imageBuffer2: Buffer | undefined;

    if (item?.b64_json) {
      imageBuffer2 = Buffer.from(item.b64_json, "base64");
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      imageBuffer2 = Buffer.from(await imgRes.arrayBuffer());
    }

    if (!imageBuffer2) return Response.json({ error: "Falha ao gerar imagem." }, { status: 500 });

    // Redimensionar a saída da API diretamente para 900x1600 sem cortes
    const upscaled = await sharp(imageBuffer2)
      .resize(900, 1600, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6, quality: 100 })
      .toBuffer();

    const url = `data:image/png;base64,${upscaled.toString("base64")}`;
    return Response.json({ url, prompt: editPrompt, logoAnalysis });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
