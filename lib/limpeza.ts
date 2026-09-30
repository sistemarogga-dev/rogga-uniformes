import { del, list } from "@vercel/blob";
import { arteDoCaminho } from "@/lib/artes";

// Limpeza diária do armazenamento, com UMA listagem de tudo (listar conta nas 2.000
// operações mensais do plano gratuito da Vercel; apagar não conta).
// Apaga o que tem mais de `dias` dias:
// - artes (pelo horário no nome) e as miniaturas gravadas antigamente (não são mais usadas);
// - logos originais que nenhuma arte restante usa;
// - conversas sem atividade (data do último salvamento).
export async function limparAntigos(dias: number) {
  const limite = Date.now() - dias * 86_400_000;

  const blobs: Array<{ pathname: string; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const r = await list({ cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);

  const artes = blobs.map((b) => arteDoCaminho(b.pathname)).filter((a) => a !== null);
  const velhas = artes.filter((a) => a.timestamp < limite);
  const logosEmUso = new Set(artes.filter((a) => a.timestamp >= limite).flatMap((a) => a.logos));

  const miniaturas = blobs.filter((b) => b.pathname.startsWith("miniaturas/")).map((b) => b.pathname);
  const logos = blobs
    .filter((b) => b.pathname.startsWith("logos/") && b.uploadedAt.getTime() < limite
      && !logosEmUso.has(b.pathname.replace(/^logos\/|\.png$/g, "")))
    .map((b) => b.pathname);
  const conversas = blobs
    .filter((b) => b.pathname.startsWith("conversas/") && b.uploadedAt.getTime() < limite)
    .map((b) => b.pathname);

  const apagar = [...velhas.map((a) => a.caminho), ...miniaturas, ...logos, ...conversas];
  for (let i = 0; i < apagar.length; i += 500) await del(apagar.slice(i, i + 500));
  return { artes: velhas.length, miniaturas: miniaturas.length, logos: logos.length, conversas: conversas.length };
}
