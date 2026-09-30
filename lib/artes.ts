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
  await Promise.all([
    put(caminho, jpeg, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true }),
    salvarMiniatura(dados.timestamp, jpeg).catch(() => null), // se falhar, é criada ao abrir a galeria
  ]);
  return lerCaminho(caminho)!;
}

// ─── Miniaturas (galeria) ─────────────────────────────────────────────────────
// A galeria mostra uma versão pequena de cada arte (~20 KB em vez de ~330 KB).
// Fica em "miniaturas/<timestamp>.webp"; artes antigas ganham a sua na primeira vez
// que aparecem na galeria.

const caminhoMiniatura = (timestamp: number) => `miniaturas/${timestamp}.webp`;

async function salvarMiniatura(timestamp: number, arte: Buffer): Promise<Buffer> {
  const mini = await sharp(arte).resize(270, 480, { fit: "cover" }).webp({ quality: 72 }).toBuffer();
  await put(caminhoMiniatura(timestamp), mini, { access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: true });
  return mini;
}

/** Miniatura de uma arte; se ainda não existir, cria a partir da arte e guarda. */
export async function miniaturaDaArte(caminho: string): Promise<Buffer | null> {
  const arte = lerCaminho(caminho);
  if (!arte) return null;
  const r = await get(caminhoMiniatura(arte.timestamp), { access: "private" }).catch(() => null);
  if (r && r.statusCode === 200 && r.stream) return Buffer.from(await new Response(r.stream).arrayBuffer());
  const completa = await bufferDaArte(caminho).catch(() => null);
  return completa ? salvarMiniatura(arte.timestamp, completa) : null;
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
  const arte = lerCaminho(caminho);
  await del(arte ? [caminho, caminhoMiniatura(arte.timestamp)] : [caminho]);
}

// ─── Limpeza automática ──────────────────────────────────────────────────────

/**
 * Apaga as artes (e miniaturas) com mais de `dias` dias, e os logos originais que
 * nenhuma arte restante usa mais. Devolve quantos arquivos saíram de cada tipo.
 */
export async function limparArtesAntigas(dias: number) {
  const limite = Date.now() - dias * 86_400_000;
  const todas = await listarArtesNuvem();
  const velhas = todas.filter((a) => a.timestamp < limite);
  const ficam = todas.filter((a) => a.timestamp >= limite);
  const logosEmUso = new Set(ficam.flatMap((a) => a.logos));

  const listarTudo = async (prefix: string) => {
    const blobs: Array<{ pathname: string; uploadedAt: Date }> = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      blobs.push(...r.blobs);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return blobs;
  };
  const tsDasArtes = new Set(ficam.map((a) => a.timestamp));
  const miniaturasSoltas = (await listarTudo("miniaturas/"))
    .filter((b) => !tsDasArtes.has(Number(b.pathname.match(/^miniaturas\/(\d+)\.webp$/)?.[1])))
    .map((b) => b.pathname);
  const logosSoltos = (await listarTudo("logos/"))
    .filter((b) => b.uploadedAt.getTime() < limite && !logosEmUso.has(b.pathname.replace(/^logos\/|\.png$/g, "")))
    .map((b) => b.pathname);

  const apagar = [...velhas.map((a) => a.caminho), ...miniaturasSoltas, ...logosSoltos];
  for (let i = 0; i < apagar.length; i += 500) await del(apagar.slice(i, i + 500));
  return { artes: velhas.length, miniaturas: miniaturasSoltas.length, logos: logosSoltos.length };
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
