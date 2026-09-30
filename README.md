# Gerador de Artes — Rogga Uniformes

App interno em que os designers conversam com uma IA (estilo ChatGPT) para criar e editar
propostas de uniformes a partir de uma arte de referência fixa.

- Produção: https://rogga-uniformes-15s9.vercel.app/gerador (pede a senha da equipe)
- Publicação: todo `push` na branch `main` do GitHub publica sozinho na Vercel.

## Como funciona

1. O designer escreve o pedido e anexa o logo (ou cola um print).
2. `/api/chat` (gpt-4.1-mini) conversa e decide: responder, **criar** uma arte nova ou
   **editar** uma arte existente (e quais quadros a edição afeta).
3. `/api/gerar` gera a imagem com `gpt-image-2` (cai para `gpt-image-1.5` se precisar),
   na qualidade escolhida ao lado do botão de enviar (**Low**, padrão, ou **Medium**) e sem prévias (economia). A IA gera só um **recorte** — a área
   dos quadros (864x1152) na criação, ou só os quadros citados na edição — e ele é recolado
   sobre a arte de referência (`public/template.png`). Cabeçalho, etiquetas, bordas e
   rodapé nunca mudam. O consumo de tokens de cada geração aparece no log (`[gerar] ... uso:`).
   - **Criação:** usa as regras rígidas (Configurações).
   - **Edição:** usa as regras de edição (Configurações) + cores medidas na arte atual,
     reenvia o logo original e só refaz os quadros citados; os outros saem pixel a pixel.
4. A arte volta para a conversa e fica **só no navegador** do designer (IndexedDB), junto com os logos
   originais reduzidos, que são reenviados nas edições. Nada é gravado na nuvem.

## Onde fica cada coisa

| Caminho | O quê |
|---|---|
| `app/gerador/page.tsx` | Tela principal (chat, barra lateral de Conversas, seletor Low/Medium) |
| `app/gerador/componentes/` | Tela de senha, Configurações, Comparar e Tela cheia |
| `app/gerador/regras.ts` | Textos padrão das regras rígidas e das regras de edição |
| `app/gerador/utilidades.ts` | Funções auxiliares da tela |
| `app/gerador/historico.ts` | Tipos e conversas salvas no navegador (IndexedDB) |
| `app/api/chat` | Conversa e decisão (criar / editar / responder) |
| `app/api/gerar` | Geração da imagem, máscara dos quadros, medição de cores |
| `app/api/artes/imagem` | Abre artes antigas que ficaram no histórico da nuvem |
| `app/api/acesso` | Senha da equipe |
| `app/api/limpeza` | Limpeza diária (Vercel Cron, `vercel.json`) |
| `lib/` | Acesso/senha, leitura e limpeza do histórico antigo |

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `OPENAI_API_KEY` | Geração de imagens e chat |
| `TEAM_PASSWORD` | Senha da equipe (trocar desloga todo mundo) |
| `BLOB_READ_WRITE_TOKEN` | Histórico antigo na nuvem (só leitura e limpeza) |
| `CRON_SECRET` | Autoriza a limpeza diária |
| `IMAGE_MODEL` | (opcional) modelo de imagem; padrão `gpt-image-2` |
| `LIMITE_GERACOES_HORA` | (opcional) limite de gerações por hora; padrão 60 |

Para rodar localmente, copie as variáveis para `.env.local` e rode:

```bash
npm install
node node_modules/next/dist/bin/next dev --webpack
```

(Use `--webpack`: o Turbopack falha nesta pasta por causa do caminho.)

## Guarda dos dados

Artes, miniaturas, logos sem uso e conversas sem atividade são apagados após **7 dias**
pela limpeza diária (`app/api/limpeza`, todo dia às 06:00 UTC).
