"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, Lock, User } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/gerador";

  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, senha }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Falha ao entrar.");
      router.push(next);
      router.refresh();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao entrar.");
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f13] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">ROGGA UNIFORMES</h1>
          <p className="text-[#C8102E] text-sm font-medium mt-1">Gerador de Artes — Acesso</p>
        </div>

        <form onSubmit={entrar} className="bg-[#1a1a1f] border border-white/8 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1"><User size={13} className="inline mr-1" />Usuário</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
              placeholder="ex: gustavo" autoCapitalize="none"
              className="w-full border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1"><Lock size={13} className="inline mr-1" />Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="sua senha"
              className="w-full border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8102E] bg-white/5 text-gray-200 placeholder-gray-600" />
          </div>

          {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>}

          <button type="submit" disabled={carregando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C8102E] text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
            {carregando ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">© {new Date().getFullYear()} ROGGA UNIFORMES</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f13]" />}>
      <LoginForm />
    </Suspense>
  );
}
