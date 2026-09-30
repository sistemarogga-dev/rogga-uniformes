import { limparArtesAntigas } from "@/lib/artes";
import { limparConversasAntigas } from "@/lib/conversas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Por quantos dias as artes e as conversas ficam guardadas
const DIAS_GUARDADOS = 7;

// Limpeza diária, chamada pelo Cron da Vercel (vercel.json). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>"; sem esse segredo, ninguém de fora apaga nada.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const [artes, conversas] = await Promise.all([
      limparArtesAntigas(DIAS_GUARDADOS),
      limparConversasAntigas(DIAS_GUARDADOS),
    ]);
    console.log("[limpeza]", JSON.stringify({ ...artes, conversas }));
    return Response.json({ ok: true, apagados: { ...artes, conversas } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
