"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload, Download, ChevronLeft, Loader2, Image as ImageIcon,
  AlertCircle, CheckCircle2, X, Sparkles, User, Building2,
} from "lucide-react";

interface ArteGerada {
  url: string;
  prompt: string;
  cliente: string;
  vendedor: string;
  timestamp: number;
}

export default function GeradorPage() {
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [pecas, setPecas] = useState<string[]>(["polo"]);
  const [cores, setCores] = useState<"automatica" | "detalhada">("automatica");
  const [coresDetalhadas, setCoresDetalhadas] = useState("");
  const [detalhes, setDetalhes] = useState<string[]>(["logo-costas"]);
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [imagemAtual, setImagemAtual] = useState<ArteGerada | null>(null);
  const [historico, setHistorico] = useState<ArteGerada[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = useCallback((file: File) => {
    setLogo(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const togglePeca = (peca: string) => {
    setPecas((prev) =>
      prev.includes(peca) ? prev.filter((p) => p !== peca) : [...prev, peca]
    );
  };

  const toggleDetalhe = (d: string) => {
    setDetalhes((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const gerarArte = useCallback(async () => {
    if (pecas.length === 0) {
      setErro("Selecione pelo menos uma peça.");
      return;
    }
    if (!cliente.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }

    setGerando(true);
    setErro("");
    setSucesso("");

    try {
      const fd = new FormData();
      if (logo) fd.append("logo", logo);
      fd.append("cliente", cliente);
      fd.append("vendedor", vendedor);
      pecas.forEach((p) => fd.append("pecas", p));
      fd.append("cores", cores);
      fd.append("coresDetalhadas", coresDetalhadas);
      detalhes.forEach((d) => fd.append("detalhes", d));
      fd.append("observacoes", observacoes);

      const res = await fetch("/api/gerar", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const nova: ArteGerada = {
        url: data.url,
        prompt: data.prompt,
        cliente,
        vendedor,
        timestamp: Date.now(),
      };
      setImagemAtual(nova);
      setHistorico((prev) => [nova, ...prev.slice(0, 11)]);
      setSucesso("Arte gerada com sucesso!");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar arte.");
    } finally {
      setGerando(false);
    }
  }, [logo, cliente, vendedor, pecas, cores, coresDetalhadas, detalhes, observacoes]);

  const baixarImagem = useCallback(async (url: string, nome: string) => {
    try {
      const a = document.createElement("a");
      a.download = `rogga-${nome}-${Date.now()}.png`;
      if (url.startsWith("data:")) {
        a.href = url;
        a.click();
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      setErro("Erro ao baixar. Tente clique direito > Salvar imagem.");
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ===== FORMULÁRIO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Novo Pedido de Arte</h2>
            <p className="text-gray-500 text-sm">Preencha os dados do cliente e gere a arte</p>
          </div>

          {/* Upload de Logo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Logo do Cliente</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${logoPreview ? "border-[#C8102E] bg-red-50" : "border-gray-300 hover:border-[#C8102E] bg-white"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleLogoChange(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoChange(e.target.files[0])}
              />
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo" className="h-16 object-contain rounded" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-700">{logo?.name}</p>
                    <p className="text-xs text-gray-400">Clique para trocar</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setLogo(null); setLogoPreview(""); }}
                    className="text-gray-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Arraste o logo aqui ou <span className="text-[#C8102E] font-semibold">clique para selecionar</span></p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG</p>
                </div>
              )}
            </div>
          </div>

          {/* Cliente e Vendedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                <Building2 size={14} className="inline mr-1" />Cliente / Empresa
              </label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome da empresa"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                <User size={14} className="inline mr-1" />Vendedor
              </label>
              <input
                type="text"
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                placeholder="Nome do vendedor"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white"
              />
            </div>
          </div>

          {/* Peças */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Peças do Pedido</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "polo", label: "Camisa Polo" },
                { id: "manga-curta", label: "Camiseta M. Curta" },
                { id: "manga-longa", label: "Camiseta M. Longa" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePeca(p.id)}
                  className={`py-3 px-2 rounded-xl border-2 text-sm font-semibold transition-all ${pecas.includes(p.id) ? "border-[#C8102E] bg-red-50 text-[#C8102E]" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Combinação de Cores */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Combinação de Cores</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setCores("automatica")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${cores === "automatica" ? "border-[#C8102E] bg-red-50 text-[#C8102E]" : "border-gray-200 bg-white text-gray-500"}`}
              >
                🎨 Automática
                <span className="block text-xs font-normal opacity-70">Baseada no logotipo</span>
              </button>
              <button
                onClick={() => setCores("detalhada")}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${cores === "detalhada" ? "border-[#C8102E] bg-red-50 text-[#C8102E]" : "border-gray-200 bg-white text-gray-500"}`}
              >
                ✏️ Detalhada
                <span className="block text-xs font-normal opacity-70">Especificar cores</span>
              </button>
            </div>
            {cores === "detalhada" && (
              <textarea
                value={coresDetalhadas}
                onChange={(e) => setCoresDetalhadas(e.target.value)}
                rows={3}
                placeholder="Ex: Polo azul marinho com gola branca, camiseta cinza com detalhes em laranja..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white resize-none"
              />
            )}
          </div>

          {/* Detalhes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Detalhes da Arte</label>
            <div className="space-y-2">
              {[
                { id: "alternar-cores", label: "Alternar cores entre as peças" },
                { id: "isotipo-peito", label: "Isotipo/ícone nos peitos" },
                { id: "logo-costas", label: "Logomarca completa nas costas" },
                { id: "logo-manga", label: "Logomarca nas mangas (vertical)" },
                { id: "estampa-barriga", label: "Estampa na barriga da camiseta" },
                { id: "estampa-abstrata", label: "Estampa abstrata agressiva" },
              ].map((d) => (
                <label key={d.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => toggleDetalhe(d.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${detalhes.includes(d.id) ? "border-[#C8102E] bg-[#C8102E]" : "border-gray-300 bg-white group-hover:border-[#C8102E]"}`}
                  >
                    {detalhes.includes(d.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-sm text-gray-700" onClick={() => toggleDetalhe(d.id)}>{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Observações Adicionais</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex: A cor predominante deve ser laranja. Coloque o capacete como estampa na barriga..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white resize-none"
            />
          </div>

          {/* Alertas */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}

          {/* Botão Gerar */}
          <button
            onClick={gerarArte}
            disabled={gerando}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#C8102E] text-white font-bold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
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
            {imagemAtual ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemAtual.url} alt="Arte gerada" className="w-full object-contain max-h-[600px]" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{imagemAtual.cliente}</p>
                      {imagemAtual.vendedor && <p className="text-xs text-gray-400">Vendedor: {imagemAtual.vendedor}</p>}
                    </div>
                    <button
                      onClick={() => baixarImagem(imagemAtual.url, imagemAtual.cliente)}
                      className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      <Download size={14} /> Baixar Arte
                    </button>
                  </div>
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="text-xs text-gray-400 underline"
                  >
                    {showPrompt ? "Ocultar" : "Ver"} prompt gerado
                  </button>
                  {showPrompt && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">{imagemAtual.prompt}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-[9/16] max-h-[600px] flex flex-col items-center justify-center text-gray-300 gap-4 p-8">
                <ImageIcon size={64} strokeWidth={1} />
                <p className="text-sm text-center text-gray-400">
                  Preencha o formulário ao lado e clique em <strong className="text-gray-500">Gerar Arte</strong>
                </p>
              </div>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico desta sessão</h3>
              <div className="grid grid-cols-3 gap-2">
                {historico.slice(1).map((arte) => (
                  <div key={arte.timestamp} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white cursor-pointer" onClick={() => setImagemAtual(arte)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={arte.url} alt={arte.cliente} className="w-full aspect-[9/16] object-cover hover:opacity-90 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{arte.cliente}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); baixarImagem(arte.url, arte.cliente); }}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
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
    </div>
  );
}
