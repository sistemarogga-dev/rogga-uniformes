import OpenAI from "openai";
import { exigirAcesso } from "@/lib/acesso";

export const dynamic = "force-dynamic";

// Conversa do gerador. O gpt-4o responde em texto OU decide gerar/editar uma arte
// (via tool call). A geração da imagem em si continua em /api/gerar.

interface MensagemChat {
  papel: "user" | "assistant";
  texto: string;
}

const SISTEMA = `Você é o assistente de criação da ROGGA UNIFORMES, dentro do Gerador de Artes. Converse em português do Brasil, de forma curta, simpática e objetiva.

O sistema gera PROPOSTAS DE UNIFORMES a partir de uma arte de referência fixa (9:16) com 4 quadros de produto: POLO PIQUET (frente e costas), CAMISETA (frente e costas), BAGA PERSONALIZADA (bag de cordão) e WINDBANNER. Em cada arte mudam SOMENTE os produtos (cores e logomarca do cliente no lugar de "LOGO AQUI") e as imagens de contexto atrás deles. Cabeçalho, etiquetas, bordas e rodapé são preservados automaticamente.

Você tem duas ferramentas:
- gerar_arte: cria uma arte NOVA a partir do template.
- editar_arte: altera a arte mais recente da conversa (ou a que o usuário marcou para editar).

Quando usar:
- O usuário pede uma arte/proposta/mockup (mesmo de forma vaga, ou só manda um logo pedindo para fazer) → gerar_arte. Não faça perguntas desnecessárias: se faltar detalhe, escolha cores automaticamente pela logomarca e pelo ramo.
- Já existe arte e o usuário pede uma mudança ("deixa a polo azul", "troca o fundo", "logo maior") → editar_arte.
- O usuário ANEXOU UMA PROPOSTA PRONTA da Rogga (o sistema avisa) e pede para refazer/ajustar/mudar algo nela ("refaça a arte do anexo", "somente na camiseta...", "acrescentar o instagram", "não mude a polo") → editar_arte. Essa proposta anexada é a arte a editar.
- Se ele pedir claramente uma arte do zero mesmo já existindo uma → gerar_arte.
- Dúvidas, conversa, ideias de cores/estampas, pedidos de sugestão → responda em texto, sem ferramenta.

Como escrever o "prompt" das ferramentas:
- gerar_arte: prompt DETALHADO em português, bem estruturado: cores de cada produto (polo, camiseta, bag e windbanner — combinação pela logomarca/ramo, com cores diferentes entre polo e camiseta para contraste), logo no peito esquerdo e centralizado nas costas das camisas e centralizado na bag e no windbanner, retirar o fundo dos logotipos anexados, e o cenário de fundo de cada quadro ligado ao ramo da empresa. Não repita regras gerais do template (botões da polo, preservar cabeçalho/rodapé).
- editar_arte: descreva SOMENTE a mudança pedida, de forma clara, e diga para manter todo o resto exatamente igual. Nunca invente mudanças de cor ou de logo que o usuário não pediu.
- editar_arte, campo "quadros": liste SOMENTE os quadros que a mudança afeta — "polo", "camiseta", "bag", "windbanner". Os outros quadros são copiados da arte atual sem nenhuma alteração. Ex: "troque o fundo do windbanner" → ["windbanner"]; "polo verde" → ["polo"]; "troque os fundos" ou "logo maior em tudo" → os 4; mudança na logo/cor da marca em todos os produtos → os 4. Na dúvida, inclua o quadro.
- Considere o histórico: pedidos anteriores continuam valendo, a não ser que o usuário mude.

O campo "mensagem" é o que aparece para o usuário no chat enquanto a arte é gerada: 1 frase curta (ex: "Beleza! Vou deixar a polo azul-marinho e manter o resto.").`;

const ferramentas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "gerar_arte",
      description: "Gera uma nova arte de proposta de uniformes a partir do template.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Prompt detalhado da arte." },
          mensagem: { type: "string", description: "Frase curta para o usuário." },
        },
        required: ["prompt", "mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_arte",
      description: "Aplica uma alteração na arte atual da conversa.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Somente a alteração pedida, mantendo o resto igual." },
          mensagem: { type: "string", description: "Frase curta para o usuário." },
          quadros: {
            type: "array",
            items: { type: "string", enum: ["polo", "camiseta", "bag", "windbanner"] },
            description: "Somente os quadros afetados pela mudança. Os outros ficam idênticos.",
          },
        },
        required: ["prompt", "mensagem", "quadros"],
      },
    },
  },
];

export async function POST(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { mensagens, temArte, anexos, propostaAnexada } = (await request.json()) as {
      mensagens: MensagemChat[];
      temArte: boolean;
      anexos: number;
      propostaAnexada?: boolean;
    };

    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return Response.json({ error: "Escreva uma mensagem." }, { status: 400 });
    }

    const contexto = [
      propostaAnexada
        ? "O usuário ANEXOU nesta mensagem uma PROPOSTA PRONTA da Rogga: é a arte a ser editada (use editar_arte para qualquer mudança nela)."
        : temArte ? "Já existe uma arte na conversa (pode ser editada)." : "Ainda não existe nenhuma arte na conversa.",
      anexos > 0
        ? `O usuário anexou ${anexos} imagem(ns) nesta mensagem (logos/estampas/referências) — elas serão enviadas junto para a geração.`
        : "Nenhuma imagem anexada nesta mensagem.",
    ].join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SISTEMA },
        ...mensagens.slice(-20).map((m) => ({ role: m.papel, content: m.texto || "(sem texto)" })),
        { role: "system", content: contexto },
      ],
      tools: ferramentas,
      max_tokens: 700,
    });

    const msg = completion.choices[0]?.message;
    const call = msg?.tool_calls?.find((c) => c.type === "function");

    if (call && call.type === "function") {
      const args = JSON.parse(call.function.arguments || "{}") as { prompt?: string; mensagem?: string; quadros?: string[] };
      const modo = call.function.name === "editar_arte" && temArte ? "editar" : "nova";
      const validos = ["polo", "camiseta", "bag", "windbanner"];
      const quadros = (args.quadros || []).filter((q) => validos.includes(q));
      return Response.json({
        tipo: "arte",
        modo,
        quadros: modo === "editar" && quadros.length ? quadros : validos,
        prompt: args.prompt || mensagens[mensagens.length - 1].texto,
        texto: args.mensagem || (modo === "editar" ? "Aplicando a alteração..." : "Criando a arte..."),
      });
    }

    return Response.json({ tipo: "texto", texto: msg?.content?.trim() || "Não entendi, pode repetir?" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return Response.json({ error: message }, { status: 500 });
  }
}
