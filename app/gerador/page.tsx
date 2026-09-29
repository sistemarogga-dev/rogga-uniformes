"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Download, Loader2, AlertCircle, X, Sparkles, Wand2, ZoomIn, ZoomOut,
  RotateCcw, Paperclip, ArrowUp, Square, Settings, SquarePen,
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

interface Mensagem {
  id: string;
  papel: "user" | "assistant";
  texto: string;
  anexos?: string[];
  arte?: ArteGerada;
  status?: "pensando" | "gerando" | "erro";
}

const VENDEDORES = ["Ketelly", "Manassés", "Raphael", "Jonathas"];

const SUGESTOES = [
  "Crie uma arte com o logo em anexo, cores automáticas pelo ramo da empresa",
  "Polo azul-marinho, camiseta branca e fundos de escritório moderno",
  "Me dê 3 ideias de combinação de cores para uma oficina mecânica",
];

// Regras rígidas padrão (editáveis em Configurações)
const REGRAS_PADRAO = `Use a PRIMEIRA imagem (arte de referência da Rogga) como base. Ela é um TEMPLATE FIXO e o resultado deve ser IDÊNTICO a ela.

O QUE PODE MUDAR (SOMENTE ISSO):
✅ Os produtos: polo piquet (frente e costas), camiseta (frente e costas), bag de cordão e windbanner — cores e aplicação da logomarca do cliente
✅ As imagens de contexto (fundo fotográfico) atrás dos produtos, dentro de cada quadro

O QUE NÃO PODE MUDAR:
❌ Cabeçalho (ROGGA Uniformes, "PROPOSTA DE UNIFORMES" e o subtítulo)
❌ Etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) e seus ícones
❌ Bordas douradas, molduras, cantos arredondados e espaçamentos
❌ Posição e tamanho dos 4 quadros
❌ Rodapé (site, Instagram e "Atendimento para todo o Brasil")
❌ Tipo, posição, tamanho, ângulo e enquadramento de cada produto

REGRAS:
1. Substituir cada "LOGO AQUI" pela logomarca enviada:
- Polo e camiseta: peito esquerdo na frente e centralizada nas costas
- Bag e windbanner: centralizada
Retire o fundo dos logotipos anexados.

2. Cores dos produtos escolhidas pela logomarca, pelo segmento e pela identidade visual do cliente. A polo e a camiseta devem ter cores diferentes entre si para gerar contraste.

3. Polo: apenas 2 botões, sem listras e sem estampas na gola, carcela da mesma cor do tronco.

4. Fundo de cada quadro: cenário fotográfico ligado ao ramo do cliente (ex: oficina → oficina premium; clínica → ambiente médico sofisticado; academia → academia premium; restaurante → cozinha gourmet; construção → obra moderna; transporte → centro logístico), com profundidade, desfoque natural, iluminação cinematográfica e aspecto premium. O fundo cobre 100% do quadro.

5. Os produtos ficam totalmente nítidos em primeiro plano e os logotipos perfeitamente legíveis.

6. Não criar nem remover áreas gráficas. O resultado deve parecer a arte de referência com apenas os produtos e os fundos trocados.`;

const novoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const lerPreview = (f: File) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target?.result as string);
    r.readAsDataURL(f);
  });

