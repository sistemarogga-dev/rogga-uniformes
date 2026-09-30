import { put, list, del, get } from "@vercel/blob";
import sharp from "sharp";

// Histórico compartilhado das artes, no Vercel Blob PRIVADO (store "rogga-artes").
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

const PREFIXO = "artes/";

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

export async function salvarArteNuvem(
  jpeg: Buffer,
  dados: { timestamp: number; logomarca: string; vendedor: string; logos?: string[]; anterior?: number },
): Promise<ArteSalva> {
  const meta = Buffer.from(JSON.stringify({
    l: dados.logomarca.slice(0, 60),
    v: dados.vendedor.slice(0, 40),
    ...(dados.logos?.length ? { g: dados.logos.slice(0, 4) } : {}),
    ...(dados.anterior ? { a: dados.anterior } : {}),
  })).toString("base64url");
  const caminho = `${PREFIXO}${dados.timestamp}__${meta}.jpg`;
  await put(caminho, jpeg, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
  return lerCaminho(caminho)!;
}

export async function listarArtesNuvem(): Promise<ArteSalva[]> {
  const artes: ArteSalva[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: PREFIXO, cursor, limit: 1000 });
    for (const b of r.blobs) {
      const a = lerCaminho(b.pathname);
      if (a) artes.push(a);
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return artes.sort((a, b) => b.timestamp - a.timestamp);
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

export async function excluirArteNuvem(caminho: string) {
  await del(caminho);
}

// ─── Logos originais ─────────────────────────────────────────────────────────

export const logoIdValido = (id: unknown): id is string => typeof id === "string" && /^\d{10,}-\d{1,2}$/.test(id);

/** Guarda o arquivo original de uma logo (PNG, até 1024px) e devolve o id. */
export async function salvarLogoNuvem(imagem: Buffer, id: string): Promise<string> {
  const png = await sharp(imagem).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  await put(`logos/${id}.png`, png, { access: "private", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true });
  return id;
}

export async function bufferDoLogo(id: string): Promise<Buffer | null> {
  if (!logoIdValido(id)) return null;
  const r = await get(`logos/${id}.png`, { access: "private" }).catch(() => null);
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}
