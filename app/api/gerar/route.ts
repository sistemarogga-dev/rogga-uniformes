import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";

function buildEditPrompt(params: {
  cliente: string;
  vendedor: string;
  pecas: string[];
  cores: string;
  coresDetalhadas: string;
  detalhes: string[];
  observacoes: string;
  logoAnalysis: string;
  temLogo: boolean;
}): string {
  const { cliente, vendedor, cores, coresDetalhadas, detalhes, observacoes, logoAnalysis, temLogo } = params;

  const alternarCores = detalhes.includes("alternar-cores");
  const isotipoNoPeito = detalhes.includes("isotipo-peito");
  const logoNasCostas = detalhes.includes("logo-costas");
  const logoNasManga = detalhes.includes("logo-manga");
  const estampaBarriga = detalhes.includes("estampa-barriga");
  const estampaAbstrata = detalhes.includes("estampa-abstrata");

  let prompt = `Edit this ROGGA UNIFORMES uniform proposal template for client "${cliente}". Make ONLY the following changes and preserve everything else exactly:\n\n`;

  // Cores
  if (cores === "detalhada" && coresDetalhadas) {
    prompt += `1. SHIRT COLORS: ${coresDetalhadas}. `;
  } else if (logoAnalysis) {
    prompt += `1. SHIRT COLORS: Choose colors based on the client logo analysis: ${logoAnalysis}. `;
    if (alternarCores) {
      prompt += `Alternate the main and secondary colors between the polo shirt and the t-shirt. `;
    }
  } else {
    prompt += `1. SHIRT COLORS: Choose professional colors suitable for corporate uniforms. `;
  }
  prompt += `IMPORTANT: The polo shirt carcela (button placket, both inside and outside) must be exactly the same color as the polo shirt body. The polo must have exactly 2 buttons. No stripes or patterns on any collar.\n\n`;

  // Logo
  if (temLogo) {
    prompt += `2. LOGO PLACEMENT: Use the client logo provided as reference image.\n`;
    if (isotipoNoPeito) {
      prompt += `   - Place the logo isotipo/icon inside the red circle on the polo front chest (replacing "Logo" text)\n`;
      prompt += `   - Place the logo isotipo/icon inside the red circle on the t-shirt front chest (replacing "Logo" text)\n`;
    } else {
      prompt += `   - Place the client logo inside the red circle on the polo front chest (replacing "Logo" text)\n`;
      prompt += `   - Place the client logo inside the red circle on the t-shirt front chest (replacing "Logo" text)\n`;
    }
    if (logoNasCostas !== false) {
      prompt += `   - Place the full client logotype inside the red rectangle on the polo back (replacing "Logo" text)\n`;
      prompt += `   - Place the full client logotype inside the red rectangle on the t-shirt back (replacing "Logo" text)\n`;
    }
    if (logoNasManga) {
      prompt += `   - Place the client logo on the sleeves vertically\n`;
    }
  } else {
    prompt += `2. LOGO PLACEHOLDER: Keep the red circle and rectangle "Logo" placeholders as they are, but label them with "${cliente}".\n`;
  }
  prompt += `\n`;

  // Extras
  if (estampaBarriga) {
    prompt += `3. Add a bold graphic print on the belly/lower front area of the t-shirt.\n`;
  }
  if (estampaAbstrata) {
    prompt += `${estampaBarriga ? "4" : "3"}. Add an aggressive abstract pattern that complements the shirt colors.\n`;
  }

  // Vendedor
  if (vendedor) {
    prompt += `\nSELLER NAME: Replace the seller name in the bottom bar with "${vendedor}".\n`;
  }

  // Observações
  if (observacoes) {
    prompt += `\nADDITIONAL DETAILS: ${observacoes}\n`;
  }

  prompt += `
STRICT RULES - DO NOT CHANGE:
- ROGGA UNIFORMES logo and branding at the top
- The overall template layout and structure
- The golden decorative borders and background
- The section labels (CAMISA POLO, CAMISETA GOLA REDONDA, FRENTE, VERSO)
- The feature icons on the left (Tecido Premium, Conforto, Durabilidade, Caimento)
- The bottom bar with website and instagram info
- The "PROPOSTA DE UNIFORMES" title and subtitle
- Polo shirt must have exactly 2 buttons, clean collar with NO stripes or patterns
- T-shirt must have a clean round collar with NO stripes or patterns
- The carcela of the polo (inside and outside) must be the same color as the polo body`;

  return prompt;
}

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await request.formData();
    const logo = formData.get("logo") as File | null;
    const cliente = (formData.get("cliente") as string) || "";
    const vendedor = (formData.get("vendedor") as string) || "";
    const pecas = formData.getAll("pecas") as string[];
    const cores = (formData.get("cores") as string) || "automatica";
    const coresDetalhadas = (formData.get("coresDetalhadas") as string) || "";
    const detalhes = formData.getAll("detalhes") as string[];
    const observacoes = (formData.get("observacoes") as string) || "";

    if (!cliente.trim()) {
      return Response.json({ error: "Informe o nome do cliente." }, { status: 400 });
    }

    // Verificar se o template existe
    const templatePath = path.join(process.cwd(), "public", "template.png");
    if (!fs.existsSync(templatePath)) {
      return Response.json({ error: "Template não encontrado. Salve o arquivo template.png na pasta public do projeto." }, { status: 500 });
    }

    // Analisar logo com GPT-4o vision
    let logoAnalysis = "";
    let logoBase64 = "";
    let logoMime = "";

    if (logo && logo.size > 0) {
      const bytes = await logo.arrayBuffer();
      logoBase64 = Buffer.from(bytes).toString("base64");
      logoMime = logo.type || "image/png";

      const vision = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${logoMime};base64,${logoBase64}` } },
              {
                type: "text",
                text: "Analyze this company logo: 1) Main and secondary colors with names and hex codes, 2) Visual style (modern, classic, sporty, industrial, etc), 3) Company sector/industry if identifiable. Be concise.",
              },
            ],
          },
        ],
        max_tokens: 300,
      });
      logoAnalysis = vision.choices[0]?.message?.content ?? "";
    }

    // Montar prompt
    const editPrompt = buildEditPrompt({
      cliente, vendedor, pecas, cores, coresDetalhadas,
      detalhes, observacoes, logoAnalysis, temLogo: !!(logo && logo.size > 0),
    });

    // Preparar imagens para o edit
    const templateBuffer = fs.readFileSync(templatePath);
    const templateFile = await toFile(templateBuffer, "template.png", { type: "image/png" });

    let imageInput: Parameters<typeof openai.images.edit>[0]["image"];

    if (logo && logo.size > 0) {
      // Passa template + logo do cliente
      const logoBuffer = Buffer.from(logoBase64, "base64");
      const logoFile = await toFile(logoBuffer, "logo.png", { type: logoMime });
      imageInput = [templateFile, logoFile];
    } else {
      imageInput = templateFile;
    }

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
    let imageBuffer: Buffer | undefined;

    if (item?.b64_json) {
      imageBuffer = Buffer.from(item.b64_json, "base64");
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    if (!imageBuffer) {
      return Response.json({ error: "Falha ao gerar imagem." }, { status: 500 });
    }

    // Redimensionar para 1080x1920 (9:16)
    const resized = await sharp(imageBuffer)
      .resize(1080, 1920, { fit: "cover", position: "center" })
      .png()
      .toBuffer();

    const url = `data:image/png;base64,${resized.toString("base64")}`;

    return Response.json({ url, prompt: editPrompt, logoAnalysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
