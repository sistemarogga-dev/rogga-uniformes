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

Como escrever o "prompt" das ferramentas — SEMPRE EM INGLÊS, curto e objetivo (menos texto = menos custo). As regras gerais do template já vão automaticamente: não repita (posição das logos, botões da polo, cabeçalho/rodapé, enquadramento).
- gerar_arte: só o que é desta arte: client name and industry, the color of each product (polo, t-shirt, bag, windbanner — pela logomarca/ramo, polo e camiseta com cores diferentes) e the background scene of each panel. Inclua qualquer pedido específico do usuário. Ex: "Client: MW Instalações (HVAC). Polo navy, t-shirt light gray, bag navy, windbanner navy with light-blue stripes. Backgrounds: modern HVAC warehouse with AC units."
- editar_arte: SOMENTE a mudança pedida, em 1-2 frases em inglês. Nunca invente mudanças de cor ou de logo que o usuário não pediu. Ex: "Make the t-shirt (front and back) white."
- editar_arte, campo "quadros": liste SOMENTE os quadros que a mudança afeta — "polo", "camiseta", "bag", "windbanner". Os outros quadros são copiados da arte atual sem nenhuma alteração. Ex: "troque o fundo do windbanner" → ["windbanner"]; "polo verde" → ["polo"]; "troque os fundos" ou "logo maior em tudo" → os 4; mudança na logo/cor da marca em todos os produtos → os 4. Na dúvida, inclua o quadro.
- ANEXOS NUMERADOS: os anexos aparecem numerados para o usuário (anexo 1, anexo 2, anexo 3...). Quando ele disser onde vai cada um ("anexo 1: peito esquerdo", "anexo 2 no peito direito", "anexo 3 nas costas"), escreva no prompt EXATAMENTE essas referências em maiúsculas — "ANEXO 1", "ANEXO 2" — com o local e o produto de cada uma, sem trocar os números. Ex: "Polo: ANEXO 1 on the left chest, ANEXO 2 on the right chest. Keep the back logo and background." Se ele não disser o produto, aplique nas camisas (polo e camiseta) quando o local for de camisa (peito, manga, costas). Em editar_arte, inclua nos "quadros" todos os produtos que recebem algum anexo.
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
    const { mensagens, temArte, anexos, numerosAnexos, propostaAnexada, numeroProposta } = (await request.json()) as {
      mensagens: MensagemChat[];
      temArte: boolean;
      anexos: number;
      numerosAnexos?: number[];
      propostaAnexada?: boolean;
      numeroProposta?: number;
    };
    const numeros = Array.isArray(numerosAnexos) ? numerosAnexos.filter(Number.isInteger).slice(0, 16) : [];

    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return Response.json({ error: "Escreva uma mensagem." }, { status: 400 });
    }

    const contexto = [
      propostaAnexada
        ? `O usuário ANEXOU nesta mensagem uma PROPOSTA PRONTA da Rogga${numeroProposta ? ` (é o anexo ${numeroProposta})` : ""}: é a arte a ser editada (use editar_arte para qualquer mudança nela).`
        : temArte ? "Já existe uma arte na conversa (pode ser editada)." : "Ainda não existe nenhuma arte na conversa.",
      anexos > 0
        ? `O usuário anexou ${anexos} imagem(ns) nesta mensagem (logos/estampas/referências) — elas serão enviadas junto para a geração.${numeros.length ? ` Números desses anexos: ${numeros.map((n) => `anexo ${n}`).join(", ")}.` : ""}`
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
