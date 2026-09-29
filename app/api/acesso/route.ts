import { cookies } from "next/headers";
import { COOKIE_ACESSO, senhaConfigurada, senhaCorreta, temAcesso, valorCookie } from "@/lib/acesso";

export const dynamic = "force-dynamic";

// GET: o navegador já tem acesso?
export async function GET() {
  return Response.json({ ok: await temAcesso() });
}

// POST { senha }: confere a senha da equipe e grava o cookie (lembrado por ~1 ano).
export async function POST(request: Request) {
  if (!senhaConfigurada()) return Response.json({ ok: true });
  const { senha } = (await request.json().catch(() => ({}))) as { senha?: string };
  if (!senha || !senhaCorreta(senha)) {
    await new Promise((r) => setTimeout(r, 600)); // atrasa tentativas de adivinhar
    return Response.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
  }
  (await cookies()).set(COOKIE_ACESSO, valorCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true });
}
