import { exigirAcesso } from "@/lib/acesso";
import { caminhoValido, lerArteNuvem } from "@/lib/artes";

export const dynamic = "force-dynamic";

// GET ?p=<caminho>: entrega a imagem de uma arte. O Blob é privado, então as imagens
// só saem por aqui, para quem tem a senha da equipe.
export async function GET(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const caminho = new URL(request.url).searchParams.get("p") || "";
  if (!caminhoValido(caminho)) return new Response("Arte inválida.", { status: 400 });
  const r = await lerArteNuvem(caminho).catch(() => null);
  if (!r || r.statusCode !== 200) return new Response("Arte não encontrada.", { status: 404 });
  return new Response(r.stream, {
    headers: {
      "Content-Type": r.blob.contentType || "image/jpeg",
      // cada arte nunca muda (o caminho tem o horário), então o navegador pode guardar
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
