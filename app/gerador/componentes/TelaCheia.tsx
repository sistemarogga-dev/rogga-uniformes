import { useRef } from "react";
import { ChevronLeft, ChevronRight, Columns2, Download, Wand2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { ArteGerada } from "../historico";

// Arte em tela cheia, com zoom e navegação entre as artes (setas, botões ou deslizar
// o dedo). O teclado (← → Esc) é tratado na página.
export default function TelaCheia({
  arte, legenda, indice, total, zoom, setZoom, onNavegar, onFechar, onEditar, onComparar, onBaixar,
}: {
  arte: ArteGerada;
  legenda: string;
  indice: number;
  total: number;
  zoom: number;
  setZoom: (f: (z: number) => number) => void;
  onNavegar: (passo: number) => void;
  onFechar: () => void;
  onEditar: () => void;
  onComparar?: () => void; // só existe quando a arte veio de uma edição
  onBaixar: () => void;
}) {
  const toqueX = useRef<number | null>(null);
  const botaoClaro = "flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold";
  const seta = "absolute top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 disabled:hover:bg-white/10 transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toqueX.current === null || zoom !== 1) return;
        const dx = e.changedTouches[0].clientX - toqueX.current;
        if (Math.abs(dx) > 50) onNavegar(dx < 0 ? 1 : -1);
        toqueX.current = null;
      }}>
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex-1 min-w-0 text-white">
          <p className="text-sm font-semibold truncate">{arte.logomarca}</p>
          <p className="text-[11px] text-gray-400">
            {legenda}
            {total > 1 && ` · ${indice + 1} de ${total}`}
          </p>
        </div>
        <button onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.25).toFixed(2)))}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><ZoomOut size={18} /></button>
        <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><ZoomIn size={18} /></button>
        <button onClick={onEditar} className={botaoClaro}>
          <Wand2 size={14} /> Editar
        </button>
        {onComparar && (
          <button onClick={onComparar} title="Ver a versão anterior ao lado" className={botaoClaro}>
            <Columns2 size={14} /> Comparar
          </button>
        )}
        <button onClick={onBaixar}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold">
          <Download size={14} /> Baixar
        </button>
        <button onClick={onFechar}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={18} /></button>
      </div>
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-auto flex items-start justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={arte.url} alt="Arte gerada"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
            className="max-w-sm w-full" />
        </div>
        {total > 1 && (
          <>
            <button onClick={() => onNavegar(-1)} disabled={indice <= 0} title="Anterior (←)" aria-label="Arte anterior"
              className={`${seta} left-2 sm:left-6`}>
              <ChevronLeft size={26} />
            </button>
            <button onClick={() => onNavegar(1)} disabled={indice >= total - 1} title="Próxima (→)" aria-label="Próxima arte"
              className={`${seta} right-2 sm:right-6`}>
              <ChevronRight size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
