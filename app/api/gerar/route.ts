import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { prompt, tipo } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return Response.json({ error: "Descrição inválida." }, { status: 400 });
    }

    const prefixos: Record<string, string> = {
      uniforme: "Mockup fotorrealista de uniforme esportivo/profissional. Alta qualidade, fundo branco limpo.",
      logo: "Logo profissional vetorial clean, adequado para bordado ou estampa em uniforme.",
      estampa: "Estampa/design para uniforme, arte gráfica profissional, adequada para serigrafia ou bordado.",
      catalogo: "Foto de catálogo profissional de uniforme, iluminação de estúdio, fundo branco, alta definição.",
    };

    const prefixo = prefixos[tipo] ?? prefixos.uniforme;
    const promptFinal = `${prefixo} ${prompt}. Estilo: profissional, empresarial, ROGGA UNIFORMES.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: promptFinal,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const url = response.data?.[0]?.url;
    if (!url) {
      return Response.json({ error: "Falha ao gerar imagem." }, { status: 500 });
    }

    return Response.json({ url, prompt: promptFinal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
