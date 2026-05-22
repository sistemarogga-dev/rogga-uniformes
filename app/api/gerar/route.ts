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
  let prompt = `You are editing a uniform proposal template image for ROGGA UNIFORMES. Client: "${cliente}".

ABSOLUTE RULE — PRESERVE EVERYTHING PIXEL-PERFECT, EXCEPT THE SHIRTS:
- The overall layout, proportions and dimensions must remain IDENTICAL
- The cream/white background color must remain unchanged
- The golden/yellow decorative borders and corner ornaments must remain unchanged
- The ROGGA UNIFORMES logo (top center, with the RG monogram in the blue circle) must remain unchanged
- The "PROPOSTA DE UNIFORMES" bold title must remain unchanged
- The "CONFORTO, QUALIDADE E PROFISSIONALISMO" subtitle must remain unchanged
- The golden horizontal divider line must remain unchanged
- The navy blue section header bars with text "CAMISA POLO" and "CAMISETA GOLA REDONDA" must remain unchanged
- The rounded rectangular frames/boxes containing each shirt section must remain unchanged
- The "FRENTE" and "VERSO" labels below each shirt must remain unchanged
- The feature icons column on the LEFT side of each shirt section (TECIDO PREMIUM, CONFORTO E RESPIRABILIDADE, DURABILIDADE E RESISTÊNCIA, CAIMENTO PERFEITO) must remain unchanged — do NOT remove or move them
- The bottom info bar with icons (ALTA QUALIDADE, PERSONALIZAÇÃO, PRAZO ÁGIL, ATENDIMENTO) must remain unchanged
- The dark navy footer bar with roggauniformes.com.br, @roggauniformes icons and the seller name area must remain unchanged
${vendedor ? `- Replace ONLY the seller name text in the footer with: "${vendedor}"` : "- Keep the seller name as it appears in the template"}

WHAT YOU MUST CHANGE — ONLY THE SHIRTS:
The shirts are the ONLY elements you should modify. Everything else stays exactly the same.\n\n`;

  // === CORES ===
  if (tipoCores === "automatica") {
    prompt += `SHIRT COLORS (automatic — extract from the provided client logo):\n`;
    prompt += `- Use the logo's main color as the primary shirt color and the secondary logo color as accent.\n`;
    if (detalhes.alternarCores) prompt += `- Polo shirt: primary color body/sleeves, secondary color collar/cuffs. T-shirt: swap — secondary color body, primary color accents.\n`;
    else prompt += `- Apply the same color scheme to both shirts.\n`;
    if (logoAnalysis) prompt += `Logo color analysis: ${logoAnalysis}\n`;
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
- Collar must be PLAIN and CLEAN — absolutely no stripes, patterns or decorations on the collar

T-SHIRT RULES (mandatory):
- Collar must be PLAIN and CLEAN — no stripes or patterns (unless V-neck was requested above)

FINAL REMINDER: The template frame, background, all text, all icons, all decorative elements outside the shirts must remain 100% identical to the input image. Only recolor/modify the shirts themselves.`;

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

    // Preparar imagens para o edit
    const templateBuf = fs.readFileSync(templatePath);
    const images: Parameters<typeof toFile>[0][] = [templateBuf];
    const names = ["template.png"];
    const types = ["image/png"];

    if (logoBuffer) { images.push(logoBuffer); names.push("logo.png"); types.push(logo?.type || "image/png"); }
    if (logo2Buffer) { images.push(logo2Buffer); names.push("logo2.png"); types.push(logo2?.type || "image/png"); }
    if (estampaBuffer) { images.push(estampaBuffer); names.push("estampa.png"); types.push(estampa?.type || "image/png"); }

    const imageFiles = await Promise.all(images.map((buf, i) => toFile(buf as Buffer, names[i], { type: types[i] })));

    const imageInput = imageFiles.length === 1 ? imageFiles[0] : imageFiles;

    // Editar template
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageInput,
      prompt: editPrompt,
      n: 1,
      size: "1024x1536",
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

    // Etapa 1: Redimensionar para exatamente 1080x1920 (mesmas dimensões do template)
    const resized = await sharp(imageBuffer2)
      .resize(1080, 1920, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .toBuffer();

    // Etapa 2: Upscale 2x → 2160x3840 para alta resolução
    const upscaled = await sharp(resized)
      .resize(2160, 3840, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6, quality: 100 })
      .toBuffer();

    const url = `data:image/png;base64,${upscaled.toString("base64")}`;
    return Response.json({ url, prompt: editPrompt, logoAnalysis });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
