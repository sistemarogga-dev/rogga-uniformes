import { get } from "@vercel/blob";
import sharp from "sharp";

// Histórico ANTIGO das artes, no Vercel Blob PRIVADO (store "rogga-artes").
// O app NÃO grava mais artes nem logos na nuvem (as artes ficam nas conversas, no
// navegador). Isto só serve para abrir artes antigas das conversas e para a limpeza.
// Cada arte é um JPEG em "artes/<timestamp>__<meta>.jpg", onde <meta> é um JSON curto
// em base64url: l = marca, v = vendedor, g = logos originais (ids em "logos/"),
// a = timestamp da arte anterior (quando é uma edição). Assim listar o histórico é
// uma chamada só, sem abrir um arquivo de dados por arte.
// Os arquivos ORIGINAIS de logo anexados pelo designer ficam em "logos/<id>.png" e são
// reenviados em toda edição, para a IA copiar a logo do arquivo e não da arte reduzida.

export interface ArteSalva {
  timestamp: number;
  logomarca: string;
  vendedor: string;
  caminho: string; // pathname no Blob
  url: string;     // URL servida pelo próprio site (o Blob é privado)
  logos: string[]; // ids dos arquivos de logo originais
  anterior?: number; // timestamp da arte que foi editada para gerar esta
}


const urlDa = (caminho: string) => `/api/artes/imagem?p=${encodeURIComponent(caminho)}`;

function lerCaminho(caminho: string): ArteSalva | null {
  const m = caminho.match(/^artes\/(\d+)__([A-Za-z0-9_-]*)\.jpg$/);
  if (!m) return null;
  let meta: { l?: string; v?: string; g?: string[]; a?: number } = {};
  try { meta = JSON.parse(Buffer.from(m[2], "base64url").toString("utf8")); } catch {}
  return {
    timestamp: Number(m[1]), logomarca: meta.l || "Logomarca", vendedor: meta.v || "", caminho, url: urlDa(caminho),
    logos: Array.isArray(meta.g) ? meta.g.filter(logoIdValido) : [],
    ...(meta.a ? { anterior: Number(meta.a) } : {}),
  };
}

export const caminhoValido = (caminho: string) => lerCaminho(caminho) !== null;

// ─── Miniaturas (galeria) ─────────────────────────────────────────────────────
// A galeria mostra uma versão pequena de cada arte (~20 KB em vez de ~340 KB). Ela é
// gerada na hora a partir da arte e NÃO é gravada: gravar custaria 1 das 2.000
// operações mensais do plano gratuito da Vercel. Ler não conta como essa operação,
// e o navegador guarda a miniatura, então cada designer só a baixa uma vez.

/** Miniatura WebP de uma arte do histórico. */
export async function miniaturaDaArte(caminho: string): Promise<Buffer | null> {
  if (!lerCaminho(caminho)) return null;
  const completa = await bufferDaArte(caminho).catch(() => null);
  return completa ? sharp(completa).resize(270, 480, { fit: "cover" }).webp({ quality: 72 }).toBuffer() : null;
}

export async function lerArteNuvem(caminho: string) {
  return get(caminho, { access: "private" });
}

/** Lê a arte inteira como Buffer (usado para editar uma arte do histórico). */
export async function bufferDaArte(caminho: string): Promise<Buffer | null> {
  const r = await get(caminho, { access: "private" });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

/** Dados de uma arte a partir do caminho (usado pela limpeza). */
export const arteDoCaminho = lerCaminho;

// ─── Logos originais ─────────────────────────────────────────────────────────

export const logoIdValido = (id: unknown): id is string => typeof id === "string" && /^\d{10,}-\d{1,2}$/.test(id);
