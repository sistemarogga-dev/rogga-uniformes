import crypto from "crypto";

// Hash de senha com scrypt (node:crypto). Use SOMENTE em route handlers (runtime Node),
// nunca no middleware (edge).

export function gerarHashSenha(senha: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salt, hash] = (hashArmazenado || "").split(":");
  if (!salt || !hash) return false;
  const derivado = crypto.scryptSync(senha, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(derivado, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
