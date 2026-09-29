// Histórico ANTIGO, que ficava só no navegador (IndexedDB). Hoje o histórico é
// compartilhado na nuvem (/api/artes); isto fica só para migrar as artes antigas
// de cada navegador para a nuvem uma única vez.

export interface ArteGerada {
  url: string;
  prompt: string;
  logomarca: string;
  vendedor: string;
  timestamp: number;
  caminho?: string; // arte salva no histórico compartilhado (pathname no Blob)
  tempoMs?: number; // quanto tempo a geração levou
}

const DB = "rogga-gerador";
const STORE = "artes";
const LIMITE = 300; // mantém só as mais recentes para não estourar a cota do navegador

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "timestamp" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transacao<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, modo).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Todas as artes, da mais recente para a mais antiga. */
export async function listarArtes(): Promise<ArteGerada[]> {
  try {
    const todas = await transacao<ArteGerada[]>("readonly", (s) => s.getAll());
    return todas.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return []; // navegador sem IndexedDB (ex: aba anônima restrita): segue sem histórico
  }
}

export async function salvarArte(arte: ArteGerada): Promise<void> {
  try {
    await transacao("readwrite", (s) => s.put(arte));
    const todas = await listarArtes();
    for (const velha of todas.slice(LIMITE)) await excluirArte(velha.timestamp);
  } catch {
    // se não conseguir salvar, a arte continua na conversa atual
  }
}

export async function excluirArte(timestamp: number): Promise<void> {
  try {
    await transacao("readwrite", (s) => s.delete(timestamp));
  } catch {
    // ignora
  }
}
