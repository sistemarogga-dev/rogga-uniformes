"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload, Download, ChevronLeft, Loader2,
  AlertCircle, CheckCircle2, X, Sparkles, User, Building2,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Wand2,
} from "lucide-react";
import { useEffect } from "react";

interface ArteGerada {
  url: string;
  prompt: string;
  cliente: string;
  vendedor: string;
  timestamp: number;
}

interface CoresDetalhadas {
  poloTronco: string;
  poloGola: string;
  camisetaTronco: string;
  camisetaMangas: string;
  camisetaGola: string;
  camisetaPunho: string;
}

function MiniUploadBox({
  label, sublabel, file, preview, onChange, onClear, accept, badge
}: {
  label: string; sublabel?: string; file: File | null; preview: string;
  onChange: (f: File) => void; onClear: () => void; accept?: string; badge?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div
        className={`relative w-full aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden flex items-center justify-center ${preview ? "border-[#C8102E] bg-[#C8102E]/10" : "border-white/10 hover:border-[#C8102E]/60 bg-white/5"}`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
      >
        <input ref={ref} type="file" accept={accept || "image/*"} className="hidden"
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="w-full h-full object-contain p-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-gray-300 hover:text-red-400 shadow-sm">
              <X size={10} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 p-2 text-center">
            <Upload size={18} className="text-white/20" />
            {badge}
          </div>
        )}
      </div>
      <p className="text-[10px] font-semibold text-gray-400 text-center leading-tight">{label}</p>
      {sublabel && <p className="text-[9px] text-gray-500 text-center">{sublabel}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: azul marinho, #003366..."
        className="w-full border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600"
      />
    </div>
  );
}

