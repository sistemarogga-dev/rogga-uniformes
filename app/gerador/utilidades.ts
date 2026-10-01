// Funções auxiliares da tela do gerador (sem estado do React).
import type { Mensagem } from "./historico";

// Miniatura das imagens anexadas (logos, prints) para guardar na conversa: o original
// pode ter vários MB e a conversa inteira precisa caber no limite de envio da Vercel.
const miniaturasCache = new Map<string, string>();
export async function miniatura(src: string, lado = 320): Promise<string> {
  if (!src.startsWith("data:") || src.length < 60_000) return src;
  const chave = `${lado}:${src}`;
  const pronta = miniaturasCache.get(chave);
  if (pronta) return pronta;
  try {
    const img = new window.Image();
    await new Promise<void>((ok, falha) => { img.onload = () => ok(); img.onerror = () => falha(); img.src = src; });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const mini = canvas.toDataURL("image/webp", 0.85); // webp mantém a transparência dos logos
    miniaturasCache.set(chave, mini);
    return mini;
  } catch {
    return src;
  }
}
export async function mensagensLeves(msgs: Mensagem[]): Promise<Mensagem[]> {
  return Promise.all(msgs.map(async (m) => ({
    ...m,
    ...(m.anexos?.length ? { anexos: await Promise.all(m.anexos.map((a) => miniatura(a))) } : {}),
    // versão "antes" de uma edição feita sobre uma proposta anexada (vira imagem menor)
    ...(m.arte?.antes?.startsWith("data:") ? { arte: { ...m.arte, antes: await miniatura(m.arte.antes, 720) } } : {}),
  })));
}

// ─── Reconhecer uma proposta da Rogga anexada ────────────────────────────────
// Os designers costumam baixar a arte e anexar de volta pedindo mudanças. Toda proposta
// tem o cabeçalho e o rodapé idênticos aos da arte de referência, então comparamos só
// essas faixas (em tamanho reduzido): se baterem, o anexo é a arte a ser EDITADA.
let faixasReferencia: Promise<Uint8ClampedArray> | null = null;
const PEQ_W = 90, PEQ_H = 160;
function faixasDe(img: CanvasImageSource): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = PEQ_W; canvas.height = PEQ_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, PEQ_W, PEQ_H);
  const topo = ctx.getImageData(0, 0, PEQ_W, 24).data;           // cabeçalho (0–15%)
  const rodape = ctx.getImageData(0, 142, PEQ_W, 18).data;       // rodapé (89–100%)
  const junto = new Uint8ClampedArray(topo.length + rodape.length);
  junto.set(topo); junto.set(rodape, topo.length);
  return junto;
}
const carregarImagem = (src: string) =>
  new Promise<HTMLImageElement>((ok, falha) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });

export async function ehPropostaRogga(src: string): Promise<boolean> {
  try {
    const img = await carregarImagem(src);
    const proporcao = img.naturalWidth / img.naturalHeight;
    if (Math.abs(proporcao - 9 / 16) > 0.03) return false; // precisa ser vertical 9:16
    faixasReferencia ??= carregarImagem("/template.png").then(faixasDe);
    const ref = await faixasReferencia, atual = faixasDe(img);
    let soma = 0, n = 0;
    for (let i = 0; i < ref.length; i += 4) {
      soma += Math.abs(ref[i] - atual[i]) + Math.abs(ref[i + 1] - atual[i + 1]) + Math.abs(ref[i + 2] - atual[i + 2]);
      n += 3;
    }
    return soma / n < 18; // cabeçalho e rodapé praticamente iguais
  } catch {
    return false;
  }
}

// Dólar usado para mostrar o custo de cada arte em reais: média de set/2026 (R$ 5,13)
// + IOF de 3,5% do cartão internacional. Atualize se o dólar mudar muito.
export const COTACAO_DOLAR = 5.31;
export const emReais = (usd: number) =>
  (usd * COTACAO_DOLAR).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 3 });

export const segundos = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
};

export interface ImagemEnviada {
  id: string;
  file: File;
  preview: string;
}

export const novoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const lerPreview = (f: File) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target?.result as string);
    r.readAsDataURL(f);
  });
