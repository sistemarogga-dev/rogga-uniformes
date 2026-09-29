import { sessaoAtual } from "@/lib/sessao-servidor";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await sessaoAtual();
  if (!s) return Response.json({ error: "não autenticado" }, { status: 401 });
  return Response.json(s);
}
