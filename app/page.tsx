import Link from "next/link";
import { Sparkles, Image, Download, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f13]">
      {/* Header */}
      <header className="bg-[#1a1a1f] border-b border-white/5 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">ROGGA UNIFORMES</h1>
            <p className="text-[#C8102E] text-sm font-medium">Gerador de Artes com IA</p>
          </div>
          <Link
            href="/gerador"
            className="bg-[#C8102E] text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-red-700 transition-colors"
          >
            Criar Arte
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="bg-gradient-to-br from-[#0f0f13] via-[#1a1a2e] to-[#C8102E]/30 text-white py-24 px-6 border-b border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-sm mb-8 text-gray-300">
              <Sparkles size={14} className="text-[#C8102E]" />
              <span>Powered by OpenAI gpt-image-1</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-white">
              Crie artes para seus uniformes em segundos
            </h2>
            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
              Envie o logo do cliente e nossa IA gera propostas profissionais prontas para apresentar.
            </p>
            <Link
              href="/gerador"
              className="inline-flex items-center gap-2 bg-[#C8102E] text-white font-bold px-8 py-4 rounded-full text-lg hover:bg-red-700 transition-colors shadow-xl shadow-red-900/30"
            >
              <Sparkles size={20} />
              Começar a criar
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-6 bg-[#0f0f13]">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-white mb-12">O que você pode criar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FeatureCard
                icon={<Layers size={26} className="text-[#C8102E]" />}
                title="Mockups de Uniformes"
                description="Visualize o uniforme completo com cores, logos e detalhes antes de produzir."
              />
              <FeatureCard
                icon={<Sparkles size={26} className="text-[#C8102E]" />}
                title="Logos & Identidade Visual"
                description="Crie ou adapte logotipos para bordados e estampas nos uniformes."
              />
              <FeatureCard
                icon={<Image size={26} className="text-[#C8102E]" />}
                title="Estampas & Bordados"
                description="Designs detalhados prontos para serem enviados para produção."
              />
              <FeatureCard
                icon={<Download size={26} className="text-[#C8102E]" />}
                title="Download em Alta Resolução"
                description="Baixe todas as imagens geradas em alta qualidade para uso profissional."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 bg-[#1a1a1f] border-t border-white/5 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Pronto para impressionar seus clientes?</h3>
          <p className="text-gray-400 mb-8">Gere artes profissionais em segundos, sem precisar de designer.</p>
          <Link
            href="/gerador"
            className="inline-flex items-center gap-2 bg-[#C8102E] text-white font-bold px-8 py-4 rounded-full text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-900/30"
          >
            <Sparkles size={20} />
            Criar minha primeira arte
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0e] border-t border-white/5 text-gray-500 text-center py-6 text-sm">
        © {new Date().getFullYear()} ROGGA UNIFORMES — Todos os direitos reservados
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-6 rounded-2xl border border-white/8 bg-[#1a1a1f] hover:border-[#C8102E]/30 transition-colors">
      <div className="shrink-0 mt-1 p-2 rounded-xl bg-[#C8102E]/10">{icon}</div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
