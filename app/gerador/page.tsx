"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download, Loader2,
  AlertCircle, CheckCircle2, X, Sparkles, Lock, Wand2,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Paperclip, LogOut, BarChart3,
} from "lucide-react";

interface ArteGerada {
  url: string;
  prompt: string;
  logomarca: string;
  vendedor: string;
  timestamp: number;
}

interface ImagemEnviada {
  id: string;
  file: File;
  preview: string;
}

const VENDEDORES = ["Ketelly", "Manassés", "Raphael", "Jonathas"];

const PROMPT_SUGESTAO = `Faça uma arte de uniformes com os detalhes abaixo:
1- Retire o fundo apenas dos logotipos em anexo.
2- Polo: lisa com detalhes refinados e elegantes.
3- Camiseta: estampa abstrata refinada.`;

// Regras rígidas padrão (você pode editar à vontade na tela)
const REGRAS_PADRAO = `Utilize EXATAMENTE o mockup Rogga gravado em sua memória como base.

ATENÇÃO: O mockup é um TEMPLATE FIXO. Ele funciona como uma moldura e NÃO pode ser alterado.

ALTERAÇÕES PERMITIDAS:
✅ Camisa polo (frente)
✅ Camisa polo (costas)
✅ Camiseta (frente)
✅ Camiseta (costas)
✅ Fundo interno dos quadros onde aparecem as camisas

ALTERAÇÕES PROIBIDAS:
❌ Cabeçalho
❌ Rodapé
❌ Logo Rogga Uniformes
❌ Textos
❌ Ícones
❌ Bordas douradas
❌ Molduras
❌ Espaçamentos
❌ Tamanhos dos quadros
❌ Posicionamento dos elementos
❌ Cores do layout
❌ Informações do vendedor
❌ Estrutura geral do mockup

REGRAS RÍGIDAS:

1. A imagem final deve ser 1080x1920 (9:16).

2. O layout deve permanecer IDÊNTICO ao modelo original.

3. Apenas os conteúdos dos 4 modelos podem ser alterados:
- Polo frente
- Polo costas
- Camiseta frente
- Camiseta costas

4. Sempre aplicar a logomarca enviada:
- Peito esquerdo
- Costas centralizadas
Substituindo exatamente os marcadores de logo do template.

5. Combinação automática de cores:
Escolha as cores dos uniformes com base:
- Na logomarca
- No segmento da empresa
- Na identidade visual do cliente

6. Polo:
- Apenas 2 botões
- Sem listras na gola
- Sem estampas na gola
- Parte interna e externa da carcela obrigatoriamente da mesma cor do tronco

7. Alternância de cores:
A camisa polo e a camiseta devem possuir cores diferentes entre si para gerar contraste visual.

8. Fundo interno dos quadros:
Criar um cenário cinematográfico relacionado ao ramo da empresa.

Exemplos:
- Oficina → oficina premium
- Construção → obra moderna
- Clínica → ambiente médico sofisticado
- Academia → academia premium
- Restaurante → cozinha gourmet
- Transporte → centro logístico

9. O fundo deve possuir:
- Profundidade
- Desfoque natural
- Iluminação cinematográfica
- Alto contraste
- Aspecto premium

10. As camisas devem permanecer totalmente nítidas em primeiro plano.

11. Os logotipos devem permanecer perfeitamente legíveis.

12. Não criar novas áreas gráficas.

13. Não remover nenhuma área gráfica existente.

14. Não modificar nenhuma informação do template.

15. O resultado final deve parecer que apenas as 4 imagens dos uniformes foram substituídas dentro do mockup original.`;

