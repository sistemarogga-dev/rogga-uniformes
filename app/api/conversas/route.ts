import { exigirAcesso } from "@/lib/acesso";
import {
  excluirConversaNuvem, idValido, lerConversaNuvem, listarConversasNuvem, salvarConversaNuvem,
} from "@/lib/conversas";

export const dynamic = "force-dynamic";

const erro = (e: unknown, status = 500) =>
  Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });

// GET            → lista das conversas da equipe (sem as mensagens)
// GET ?id=<id>   → conversa completa
export async function GET(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!id) return Response.json({ conversas: await listarConversasNuvem() });
    if (!idValido(id)) return erro("Conversa inválida.", 400);
    const c = await lerConversaNuvem(id);
    return c ? Response.json({ conversa: c }) : erro("Conversa não encontrada.", 404);
  } catch (e) {
    return erro(e);
  }
}

// PUT { id, titulo, mensagens? } → salva a conversa (sem mensagens = só renomear)
export async function PUT(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  try {
    const { id, titulo, mensagens } = (await request.json()) as { id?: string; titulo?: string; mensagens?: unknown[] };
    if (!id || !idValido(id)) return erro("Conversa inválida.", 400);
    if (mensagens !== undefined && !Array.isArray(mensagens)) return erro("Mensagens inválidas.", 400);
    const resumo = await salvarConversaNuvem(id, titulo || "Conversa", mensagens);
    return resumo ? Response.json({ conversa: resumo }) : erro("Conversa não encontrada.", 404);
  } catch (e) {
    return erro(e);
  }
}

// DELETE ?id=<id> → apaga a conversa para toda a equipe
export async function DELETE(request: Request) {
  const bloqueio = await exigirAcesso();
  if (bloqueio) return bloqueio;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!idValido(id)) return erro("Conversa inválida.", 400);
  try {
    await excluirConversaNuvem(id);
    return Response.json({ ok: true });
  } catch (e) {
    return erro(e);
  }
}
