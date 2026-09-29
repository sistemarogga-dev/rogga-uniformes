import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const c = await cookies();
  c.delete("sessao");
  return Response.json({ ok: true });
}
