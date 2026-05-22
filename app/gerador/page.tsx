"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload, Download, ChevronLeft, Loader2,
  AlertCircle, CheckCircle2, X, Sparkles, User, Building2,
  ZoomIn, ZoomOut, Maximize2, RotateCcw,
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

function UploadBox({
  label, hint, file, preview, onChange, onClear, accept
}: {
  label: string; hint: string; file: File | null; preview: string;
  onChange: (f: File) => void; onClear: () => void; accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div
        className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors ${preview ? "border-[#C8102E] bg-red-50" : "border-gray-200 hover:border-[#C8102E] bg-white"}`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
      >
        <input ref={ref} type="file" accept={accept || "image/*"} className="hidden"
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        {preview ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="h-10 object-contain rounded" />
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-gray-700 truncate">{file?.name}</p>
              <p className="text-xs text-gray-400">Clique para trocar</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-gray-400 hover:text-red-500 shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="py-2">
            <Upload size={20} className="mx-auto text-gray-300 mb-1" />
            <p className="text-xs text-gray-400">{hint}</p>
          </div>
        )}
      </div>
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
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white"
      />
    </div>
  );
}

export default function GeradorPage() {
  // Logos e imagens
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logo2, setLogo2] = useState<File | null>(null);
  const [logo2Preview, setLogo2Preview] = useState("");
  const [estampa, setEstampa] = useState<File | null>(null);
  const [estampaPreview, setEstampaPreview] = useState("");

  // Dados básicos
  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState("");

  // Tipo de combinação de cores
  const [tipoCores, setTipoCores] = useState<"automatica" | "detalhada">("automatica");
  const [cores, setCores] = useState<CoresDetalhadas>({
    poloTronco: "", poloGola: "",
    camisetaTronco: "", camisetaMangas: "", camisetaGola: "", camisetaPunho: "",
  });

  // Detalhes opcionais
  const [detalhes, setDetalhes] = useState<Record<string, string | boolean>>({
    alternarCores: true,
    golaV: false,
    mangaLonga: false,
    usarEstampa: "",        // "polo" | "camiseta" | "ambas"
    usarLogo2: "",          // "polo" | "camiseta" | "ambas"
    mudarCoresEstampa: "",
    punhoBarra: "",
    bandeiras: "",
    logo2OutroPeito: "",
  });

  // Estado
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [imagemAtual, setImagemAtual] = useState<ArteGerada | null>(null);
  const [historico, setHistorico] = useState<ArteGerada[]>([]);
  const [zoom, setZoom] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);

  // Barra de progresso simulada durante geração
  useEffect(() => {
    if (!gerando) { setProgresso(0); return; }
    setProgresso(5);
    const etapas = [
      { p: 15, t: 2000 },
      { p: 30, t: 5000 },
      { p: 45, t: 10000 },
      { p: 60, t: 18000 },
      { p: 75, t: 28000 },
      { p: 88, t: 40000 },
      { p: 95, t: 52000 },
    ];
    const timers = etapas.map(({ p, t }) => setTimeout(() => setProgresso(p), t));
    return () => timers.forEach(clearTimeout);
  }, [gerando]);
  const [showPrompt, setShowPrompt] = useState(false);

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

  const setDetalhe = (key: string, value: string | boolean) => {
    setDetalhes(prev => ({ ...prev, [key]: value }));
  };

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
    } finally {
      setGerando(false);
    }
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-[#C8102E] text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-red-200 hover:text-white transition-colors text-sm">
            <ChevronLeft size={16} /> Início
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">ROGGA UNIFORMES</h1>
            <p className="text-red-200 text-xs">Gerador de Artes para Clientes</p>
          </div>
          <span className="text-xs text-red-200">{historico.length} arte{historico.length !== 1 ? "s" : ""} gerada{historico.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ===== FORMULÁRIO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Novo Pedido de Arte</h2>
            <p className="text-gray-500 text-sm">Preencha os dados e gere a proposta</p>
          </div>

          {/* Logos e Imagens */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">📎 Imagens</p>
            <UploadBox label="Logo Principal *" hint="Arraste ou clique — PNG, JPG, SVG"
              file={logo} preview={logoPreview} onChange={handleLogo} onClear={() => { setLogo(null); setLogoPreview(""); }} />
            <UploadBox label="2º Logo (opcional)" hint="Segundo logotipo do cliente"
              file={logo2} preview={logo2Preview} onChange={handleLogo2} onClear={() => { setLogo2(null); setLogo2Preview(""); }} />
            <UploadBox label="Estampa (opcional)" hint="Imagem para usar como estampa"
              file={estampa} preview={estampaPreview} onChange={handleEstampa} onClear={() => { setEstampa(null); setEstampaPreview(""); }} />
          </div>

          {/* Cliente e Vendedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1"><Building2 size={13} className="inline mr-1" />Cliente / Empresa</label>
              <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome da empresa"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1"><User size={13} className="inline mr-1" />Vendedor(a)</label>
              <input type="text" value={vendedor} onChange={(e) => setVendedor(e.target.value)}
                placeholder="Nome do vendedor"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white" />
            </div>
          </div>

          {/* Combinação de Cores */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <p className="text-sm font-bold text-gray-700">🎨 Combinação de Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipoCores("automatica")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${tipoCores === "automatica" ? "border-[#C8102E] bg-red-50 text-[#C8102E]" : "border-gray-200 text-gray-500"}`}>
                🎨 Automática
                <span className="block text-xs font-normal opacity-70">Baseada no logotipo</span>
              </button>
              <button onClick={() => setTipoCores("detalhada")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${tipoCores === "detalhada" ? "border-[#C8102E] bg-red-50 text-[#C8102E]" : "border-gray-200 text-gray-500"}`}>
                ✏️ Detalhada
                <span className="block text-xs font-normal opacity-70">Especificar cada peça</span>
              </button>
            </div>

            {tipoCores === "automatica" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={detalhes.alternarCores as boolean}
                  onChange={(e) => setDetalhe("alternarCores", e.target.checked)}
                  className="accent-[#C8102E] w-4 h-4" />
                <span className="text-sm text-gray-700">Alternar cores entre polo e camiseta</span>
              </label>
            )}

            {tipoCores === "detalhada" && (
              <div className="space-y-3">
                <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Camisa Polo</p>
                  <ColorField label="Tronco e mangas" value={cores.poloTronco} onChange={(v) => setCores(p => ({ ...p, poloTronco: v }))} />
                  <ColorField label="Gola e punhos" value={cores.poloGola} onChange={(v) => setCores(p => ({ ...p, poloGola: v }))} />
                </div>
                <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Camiseta</p>
                  <ColorField label="Tronco" value={cores.camisetaTronco} onChange={(v) => setCores(p => ({ ...p, camisetaTronco: v }))} />
                  <ColorField label="Mangas" value={cores.camisetaMangas} onChange={(v) => setCores(p => ({ ...p, camisetaMangas: v }))} />
                  <ColorField label="Gola" value={cores.camisetaGola} onChange={(v) => setCores(p => ({ ...p, camisetaGola: v }))} />
                  <ColorField label="Punho" value={cores.camisetaPunho} onChange={(v) => setCores(p => ({ ...p, camisetaPunho: v }))} />
                </div>
              </div>
            )}
          </div>

          {/* Detalhes Opcionais */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">⚙️ Detalhes Opcionais</p>

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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white" />
              </div>
            )}

            <SelectItem label="Usar 2º logo em:"
              value={detalhes.usarLogo2 as string} onChange={(v) => setDetalhe("usarLogo2", v)}
              options={[{ value: "", label: "Não usar" }, { value: "polo", label: "Polo" }, { value: "camiseta", label: "Camiseta" }, { value: "ambas", label: "Ambas" }]} />

            <div>
              <label className="block text-xs text-gray-500 mb-1">Punho com fina barra em: (ex: "polo, cor vermelha")</label>
              <input type="text" value={detalhes.punhoBarra as string}
                onChange={(e) => setDetalhe("punhoBarra", e.target.value)}
                placeholder="Ex: ambas as camisas, barra dourada"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white" />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Bandeiras nos braços (somente frente):</label>
              <input type="text" value={detalhes.bandeiras as string}
                onChange={(e) => setDetalhe("bandeiras", e.target.value)}
                placeholder="Ex: bandeira do Brasil nos dois braços da camiseta"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white" />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">2º logo no outro peito em:</label>
              <input type="text" value={detalhes.logo2OutroPeito as string}
                onChange={(e) => setDetalhe("logo2OutroPeito", e.target.value)}
                placeholder="Ex: polo e camiseta"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white" />
            </div>
          </div>

          {/* Alertas */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              <CheckCircle2 size={16} className="shrink-0" /><span>{sucesso}</span>
            </div>
          )}

          <button onClick={gerarArte} disabled={gerando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#C8102E] text-white font-bold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            {gerando ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {gerando ? "Gerando arte... aguarde até 60s" : "Gerar Arte"}
          </button>
        </div>

        {/* ===== RESULTADO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Resultado</h2>
            <p className="text-gray-500 text-sm">A arte gerada aparecerá aqui</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Controles de zoom — só aparecem quando há imagem gerada */}
            {imagemAtual && !gerando && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500 font-medium">Zoom: {Math.round(zoom * 100)}%</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors" title="Diminuir">
                    <ZoomOut size={16} />
                  </button>
                  <button onClick={() => setZoom(1)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors" title="100%">
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors" title="Ampliar">
                    <ZoomIn size={16} />
                  </button>
                  <button onClick={() => setModalAberto(true)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors ml-1" title="Tela cheia">
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            )}

            {gerando ? (
              <div className="aspect-[9/16] max-h-[650px] flex flex-col items-center justify-center bg-gray-50 p-8 gap-6">
                <div className="text-center">
                  <Loader2 size={40} className="animate-spin text-[#C8102E] mx-auto mb-3" />
                  <p className="text-gray-700 font-semibold text-sm">Gerando sua arte...</p>
                  <p className="text-gray-400 text-xs mt-1">A IA está criando a proposta. Isso pode levar até 60 segundos.</p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progresso</span>
                    <span>{progresso}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-[#C8102E] transition-all duration-1000 ease-out"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    {progresso < 20 && "Analisando o logotipo..."}
                    {progresso >= 20 && progresso < 45 && "Preparando o template..."}
                    {progresso >= 45 && progresso < 70 && "Aplicando cores e logos..."}
                    {progresso >= 70 && progresso < 90 && "Refinando detalhes..."}
                    {progresso >= 90 && "Finalizando e otimizando..."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-auto max-h-[650px] flex items-start justify-center bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagemAtual ? imagemAtual.url : "/template.png"}
                  alt={imagemAtual ? "Arte gerada" : "Template padrão ROGGA"}
                  className="object-contain transition-transform duration-200 cursor-zoom-in"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", maxHeight: "650px", width: "100%" }}
                  onClick={() => imagemAtual && setModalAberto(true)}
                />
              </div>
            )}
            <div className="p-4 space-y-3">
              {imagemAtual ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{imagemAtual.cliente}</p>
                      {imagemAtual.vendedor && <p className="text-xs text-gray-400">Vendedor(a): {imagemAtual.vendedor}</p>}
                    </div>
                    <button onClick={() => baixarImagem(imagemAtual.url, imagemAtual.cliente)}
                      className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors">
                      <Download size={14} /> Baixar Arte
                    </button>
                  </div>
                  <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-gray-400 underline">
                    {showPrompt ? "Ocultar" : "Ver"} prompt enviado
                  </button>
                  {showPrompt && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">{imagemAtual.prompt}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  Preencha o formulário e clique em <strong className="text-gray-600">Gerar Arte</strong>
                </p>
              )}
            </div>
          </div>

          {historico.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico desta sessão</h3>
              <div className="grid grid-cols-3 gap-2">
                {historico.slice(1).map((arte) => (
                  <div key={arte.timestamp} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white cursor-pointer" onClick={() => setImagemAtual(arte)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={arte.url} alt={arte.cliente} className="w-full aspect-[9/16] object-cover hover:opacity-90 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{arte.cliente}</div>
                    <button onClick={(e) => { e.stopPropagation(); baixarImagem(arte.url, arte.cliente); }}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#1a1a2e] text-gray-400 text-center py-4 text-xs">
        © {new Date().getFullYear()} ROGGA UNIFORMES — Gerador de Artes com IA
      </footer>

      {/* Modal tela cheia */}
      {modalAberto && imagemAtual && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/60">
            <span className="text-white text-sm font-semibold">{imagemAtual.cliente}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ZoomOut size={18} />
              </button>
              <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => setZoom(1)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs">
                100%
              </button>
              <button onClick={() => baixarImagem(imagemAtual.url, imagemAtual.cliente)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#C8102E] hover:bg-red-700 text-white text-xs font-semibold transition-colors">
                <Download size={14} /> Baixar
              </button>
              <button onClick={() => { setModalAberto(false); setZoom(1); }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagemAtual.url}
              alt="Arte gerada"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
              className="max-w-sm w-full"
            />
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
      <span className="text-sm text-gray-700">{label}</span>
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
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#C8102E] bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
