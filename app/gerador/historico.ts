// Dados guardados no navegador (IndexedDB):
// - "conversas": as conversas de cada designer (como no ChatGPT). Ficam no navegador,
//   porque o app não tem login individual. As artes em si ficam na nuvem; a conversa
//   só guarda o endereço delas.
// - "artes": histórico ANTIGO de artes (antes da nuvem). Só serve para migrar as artes
//   antigas de cada navegador para a nuvem uma única vez.

export interface ArteGerada {
  url: string;
  prompt: string;
  logomarca: string;
  vendedor: string;
  timestamp: number;
  caminho?: string; // arte salva no histórico compartilhado (pathname no Blob)
  tempoMs?: number; // quanto tempo a geração levou
  logos?: string[]; // ids dos arquivos de logo originais (reenviados nas edições)
  anterior?: number; // timestamp da arte que foi editada para gerar esta
  antes?: string; // endereço da versão anterior (botão "Comparar")
}

export interface Mensagem {
  id: string;
  papel: "user" | "assistant";
  texto: string;
  anexos?: string[];
  arte?: ArteGerada;
  status?: "pensando" | "gerando" | "erro";
  previa?: string; // prévia da arte enquanto é gerada
  inicio?: number; // quando o pedido começou (cronômetro)
}

export interface Conversa {
  id: string;
  titulo: string;
  criadaEm: number;
  atualizadaEm: number;
  mensagens?: Mensagem[]; // só vem ao abrir a conversa (a lista traz só o resumo)
}

const DB = "rogga-gerador";
const ARTES = "artes";
const CONVERSAS = "conversas";
const LIMITE_CONVERSAS = 200; // mantém só as mais recentes

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARTES)) db.createObjectStore(ARTES, { keyPath: "timestamp" });
      if (!db.objectStoreNames.contains(CONVERSAS)) db.createObjectStore(CONVERSAS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transacao<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, modo).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Artes antigas (só migração) ─────────────────────────────────────────────

/** Todas as artes antigas deste navegador, da mais recente para a mais antiga. */
export async function listarArtes(): Promise<ArteGerada[]> {
  try {
    const todas = await transacao<ArteGerada[]>(ARTES, "readonly", (s) => s.getAll());
    return todas.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return []; // navegador sem IndexedDB (ex: aba anônima restrita)
  }
}

export async function excluirArte(timestamp: number): Promise<void> {
  try {
    await transacao(ARTES, "readwrite", (s) => s.delete(timestamp));
  } catch {
    // ignora
  }
}

// ─── Conversas ───────────────────────────────────────────────────────────────

/** Todas as conversas, da atualizada mais recentemente para a mais antiga. */
export async function listarConversas(): Promise<Conversa[]> {
  try {
    const todas = await transacao<Conversa[]>(CONVERSAS, "readonly", (s) => s.getAll());
    return todas.sort((a, b) => b.atualizadaEm - a.atualizadaEm);
  } catch {
    return [];
  }
}

export async function salvarConversa(c: Conversa): Promise<void> {
  try {
    await transacao(CONVERSAS, "readwrite", (s) => s.put(c));
    const todas = await listarConversas();
    for (const velha of todas.slice(LIMITE_CONVERSAS)) await excluirConversa(velha.id);
  } catch {
    // se não conseguir salvar, a conversa continua aberta na tela
  }
}

export async function excluirConversa(id: string): Promise<void> {
  try {
    await transacao(CONVERSAS, "readwrite", (s) => s.delete(id));
  } catch {
    // ignora
  }
}
