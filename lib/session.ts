import { SignJWT, jwtVerify } from "jose";

// Sessão por JWT assinado. Este módulo usa apenas `jose`, que funciona no
// runtime do middleware (edge). NÃO importe node:crypto aqui.

export interface Sessao {
  username: string;
  nome: string;
  papel: "designer" | "admin";
}

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-troque-isto");
}

export async function criarToken(s: Sessao): Promise<string> {
  return new SignJWT({ nome: s.nome, papel: s.papel })
    .setSubject(s.username)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verificarToken(token: string): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      username: String(payload.sub),
      nome: String(payload.nome),
      papel: payload.papel === "admin" ? "admin" : "designer",
    };
  } catch {
    return null;
  }
}
