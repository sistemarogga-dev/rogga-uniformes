// Funções auxiliares da tela do gerador (sem estado do React).
import type { Mensagem } from "./historico";

// Miniatura das imagens anexadas (logos, prints) para guardar na conversa: o original
// pode ter vários MB e a conversa inteira precisa caber no limite de envio da Vercel.
const miniaturasCache = new Map<string, string>();
export async function miniatura(src: string): Promise<string> {
  if (!src.startsWith("data:") || src.length < 60_000) return src;
  const pronta = miniaturasCache.get(src);
  if (pronta) return pronta;
  try {
    const img = new window.Image();
    await new Promise<void>((ok, falha) => { img.onload = () => ok(); img.onerror = () => falha(); img.src = src; });
    const escala = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const mini = canvas.toDataURL("image/webp", 0.85); // webp mantém a transparência dos logos
    miniaturasCache.set(src, mini);
    return mini;
  } catch {
    return src;
  }
}
export async function mensagensLeves(msgs: Mensagem[]): Promise<Mensagem[]> {
  return Promise.all(msgs.map(async (m) => (m.anexos?.length ? { ...m, anexos: await Promise.all(m.anexos.map(miniatura)) } : m)));
}

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
