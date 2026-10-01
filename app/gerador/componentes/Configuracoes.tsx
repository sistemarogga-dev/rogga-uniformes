import { RotateCcw, X } from "lucide-react";
import { REGRAS_EDICAO_PADRAO, REGRAS_PADRAO } from "../regras";

// Janela de Configurações: trava do layout e as regras enviadas à IA.
// Tudo fica salvo no navegador (a página cuida disso).
export default function Configuracoes({
  onFechar, usarMascara, setUsarMascara, regras, setRegras, regrasEdicao, setRegrasEdicao,
}: {
  onFechar: () => void;
  usarMascara: boolean;
  setUsarMascara: (v: boolean) => void;
  regras: string;
  setRegras: (v: string) => void;
  regrasEdicao: string;
  setRegrasEdicao: (v: string) => void;
}) {
  const campoTexto = "w-full border border-white/10 rounded-xl px-3 py-2 text-xs bg-black/20 text-gray-200 resize-y leading-relaxed focus:outline-none focus:border-white/25";
  const restaurar = "text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-[#1e1e24] border border-white/10 rounded-2xl p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Configurações</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={usarMascara} onChange={(e) => setUsarMascara(e.target.checked)}
            className="accent-[#2563EB] w-4 h-4 mt-0.5" />
          <span className="text-sm text-gray-300">
            Travar tudo, menos os produtos <span className="text-gray-500">(recomendado — protege cabeçalho, etiquetas, rodapé e bordas)</span>
          </span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-300">Regras rígidas <span className="font-normal text-gray-500">— criação de arte nova</span></p>
            <button onClick={() => setRegras(REGRAS_PADRAO)} className={restaurar}>
              <RotateCcw size={12} /> Restaurar padrão
            </button>
          </div>
          <p className="text-xs text-gray-500">Enviadas quando uma arte nova é criada. Escritas em inglês: a IA entende igual e gasta menos. Ficam salvas neste navegador.</p>
          <textarea value={regras} onChange={(e) => setRegras(e.target.value)} rows={14} className={campoTexto} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-300">Regras de edição <span className="font-normal text-gray-500">— ao editar uma arte</span></p>
            <button onClick={() => setRegrasEdicao(REGRAS_EDICAO_PADRAO)} className={restaurar}>
              <RotateCcw size={12} /> Restaurar padrão
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Enviadas em toda edição, junto com o pedido do designer (em inglês, para gastar menos). O gerador acrescenta sozinho as cores medidas na arte,
            os quadros que podem mudar e a logo original. Ficam salvas neste navegador.
          </p>
          <textarea value={regrasEdicao} onChange={(e) => setRegrasEdicao(e.target.value)} rows={14} className={campoTexto} />
        </div>
      </div>
    </div>
  );
}
