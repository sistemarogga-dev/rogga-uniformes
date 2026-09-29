import sharp from "sharp";
import { exigirAcesso } from "@/lib/acesso";
import { caminhoValido, excluirArteNuvem, listarArtesNuvem, salvarArteNuvem } from "@/lib/artes";

export const dynamic = "force-dynamic";

// GET: histórico compartilhado (todas as artes da equipe, mais recentes primeiro)
export async function GET() {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  try {
    return Response.json({ artes: await listarArtesNuvem() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST (form: imagem, logomarca, vendedor, timestamp): envia uma arte que só estava
// salva no navegador (histórico antigo) para o histórico compartilhado.
export async function POST(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  try {
    const fd = await request.formData();
    const arquivo = fd.get("imagem") as File | null;
    const timestamp = Number(fd.get("timestamp")) || Date.now();
    if (!arquivo || !arquivo.size) return Response.json({ error: "Imagem ausente." }, { status: 400 });
    const jpeg = await sharp(Buffer.from(await arquivo.arrayBuffer())).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    const arte = await salvarArteNuvem(jpeg, {
      timestamp,
      logomarca: String(fd.get("logomarca") || "Logomarca"),
      vendedor: String(fd.get("vendedor") || ""),
    });
    return Response.json({ arte });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE ?p=<caminho>: remove uma arte do histórico compartilhado
export async function DELETE(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const caminho = new URL(request.url).searchParams.get("p") || "";
  if (!caminhoValido(caminho)) return Response.json({ error: "Arte inválida." }, { status: 400 });
  try {
    await excluirArteNuvem(caminho);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
