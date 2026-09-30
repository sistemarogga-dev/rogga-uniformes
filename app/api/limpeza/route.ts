import { limparAntigos } from "@/lib/limpeza";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Por quantos dias as artes ficam guardadas (e as conversas antigas que ficaram na nuvem)
const DIAS_GUARDADOS = 7;

// Limpeza diária, chamada pelo Cron da Vercel (vercel.json). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>"; sem esse segredo, ninguém de fora apaga nada.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const apagados = await limparAntigos(DIAS_GUARDADOS);
    console.log("[limpeza]", JSON.stringify(apagados));
    return Response.json({ ok: true, apagados });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