export default function GeradorPage() {
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logo2, setLogo2] = useState<File | null>(null);
  const [logo2Preview, setLogo2Preview] = useState("");
  const [estampa, setEstampa] = useState<File | null>(null);
  const [estampaPreview, setEstampaPreview] = useState("");

  const [modoEstampa, setModoEstampa] = useState<"carregar" | "criar">("carregar");
  const [estampaPrompt, setEstampaPrompt] = useState("");
  const [criandoEstampa, setCriandoEstampa] = useState(false);
  const [erroEstampa, setErroEstampa] = useState("");

  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState("");

  const [tipoCores, setTipoCores] = useState<"automatica" | "detalhada">("automatica");
  const [cores, setCores] = useState<CoresDetalhadas>({
    poloTronco: "", poloGola: "",
    camisetaTronco: "", camisetaMangas: "", camisetaGola: "", camisetaPunho: "",
  });

  const [detalhes, setDetalhes] = useState<Record<string, string | boolean>>({
    alternarCores: true,
    golaV: false,
    mangaLonga: false,
    usarEstampa: "",
    usarLogo2: "",
    mudarCoresEstampa: "",
    punhoBarra: "",
    bandeiras: "",
    logo2OutroPeito: "",
  });

  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [imagemAtual, setImagemAtual] = useState<ArteGerada | null>(null);
  const [historico, setHistorico] = useState<ArteGerada[]>([]);
  const [zoom, setZoom] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!gerando) { setProgresso(0); return; }
    setProgresso(5);
    const etapas = [
      { p: 15, t: 2000 }, { p: 30, t: 5000 }, { p: 45, t: 10000 },
      { p: 60, t: 18000 }, { p: 75, t: 28000 }, { p: 88, t: 40000 }, { p: 95, t: 52000 },
    ];
    const timers = etapas.map(({ p, t }) => setTimeout(() => setProgresso(p), t));
    return () => timers.forEach(clearTimeout);
  }, [gerando]);

  const handleLogo = useCallback((f: File) => {
    setLogo(f);
    const r = new FileReader(); r.onload = (e) => setLogoPreview(e.target?.result as string); r.readAsDataURL(f);
  }, []);
  const handleLogo2 = useCallback((f: File) => {
    setLogo2(f);
    const r = new FileReader(); r.onload = (e) => setLogo2Preview(e.target?.result as string); r.readAsDataURL(f);
  }, []);
  const handleEstampa = useCallback((f: File) => {
    setEstampa(f);
    const r = new FileReader(); r.onload = (e) => setEstampaPreview(e.target?.result as string); r.readAsDataURL(f);
  }, []);

  const base64ToFile = useCallback(async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: "image/png" });
  }, []);

  const criarEstampaIA = useCallback(async () => {
    if (!estampaPrompt.trim()) { setErroEstampa("Descreva a estampa que deseja criar."); return; }
    setCriandoEstampa(true); setErroEstampa("");
    try {
      const res = await fetch("/api/criar-estampa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: estampaPrompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEstampaPreview(data.url);
      const file = await base64ToFile(data.url, "estampa-ia.png");
      setEstampa(file);
    } catch (e: unknown) {
      setErroEstampa(e instanceof Error ? e.message : "Erro ao criar estampa.");
    } finally { setCriandoEstampa(false); }
  }, [estampaPrompt, base64ToFile]);

  const setDetalhe = (key: string, value: string | boolean) =>
    setDetalhes(prev => ({ ...prev, [key]: value }));

  const gerarArte = useCallback(async () => {
    if (!cliente.trim()) { setErro("Informe o nome do cliente."); return; }
    setGerando(true); setErro(""); setSucesso("");
    try {
      const fd = new FormData();
      if (logo) fd.append("logo", logo);
      if (logo2) fd.append("logo2", logo2);
      if (estampa) fd.append("estampa", estampa);
      fd.append("cliente", cliente);
      fd.append("vendedor", vendedor);
      fd.append("tipoCores", tipoCores);
      fd.append("cores", JSON.stringify(cores));
      fd.append("detalhes", JSON.stringify(detalhes));
      const res = await fetch("/api/gerar", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const nova: ArteGerada = { url: data.url, prompt: data.prompt, cliente, vendedor, timestamp: Date.now() };
      setImagemAtual(nova);
      setHistorico(prev => [nova, ...prev.slice(0, 11)]);
      setSucesso("Arte gerada com sucesso!");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar arte.");
    } finally { setGerando(false); }
  }, [logo, logo2, estampa, cliente, vendedor, tipoCores, cores, detalhes]);

  const baixarImagem = useCallback(async (url: string, nome: string) => {
    try {
      const a = document.createElement("a");
      a.download = `rogga-${nome}-${Date.now()}.png`;
      if (url.startsWith("data:")) { a.href = url; a.click(); }
      else {
        const res = await fetch(url); const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob); a.href = blobUrl; a.click(); URL.revokeObjectURL(blobUrl);
      }
    } catch { setErro("Erro ao baixar. Tente clique direito > Salvar imagem."); }
  }, []);

  // classes reutilizáveis dark
  const card = "bg-[#1a1a1f] rounded-2xl border border-white/8 p-4";
  const inputCls = "w-full border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600";
  const inputXsCls = "w-full border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600";

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f13]">
      <header className="bg-[#1a1a1f] border-b border-white/5 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-gray-500 hover:text-white transition-colors text-sm">
            <ChevronLeft size={16} /> Início
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">ROGGA UNIFORMES</h1>
            <p className="text-[#C8102E] text-xs font-medium">Gerador de Artes para Clientes</p>
          </div>
          <span className="text-xs text-gray-500">{historico.length} arte{historico.length !== 1 ? "s" : ""} gerada{historico.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ===== FORMULÁRIO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">Novo Pedido de Arte</h2>
            <p className="text-gray-500 text-sm">Preencha os dados e gere a proposta</p>
          </div>

          {/* Logos e Imagens */}
          <div className={card + " space-y-3"}>
            <p className="text-sm font-bold text-gray-300">📎 Imagens</p>

            <div className="flex gap-3">
              <MiniUploadBox label="Logo Principal" sublabel="*obrigatório"
                file={logo} preview={logoPreview} onChange={handleLogo}
                onClear={() => { setLogo(null); setLogoPreview(""); }} />
              <MiniUploadBox label="2º Logo" sublabel="opcional"
                file={logo2} preview={logo2Preview} onChange={handleLogo2}
                onClear={() => { setLogo2(null); setLogo2Preview(""); }} />
              <MiniUploadBox label="Estampa" sublabel={modoEstampa === "criar" && estampaPreview ? "IA ✓" : "opcional"}
                file={estampa} preview={estampaPreview}
                onChange={(f) => { setModoEstampa("carregar"); handleEstampa(f); }}
                onClear={() => { setEstampa(null); setEstampaPreview(""); setEstampaPrompt(""); }}
                badge={<p className="text-[9px] text-gray-500 leading-tight">Carregar<br />ou criar IA</p>}
              />
            </div>

            {/* Painel estampa */}
            <div className="border border-white/8 rounded-xl p-3 space-y-2 bg-white/3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400">✨ Estampa</p>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => { setModoEstampa("carregar"); setEstampa(null); setEstampaPreview(""); }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-colors ${modoEstampa === "carregar" ? "bg-[#C8102E] text-white" : "bg-transparent text-gray-400 hover:text-gray-200"}`}>
                    <Upload size={10} /> Carregar
                  </button>
                  <button
                    onClick={() => setModoEstampa("criar")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-colors ${modoEstampa === "criar" ? "bg-purple-600 text-white" : "bg-transparent text-gray-400 hover:text-gray-200"}`}>
                    <Wand2 size={10} /> Criar com IA
                  </button>
                </div>
              </div>

              {modoEstampa === "criar" && (
                <div className="space-y-2">
                  <textarea value={estampaPrompt} onChange={(e) => setEstampaPrompt(e.target.value)}
                    placeholder="Descreva a estampa... ex: leão dourado estilo vintage, brasão com engrenagens..."
                    rows={2}
                    className="w-full border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500 bg-white/5 text-gray-200 placeholder-gray-600 resize-none" />
                  {erroEstampa && <p className="text-xs text-red-400">{erroEstampa}</p>}
                  <button onClick={criarEstampaIA} disabled={criandoEstampa || !estampaPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {criandoEstampa ? <><Loader2 size={13} className="animate-spin" /> Criando...</> : <><Wand2 size={13} /> Criar Estampa com IA</>}
                  </button>
                  {estampaPreview && (
                    <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={estampaPreview} alt="Estampa gerada" className="h-10 w-10 object-contain rounded" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-purple-300">Estampa criada!</p>
                        <p className="text-[10px] text-purple-400">Pronta para usar na arte</p>
                      </div>
                      <button onClick={() => { setEstampa(null); setEstampaPreview(""); setEstampaPrompt(""); }}
                        className="text-gray-500 hover:text-red-400"><X size={13} /></button>
                    </div>
                  )}
                </div>
              )}
              {modoEstampa === "carregar" && !estampaPreview && (
                <p className="text-[10px] text-gray-600">Clique na caixa &quot;Estampa&quot; acima para carregar, ou mude para &quot;Criar com IA&quot;.</p>
              )}
              {modoEstampa === "carregar" && estampaPreview && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estampaPreview} alt="Estampa" className="h-10 w-10 object-contain rounded" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-400">Estampa carregada</p>
                    <p className="text-[10px] text-green-500 truncate">{estampa?.name}</p>
                  </div>
                  <button onClick={() => { setEstampa(null); setEstampaPreview(""); }}
                    className="text-gray-500 hover:text-red-400"><X size={13} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Cliente e Vendedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1"><Building2 size={13} className="inline mr-1" />Cliente / Empresa</label>
              <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome da empresa" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1"><User size={13} className="inline mr-1" />Vendedor(a)</label>
              <input type="text" value={vendedor} onChange={(e) => setVendedor(e.target.value)}
                placeholder="Nome do vendedor" className={inputCls} />
            </div>
          </div>

          {/* Combinação de Cores */}
          <div className={card + " space-y-4"}>
            <p className="text-sm font-bold text-gray-300">🎨 Combinação de Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipoCores("automatica")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${tipoCores === "automatica" ? "border-[#C8102E] bg-[#C8102E]/10 text-[#C8102E]" : "border-white/10 text-gray-500 hover:border-white/20"}`}>
                🎨 Automática
                <span className="block text-xs font-normal opacity-70">Baseada no logotipo</span>
              </button>
              <button onClick={() => setTipoCores("detalhada")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${tipoCores === "detalhada" ? "border-[#C8102E] bg-[#C8102E]/10 text-[#C8102E]" : "border-white/10 text-gray-500 hover:border-white/20"}`}>
                ✏️ Detalhada
                <span className="block text-xs font-normal opacity-70">Especificar cada peça</span>
              </button>
            </div>

            {tipoCores === "automatica" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={detalhes.alternarCores as boolean}
                  onChange={(e) => setDetalhe("alternarCores", e.target.checked)}
                  className="accent-[#C8102E] w-4 h-4" />
                <span className="text-sm text-gray-400">Alternar cores entre polo e camiseta</span>
              </label>
            )}

            {tipoCores === "detalhada" && (
              <div className="space-y-3">
                <div className="border border-white/8 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Camisa Polo</p>
                  <ColorField label="Tronco e mangas" value={cores.poloTronco} onChange={(v) => setCores(p => ({ ...p, poloTronco: v }))} />
                  <ColorField label="Gola e punhos" value={cores.poloGola} onChange={(v) => setCores(p => ({ ...p, poloGola: v }))} />
                </div>
                <div className="border border-white/8 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Camiseta</p>
                  <ColorField label="Tronco" value={cores.camisetaTronco} onChange={(v) => setCores(p => ({ ...p, camisetaTronco: v }))} />
                  <ColorField label="Mangas" value={cores.camisetaMangas} onChange={(v) => setCores(p => ({ ...p, camisetaMangas: v }))} />
                  <ColorField label="Gola" value={cores.camisetaGola} onChange={(v) => setCores(p => ({ ...p, camisetaGola: v }))} />
                  <ColorField label="Punho" value={cores.camisetaPunho} onChange={(v) => setCores(p => ({ ...p, camisetaPunho: v }))} />
                </div>
              </div>
            )}
          </div>

          {/* Detalhes Opcionais */}
          <div className={card + " space-y-3"}>
            <p className="text-sm font-bold text-gray-300">⚙️ Detalhes Opcionais</p>

            <CheckItem label="Gola V na camiseta"
              checked={detalhes.golaV as boolean} onChange={(v) => setDetalhe("golaV", v)} />
            <CheckItem label="Manga longa com punhos na mesma cor das mangas"
              checked={detalhes.mangaLonga as boolean} onChange={(v) => setDetalhe("mangaLonga", v)} />

            <SelectItem label="Usar estampa anexada em:"
              value={detalhes.usarEstampa as string} onChange={(v) => setDetalhe("usarEstampa", v)}
              options={[{ value: "", label: "Não usar" }, { value: "polo", label: "Polo" }, { value: "camiseta", label: "Camiseta" }, { value: "ambas", label: "Ambas" }]} />

            {detalhes.usarEstampa && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mudar cores da estampa para:</label>
                <input type="text" value={detalhes.mudarCoresEstampa as string}
                  onChange={(e) => setDetalhe("mudarCoresEstampa", e.target.value)}
                  placeholder="Ex: laranja e preto (deixe vazio para manter)"
                  className={inputXsCls} />
              </div>
            )}

            <SelectItem label="Usar 2º logo em:"
              value={detalhes.usarLogo2 as string} onChange={(v) => setDetalhe("usarLogo2", v)}
              options={[{ value: "", label: "Não usar" }, { value: "polo", label: "Polo" }, { value: "camiseta", label: "Camiseta" }, { value: "ambas", label: "Ambas" }]} />

            <div>
              <label className="block text-xs text-gray-500 mb-1">Punho com fina barra em:</label>
              <input type="text" value={detalhes.punhoBarra as string}
                onChange={(e) => setDetalhe("punhoBarra", e.target.value)}
                placeholder="Ex: ambas as camisas, barra dourada"
                className={inputXsCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bandeiras nos braços (somente frente):</label>
              <input type="text" value={detalhes.bandeiras as string}
                onChange={(e) => setDetalhe("bandeiras", e.target.value)}
                placeholder="Ex: bandeira do Brasil nos dois braços da camiseta"
                className={inputXsCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">2º logo no outro peito em:</label>
              <input type="text" value={detalhes.logo2OutroPeito as string}
                onChange={(e) => setDetalhe("logo2OutroPeito", e.target.value)}
                placeholder="Ex: polo e camiseta"
                className={inputXsCls} />
            </div>
          </div>

          {/* Alertas */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm">
              <CheckCircle2 size={16} className="shrink-0" /><span>{sucesso}</span>
            </div>
          )}

          <button onClick={gerarArte} disabled={gerando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#C8102E] text-white font-bold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/30">
            {gerando ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {gerando ? "Gerando arte... aguarde até 60s" : "Gerar Arte"}
          </button>
        </div>

        {/* ===== RESULTADO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">Resultado</h2>
            <p className="text-gray-500 text-sm">A arte gerada aparecerá aqui</p>
          </div>

          <div className="bg-[#1a1a1f] rounded-2xl border border-white/8 overflow-hidden shadow-sm">
            {imagemAtual && !gerando && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/3">
                <span className="text-xs text-gray-500 font-medium">Zoom: {Math.round(zoom * 100)}%</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Diminuir">
                    <ZoomOut size={16} />
                  </button>
                  <button onClick={() => setZoom(1)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="100%">
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Ampliar">
                    <ZoomIn size={16} />
                  </button>
                  <button onClick={() => setModalAberto(true)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1" title="Tela cheia">
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            )}

            {gerando ? (
              <div className="aspect-[9/16] max-h-[650px] flex flex-col items-center justify-center bg-[#0f0f13] p-8 gap-6">
                <div className="text-center">
                  <Loader2 size={40} className="animate-spin text-[#C8102E] mx-auto mb-3" />
                  <p className="text-gray-300 font-semibold text-sm">Gerando sua arte...</p>
                  <p className="text-gray-600 text-xs mt-1">A IA está criando a proposta. Isso pode levar até 60 segundos.</p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progresso</span><span>{progresso}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full bg-[#C8102E] transition-all duration-1000 ease-out" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="text-xs text-gray-600 text-center">
                    {progresso < 20 && "Analisando o logotipo..."}
                    {progresso >= 20 && progresso < 45 && "Preparando o template..."}
                    {progresso >= 45 && progresso < 70 && "Aplicando cores e logos..."}
                    {progresso >= 70 && progresso < 90 && "Refinando detalhes..."}
                    {progresso >= 90 && "Finalizando e otimizando..."}
                  </div>
                </div>
              </div>
            ) : imagemAtual ? (
              <div className="overflow-auto max-h-[650px] flex items-start justify-center bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemAtual.url} alt="Arte gerada"
                  className="object-contain transition-transform duration-200 cursor-zoom-in"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", maxHeight: "650px", width: "100%" }}
                  onClick={() => setModalAberto(true)} />
              </div>
            ) : (
              <div className="relative w-full aspect-[9/16] max-h-[650px] select-none overflow-hidden bg-gradient-to-b from-[#0d1117] via-[#111827] to-[#0d1117]">
                {/* Ornamentos de canto */}
                <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-[#C8A951]/60 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-20 h-20 border-t-2 border-r-2 border-[#C8A951]/60 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-20 h-20 border-b-2 border-l-2 border-[#C8A951]/60 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-[#C8A951]/60 rounded-br-2xl" />

                {/* Faixa de brilho central */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-[#C8A951]/20 to-transparent" />

                {/* Conteúdo centralizado preenchendo o frame */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0 p-8">

                  {/* Emblema superior */}
                  <div className="relative mb-6">
                    <div className="w-28 h-28 rounded-full border-[3px] border-[#C8102E] flex items-center justify-center bg-[#C8102E]/10 shadow-lg shadow-[#C8102E]/20">
                      <div className="w-20 h-20 rounded-full border border-[#C8102E]/40 flex items-center justify-center">
                        <Sparkles size={36} className="text-[#C8102E]" />
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#C8102E] flex items-center justify-center shadow-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* Eyebrow */}
                  <p className="text-[#C8A951] text-[10px] font-bold tracking-[0.4em] uppercase mb-3">Gerador de Artes</p>

                  {/* Nome principal */}
                  <h2 className="text-white text-5xl font-black tracking-widest leading-none drop-shadow-lg">ROGGA</h2>
                  <h3 className="text-white/70 text-xl font-light tracking-[0.5em] mt-1 mb-5">UNIFORMES</h3>

                  {/* Linha decorativa dourada */}
                  <div className="flex items-center gap-3 mb-6 w-full max-w-[70%]">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C8A951]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C8A951]" />
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C8A951]/60" />
                  </div>

                  {/* Tagline */}
                  <p className="text-white/30 text-[11px] tracking-[0.25em] uppercase text-center leading-loose mb-8">
                    Conforto · Qualidade · Profissionalismo
                  </p>

                  {/* Card de instrução */}
                  <div className="w-full max-w-[80%] bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
                    <p className="text-white/50 text-xs leading-relaxed">
                      Preencha o formulário ao lado<br />e clique em{" "}
                      <span className="text-[#C8102E] font-bold">Gerar Arte</span>
                      <br />para criar a proposta do cliente
                    </p>
                  </div>

                  {/* Versão / badge */}
                  <p className="absolute bottom-5 text-white/15 text-[9px] tracking-widest uppercase">
                    roggauniformes.com.br
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              {imagemAtual ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white text-sm">{imagemAtual.cliente}</p>
                      {imagemAtual.vendedor && <p className="text-xs text-gray-500">Vendedor(a): {imagemAtual.vendedor}</p>}
                    </div>
                    <button onClick={() => baixarImagem(imagemAtual.url, imagemAtual.cliente)}
                      className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors">
                      <Download size={14} /> Baixar Arte
                    </button>
                  </div>
                  <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-gray-600 hover:text-gray-400 underline">
                    {showPrompt ? "Ocultar" : "Ver"} prompt enviado
                  </button>
                  {showPrompt && <p className="text-xs text-gray-500 bg-white/5 rounded-lg p-3 leading-relaxed">{imagemAtual.prompt}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-600 text-center">
                  Preencha o formulário e clique em <strong className="text-gray-400">Gerar Arte</strong>
                </p>
              )}
            </div>
          </div>

          {historico.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Histórico desta sessão</h3>
              <div className="grid grid-cols-3 gap-2">
                {historico.slice(1).map((arte) => (
                  <div key={arte.timestamp}
                    className="relative group rounded-xl overflow-hidden border border-white/8 bg-[#1a1a1f] cursor-pointer hover:border-white/20 transition-colors"
                    onClick={() => setImagemAtual(arte)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={arte.url} alt={arte.cliente} className="w-full aspect-[9/16] object-cover hover:opacity-80 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{arte.cliente}</div>
                    <button onClick={(e) => { e.stopPropagation(); baixarImagem(arte.url, arte.cliente); }}
                      className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#0a0a0e] border-t border-white/5 text-gray-600 text-center py-4 text-xs">
        © {new Date().getFullYear()} ROGGA UNIFORMES — Gerador de Artes com IA
      </footer>

      {/* Modal tela cheia */}
      {modalAberto && imagemAtual && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10">
            <span className="text-white text-sm font-semibold">{imagemAtual.cliente}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><ZoomOut size={18} /></button>
              <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><ZoomIn size={18} /></button>
              <button onClick={() => setZoom(1)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs">100%</button>
              <button onClick={() => baixarImagem(imagemAtual.url, imagemAtual.cliente)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#C8102E] hover:bg-red-700 text-white text-xs font-semibold transition-colors">
                <Download size={14} /> Baixar
              </button>
              <button onClick={() => { setModalAberto(false); setZoom(1); }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagemAtual.url} alt="Arte gerada"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
              className="max-w-sm w-full" />
          </div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#C8102E] w-4 h-4" />
      <span className="text-sm text-gray-400">{label}</span>
    </label>
  );
}

function SelectItem({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-[#0f0f13] text-gray-300">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