export default function GeradorPage() {
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  const [vendedor, setVendedor] = useState("");
  const [prompt, setPrompt] = useState(PROMPT_SUGESTAO);
  const [imagens, setImagens] = useState<ImagemEnviada[]>([]);
  const [usarMascara, setUsarMascara] = useState(true);

  const [gerando, setGerando] = useState(false);
  const [melhorandoPrompt, setMelhorandoPrompt] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [imagemAtual, setImagemAtual] = useState<ArteGerada | null>(null);
  const [arteParaEditar, setArteParaEditar] = useState<ArteGerada | null>(null);
  const [historico, setHistorico] = useState<ArteGerada[]>([]);
  const [zoom, setZoom] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; papel: string } | null>(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setUsuario(d); });
  }, []);

  const sair = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Lembra as regras entre sessões (salva no navegador)
  useEffect(() => {
    const salvas = localStorage.getItem("rogga-regras");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (salvas) setRegras(salvas);
  }, []);
  useEffect(() => {
    localStorage.setItem("rogga-regras", regras);
  }, [regras]);

  // Barra de progresso animada enquanto gera
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!gerando) { setProgresso(0); return; }
    setProgresso(5);
    /* eslint-enable react-hooks/set-state-in-effect */
    const etapas = [
      { p: 15, t: 2000 }, { p: 30, t: 5000 }, { p: 45, t: 10000 },
      { p: 60, t: 18000 }, { p: 75, t: 28000 }, { p: 88, t: 40000 }, { p: 95, t: 52000 },
    ];
    const timers = etapas.map(({ p, t }) => setTimeout(() => setProgresso(p), t));
    return () => timers.forEach(clearTimeout);
  }, [gerando]);

  const adicionarImagens = useCallback((files: FileList | File[]) => {
    const novas: ImagemEnviada[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const id = `${f.name}-${f.size}-${f.lastModified}-${Math.round(performance.now())}`;
      const r = new FileReader();
      r.onload = (e) => {
        setImagens((prev) =>
          prev.some((x) => x.id === id) ? prev : [...prev, { id, file: f, preview: e.target?.result as string }]
        );
      };
      r.readAsDataURL(f);
      novas.push({ id, file: f, preview: "" });
    });
  }, []);

  const removerImagem = (id: string) => setImagens((prev) => prev.filter((x) => x.id !== id));

  // Colar imagens com Ctrl+V (de qualquer lugar)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const arquivos: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) arquivos.push(f);
        }
      }
      if (arquivos.length) {
        e.preventDefault();
        adicionarImagens(arquivos);
        setSucesso(`${arquivos.length} imagem${arquivos.length !== 1 ? "ns" : ""} colada${arquivos.length !== 1 ? "s" : ""}!`);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [adicionarImagens]);

  const melhorarPromptIA = useCallback(async () => {
    if (!prompt.trim()) { setErro("Escreva um rascunho no prompt para a IA aprimorar."); return; }
    setMelhorandoPrompt(true); setErro(""); setSucesso("");
    try {
      const res = await fetch("/api/melhorar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrompt(data.melhorado);
      setSucesso("Prompt aprimorado pela IA! Revise e gere a arte.");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar prompt.");
    } finally { setMelhorandoPrompt(false); }
  }, [prompt]);

  const gerarArte = useCallback(async () => {
    if (!prompt.trim()) { setErro(arteParaEditar ? "Descreva o que deseja mudar na arte." : "Escreva o prompt da arte que deseja gerar."); return; }
    setGerando(true); setErro(""); setSucesso("");
    try {
      const fd = new FormData();
      fd.append("regras", regras);
      fd.append("prompt", prompt);
      fd.append("usarMascara", String(usarMascara));
      imagens.forEach((img) => fd.append("imagens", img.file));
      // Modo edição: envia a arte atual como base
      if (arteParaEditar) fd.append("baseImage", arteParaEditar.url);

      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/gerar", { method: "POST", body: fd, signal: controller.signal });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Na edição sem novo logo, mantém o nome da marca da arte original
      const nomeMarca = imagens.length > 0 ? (data.logomarca || "Logomarca") : (arteParaEditar?.logomarca || data.logomarca || "Logomarca");
      const nova: ArteGerada = { url: data.url, prompt: data.prompt, logomarca: nomeMarca, vendedor: arteParaEditar?.vendedor || vendedor, timestamp: Date.now() };
      setImagemAtual(nova);
      setHistorico((prev) => [nova, ...prev.slice(0, 11)]);
      setImagens([]); // limpa as imagens anexadas após gerar
      setPrompt(arteParaEditar ? "" : PROMPT_SUGESTAO); // edição: limpa | nova arte: volta a sugestão
      if (arteParaEditar) setArteParaEditar(nova); // permite continuar editando a nova arte
      setSucesso(arteParaEditar ? "Edição aplicada!" : "Arte gerada com sucesso!");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setSucesso(""); setErro("Geração cancelada.");
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao gerar arte.");
      }
    } finally { setGerando(false); abortRef.current = null; }
  }, [regras, prompt, usarMascara, imagens, vendedor, arteParaEditar]);

  const cancelarGeracao = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const montarNomeArquivo = (arte: ArteGerada) => {
    const limpa = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
    const logo = limpa(arte.logomarca) || "Logomarca";
    const vend = limpa(arte.vendedor) || "Vendedor";
    return `${logo} - Proposta de Uniformes - ${vend}.webp`;
  };

  const baixarImagem = useCallback(async (arte: ArteGerada) => {
    try {
      // Carrega a imagem e converte para WebP via canvas
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("load"));
        img.src = arte.url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.95));
      if (!blob) throw new Error("webp");
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = montarNomeArquivo(arte);
      a.href = blobUrl;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch { setErro("Erro ao baixar. Tente clique direito > Salvar imagem."); }
  }, []);

  const card = "bg-[#1a1a1f] rounded-2xl border border-white/8 p-4";
  const textareaCls = "w-full border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600 resize-y leading-relaxed";

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f13]">
      <header className="bg-[#1a1a1f] border-b border-white/5 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">ROGGA UNIFORMES</h1>
            <p className="text-[#C8102E] text-xs font-medium">Gerador de Artes</p>
          </div>
          <Link href={usuario?.papel === "admin" ? "/admin" : "/dashboard"}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-white/10 rounded-full px-4 py-1.5">
            <BarChart3 size={14} /> Painel
          </Link>
          {usuario && <span className="text-sm text-gray-400 hidden sm:inline">{usuario.nome}</span>}
          <button onClick={sair} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ===== FORMULÁRIO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">{arteParaEditar ? "Editar Arte" : "Nova Arte"}</h2>
            <p className="text-gray-500 text-sm">{arteParaEditar ? "Descreva o que deseja mudar na arte atual" : "Escreva as regras, o prompt e adicione as imagens"}</p>
          </div>

          {/* Aviso de modo edição */}
          {arteParaEditar && (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={arteParaEditar.url} alt="Arte sendo editada" className="w-12 h-20 object-cover rounded-lg border border-white/10" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-300">✏️ Editando esta arte</p>
                <p className="text-[11px] text-blue-400/80">Escreva no prompt só o que mudar. Ex: &quot;deixe a polo vermelha&quot;.</p>
              </div>
              <button onClick={() => { setArteParaEditar(null); setPrompt(PROMPT_SUGESTAO); }}
                className="text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5">
                Sair da edição
              </button>
            </div>
          )}

          {/* Vendedor (usado no nome do arquivo) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Vendedor(a)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VENDEDORES.map((v) => (
                <button key={v} onClick={() => setVendedor(v)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${vendedor === v ? "border-[#C8102E] bg-[#C8102E]/10 text-[#C8102E]" : "border-white/10 text-gray-400 hover:border-white/20"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Regras rígidas */}
          <div className={card + " space-y-2"}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <Lock size={14} className="text-[#C8102E]" /> Regras rígidas
              </p>
              <button onClick={() => setRegras(REGRAS_PADRAO)}
                className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
                <RotateCcw size={11} /> Restaurar padrão
              </button>
            </div>
            <p className="text-[11px] text-gray-500">O que a IA NUNCA pode mudar. Fica salvo automaticamente.</p>
            <textarea value={regras} onChange={(e) => setRegras(e.target.value)} rows={10}
              className={textareaCls + " text-xs"} placeholder="Ex: não altere o cabeçalho nem o rodapé..." />
          </div>

          {/* Prompt da arte (com anexos de imagem integrados) */}
          <div className={card + " space-y-2"}>
            <p className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <Wand2 size={14} className="text-[#C8102E]" /> Prompt da arte
            </p>
            <p className="text-[11px] text-gray-500">Descreva a arte e anexe os logos/estampas aqui mesmo (botão de anexo, arrastar ou Ctrl+V).</p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) adicionarImagens(e.dataTransfer.files); }}
              className="border border-white/10 rounded-xl bg-white/5 focus-within:border-[#C8102E] overflow-hidden"
            >
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6}
                className="w-full bg-transparent px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-y leading-relaxed focus:outline-none"
                placeholder={PROMPT_SUGESTAO} />

              {/* Miniaturas das imagens anexadas */}
              {imagens.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pb-2">
                  {imagens.map((img) => (
                    <div key={img.id} className="relative w-14 h-14 rounded-lg border border-[#C8102E]/40 bg-[#C8102E]/5 overflow-hidden flex items-center justify-center">
                      {img.preview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={img.preview} alt={img.file.name} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <Loader2 size={14} className="animate-spin text-gray-500" />
                      )}
                      <button onClick={() => removerImagem(img.id)}
                        className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-gray-300 hover:text-red-400">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Barra de ações */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#C8102E] transition-colors">
                    <Paperclip size={14} /> Anexar imagem
                  </button>
                  <button onClick={melhorarPromptIA} disabled={melhorandoPrompt}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50">
                    {melhorandoPrompt ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {melhorandoPrompt ? "Gerando..." : "Gerar prompt com IA"}
                  </button>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0">{imagens.length} anexada{imagens.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) adicionarImagens(e.target.files); e.target.value = ""; }} />
          </div>

          {/* Opção da máscara */}
          <label className="flex items-start gap-2 cursor-pointer px-1">
            <input type="checkbox" checked={usarMascara} onChange={(e) => setUsarMascara(e.target.checked)}
              className="accent-[#C8102E] w-4 h-4 mt-0.5" />
            <span className="text-sm text-gray-400">
              Travar tudo, menos as camisas <span className="text-gray-600">(recomendado — protege cabeçalho, rodapé e bordas)</span>
            </span>
          </label>

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

          {gerando ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-[#C8102E]/40 text-white font-bold text-base">
                <Loader2 size={20} className="animate-spin" />
                {arteParaEditar ? "Aplicando edição..." : "Gerando arte..."}
              </div>
              <button onClick={cancelarGeracao}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl border-2 border-red-500/60 text-red-300 font-bold hover:bg-red-500/10 transition-colors">
                <X size={20} /> Parar
              </button>
            </div>
          ) : (
            <button onClick={gerarArte}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#C8102E] text-white font-bold text-base hover:bg-red-700 transition-colors shadow-lg shadow-red-900/30">
              <Sparkles size={20} />
              {arteParaEditar ? "Aplicar Edição" : "Gerar Arte"}
            </button>
          )}
        </div>

        {/* ===== RESULTADO ===== */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">Resultado</h2>
            <p className="text-gray-500 text-sm">A arte gerada aparecerá aqui</p>
          </div>

          <div className="bg-[#1a1a1f] rounded-2xl border border-white/8 overflow-hidden shadow-sm w-full">
            {imagemAtual && !gerando && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/3">
                <span className="text-xs text-gray-500 font-medium">Zoom: {Math.round(zoom * 100)}%</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Diminuir"><ZoomOut size={16} /></button>
                  <button onClick={() => setZoom(1)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="100%"><RotateCcw size={14} /></button>
                  <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Ampliar"><ZoomIn size={16} /></button>
                  <button onClick={() => setModalAberto(true)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1" title="Tela cheia"><Maximize2 size={15} /></button>
                </div>
              </div>
            )}

            {gerando ? (
              <div className="w-full aspect-[9/16] flex flex-col items-center justify-center bg-[#0f0f13] p-8 gap-6">
                <div className="text-center">
                  <Loader2 size={40} className="animate-spin text-[#C8102E] mx-auto mb-3" />
                  <p className="text-gray-300 font-semibold text-sm">Gerando sua arte...</p>
                  <p className="text-gray-600 text-xs mt-1">A IA está criando a proposta. Pode levar até 60 segundos.</p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-gray-500"><span>Progresso</span><span>{progresso}%</span></div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full bg-[#C8102E] transition-all duration-1000 ease-out" style={{ width: `${progresso}%` }} />
                  </div>
                </div>
              </div>
            ) : imagemAtual ? (
              <div className="overflow-auto flex items-start justify-center bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemAtual.url} alt="Arte gerada"
                  className="object-contain transition-transform duration-200 cursor-zoom-in"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", maxHeight: "650px", width: "100%" }}
                  onClick={() => setModalAberto(true)} />
              </div>
            ) : (
              <div className="w-full aspect-[9/16] max-h-[650px] flex flex-col items-center justify-center bg-gradient-to-b from-[#0d1117] via-[#111827] to-[#0d1117] p-8 text-center">
                <div className="w-24 h-24 rounded-full border-[3px] border-[#C8102E] flex items-center justify-center bg-[#C8102E]/10 mb-6">
                  <Sparkles size={32} className="text-[#C8102E]" />
                </div>
                <h2 className="text-white text-3xl font-black tracking-widest">ROGGA</h2>
                <h3 className="text-white/60 text-lg font-light tracking-[0.4em] mt-1 mb-6">UNIFORMES</h3>
                <p className="text-white/40 text-xs leading-relaxed max-w-[80%]">
                  Preencha o formulário ao lado e clique em <span className="text-[#C8102E] font-bold">Gerar Arte</span>
                </p>
              </div>
            )}

            <div className="p-4 space-y-3">
              {imagemAtual ? (
                <>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setArteParaEditar(imagemAtual); setPrompt(""); setSucesso(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="flex items-center gap-2 border border-white/15 text-gray-200 px-4 py-2 rounded-full text-sm font-semibold hover:border-[#C8102E] hover:text-white transition-colors">
                      <Wand2 size={14} /> Editar
                    </button>
                    <button onClick={() => baixarImagem(imagemAtual)}
                      className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors">
                      <Download size={14} /> Baixar Arte
                    </button>
                  </div>
                  <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-gray-600 hover:text-gray-400 underline">
                    {showPrompt ? "Ocultar" : "Ver"} prompt enviado
                  </button>
                  {showPrompt && <p className="text-xs text-gray-500 bg-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">{imagemAtual.prompt}</p>}
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
                    <img src={arte.url} alt="arte" className="w-full aspect-[9/16] object-cover hover:opacity-80 transition-opacity" />
                    <button onClick={(e) => { e.stopPropagation(); baixarImagem(arte); }}
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
            <span className="text-white text-sm font-semibold">Arte gerada</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><ZoomOut size={18} /></button>
              <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><ZoomIn size={18} /></button>
              <button onClick={() => setZoom(1)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs">100%</button>
              <button onClick={() => baixarImagem(imagemAtual)}
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
