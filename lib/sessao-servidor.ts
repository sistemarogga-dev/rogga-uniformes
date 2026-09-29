import { cookies } from "next/headers";
import { verificarToken, type Sessao } from "@/lib/session";

// Lê a sessão atual a partir do cookie (para route handlers).
export async function sessaoAtual(): Promise<Sessao | null> {
  const c = await cookies();
  const token = c.get("sessao")?.value;
  if (!token) return null;
  return verificarToken(token);
}
