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

  let prompt = `Edit this ROGGA UNIFORMES uniform proposal template. Size: 1080x1920 (9:16). Client: "${cliente}".\n\n`;

  // === CORES ===
  if (tipoCores === "automatica") {
    prompt += `COLORS: Automatic color combination based on the client logo analysis below. `;
    if (detalhes.alternarCores) prompt += `Alternate the main and secondary colors between the polo shirt and the t-shirt. `;
    if (logoAnalysis) prompt += `\nLogo analysis: ${logoAnalysis}`;
  } else {
    prompt += `COLORS - Detailed combination:\n`;
    prompt += `POLO:\n`;
    if (cores.poloTronco) prompt += `- Polo body and sleeves: ${cores.poloTronco}\n`;
    if (cores.poloGola) prompt += `- Polo collar and cuffs: ${cores.poloGola}\n`;
    prompt += `T-SHIRT:\n`;
    if (cores.camisetaTronco) prompt += `- T-shirt body: ${cores.camisetaTronco}\n`;
    if (cores.camisetaMangas) prompt += `- T-shirt sleeves: ${cores.camisetaMangas}\n`;
    else if (cores.camisetaTronco) prompt += `- T-shirt sleeves: same as body (${cores.camisetaTronco})\n`;
    if (cores.camisetaGola) prompt += `- T-shirt collar: ${cores.camisetaGola}\n`;
    if (cores.camisetaPunho) prompt += `- T-shirt cuff: ${cores.camisetaPunho}\n`;
  }
  prompt += `\n`;

  // === LOGOS ===
  prompt += `LOGO PLACEMENT:\n`;
  if (temLogo) {
    prompt += `- Remove background from the client logo (image provided).\n`;
    prompt += `- Place the client logo inside the red circle on the POLO FRONT chest (replacing "Logo" text).\n`;
    prompt += `- Place the full client logo inside the red rectangle on the POLO BACK (replacing "Logo" text).\n`;
    prompt += `- Place the client logo inside the red circle on the T-SHIRT FRONT chest (replacing "Logo" text).\n`;
    prompt += `- Place the full client logo inside the red rectangle on the T-SHIRT BACK (replacing "Logo" text).\n`;
  }

  // === DETALHES OPCIONAIS ===
  const detalhesList: string[] = [];

  if (detalhes.golaV) detalhesList.push("Make the t-shirt with a V-neck collar instead of round neck.");

  if (detalhes.mangaLonga) detalhesList.push("Make the t-shirt with long sleeves, with cuffs in the same color as the sleeves.");

  if (temEstampa && detalhes.usarEstampa) {
    let estampaTarget = "";
    if (detalhes.usarEstampa === "polo") estampaTarget = "the polo shirt";
    else if (detalhes.usarEstampa === "camiseta") estampaTarget = "the t-shirt";
    else estampaTarget = "both shirts";
    let estampaDesc = `Use the provided stamp/design image on ${estampaTarget}.`;
    if (detalhes.mudarCoresEstampa) estampaDesc += ` Change the stamp colors to: ${detalhes.mudarCoresEstampa}.`;
    detalhesList.push(estampaDesc);
  }

  if (temLogo2 && detalhes.usarLogo2) {
    let logo2Target = "";
    if (detalhes.usarLogo2 === "polo") logo2Target = "the polo shirt";
    else if (detalhes.usarLogo2 === "camiseta") logo2Target = "the t-shirt";
    else logo2Target = "both shirts";
    detalhesList.push(`Use the second provided logo on ${logo2Target}.`);
  }

  if (detalhes.punhoBarra) detalhesList.push(`Add a thin bar/stripe on the cuffs of: ${detalhes.punhoBarra}.`);

  if (detalhes.bandeiras) detalhesList.push(`Add flags on the arms (FRONT view sleeves only, not on back view): ${detalhes.bandeiras}.`);

  if (detalhes.logo2OutroPeito && temLogo2) detalhesList.push(`Add the second logo on the other chest (right side) on: ${detalhes.logo2OutroPeito}.`);

  if (detalhesList.length > 0) {
    prompt += `\nADDITIONAL DETAILS:\n`;
    detalhesList.forEach((d, i) => { prompt += `${i + 1}. ${d}\n`; });
  }

  // === VENDEDOR ===
  if (vendedor) prompt += `\nSELLER: Replace the seller name in the bottom bar with "${vendedor}".\n`;

  // === REGRAS FIXAS ===
  prompt += `
STRICT RULES - PRESERVE EXACTLY:
- ROGGA UNIFORMES logo and all branding at the top (do not modify)
- Template layout, structure, golden borders, cream/white background
- Section labels: CAMISA POLO, CAMISETA GOLA REDONDA, FRENTE, VERSO
- Feature icons on the left side of each section
- Bottom bar: roggauniformes.com.br, @roggauniformes (only update seller name)
- "PROPOSTA DE UNIFORMES" title and "CONFORTO, QUALIDADE E PROFISSIONALISMO" subtitle

POLO RULES:
- Exactly 2 buttons only
- Polo carcela (button placket, inside AND outside) must be the SAME color as the polo body
- Clean collar with NO stripes, NO patterns, NO decorations

T-SHIRT RULES:
- Clean collar with NO stripes, NO patterns, NO decorations (unless V-neck was requested)`;

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
