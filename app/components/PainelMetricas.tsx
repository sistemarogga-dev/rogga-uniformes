"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Sparkles, BarChart3, Clock, Layers, Image as ImageIcon, Users } from "lucide-react";

interface Registro {
  id: number;
  designer_username: string;
  empresa: string | null;
  categoria: string | null;
  tempo_ms: number | null;
  criado_em: string;
}
interface Designer { username: string; nome: string; papel: string; }
interface Usuario { username: string; nome: string; papel: "designer" | "admin"; }

function contar<T extends string>(itens: T[]): Record<string, number> {
  return itens.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {} as Record<string, number>);
}

function BarList({ dados, cor = "#C8102E" }: { dados: [string, number][]; cor?: string }) {
  const max = Math.max(1, ...dados.map(([, v]) => v));
  if (!dados.length) return <p className="text-xs text-gray-600">Sem dados ainda.</p>;
  return (
    <div className="space-y-2">
      {dados.map(([label, v]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-28 truncate shrink-0" title={label}>{label}</span>
          <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
            <div className="h-4 rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: cor }} />
          </div>
          <span className="text-xs text-gray-300 w-8 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-[#C8102E]/10">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white leading-none">{valor}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function PainelMetricas({ permitirFiltro = false }: { permitirFiltro?: boolean }) {
  const router = useRouter();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const url = permitirFiltro && filtro !== "todos" ? `/api/metrics?designer=${filtro}` : "/api/metrics";
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) { router.push("/login"); return; }
    setRegistros(data.registros || []);
    setUsuario(data.usuario);
    setDesigners((data.designers || []).filter((d: Designer) => d.papel !== "admin"));
    setCarregando(false);
  }, [filtro, permitirFiltro, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const sair = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Filtro de datas (client-side)
  const inicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
  const fim = dataFim ? new Date(dataFim + "T23:59:59") : null;
  const registrosFiltrados = registros.filter((r) => {
    const d = new Date(r.criado_em);
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
  });

  // Métricas
  const total = registrosFiltrados.length;
  const tempos = registrosFiltrados.map((r) => r.tempo_ms || 0).filter((t) => t > 0);
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 1000) : 0;
  const porCategoria = Object.entries(contar(registrosFiltrados.map((r) => r.categoria || "Outros"))).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const porDesigner = Object.entries(contar(registrosFiltrados.map((r) => r.designer_username))).sort((a, b) => b[1] - a[1]);
  const porDia = Object.entries(
    contar(registrosFiltrados.map((r) => new Date(r.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })))
  ).slice(0, 14).reverse();

  const nomeDesigner = (u: string) => designers.find((d) => d.username === u)?.nome || u;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f13]">
      <header className="bg-[#1a1a1f] border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">ROGGA UNIFORMES</h1>
            <p className="text-[#C8102E] text-xs font-medium">{permitirFiltro ? "Painel do Administrador" : "Meu Painel"}</p>
          </div>
          <Link href="/gerador" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-white/10 rounded-full px-4 py-1.5">
            <Sparkles size={14} /> Gerar
          </Link>
          {usuario?.papel === "admin" && !permitirFiltro && (
            <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-white/10 rounded-full px-4 py-1.5">
              <BarChart3 size={14} /> Admin
            </Link>
          )}
          <span className="text-sm text-gray-400 hidden sm:inline">{usuario?.nome}</span>
          <button onClick={sair} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          {permitirFiltro && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Designer</label>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
                className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-[#1a1a1f] text-gray-200 focus:outline-none focus:border-[#C8102E]">
                <option value="todos">Todos</option>
                {designers.map((d) => <option key={d.username} value={d.username}>{d.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-[#1a1a1f] text-gray-200 focus:outline-none focus:border-[#C8102E]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-[#1a1a1f] text-gray-200 focus:outline-none focus:border-[#C8102E]" />
          </div>
          {(dataInicio || dataFim) && (
            <button onClick={() => { setDataInicio(""); setDataFim(""); }}
              className="text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-2">
              Limpar datas
            </button>
          )}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <div className={`grid grid-cols-2 ${permitirFiltro ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
              <Card icon={<ImageIcon size={20} className="text-[#C8102E]" />} label="Artes geradas" valor={String(total)} />
              <Card icon={<Clock size={20} className="text-[#C8102E]" />} label="Tempo médio" valor={`${tempoMedio}s`} />
              <Card icon={<Layers size={20} className="text-[#C8102E]" />} label="Categorias" valor={String(porCategoria.length)} />
              {permitirFiltro && <Card icon={<Users size={20} className="text-[#C8102E]" />} label="Designers ativos" valor={String(porDesigner.length)} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-4">Artes por dia</h3>
                <BarList dados={porDia} />
              </div>
              <div className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-4">Artes por categoria</h3>
                <BarList dados={porCategoria} cor="#8b5cf6" />
              </div>
              {permitirFiltro && (
                <div className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-5 lg:col-span-2">
                  <h3 className="text-sm font-bold text-gray-300 mb-4">Artes por designer</h3>
                  <BarList dados={porDesigner.map(([u, v]) => [nomeDesigner(u), v] as [string, number])} cor="#10b981" />
                </div>
              )}
            </div>

            <div className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-300 mb-4">Últimas artes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-white/5">
                      <th className="text-left font-medium py-2 pr-3">Data</th>
                      {permitirFiltro && <th className="text-left font-medium py-2 pr-3">Designer</th>}
                      <th className="text-left font-medium py-2 pr-3">Empresa</th>
                      <th className="text-left font-medium py-2 pr-3">Categoria</th>
                      <th className="text-right font-medium py-2">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltrados.slice(0, 50).map((r) => (
                      <tr key={r.id} className="border-b border-white/5 text-gray-300">
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-400">{new Date(r.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        {permitirFiltro && <td className="py-2 pr-3 whitespace-nowrap">{nomeDesigner(r.designer_username)}</td>}
                        <td className="py-2 pr-3">{r.empresa || "—"}</td>
                        <td className="py-2 pr-3"><span className="text-xs bg-white/5 rounded-full px-2 py-0.5">{r.categoria || "—"}</span></td>
                        <td className="py-2 text-right text-gray-400">{r.tempo_ms ? `${Math.round(r.tempo_ms / 1000)}s` : "—"}</td>
                      </tr>
                    ))}
                    {!registrosFiltrados.length && (
                      <tr><td colSpan={permitirFiltro ? 5 : 4} className="py-6 text-center text-gray-600 text-xs">Nenhuma arte gerada ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