export default function GeradorPage() {
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  const [vendedor, setVendedor] = useState("");
  const [usarMascara, setUsarMascara] = useState(true);

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<ImagemEnviada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [gerandoImagem, setGerandoImagem] = useState(false);
  const [baseArte, setBaseArte] = useState<ArteGerada | null>(null);
  const [aviso, setAviso] = useState("");

  const [arteModal, setArteModal] = useState<ArteGerada | null>(null);
  const [zoom, setZoom] = useState(1);
  const [configAberta, setConfigAberta] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Configurações lembradas no navegador
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const r = localStorage.getItem("rogga-regras-v2");
    if (r) setRegras(r);
    const v = localStorage.getItem("rogga-vendedor");
    if (v) setVendedor(v);
    if (localStorage.getItem("rogga-mascara") === "false") setUsarMascara(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => { localStorage.setItem("rogga-regras-v2", regras); }, [regras]);
  useEffect(() => { if (vendedor) localStorage.setItem("rogga-vendedor", vendedor); }, [vendedor]);
  useEffect(() => { localStorage.setItem("rogga-mascara", String(usarMascara)); }, [usarMascara]);

  // Progresso animado enquanto a imagem é gerada
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!gerandoImagem) { setProgresso(0); return; }
    setProgresso(5);
    /* eslint-enable react-hooks/set-state-in-effect */
    const etapas = [
      { p: 15, t: 2000 }, { p: 30, t: 5000 }, { p: 45, t: 10000 },
      { p: 60, t: 18000 }, { p: 75, t: 28000 }, { p: 88, t: 40000 }, { p: 95, t: 52000 },
    ];
    const timers = etapas.map(({ p, t }) => setTimeout(() => setProgresso(p), t));
    return () => timers.forEach(clearTimeout);
  }, [gerandoImagem]);

  // Rola para a última mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens]);

  // Textarea cresce com o conteúdo (até um limite)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [texto]);

  const adicionarImagens = useCallback(async (files: FileList | File[]) => {
    const validos = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const novas = await Promise.all(
      validos.map(async (f) => ({ id: novoId(), file: f, preview: await lerPreview(f) }))
    );
    setImagens((prev) => [...prev, ...novas]);
  }, []);

  const removerImagem = (id: string) => setImagens((prev) => prev.filter((x) => x.id !== id));

  // Colar prints/imagens e texto com Ctrl+V de qualquer lugar da tela: imagens viram
  // anexos e o texto vai para a caixa de mensagem (mesmo sem ela estar focada).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dados = e.clipboardData;
      if (!dados) return;
      const arquivos: File[] = [];
      for (const item of Array.from(dados.items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) arquivos.push(f);
        }
      }
      const textoColado = dados.getData("text/plain");
      const alvo = e.target as HTMLElement | null;
      const noComposer = alvo === textareaRef.current;
      const emOutroCampo = !noComposer && !!alvo?.closest("input, textarea, [contenteditable]");

      if (arquivos.length) adicionarImagens(arquivos);

      // Texto: no próprio composer o navegador cola sozinho (se não houver imagem junto);
      // em outro campo (ex: regras) não interferimos; fora de campos, mandamos pro composer.
      if (emOutroCampo) { if (arquivos.length) e.preventDefault(); return; }
      if (noComposer && !arquivos.length) return;
      e.preventDefault();
      if (textoColado) {
        const el = textareaRef.current;
        const ini = el && noComposer ? el.selectionStart : texto.length;
        const fim = el && noComposer ? el.selectionEnd : texto.length;
        setTexto(texto.slice(0, ini) + textoColado + texto.slice(fim));
      }
      textareaRef.current?.focus();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [adicionarImagens, texto]);

  const atualizarMsg = (id: string, dados: Partial<Mensagem>) =>
    setMensagens((prev) => prev.map((m) => (m.id === id ? { ...m, ...dados } : m)));

  const enviar = useCallback(async (textoForcado?: string) => {
    const conteudo = (textoForcado ?? texto).trim();
    if ((!conteudo && imagens.length === 0) || ocupado) return;

    const anexosEnviados = imagens;
    const userMsg: Mensagem = {
      id: novoId(), papel: "user",
      texto: conteudo || "Crie uma arte com as imagens em anexo.",
      anexos: anexosEnviados.map((i) => i.preview),
    };
    const respId = novoId();
    const historico = [...mensagens, userMsg];
    setMensagens([...historico, { id: respId, papel: "assistant", texto: "", status: "pensando" }]);
    setTexto("");
    setImagens([]);
    setAviso("");
    setOcupado(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1) Conversa: o assistente responde ou decide gerar/editar
      const resChat = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mensagens: historico.map((m) => ({
            papel: m.papel,
            texto: m.arte ? `${m.texto}\n[arte gerada e exibida ao usuário]` : m.texto,
          })),
          temArte: !!baseArte,
          anexos: anexosEnviados.length,
        }),
      });
      const chat = await resChat.json();
      if (chat.error) throw new Error(chat.error);

      if (chat.tipo === "texto") {
        atualizarMsg(respId, { texto: chat.texto, status: undefined });
        return;
      }

      // 2) Geração da arte
      const editando = chat.modo === "editar" ? baseArte : null;
      atualizarMsg(respId, { texto: chat.texto, status: "gerando" });
      setGerandoImagem(true);

      const fd = new FormData();
      fd.append("regras", regras);
      fd.append("prompt", chat.prompt);
      fd.append("usarMascara", String(usarMascara));
      anexosEnviados.forEach((img) => fd.append("imagens", img.file));
      if (editando) fd.append("baseImage", editando.url);

      const res = await fetch("/api/gerar", { method: "POST", body: fd, signal: controller.signal });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Na edição sem novo logo, mantém o nome da marca da arte original
      const nomeMarca = anexosEnviados.length > 0
        ? (data.logomarca || "Logomarca")
        : (editando ? editando.logomarca : data.logomarca) || "Logomarca";
      const nova: ArteGerada = {
        url: data.url, prompt: data.prompt, logomarca: nomeMarca,
        vendedor: (editando ? editando.vendedor : "") || vendedor, timestamp: Date.now(),
      };
      atualizarMsg(respId, { arte: nova, status: undefined });
      setBaseArte(nova);
    } catch (e: unknown) {
      const cancelado = e instanceof DOMException && e.name === "AbortError";
      atualizarMsg(respId, {
        status: "erro",
        texto: cancelado ? "Geração interrompida." : (e instanceof Error ? e.message : "Erro ao processar."),
      });
    } finally {
      setOcupado(false);
      setGerandoImagem(false);
      abortRef.current = null;
    }
  }, [texto, imagens, ocupado, mensagens, baseArte, regras, usarMascara, vendedor]);

  const parar = () => abortRef.current?.abort();

  const novaConversa = () => {
    if (ocupado) parar();
    setMensagens([]);
    setBaseArte(null);
    setImagens([]);
    setTexto("");
    setAviso("");
    textareaRef.current?.focus();
  };

  const montarNomeArquivo = (arte: ArteGerada) => {
    const limpa = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
    const logo = limpa(arte.logomarca) || "Logomarca";
    const vend = limpa(arte.vendedor || vendedor) || "Vendedor";
    return `${logo} - Proposta de Uniformes - ${vend}.webp`;
  };

  const baixarImagem = async (arte: ArteGerada) => {
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
    } catch { setAviso("Erro ao baixar. Abra a arte e use clique direito > Salvar imagem."); }
  };

  const editarEsta = (arte: ArteGerada) => {
    setBaseArte(arte);
    textareaRef.current?.focus();
  };

  const vazio = mensagens.length === 0;

  // ─── Caixa de mensagem (reaproveitada no estado vazio e no rodapé) ───────────
  const composer = (
    <div className="w-full">
      {baseArte && !vazio && (
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={baseArte.url} alt="" className="w-6 h-10 object-cover rounded border border-white/10" />
          <span>Próximas alterações serão aplicadas nesta arte. Para começar do zero, peça &quot;uma arte nova&quot;.</span>
        </div>
      )}
      <div
        className={`rounded-3xl border bg-[#1e1e24] transition-colors ${arrastando ? "border-[#C8102E]" : "border-white/10 focus-within:border-white/25"}`}
      >
        {imagens.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {imagens.map((img) => (
              <div key={img.id} className="relative w-16 h-16 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.file.name} className="w-full h-full object-contain p-1" />
                <button onClick={() => removerImagem(img.id)} aria-label="Remover imagem"
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-gray-300 hover:text-white">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          placeholder={baseArte ? "Peça uma alteração ou uma arte nova..." : "Descreva a arte, cole um print (Ctrl+V) ou anexe o logo do cliente..."}
          className="w-full bg-transparent px-5 pt-4 pb-2 text-[15px] text-gray-100 placeholder-gray-500 resize-none leading-relaxed focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <button onClick={() => fileRef.current?.click()} title="Anexar imagem"
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Paperclip size={18} />
          </button>
          {ocupado ? (
            <button onClick={parar} title="Parar"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 transition-colors">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button onClick={() => enviar()} title="Enviar" disabled={!texto.trim() && imagens.length === 0}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 disabled:bg-white/20 disabled:text-white/40 transition-colors">
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) adicionarImagens(e.target.files); e.target.value = ""; }} />
    </div>
  );

  return (
    <div
      className="flex flex-col h-dvh bg-[#131317] text-gray-100"
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) adicionarImagens(e.dataTransfer.files); }}
    >
      {/* ===== TOPO ===== */}
      <header className="flex items-center gap-2 px-3 sm:px-4 h-14 shrink-0">
        <button onClick={novaConversa} title="Nova conversa"
          className="p-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors">
          <SquarePen size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="font-bold tracking-wide text-white">ROGGA</span>
          <span className="text-[#C8102E] font-semibold ml-1.5 text-sm">Gerador de Artes</span>
        </div>
        <button onClick={() => setConfigAberta(true)} title="Configurações"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <Settings size={18} />
        </button>
      </header>

      {vazio ? (
        /* ===== ESTADO VAZIO ===== */
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-3xl">
            <h1 className="text-center text-2xl sm:text-3xl font-semibold text-white mb-8">
              O que vamos criar hoje{vendedor ? `, ${vendedor}` : ""}?
            </h1>
            {composer}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => setTexto(s)}
                  className="text-xs sm:text-sm text-gray-400 border border-white/10 rounded-full px-3.5 py-1.5 hover:bg-white/5 hover:text-gray-200 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* ===== CONVERSA ===== */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {mensagens.map((m) =>
                m.papel === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-2">
                    {m.anexos && m.anexos.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-2">
                        {m.anexos.map((src, i) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img key={i} src={src} alt="Anexo" className="w-24 h-24 object-contain rounded-2xl bg-white/5 border border-white/10 p-1" />
                        ))}
                      </div>
                    )}
                    <div className="max-w-[85%] bg-[#2a2a31] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {m.texto}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#C8102E] flex items-center justify-center text-[11px] font-black text-white">
                      R
                    </div>
                    <div className="flex-1 min-w-0 pt-1 space-y-3">
                      {m.status === "pensando" && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Loader2 size={15} className="animate-spin" /> Pensando...
                        </div>
                      )}
                      {m.texto && (
                        <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${m.status === "erro" ? "text-red-400 flex gap-2" : "text-gray-100"}`}>
                          {m.status === "erro" && <AlertCircle size={16} className="mt-1 shrink-0" />}
                          {m.texto}
                        </p>
                      )}
                      {m.status === "gerando" && (
                        <div className="w-full max-w-[300px] aspect-[9/16] rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-4 p-6">
                          <Sparkles size={28} className="text-[#C8102E] animate-pulse" />
                          <p className="text-sm text-gray-400 text-center">Criando a arte...<br /><span className="text-xs text-gray-600">pode levar até 1 minuto</span></p>
                          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-[#C8102E] transition-all duration-1000 ease-out" style={{ width: `${progresso}%` }} />
                          </div>
                        </div>
                      )}
                      {m.arte && (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.arte.url} alt="Arte gerada" onClick={() => { setArteModal(m.arte!); setZoom(1); }}
                            className={`w-full max-w-[300px] rounded-2xl border cursor-zoom-in ${baseArte?.timestamp === m.arte.timestamp ? "border-[#C8102E]/60" : "border-white/10"}`} />
                          <div className="flex flex-wrap items-center gap-1">
                            <button onClick={() => baixarImagem(m.arte!)}
                              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                              <Download size={14} /> Baixar
                            </button>
                            {baseArte?.timestamp === m.arte.timestamp ? (
                              <span className="flex items-center gap-1.5 text-xs text-[#e0435c] px-2.5 py-1.5">
                                <Wand2 size={14} /> Em edição
                              </span>
                            ) : (
                              <button onClick={() => editarEsta(m.arte!)}
                                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                                <Wand2 size={14} /> Editar esta
                              </button>
                            )}
                            <details className="text-xs text-gray-500 w-full">
                              <summary className="cursor-pointer hover:text-gray-300 px-2.5 py-1 w-fit">Ver prompt enviado</summary>
                              <p className="mt-1 bg-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">{m.arte.prompt}</p>
                            </details>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
              <div ref={fimRef} />
            </div>
          </main>

          {/* ===== RODAPÉ COM A CAIXA DE MENSAGEM ===== */}
          <div className="shrink-0 px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              {aviso && (
                <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
                  <AlertCircle size={14} /> {aviso}
                </div>
              )}
              {composer}
              <p className="text-center text-[11px] text-gray-600 mt-2">
                Enter envia · Shift+Enter quebra linha · arraste ou cole (Ctrl+V) imagens
              </p>
            </div>
          </div>
        </>
      )}

      {/* ===== CONFIGURAÇÕES ===== */}
      {configAberta && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setConfigAberta(false)}>
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-[#1e1e24] border border-white/10 rounded-2xl p-5 space-y-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Configurações</h2>
              <button onClick={() => setConfigAberta(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Vendedor(a) <span className="font-normal text-gray-500">— usado no nome do arquivo</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VENDEDORES.map((v) => (
                  <button key={v} onClick={() => setVendedor(v)}
                    className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-colors ${vendedor === v ? "border-[#C8102E] bg-[#C8102E]/10 text-[#e0435c]" : "border-white/10 text-gray-400 hover:border-white/25"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={usarMascara} onChange={(e) => setUsarMascara(e.target.checked)}
                className="accent-[#C8102E] w-4 h-4 mt-0.5" />
              <span className="text-sm text-gray-300">
                Travar tudo, menos os produtos <span className="text-gray-500">(recomendado — protege cabeçalho, etiquetas, rodapé e bordas)</span>
              </span>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-300">Regras rígidas</p>
                <button onClick={() => setRegras(REGRAS_PADRAO)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <RotateCcw size={12} /> Restaurar padrão
                </button>
              </div>
              <p className="text-xs text-gray-500">Enviadas em toda geração. Ficam salvas neste navegador.</p>
              <textarea value={regras} onChange={(e) => setRegras(e.target.value)} rows={14}
                className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs bg-black/20 text-gray-200 resize-y leading-relaxed focus:outline-none focus:border-white/25" />
            </div>
          </div>
        </div>
      )}

      {/* ===== TELA CHEIA ===== */}
      {arteModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-white/10">
            <button onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.25).toFixed(2)))}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><ZoomOut size={18} /></button>
            <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><ZoomIn size={18} /></button>
            <button onClick={() => baixarImagem(arteModal)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#C8102E] hover:bg-red-700 text-white text-xs font-semibold">
              <Download size={14} /> Baixar
            </button>
            <button onClick={() => setArteModal(null)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={arteModal.url} alt="Arte gerada"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
              className="max-w-sm w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
