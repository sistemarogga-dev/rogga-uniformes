import { X } from "lucide-react";

// Antes e depois de uma edição, lado a lado (Esc fecha: tratado na página).
export default function Comparacao({ antes, depois, titulo, onFechar }: {
  antes: string;
  depois: string;
  titulo: string;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex-1 min-w-0 text-white">
          <p className="text-sm font-semibold truncate">Comparar edição — {titulo}</p>
          <p className="text-[11px] text-gray-400">À esquerda a versão anterior; à direita a editada.</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar comparação"
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={18} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 max-w-5xl mx-auto">
          {([["Antes", antes], ["Depois", depois]] as const).map(([rotulo, src]) => (
            <figure key={rotulo} className="space-y-2">
              <figcaption className={`text-center text-xs font-semibold ${rotulo === "Depois" ? "text-[#60A5FA]" : "text-gray-400"}`}>{rotulo}</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Arte ${rotulo.toLowerCase()} da edição`} className="w-full rounded-xl border border-white/10" />
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
