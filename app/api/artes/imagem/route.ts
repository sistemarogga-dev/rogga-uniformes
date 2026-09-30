import { exigirAcesso } from "@/lib/acesso";
import { caminhoValido, lerArteNuvem, miniaturaDaArte } from "@/lib/artes";

export const dynamic = "force-dynamic";

// cada arte nunca muda (o caminho tem o horário), então o navegador pode guardar
const CACHE = "private, max-age=31536000, immutable";

// GET ?p=<caminho>          → a arte inteira
// GET ?p=<caminho>&mini=1   → a miniatura leve da galeria (criada na hora, se faltar)
// O Blob é privado, então as imagens só saem por aqui, para quem tem a senha da equipe.
export async function GET(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const url = new URL(request.url);
  const caminho = url.searchParams.get("p") || "";
  if (!caminhoValido(caminho)) return new Response("Arte inválida.", { status: 400 });

  if (url.searchParams.get("mini") === "1") {
    const mini = await miniaturaDaArte(caminho).catch(() => null);
    if (!mini) return new Response("Arte não encontrada.", { status: 404 });
    return new Response(new Uint8Array(mini), { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
  }

  const r = await lerArteNuvem(caminho).catch(() => null);
  if (!r || r.statusCode !== 200) return new Response("Arte não encontrada.", { status: 404 });
  return new Response(r.stream, {
    headers: { "Content-Type": r.blob.contentType || "image/jpeg", "Cache-Control": CACHE },
  });
}
