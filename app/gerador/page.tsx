"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Download, Loader2, AlertCircle, X, Sparkles, Wand2,
  RotateCcw, Paperclip, ArrowUp, Square, Settings, SquarePen, PanelLeftClose, Trash2,
  Timer, MessageSquare, PanelLeftOpen, Pencil, Columns2,
} from "lucide-react";
import {
  type ArteGerada, type Mensagem, type Conversa, type Qualidade,
  listarConversas, salvarConversa, excluirConversa,
} from "./historico";
import { REGRAS_PADRAO, REGRAS_EDICAO_PADRAO } from "./regras";
import TelaSenha from "./componentes/TelaSenha";
import Configuracoes from "./componentes/Configuracoes";
import Comparacao from "./componentes/Comparacao";
import TelaCheia from "./componentes/TelaCheia";
import { type ImagemEnviada, mensagensLeves, miniatura, segundos, novoId, lerPreview, ehPropostaRogga } from "./utilidades";

export default function GeradorPage() {
  const [regras, setRegras] = useState(REGRAS_PADRAO);
  const [regrasEdicao, setRegrasEdicao] = useState(REGRAS_EDICAO_PADRAO);
  const [usarMascara, setUsarMascara] = useState(true);
  // Qualidade da imagem: "low" (padrão, bem mais barata) ou "medium" (mais detalhe)
  const [qualidade, setQualidade] = useState<Qualidade>("low");

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
  // Lista percorrida pelas setas na tela cheia (as artes da conversa)
  const [listaModal, setListaModal] = useState<ArteGerada[]>([]);
  const indiceModal = arteModal ? listaModal.findIndex((a) => a.timestamp === arteModal.timestamp) : -1;
  const abrirModal = (arte: ArteGerada, lista: ArteGerada[]) => {
    setArteModal(arte);
    setListaModal(lista);
    setZoom(1);
  };
  // Calcula a partir da arte atual (updater), para teclas rápidas não "pularem" passos
  const navegarModal = useCallback((passo: number) => {
    setArteModal((atual) => {
      const i = atual ? listaModal.findIndex((a) => a.timestamp === atual.timestamp) : -1;
      const j = i + passo;
      return i < 0 || j < 0 || j >= listaModal.length ? atual : listaModal[j];
    });
    setZoom(1);
  }, [listaModal]);
  // Teclado na tela cheia: ← → trocam de arte, Esc fecha
  useEffect(() => {
    if (!arteModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); navegarModal(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navegarModal(1); }
      else if (e.key === "Escape") setArteModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arteModal, navegarModal]);
  // Artes já baixadas nesta sessão (o botão "Baixar" fica azul depois do clique)
  const [baixadas, setBaixadas] = useState<Set<number>>(new Set());
  // Comparar antes/depois de uma edição
  const [comparar, setComparar] = useState<{ antes: string; depois: string; titulo: string } | null>(null);
  useEffect(() => {
    if (!comparar) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setComparar(null); } };
    window.addEventListener("keydown", onKey, true); // antes do Esc da tela cheia
    return () => window.removeEventListener("keydown", onKey, true);
  }, [comparar]);
  const [configAberta, setConfigAberta] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  // Barra lateral de conversas
  const [lateralAberta, setLateralAberta] = useState(false);
  // "Agora" para os rótulos Hoje/Ontem das conversas
  const [agora, setAgora] = useState(() => Date.now());

  // ─── Conversas (lateral) — salvas NESTE navegador ────────────────────────────
  // Ficam no IndexedDB de cada designer, com as artes dentro delas. Nada é guardado
  // na nuvem: quem quiser manter uma arte, baixa.
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const conversaIdRef = useRef<string | null>(null); // id síncrono (usado dentro do enviar)
  const salvoRef = useRef(""); // assinatura do que já foi salvo (evita salvar à toa)

  const carregarConversas = useCallback(async () => {
    setConversas(await listarConversas());
    setAgora(Date.now());
  }, []);

  // Só o que já terminou vai para o histórico (nada de "Pensando..." nem prévia).
  // Artes antigas, que estavam na nuvem, ficam pelo endereço.
  const mensagensEstaveis = (msgs: Mensagem[]) =>
    msgs
      .filter((m) => !m.status || m.status === "erro")
      .map((m) => ({
        ...m,
        previa: undefined,
        inicio: undefined,
        arte: m.arte?.caminho ? { ...m.arte, url: `/api/artes/imagem?p=${encodeURIComponent(m.arte.caminho)}` } : m.arte,
      }));
  const assinaturaDe = (id: string, msgs: Mensagem[]) =>
    id + ":" + msgs.map((m) => `${m.id}.${m.arte?.timestamp ?? ""}.${m.status ?? ""}.${m.texto.length}`).join("|");

  // Salva a conversa aberta sempre que ela muda
  useEffect(() => {
    if (!conversaId) return;
    const estaveis = mensagensEstaveis(mensagens);
    if (!estaveis.length) return;
    const assinatura = assinaturaDe(conversaId, estaveis);
    if (assinatura === salvoRef.current) return;
    salvoRef.current = assinatura;
    const antiga = conversas.find((c) => c.id === conversaId);
    const titulo = antiga?.titulo
      || estaveis.find((m) => m.papel === "user")?.texto.replace(/\s+/g, " ").slice(0, 60)
      || "Nova conversa";
    const conversa: Conversa = { id: conversaId, titulo, criadaEm: antiga?.criadaEm ?? Date.now(), atualizadaEm: Date.now(), mensagens: estaveis };
    setConversas([conversa, ...conversas.filter((x) => x.id !== conversaId)]);
    mensagensLeves(estaveis).then((leves) => salvarConversa({ ...conversa, mensagens: leves }));
  }, [mensagens, conversaId, conversas]);

  // ─── Senha da equipe ────────────────────────────────────────────────────────
  const [acesso, setAcesso] = useState<"verificando" | "ok" | "bloqueado">("verificando");
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    fetch("/api/acesso").then((r) => r.json()).then((d) => {
      setAcesso(d.ok ? "ok" : "bloqueado");
      if (d.ok) carregarConversas();
    }).catch(() => setAcesso("ok"));
  }, [carregarConversas]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntrando(true); setErroSenha("");
    try {
      const r = await fetch("/api/acesso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha }) });
      const d = await r.json();
      if (!d.ok) { setErroSenha(d.error || "Senha incorreta."); return; }
      setSenha(""); setAcesso("ok");
      carregarConversas();
    } catch { setErroSenha("Sem conexão. Tente de novo."); }
    finally { setEntrando(false); }
  };

  useEffect(() => {
    // Desktop abre a lateral por padrão; celular começa fechada
    let salvo: string | null = null;
    try { salvo = localStorage.getItem("rogga-lateral"); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLateralAberta(salvo ? salvo === "1" : window.innerWidth >= 1024);
  }, []);

  const alternarLateral = (aberta: boolean) => {
    setLateralAberta(aberta);
    try { localStorage.setItem("rogga-lateral", aberta ? "1" : "0"); } catch {}
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Configurações lembradas no navegador
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const re = localStorage.getItem("rogga-regras-edicao-v2");
    if (re) setRegrasEdicao(re);
    const r = localStorage.getItem("rogga-regras-v3");
    if (r) setRegras(r);
    if (localStorage.getItem("rogga-mascara") === "false") setUsarMascara(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => { localStorage.setItem("rogga-regras-v3", regras); }, [regras]);
  useEffect(() => { localStorage.setItem("rogga-regras-edicao-v2", regrasEdicao); }, [regrasEdicao]);
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

  // Cronômetro: "tique" a cada segundo enquanto há um pedido em andamento
  const [tique, setTique] = useState(() => Date.now());
  useEffect(() => {
    if (!ocupado) return;
    const t = setInterval(() => setTique(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ocupado]);

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
      const emOutroCampo = !noComposer && typeof alvo?.closest === "function" && !!alvo.closest("input, textarea, [contenteditable]");

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

  // reenvio: mensagem editada — refaz a conversa a partir dela (as seguintes saem)
  const enviar = useCallback(async (textoForcado?: string, reenvio?: { antes: Mensagem[]; anexos: ImagemEnviada[] }) => {
    const anexosEnviados = reenvio ? reenvio.anexos : imagens;
    const conteudo = (textoForcado ?? texto).trim();
    if ((!conteudo && anexosEnviados.length === 0) || ocupado) return;

    // Primeira mensagem de uma conversa nova: cria a conversa no histórico
    if (!conversaIdRef.current) {
      conversaIdRef.current = novoId();
      setConversaId(conversaIdRef.current);
    }

    const inicio = Date.now();
    const userMsg: Mensagem = {
      id: novoId(), papel: "user",
      texto: conteudo || "Crie uma arte com as imagens em anexo.",
      anexos: anexosEnviados.map((i) => i.preview),
    };
    const respId = novoId();
    const historico = [...(reenvio ? reenvio.antes : mensagens), userMsg];
    setMensagens([...historico, { id: respId, papel: "assistant", texto: "", status: "pensando", inicio }]);
    if (!reenvio) { setTexto(""); setImagens([]); }
    setAviso("");
    setOcupado(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 0) Proposta da Rogga anexada? (o designer baixou a arte e anexou de volta pedindo
      //    mudanças). Ela vira a arte a EDITAR — com todas as proteções da edição —
      //    em vez de ser tratada como um logo e gerar tudo do zero.
      let propostaAnexada: ImagemEnviada | null = null;
      for (const img of anexosEnviados) {
        if (await ehPropostaRogga(img.preview)) { propostaAnexada = img; break; }
      }
      const outrosAnexos = anexosEnviados.filter((img) => img !== propostaAnexada);
      // Número de cada anexo como o designer vê na tela ("anexo 1", "anexo 2"...)
      const numeroDo = (img: ImagemEnviada) => anexosEnviados.indexOf(img) + 1;

      // 1) Conversa: o assistente responde ou decide gerar/editar
      let chat: { tipo: string; modo?: string; prompt?: string; texto?: string; error?: string; semAcesso?: boolean; quadros?: string[] };
      {
        const resChat = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            mensagens: historico.map((m) => ({
              papel: m.papel,
              texto: m.arte ? `${m.texto}\n[arte gerada e exibida ao usuário]` : m.texto,
            })),
            temArte: !!baseArte || !!propostaAnexada,
            anexos: outrosAnexos.length,
            numerosAnexos: outrosAnexos.map(numeroDo),
            propostaAnexada: !!propostaAnexada,
            numeroProposta: propostaAnexada ? numeroDo(propostaAnexada) : undefined,
          }),
        });
        chat = await resChat.json();
        if (chat.semAcesso) setAcesso("bloqueado");
        if (chat.error) throw new Error(chat.error);
      }

      if (chat.tipo === "texto") {
        atualizarMsg(respId, { texto: chat.texto || "", status: undefined });
        return;
      }

      // 2) Geração da arte
      // A proposta anexada tem prioridade: é a arte que o designer quer mudar agora
      const editandoAnexo = chat.modo === "editar" && propostaAnexada;
      const editando: ArteGerada | null = editandoAnexo
        ? { url: propostaAnexada!.preview, prompt: "", logomarca: "", vendedor: "", timestamp: Date.now() }
        : chat.modo === "editar" ? baseArte : null;
      atualizarMsg(respId, { texto: chat.texto || "", status: "gerando" });
      setGerandoImagem(true);

      const fd = new FormData();
      fd.append("regras", regras);
      fd.append("prompt", chat.prompt || conteudo);
      fd.append("usarMascara", String(usarMascara));
      fd.append("qualidade", qualidade);
      // Se a proposta anexada virou a arte a editar, ela não vai de novo como anexo
      const anexosDaGeracao = editandoAnexo ? outrosAnexos : anexosEnviados;
      anexosDaGeracao.forEach((img) => fd.append("imagens", img.file));
      fd.append("numerosAnexos", anexosDaGeracao.map(numeroDo).join(","));
      if (editando) {
        // Se a imagem da arte já está aqui no navegador (arte desta conversa ou proposta
        // anexada), ela vai direto — não depende de ler o armazenamento. Arte aberta
        // pelo histórico vai pelo caminho.
        if (editando.url.startsWith("data:")) fd.append("baseImage", editando.url);
        else if (editando.caminho) fd.append("basePath", editando.caminho);
        fd.append("logomarcaBase", editando.logomarca);
        fd.append("regrasEdicao", regrasEdicao);
        fd.append("quadros", (chat.quadros || []).join(","));
        // Logos originais do cliente (guardados na arte) vão de novo, para não serem redesenhados
        for (const [k, src] of (editando.logosSrc || []).entries()) {
          fd.append("logosOriginais", await (await fetch(src)).blob(), `logo-${k + 1}.png`);
        }
      }
      // Logos desta arte = os da arte editada + os anexos novos (em tamanho reduzido)
      const logosSrc = [
        ...(editando?.logosSrc || []),
        ...(await Promise.all((editandoAnexo ? outrosAnexos : anexosEnviados).map((img) => miniatura(img.preview, 512)))),
      ].slice(0, 4);

      const res = await fetch("/api/gerar", { method: "POST", body: fd, signal: controller.signal });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        if (d.semAcesso) setAcesso("bloqueado");
        throw new Error(d.error || "Erro ao gerar arte.");
      }

      // Resposta em linhas JSON (evento "final" com a arte ou "erro")
      type Evento = { tipo: string; url?: string; error?: string; prompt?: string; logomarca?: string; timestamp?: number };
      let final: Evento | null = null;
      const leitor = res.body.getReader();
      const dec = new TextDecoder();
      let resto = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const linhas = resto.split("\n");
        resto = linhas.pop() || "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const ev = JSON.parse(linha) as Evento;
          if (ev.tipo === "erro") throw new Error(ev.error || "Erro ao gerar arte.");
          else if (ev.tipo === "final") final = ev;
        }
      }
      if (!final?.url) throw new Error("A geração foi interrompida. Tente de novo.");

      const nova: ArteGerada = {
        url: final.url, prompt: final.prompt || "", logomarca: final.logomarca || "Logomarca",
        vendedor: "",
        timestamp: final.timestamp || Date.now(),
        tempoMs: Date.now() - inicio, logosSrc, qualidade,
        // versão anterior para o botão "Comparar"
        antes: editando ? (editando.caminho ? `/api/artes/imagem?p=${encodeURIComponent(editando.caminho)}` : editando.url) : undefined,
      };
      atualizarMsg(respId, { arte: nova, status: undefined, previa: undefined });
      // A arte nova NÃO entra em edição sozinha: só quando o designer clicar em "Editar"
      setBaseArte(null);
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
  }, [texto, imagens, ocupado, mensagens, baseArte, regras, regrasEdicao, usarMascara, qualidade]);

  const parar = () => abortRef.current?.abort();

  // ─── Editar mensagem já enviada (como no ChatGPT) ─────────────────────────────
  const [editandoMsgId, setEditandoMsgId] = useState<string | null>(null);
  const [textoEdicaoMsg, setTextoEdicaoMsg] = useState("");
  const comecarEditarMsg = (m: Mensagem) => { setEditandoMsgId(m.id); setTextoEdicaoMsg(m.texto); };
  // Reenvia uma mensagem do designer (com os mesmos anexos), refazendo a conversa a
  // partir dela. Usado ao editar uma mensagem e no botão "Tentar de novo".
  const reenviarMensagem = async (m: Mensagem, texto: string) => {
    if (!texto || ocupado) return;
    const i = mensagens.findIndex((x) => x.id === m.id);
    if (i < 0) return;
    const antes = mensagens.slice(0, i);
    // Anexos da mensagem vão de novo (recriados a partir das imagens guardadas)
    const anexos: ImagemEnviada[] = await Promise.all((m.anexos || []).map(async (src, k) => {
      const blob = await (await fetch(src)).blob();
      return { id: novoId(), file: new File([blob], `anexo-${k + 1}.${blob.type.split("/")[1] || "png"}`, { type: blob.type }), preview: src };
    }));
    // Se a arte em edição estava depois da mensagem, ela sai da conversa
    if (baseArte && !antes.some((x) => x.arte?.timestamp === baseArte.timestamp)) setBaseArte(null);
    enviar(texto, { antes, anexos });
  };
  const salvarEdicaoMsg = (m: Mensagem) => {
    setEditandoMsgId(null);
    reenviarMensagem(m, textoEdicaoMsg.trim());
  };
  // "Tentar de novo" num erro: reenvia a última mensagem do designer antes dele
  const tentarDeNovo = (erro: Mensagem) => {
    const i = mensagens.findIndex((x) => x.id === erro.id);
    const pedido = [...mensagens.slice(0, i)].reverse().find((x) => x.papel === "user");
    if (pedido) reenviarMensagem(pedido, pedido.texto);
  };

  const novaConversa = () => {
    if (ocupado) parar();
    conversaIdRef.current = null;
    setConversaId(null);
    setMensagens([]);
    setBaseArte(null);
    setImagens([]);
    setTexto("");
    setAviso("");
    if (window.innerWidth < 1024) setLateralAberta(false);
    textareaRef.current?.focus();
  };

  // Reabre uma conversa (guardada neste navegador), do ponto em que parou
  const abrirConversa = (c: Conversa) => {
    if (c.id === conversaIdRef.current) return;
    if (ocupado) parar(); // interrompe o pedido da conversa atual
    const msgs = c.mensagens || [];
    conversaIdRef.current = c.id;
    salvoRef.current = assinaturaDe(c.id, msgs); // abrir não conta como alteração
    setConversaId(c.id);
    setMensagens(msgs);
    setBaseArte(null);
    setImagens([]);
    setTexto("");
    setAviso("");
    if (window.innerWidth < 1024) setLateralAberta(false);
  };

  // Renomear conversa (lápis ou duplo clique no título). Não muda a ordem da lista.
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  // Conversa em edição de verdade (ref): evita salvar duas vezes (Enter + perder foco)
  // e garante que Esc cancela mesmo quando o campo some e dispara o "perder foco".
  const edicaoRef = useRef<string | null>(null);
  const comecarRenomear = (c: Conversa) => { edicaoRef.current = c.id; setRenomeandoId(c.id); setTituloEditado(c.titulo); };
  const cancelarRenomear = () => { edicaoRef.current = null; setRenomeandoId(null); };
  const confirmarRenomear = () => {
    const id = edicaoRef.current;
    edicaoRef.current = null;
    setRenomeandoId(null);
    if (!id) return;
    const titulo = tituloEditado.replace(/\s+/g, " ").trim().slice(0, 80);
    const c = conversas.find((x) => x.id === id);
    if (!c || !titulo || titulo === c.titulo) return;
    const renomeada = { ...c, titulo };
    setConversas((prev) => prev.map((x) => (x.id === id ? renomeada : x)));
    salvarConversa(renomeada);
  };

  const apagarConversa = (c: Conversa) => {
    if (!window.confirm(`Apagar a conversa "${c.titulo}"? As artes dela também serão apagadas (as que você baixou continuam no computador).`)) return;
    setConversas((prev) => prev.filter((x) => x.id !== c.id));
    if (c.id === conversaIdRef.current) novaConversa();
    excluirConversa(c.id);
  };

  const montarNomeArquivo = (arte: ArteGerada) => {
    const limpa = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
    const logo = limpa(arte.logomarca) || "Logomarca";
    return `${logo} - Proposta de Uniformes.webp`;
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
      // Download direto (vai para a pasta padrão do navegador, normalmente Downloads).
      // O link entra na página e só é descartado depois, para o download não ser cancelado.
      const a = document.createElement("a");
      a.download = montarNomeArquivo(arte);
      a.href = blobUrl;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 1000);
      setBaixadas((prev) => new Set(prev).add(arte.timestamp));
    } catch { setAviso("Erro ao baixar. Abra a arte e use clique direito > Salvar imagem."); }
  };

  const editarEsta = (arte: ArteGerada) => {
    setBaseArte(arte);
    if (window.innerWidth < 1024) setLateralAberta(false); // no celular, libera a tela
    textareaRef.current?.focus();
  };

  const hora = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Versão anterior de uma arte editada (botão "Comparar")
  const antesDe = (arte: ArteGerada) => arte.antes;
  const abrirComparacao = (arte: ArteGerada) => {
    const antes = antesDe(arte);
    if (antes) setComparar({ antes, depois: arte.url, titulo: arte.logomarca });
  };

  // ─── Datas: agrupa as conversas por dia ──────────────────────────────────────
  // Chave do dia no fuso local (AAAA-MM-DD), a mesma usada pelos <input type="date">.
  const chaveDia = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const nomePasta = (chave: string) => {
    const hoje = chaveDia(agora);
    const ontem = chaveDia(agora - 86400000);
    if (chave === hoje) return "Hoje";
    if (chave === ontem) return "Ontem";
    const [a, m, d] = chave.split("-").map(Number);
    const data = new Date(a, m - 1, d);
    const texto = data.toLocaleDateString("pt-BR", {
      weekday: "short", day: "2-digit", month: "short",
      ...(a !== new Date(agora).getFullYear() ? { year: "numeric" } : {}),
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };


  // Conversas agrupadas por dia da última atividade (Hoje, Ontem, ...)
  const gruposConversas: Array<{ nome: string; itens: Conversa[] }> = [];
  for (const c of conversas) {
    const nome = nomePasta(chaveDia(c.atualizadaEm));
    const ultimo = gruposConversas[gruposConversas.length - 1];
    if (ultimo?.nome === nome) ultimo.itens.push(c);
    else gruposConversas.push({ nome, itens: [c] });
  }

  const vazio = mensagens.length === 0;

  // ─── Caixa de mensagem (reaproveitada no estado vazio e no rodapé) ───────────
  const composer = (
    <div className="w-full">
      {baseArte && (
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={baseArte.url} alt="" className="w-6 h-10 object-cover rounded border border-white/10" />
          <span className="flex-1">Próximas alterações serão aplicadas nesta arte. Para começar do zero, peça &quot;uma arte nova&quot;.</span>
          <button onClick={() => setBaseArte(null)} title="Fechar edição" aria-label="Fechar edição"
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
      <div
        className={`rounded-3xl border bg-[#1e1e24] transition-colors ${arrastando ? "border-[#2563EB]" : "border-white/10 focus-within:border-white/25"}`}
      >
        {imagens.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {imagens.map((img, i) => (
              <div key={img.id} className="relative w-16 h-16 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={`Anexo ${i + 1}`} className="w-full h-full object-contain p-1" />
                {/* Número do anexo: o designer pode escrever "anexo 1: peito esquerdo" */}
                <span className="absolute bottom-1 left-1 min-w-4 h-4 px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
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
          placeholder={baseArte ? "Peça uma alteração ou uma arte nova..." : "Descreva a proposta, cole o print ou anexe o logo..."}
          className="w-full bg-transparent px-5 pt-4 pb-2 text-[15px] text-gray-100 placeholder-gray-500 resize-none leading-relaxed focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <button onClick={() => fileRef.current?.click()} title="Anexar imagem"
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Paperclip size={18} />
          </button>
          <div className="flex items-center gap-2">
            {/* Qualidade da imagem: Low (padrão, bem mais barata) ou Medium */}
            <div className="flex rounded-full bg-white/5 border border-white/10 p-0.5 text-xs font-semibold" role="group" aria-label="Qualidade da imagem">
              {([["low", "Low", "Mais barata — boa para testar ideias e cores"], ["medium", "Medium", "Mais detalhe — custa cerca de 2,5 vezes mais"]] as const).map(([v, nome, dica]) => (
                <button key={v} onClick={() => setQualidade(v)} title={dica} aria-pressed={qualidade === v}
                  className={`rounded-full px-3 py-1 transition-colors ${qualidade === v ? "bg-[#2563EB] text-white" : "text-gray-400 hover:text-white"}`}>
                  {nome}
                </button>
              ))}
            </div>
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
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) adicionarImagens(e.target.files); e.target.value = ""; }} />
    </div>
  );

  // ─── Tela de senha da equipe ────────────────────────────────────────────────
  if (acesso !== "ok") {
    return (
      <TelaSenha verificando={acesso === "verificando"} senha={senha} setSenha={setSenha}
        erro={erroSenha} entrando={entrando} onEntrar={entrar} />
    );
  }

  return (
    <div
      className="flex h-dvh bg-[#131317] text-gray-100"
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) adicionarImagens(e.dataTransfer.files); }}
    >
      {/* ===== CONVERSAS (LATERAL) ===== */}
      {lateralAberta && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => alternarLateral(false)} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 shrink-0 flex flex-col bg-[#0c0c0f] border-r border-white/5 transition-transform duration-200 ${lateralAberta ? "translate-x-0" : "-translate-x-full lg:hidden"}`}
      >
        <div className="flex items-center gap-2 px-3 h-14 shrink-0">
          <p className="flex-1 flex items-center gap-2 px-1 text-sm font-semibold text-gray-200">
            <MessageSquare size={15} className="text-[#60A5FA]" /> Conversas
          </p>
          <button onClick={() => alternarLateral(false)} title="Fechar barra lateral"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <PanelLeftClose size={17} />
          </button>
        </div>
            <div className="px-3 pb-2 shrink-0">
              <button onClick={novaConversa}
                className="w-full flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5 hover:border-white/20 transition-colors">
                <SquarePen size={15} /> Nova conversa
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversas.length === 0 ? (
                <p className="text-xs text-gray-600 text-center mt-10 px-4 leading-relaxed">
                  Suas conversas aparecem aqui e ficam salvas neste navegador.
                </p>
              ) : gruposConversas.map((g) => (
                <div key={g.nome}>
                  <p className="px-2 pt-3 pb-1 text-[11px] font-semibold text-gray-500">{g.nome}</p>
                  {g.itens.map((c) => (
                    <div key={c.id}
                      className={`group flex items-center rounded-lg transition-colors ${c.id === conversaId ? "bg-white/10" : "hover:bg-white/5"}`}>
                      {renomeandoId === c.id ? (
                        <input value={tituloEditado} autoFocus maxLength={80} aria-label="Novo nome da conversa"
                          onChange={(e) => setTituloEditado(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={confirmarRenomear}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); confirmarRenomear(); }
                            else if (e.key === "Escape") cancelarRenomear();
                          }}
                          className="flex-1 min-w-0 mx-1 my-1 rounded-md bg-black/40 border border-[#2563EB] px-1.5 py-1 text-[13px] text-white focus:outline-none" />
                      ) : (
                        <>
                          <button onClick={() => abrirConversa(c)} onDoubleClick={() => comecarRenomear(c)} title={c.titulo}
                            className={`flex-1 min-w-0 flex items-center gap-1.5 text-left px-2 py-2 text-[13px] ${c.id === conversaId ? "text-white" : "text-gray-300"}`}>
                            <span className="truncate">{c.titulo}</span>
                          </button>
                          <div className="flex mr-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => comecarRenomear(c)} title="Renomear conversa"
                              className="p-1.5 rounded-md text-gray-500 hover:text-white">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => apagarConversa(c)} title="Apagar conversa"
                              className="p-1.5 rounded-md text-gray-500 hover:text-red-400">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
        {/* Aviso da limpeza automática (ver app/api/limpeza) */}
        <p className="shrink-0 border-t border-white/5 px-3 py-2 text-[10px] text-gray-600 text-center">
          Conversas e artes ficam só neste navegador · baixe as artes que for usar.
        </p>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
      {/* ===== TOPO ===== */}
      <header className="flex items-center gap-2 px-3 sm:px-4 h-14 shrink-0">
        {!lateralAberta && (
          <button onClick={() => alternarLateral(true)} title="Conversas"
            className="p-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors">
            <PanelLeftOpen size={19} />
          </button>
        )}
        <button onClick={novaConversa} title="Nova conversa"
          className="p-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors">
          <SquarePen size={19} />
        </button>
        <div className="flex-1 min-w-0 flex items-center">
          <span className="text-[#60A5FA] font-semibold text-sm truncate">Gerador de Artes</span>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-rogga.png" alt="Rogga Uniformes" width={640} height={210}
              className="mx-auto mb-5 w-40 sm:w-48 h-auto" />
            <h1 className="text-center text-2xl sm:text-3xl font-semibold text-white mb-8">
              O que vamos criar hoje?
            </h1>
            {composer}
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
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`Anexo ${i + 1}`} className="w-24 h-24 object-contain rounded-2xl bg-white/5 border border-white/10 p-1" />
                            <span className="absolute bottom-1.5 left-1.5 min-w-5 h-5 px-1 rounded-full bg-[#2563EB] text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {editandoMsgId === m.id ? (
                      <div className="w-full max-w-[85%] rounded-3xl bg-[#2a2a31] border border-white/15 p-3 space-y-2">
                        <textarea value={textoEdicaoMsg} autoFocus rows={3} aria-label="Editar mensagem"
                          onChange={(e) => setTextoEdicaoMsg(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); salvarEdicaoMsg(m); }
                            else if (e.key === "Escape") setEditandoMsgId(null);
                          }}
                          className="w-full bg-transparent px-1 text-[15px] leading-relaxed text-gray-100 resize-y focus:outline-none" />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditandoMsgId(null)}
                            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-gray-300 bg-white/10 hover:bg-white/15 transition-colors">
                            Cancelar
                          </button>
                          <button onClick={() => salvarEdicaoMsg(m)} disabled={!textoEdicaoMsg.trim()}
                            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-black bg-white hover:bg-gray-200 disabled:opacity-40 transition-colors">
                            Enviar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-1.5 max-w-[85%]">
                        {!ocupado && (
                          <button onClick={() => comecarEditarMsg(m)} title="Editar mensagem"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <Pencil size={14} />
                          </button>
                        )}
                        <div className="bg-[#2a2a31] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                          {m.texto}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    {/* "Perfil" do assistente: o símbolo RG da Rogga */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/simbolo-rogga.png" alt="Rogga" width={32} height={32} className="w-8 h-8 shrink-0" />

                    <div className="flex-1 min-w-0 pt-1 space-y-3">
                      {m.status === "pensando" && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Loader2 size={15} className="animate-spin" /> Pensando...
                          {m.inicio && <span className="text-xs text-gray-600 tabular-nums">{segundos(tique - m.inicio)}</span>}
                        </div>
                      )}
                      {m.texto && (
                        <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${m.status === "erro" ? "text-red-400 flex gap-2" : "text-gray-100"}`}>
                          {m.status === "erro" && <AlertCircle size={16} className="mt-1 shrink-0" />}
                          {m.texto}
                        </p>
                      )}
                      {m.status === "erro" && !ocupado && (
                        <button onClick={() => tentarDeNovo(m)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-white/10 hover:bg-white/15 rounded-full px-3 py-1.5 transition-colors">
                          <RotateCcw size={13} /> Tentar de novo
                        </button>
                      )}
                      {m.status === "gerando" && (
                        <div className="relative w-full max-w-[300px] aspect-[9/16] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10">
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                            <Sparkles size={28} className="text-[#2563EB] animate-pulse" />
                            <p className="text-sm text-gray-400 text-center">Criando a arte...<br /><span className="text-xs text-gray-600">leva cerca de 1 minuto</span></p>
                          </div>
                          {/* Cronômetro + progresso */}
                          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="flex items-center justify-between text-xs text-white mb-1.5">
                              <span className="flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Gerando...
                              </span>
                              {m.inicio && <span className="tabular-nums font-semibold">{segundos(tique - m.inicio)}</span>}
                            </div>
                            <div className="w-full bg-white/15 rounded-full h-1 overflow-hidden">
                              <div className="h-1 rounded-full bg-[#2563EB] transition-all duration-1000 ease-out" style={{ width: `${progresso}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      {m.arte && (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.arte.url} alt="Arte gerada" onClick={() => abrirModal(m.arte!, mensagens.flatMap((x) => (x.arte ? [x.arte] : [])))}
                            className={`w-full max-w-[300px] rounded-2xl border cursor-zoom-in ${baseArte?.timestamp === m.arte.timestamp ? "border-[#2563EB]/60" : "border-white/10"}`} />
                          <div className="flex flex-wrap items-center gap-1">
                            {/* Cinza por padrão; ficam azuis só depois do clique */}
                            <button onClick={() => baixarImagem(m.arte!)}
                              className={`flex items-center gap-1.5 text-xs hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors ${baixadas.has(m.arte.timestamp) ? "text-[#60A5FA]" : "text-gray-300 hover:text-white"}`}>
                              <Download size={14} /> {baixadas.has(m.arte.timestamp) ? "Baixada" : "Baixar"}
                            </button>
                            {baseArte?.timestamp === m.arte.timestamp ? (
                              <button onClick={() => setBaseArte(null)} title="Clique para sair da edição"
                                className="flex items-center gap-1.5 text-xs text-[#60A5FA] hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                                <Wand2 size={14} /> Em edição
                              </button>
                            ) : (
                              <button onClick={() => editarEsta(m.arte!)}
                                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                                <Wand2 size={14} /> Editar
                              </button>
                            )}
                            {antesDe(m.arte) && (
                              <button onClick={() => abrirComparacao(m.arte!)} title="Ver a versão anterior ao lado"
                                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-lg px-2.5 py-1.5 transition-colors">
                                <Columns2 size={14} /> Comparar
                              </button>
                            )}
                            {m.arte.qualidade && (
                              <span className="text-[11px] text-gray-500 px-1" title="Qualidade da imagem">{m.arte.qualidade === "medium" ? "Medium" : "Low"}</span>
                            )}
                            {m.arte.tempoMs !== undefined && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-500 px-2" title="Tempo de geração">
                                <Timer size={12} /> {segundos(m.arte.tempoMs)}
                              </span>
                            )}
                          </div>
                          <div>
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
      </div>

      {/* ===== CONFIGURAÇÕES ===== */}
      {configAberta && (
        <Configuracoes onFechar={() => setConfigAberta(false)}
          usarMascara={usarMascara} setUsarMascara={setUsarMascara}
          regras={regras} setRegras={setRegras}
          regrasEdicao={regrasEdicao} setRegrasEdicao={setRegrasEdicao} />
      )}

      {/* ===== COMPARAR ANTES / DEPOIS ===== */}
      {comparar && (
        <Comparacao antes={comparar.antes} depois={comparar.depois} titulo={comparar.titulo} onFechar={() => setComparar(null)} />
      )}

      {/* ===== TELA CHEIA (com navegação entre as artes) ===== */}
      {arteModal && (
        <TelaCheia arte={arteModal}
          legenda={`${nomePasta(chaveDia(arteModal.timestamp))} · ${hora(arteModal.timestamp)}`}
          indice={indiceModal} total={listaModal.length}
          zoom={zoom} setZoom={setZoom} onNavegar={navegarModal}
          onFechar={() => setArteModal(null)}
          onEditar={() => { editarEsta(arteModal); setArteModal(null); }}
          onComparar={antesDe(arteModal) ? () => abrirComparacao(arteModal) : undefined}
          onBaixar={() => baixarImagem(arteModal)} />
      )}
    </div>
  );
}
