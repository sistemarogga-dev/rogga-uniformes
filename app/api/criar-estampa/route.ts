import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return Response.json({ error: "Descreva a estampa que deseja criar." }, { status: 400 });
    }

    const enhancedPrompt = `Create a professional uniform stamp/design for sportswear or workwear. Style: clean vector art, suitable for screen printing or embroidery. Design: ${prompt}. Background: transparent or white. High quality, centered composition.`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    const item = response.data?.[0];
    if (!item) return Response.json({ error: "Falha ao gerar estampa." }, { status: 500 });

    let url: string;
    if (item.b64_json) {
      url = `data:image/png;base64,${item.b64_json}`;
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      url = `data:image/png;base64,${buf.toString("base64")}`;
    } else {
      return Response.json({ error: "Falha ao gerar estampa." }, { status: 500 });
    }

    return Response.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
