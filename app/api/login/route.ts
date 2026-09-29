import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { verificarSenha } from "@/lib/senha";
import { criarToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { username, senha } = await request.json();
    if (!username || !senha) {
      return Response.json({ error: "Informe usuário e senha." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("designers")
      .select("username, nome, senha_hash, papel")
      .eq("username", String(username).toLowerCase().trim())
      .single();

    if (error || !data || !verificarSenha(senha, data.senha_hash)) {
      return Response.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    const token = await criarToken({ username: data.username, nome: data.nome, papel: data.papel });
    const c = await cookies();
    c.set("sessao", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return Response.json({ ok: true, nome: data.nome, papel: data.papel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao entrar.";
    return Response.json({ error: message }, { status: 500 });
  }
}
