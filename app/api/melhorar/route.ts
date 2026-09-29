import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return Response.json({ error: "Escreva algo no prompt antes de gerar com a IA." }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em criar prompts para gerar artes de PROPOSTA DE UNIFORMES da ROGGA UNIFORMES.
O sistema já edita um template fixo (mockup) que tem: camisa polo (frente e costas) e camiseta gola redonda (frente e costas), cada uma dentro de um quadro com fundo.

Sua tarefa: reescrever o pedido do usuário em um PROMPT DETALHADO em português, claro e bem estruturado, para que a arte fique profissional. Especifique, quando fizer sentido:
- Cores das camisas (e a lógica: combinação automática pelo logo/ramo, ou cores específicas), com alternância de cor entre polo e camiseta para gerar contraste.
- Posicionamento do logo (peito esquerdo na frente, centralizado nas costas).
- Estampa da camiseta, se houver (estilo).
- Fundo cinematográfico de cada quadro ligado ao ramo da empresa (profundidade, luz dramática, premium).
- Nome do vendedor, se citado.

NÃO repita as regras gerais do template (botões da polo, preservar cabeçalho/rodapé etc.) — isso já está garantido. Foque só nas instruções desta arte.
Responda APENAS com o prompt reescrito, sem títulos nem explicações.`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    });

    const melhorado = completion.choices[0]?.message?.content?.trim() ?? prompt;
    return Response.json({ melhorado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
