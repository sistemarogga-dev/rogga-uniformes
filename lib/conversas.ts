import { put, list, del, get } from "@vercel/blob";

// Conversas da equipe, no mesmo Vercel Blob PRIVADO das artes.
// Cada conversa é um JSON em "conversas/<id>__<título em base64url>.json". O título
// fica no nome do arquivo e a data da última atividade é a data de envio do arquivo,
// então listar as conversas é uma chamada só, sem abrir cada JSON.

export interface ResumoConversa {
  id: string;
  titulo: string;
  criadaEm: number;
  atualizadaEm: number;
}

const PREFIXO = "conversas/";

export const idValido = (id: string) => /^\d{10,}-[a-z0-9]{1,12}$/.test(id);

function lerCaminho(caminho: string, enviadoEm: Date): ResumoConversa | null {
  const m = caminho.match(/^conversas\/(\d{10,}-[a-z0-9]{1,12})__([A-Za-z0-9_-]*)\.json$/);
  if (!m) return null;
  let titulo = "Conversa";
  try { titulo = Buffer.from(m[2], "base64url").toString("utf8") || titulo; } catch {}
  return { id: m[1], titulo, criadaEm: Number(m[1].split("-")[0]), atualizadaEm: enviadoEm.getTime() };
}

async function caminhosDa(id: string): Promise<string[]> {
  const r = await list({ prefix: `${PREFIXO}${id}__` });
  return r.blobs.map((b) => b.pathname);
}

export async function listarConversasNuvem(): Promise<ResumoConversa[]> {
  const todas: ResumoConversa[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: PREFIXO, cursor, limit: 1000 });
    for (const b of r.blobs) {
      const c = lerCaminho(b.pathname, b.uploadedAt);
      if (c) todas.push(c);
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return todas.sort((a, b) => b.atualizadaEm - a.atualizadaEm);
}

/** Conversa completa (com as mensagens), ou null se não existir. */
export async function lerConversaNuvem(id: string): Promise<{ id: string; titulo: string; mensagens: unknown[] } | null> {
  const [caminho] = await caminhosDa(id);
  if (!caminho) return null;
  // useCache:false — a conversa muda o tempo todo; nunca servir uma versão velha
  const r = await get(caminho, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

/** Salva (cria ou atualiza). Sem mensagens = só renomear. */
export async function salvarConversaNuvem(id: string, titulo: string, mensagens?: unknown[]): Promise<ResumoConversa | null> {
  const antigos = await caminhosDa(id);
  let msgs = mensagens;
  if (!msgs) {
    const atual = await lerConversaNuvem(id);
    if (!atual) return null;
    msgs = atual.mensagens;
  }
  const tituloLimpo = titulo.replace(/\s+/g, " ").trim().slice(0, 80) || "Conversa";
  const caminho = `${PREFIXO}${id}__${Buffer.from(tituloLimpo).toString("base64url")}.json`;
  await put(caminho, JSON.stringify({ id, titulo: tituloLimpo, mensagens: msgs }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  // Se o título mudou, apaga o arquivo com o nome antigo
  const velhos = antigos.filter((p) => p !== caminho);
  if (velhos.length) await del(velhos);
  return { id, titulo: tituloLimpo, criadaEm: Number(id.split("-")[0]), atualizadaEm: Date.now() };
}

export async function excluirConversaNuvem(id: string) {
  const caminhos = await caminhosDa(id);
  if (caminhos.length) await del(caminhos);
}
