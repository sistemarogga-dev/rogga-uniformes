import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { prompt, tipo } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return Response.json({ error: "Descrição inválida." }, { status: 400 });
    }

    const context: Record<string, string> = {
      uniforme: "mockup de uniforme esportivo ou profissional",
      logo: "logotipo para bordado ou estampa em uniforme",
      estampa: "estampa ou design para uniforme",
      catalogo: "foto de catálogo de uniforme",
    };

    const tipoContext = context[tipo] ?? context.uniforme;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em design de uniformes e artes gráficas para a empresa ROGGA UNIFORMES.
Sua tarefa é melhorar descrições de imagens para gerar artes profissionais de alta qualidade.
Transforme a descrição do usuário em um prompt detalhado em inglês para geração de imagem (máximo 200 palavras).
Foque em: cores, materiais, estilo, detalhes visuais, composição.
Retorne APENAS o prompt melhorado, sem explicações.`,
        },
        {
          role: "user",
          content: `Tipo de arte: ${tipoContext}\nDescrição: ${prompt}`,
        },
      ],
      max_tokens: 300,
    });

    const melhorado = completion.choices[0]?.message?.content?.trim() ?? prompt;
    return Response.json({ melhorado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
