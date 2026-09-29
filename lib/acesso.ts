import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Senha única da equipe. O navegador guarda um cookie com um "carimbo" derivado da
// senha (nunca a senha em si). Trocar TEAM_PASSWORD na Vercel desloga todo mundo.
export const COOKIE_ACESSO = "rogga_acesso";

const carimbo = (senha: string) => createHmac("sha256", senha).update("rogga-acesso-v1").digest("hex");

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Sem TEAM_PASSWORD configurada o app fica aberto (útil só em desenvolvimento). */
export const senhaConfigurada = () => !!process.env.TEAM_PASSWORD;

export const senhaCorreta = (senha: string) =>
  senhaConfigurada() && iguais(senha, process.env.TEAM_PASSWORD as string);

export const valorCookie = () => carimbo(process.env.TEAM_PASSWORD as string);

export async function temAcesso(): Promise<boolean> {
  if (!senhaConfigurada()) return true;
  const c = (await cookies()).get(COOKIE_ACESSO)?.value;
  return !!c && iguais(c, valorCookie());
}

/** Use no começo de cada rota da API: devolve a resposta 401 ou null se liberado. */
export async function exigirAcesso(): Promise<Response | null> {
  return (await temAcesso())
    ? null
    : Response.json({ error: "Digite a senha da equipe para usar o gerador.", semAcesso: true }, { status: 401 });
}

// ─── Limite de gerações ─────────────────────────────────────────────────────────
// Proteção extra contra uso abusivo: no máximo LIMITE_HORA gerações por hora por IP.
// É por instância do servidor (sem banco de dados), então é uma trava de segurança,
// não uma contagem exata. O controle real de gasto é o limite no painel da OpenAI.
const LIMITE_HORA = Number(process.env.LIMITE_GERACOES_HORA || 60);
const usos = new Map<string, number[]>();

export function passouDoLimite(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const agora = Date.now();
  const recentes = (usos.get(ip) || []).filter((t) => agora - t < 3600_000);
  if (recentes.length >= LIMITE_HORA) {
    usos.set(ip, recentes);
    return true;
  }
  recentes.push(agora);
  usos.set(ip, recentes);
  return false;
}
