import OpenAI from "openai";

export const dynamic = "force-dynamic";

function buildPrompt(params: {
  cliente: string;
  vendedor: string;
  pecas: string[];
  cores: string;
  coresDetalhadas: string;
  detalhes: string[];
  observacoes: string;
  logoAnalysis: string;
}): string {
  const { cliente, vendedor, pecas, cores, coresDetalhadas, detalhes, observacoes, logoAnalysis } = params;

  const temPolo = pecas.includes("polo");
  const temMangaCurta = pecas.includes("manga-curta");
  const temMangaLonga = pecas.includes("manga-longa");
  const alternarCores = detalhes.includes("alternar-cores");
  const isotipoNoPeito = detalhes.includes("isotipo-peito");
  const logoNasCostas = detalhes.includes("logo-costas");
  const logoNasManga = detalhes.includes("logo-manga");
  const estampaBarriga = detalhes.includes("estampa-barriga");
  const estampaAbstrata = detalhes.includes("estampa-abstrata");

  let prompt = `Professional uniform mockup art for company "${cliente}", vertical format 9:16 (1080x1920px), white studio background. High quality product photography, perfect lighting.\n\n`;

  // Peças
  const pecasDesc: string[] = [];
  if (temPolo) pecasDesc.push("a polo shirt (exactly 2 buttons, clean collar with NO stripes or patterns, button placket carcela same color as shirt body on both inside and outside)");
  if (temMangaCurta) pecasDesc.push("a short sleeve t-shirt (clean collar with NO stripes or patterns)");
  if (temMangaLonga) pecasDesc.push("a long sleeve t-shirt with cuffs in the same color as the sleeves (clean collar with NO stripes or patterns)");

  prompt += `GARMENTS: Show ${pecasDesc.join(" AND ")}.\n\n`;

  // Cores
  if (cores === "automatica" && logoAnalysis) {
    prompt += `COLORS: Use colors extracted from the company logo analysis below. Choose professional color combinations based on the company's visual identity and industry sector. ${alternarCores ? "Alternate the main and secondary colors between the polo shirt and t-shirt." : "Use consistent colors across all garments."}\n`;
    prompt += `Logo analysis: ${logoAnalysis}\n\n`;
  } else if (cores === "detalhada" && coresDetalhadas) {
    prompt += `COLORS: ${coresDetalhadas}. ${alternarCores ? "Alternate colors between garments as described." : ""}\n\n`;
  } else {
    prompt += `COLORS: Choose professional colors that suit a corporate uniform. ${alternarCores ? "Alternate main and secondary colors between garments." : ""}\n\n`;
  }

  // Logo placement
  const logoInstructions: string[] = [];
  if (isotipoNoPeito) logoInstructions.push("Place the company isotipo/icon on the left chest of all garments");
  if (logoNasCostas) logoInstructions.push("Place the full logotype centered on the back of all garments");
  if (logoNasManga && (temMangaCurta || temMangaLonga)) logoInstructions.push("Place the full logotype on the sleeves vertically");
  if (logoInstructions.length > 0) {
    prompt += `LOGO PLACEMENT: ${logoInstructions.join(". ")}.\n\n`;
  } else {
    prompt += `LOGO PLACEMENT: Place the company logo on the left chest and centered on the back.\n\n`;
  }

  // Extras
  const extras: string[] = [];
  if (estampaBarriga) extras.push("Add a bold graphic design/print on the belly/front lower area of the t-shirt");
  if (estampaAbstrata) extras.push("Add an aggressive abstract pattern that complements the shirt colors");
  if (extras.length > 0) {
    prompt += `EXTRAS: ${extras.join(". ")}.\n\n`;
  }

  // Vendedor
  if (vendedor) {
    prompt += `SELLER: Show the seller name "${vendedor}" in a subtle, elegant way in the corner of the image.\n\n`;
  }

  // Observações
  if (observacoes) {
    prompt += `ADDITIONAL DETAILS: ${observacoes}\n\n`;
  }

  prompt += `IMPORTANT RULES:
- Keep the background completely unchanged
- Only modify/create the garments
- Polo shirt: exactly 2 buttons, NO collar stripes or patterns, carcela same color as body
- All collars must be clean and solid colored
- Professional, photorealistic style
- High resolution mockup quality`;

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

    if (pecas.length === 0) {
      return Response.json({ error: "Selecione pelo menos uma peça." }, { status: 400 });
    }

    // Analisar logo com GPT-4o vision
    let logoAnalysis = "";
    if (logo && logo.size > 0) {
      const bytes = await logo.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mimeType = logo.type || "image/png";

      const vision = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              {
                type: "text",
                text: "Analyze this company logo and describe: 1) Main and secondary colors with names and approximate hex codes, 2) Visual style (modern, classic, sporty, industrial, etc), 3) Company sector/industry if identifiable. Be concise and specific.",
              },
            ],
          },
        ],
        max_tokens: 300,
      });
      logoAnalysis = vision.choices[0]?.message?.content ?? "";
    }

    // Montar prompt
    const prompt = buildPrompt({ cliente, vendedor, pecas, cores, coresDetalhadas, detalhes, observacoes, logoAnalysis });

    // Gerar imagem
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "high",
    });

    const item = response.data?.[0];
    let url: string | undefined;
    if (item?.url) {
      url = item.url;
    } else if (item?.b64_json) {
      url = `data:image/png;base64,${item.b64_json}`;
    }

    if (!url) {
      return Response.json({ error: "Falha ao gerar imagem." }, { status: 500 });
    }

    return Response.json({ url, prompt, logoAnalysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
