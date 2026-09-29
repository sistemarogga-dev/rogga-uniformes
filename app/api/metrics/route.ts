import { sessaoAtual } from "@/lib/sessao-servidor";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const s = await sessaoAtual();
  if (!s) return Response.json({ error: "não autenticado" }, { status: 401 });

  try {
    const supabase = getSupabase();
    const url = new URL(request.url);
    const filtroDesigner = url.searchParams.get("designer");

    let q = supabase.from("geracoes").select("*").order("criado_em", { ascending: false });

    if (s.papel !== "admin") {
      // Designer só vê os próprios registros
      q = q.eq("designer_username", s.username);
    } else if (filtroDesigner && filtroDesigner !== "todos") {
      q = q.eq("designer_username", filtroDesigner);
    }

    const { data, error } = await q.limit(5000);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    let designers: Array<{ username: string; nome: string; papel: string }> = [];
    if (s.papel === "admin") {
      const { data: ds } = await supabase
        .from("designers")
        .select("username, nome, papel")
        .order("nome");
      designers = ds || [];
    }

    return Response.json({ registros: data || [], usuario: s, designers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar métricas.";
    return Response.json({ error: message }, { status: 500 });
  }
}
