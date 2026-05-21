"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Download,
  Wand2,
  ChevronLeft,
  Loader2,
  Image as ImageIcon,
  Layers,
  ShoppingBag,
  Shirt,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type TipoArte = "uniforme" | "logo" | "estampa" | "catalogo";

interface ArteGerada {
  url: string;
  prompt: string;
  tipo: TipoArte;
  timestamp: number;
}

const TIPOS: { id: TipoArte; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "uniforme", label: "Mockup de Uniforme", icon: <Shirt size={20} />, desc: "Visualização completa do uniforme" },
  { id: "logo", label: "Logo / Identidade", icon: <Sparkles size={20} />, desc: "Logotipo para bordado ou estampa" },
  { id: "estampa", label: "Estampa & Bordado", icon: <Layers size={20} />, desc: "Design para produção gráfica" },
  { id: "catalogo", label: "Catálogo", icon: <ShoppingBag size={20} />, desc: "Foto profissional de produto" },
];

export default function GeradorPage() {
  const [tipo, setTipo] = useState<TipoArte>("uniforme");
  const [descricao, setDescricao] = useState("");
  const [melhorandoPrompt, setMelhorandoPrompt] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [imagemAtual, setImagemAtual] = useState<ArteGerada | null>(null);
  const [historico, setHistorico] = useState<ArteGerada[]>([]);

  const melhorarPrompt = useCallback(async () => {
    if (!descricao.trim()) return;
    setMelhorandoPrompt(true);
    setErro("");
    try {
      const res = await fetch("/api/melhorar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: descricao, tipo }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDescricao(data.melhorado);
      setSucesso("Descrição aprimorada pela IA!");
      setTimeout(() => setSucesso(""), 3000);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao melhorar prompt.");
    } finally {
      setMelhorandoPrompt(false);
    }
  }, [descricao, tipo]);

  const gerarImagem = useCallback(async () => {
    if (!descricao.trim()) {
      setErro("Por favor, descreva a arte que deseja criar.");
      return;
    }
    setGerando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: descricao, tipo }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const nova: ArteGerada = {
        url: data.url,
        prompt: data.prompt,
        tipo,
        timestamp: Date.now(),
      };
      setImagemAtual(nova);
      setHistorico((prev) => [nova, ...prev.slice(0, 11)]);
      setSucesso("Arte gerada com sucesso!");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar imagem.");
    } finally {
      setGerando(false);
    }
  }, [descricao, tipo]);

  const baixarImagem = useCallback(async (url: string, index: number) => {
    try {
      const a = document.createElement("a");
      a.download = `rogga-arte-${index + 1}.png`;
      if (url.startsWith("data:")) {
        // base64 — link direto
        a.href = url;
        a.click();
      } else {
        // URL externa — fetch + blob
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      setErro("Erro ao baixar a imagem. Tente clique direito > Salvar imagem.");
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#C8102E] text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-red-200 hover:text-white transition-colors text-sm">
            <ChevronLeft size={16} />
            Início
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">ROGGA UNIFORMES</h1>
            <p className="text-red-200 text-xs">Gerador de Artes com IA</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-red-200">
            <ImageIcon size={14} />
            <span>{historico.length} arte{historico.length !== 1 ? "s" : ""} gerada{historico.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Criação */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Criar Nova Arte</h2>
            <p className="text-gray-500 text-sm">Escolha o tipo, descreva e gere em segundos</p>
          </div>

          {/* Tipo de Arte */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tipo de Arte</label>
            <div className="grid grid-cols-2 gap-3">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    tipo === t.id
                      ? "border-[#C8102E] bg-red-50 text-[#C8102E]"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{t.icon}</div>
                  <div>
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descreva a arte
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              placeholder={
                tipo === "uniforme"
                  ? "Ex: Uniforme de futebol azul e branco com número 10, gola polo, escudo do time no peito esquerdo..."
                  : tipo === "logo"
                  ? "Ex: Logo com iniciais JM, estilo minimalista, cores azul marinho e dourado, adequado para bordado..."
                  : tipo === "estampa"
                  ? "Ex: Estampa de águia com asas abertas, estilo tribal, monocromático, centralizado nas costas..."
                  : "Ex: Conjunto de camisas polo corporativas cinza e vermelhas, exibidas em cabide, fundo branco..."
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#C8102E] focus:ring-1 focus:ring-[#C8102E] bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">{descricao.length} caracteres</p>
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

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={melhorarPrompt}
              disabled={melhorandoPrompt || !descricao.trim() || gerando}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#C8102E] text-[#C8102E] font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {melhorandoPrompt ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              {melhorandoPrompt ? "Melhorando..." : "Aprimorar com IA"}
            </button>

            <button
              onClick={gerarImagem}
              disabled={gerando || !descricao.trim() || melhorandoPrompt}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#C8102E] text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              {gerando ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {gerando ? "Gerando arte..." : "Gerar Arte"}
            </button>
          </div>

          {gerando && (
            <p className="text-center text-xs text-gray-400 animate-pulse">
              A IA está criando sua arte... isso pode levar até 30 segundos ⚡
            </p>
          )}
        </div>

        {/* Painel de Resultado */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Resultado</h2>
            <p className="text-gray-500 text-sm">Sua arte gerada aparecerá aqui</p>
          </div>

          {/* Imagem atual */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {imagemAtual ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagemAtual.url}
                  alt="Arte gerada"
                  className="w-full aspect-square object-cover"
                />
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500 flex-1 truncate">
                    {TIPOS.find((t) => t.id === imagemAtual.tipo)?.label}
                  </div>
                  <button
                    onClick={() => baixarImagem(imagemAtual.url, 0)}
                    className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    <Download size={14} />
                    Baixar
                  </button>
                </div>
              </div>
            ) : (
              <div className="aspect-square flex flex-col items-center justify-center text-gray-300 gap-4 p-8">
                <ImageIcon size={64} strokeWidth={1} />
                <p className="text-sm text-center">
                  Preencha a descrição ao lado e clique em <strong>Gerar Arte</strong>
                </p>
              </div>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico desta sessão</h3>
              <div className="grid grid-cols-3 gap-2">
                {historico.slice(1).map((arte, i) => (
                  <div key={arte.timestamp} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={arte.url}
                      alt={`Arte ${i + 2}`}
                      className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setImagemAtual(arte)}
                    />
                    <button
                      onClick={() => baixarImagem(arte.url, i + 1)}
                      className="absolute bottom-1 right-1 bg-black/60 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Baixar"
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
