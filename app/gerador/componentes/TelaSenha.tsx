import React from "react";
import { AlertCircle, Loader2, Lock } from "lucide-react";

// Tela de entrada com a senha da equipe (ou o carregando, enquanto confere o acesso).
export default function TelaSenha({ verificando, senha, setSenha, erro, entrando, onEntrar }: {
  verificando: boolean;
  senha: string;
  setSenha: (v: string) => void;
  erro: string;
  entrando: boolean;
  onEntrar: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#131317] px-4 text-gray-100">
      {verificando ? (
        <Loader2 size={22} className="animate-spin text-gray-500" />
      ) : (
        <form onSubmit={onEntrar} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1e1e24] p-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-[#2563EB]/15 flex items-center justify-center">
              <Lock size={20} className="text-[#60A5FA]" />
            </div>
            <p className="flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/simbolo-rogga.png" alt="Rogga" width={26} height={26} className="w-[26px] h-[26px]" />
              <span className="text-[#60A5FA] font-semibold text-sm">Gerador de Artes</span>
            </p>
            <p className="text-xs text-gray-500">Digite a senha da equipe. Este navegador vai lembrar dela.</p>
          </div>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus
            placeholder="Senha da equipe" autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#2563EB]" />
          {erro && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={13} /> {erro}</p>}
          <button type="submit" disabled={!senha || entrando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {entrando && <Loader2 size={15} className="animate-spin" />} Entrar
          </button>
        </form>
      )}
    </div>
  );
}
