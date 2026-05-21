import Link from "next/link";
import { Sparkles, Image, Download, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-[#C8102E] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ROGGA UNIFORMES</h1>
            <p className="text-red-200 text-sm">Gerador de Artes com IA</p>
          </div>
          <Link
            href="/gerador"
            className="bg-white text-[#C8102E] font-semibold px-5 py-2 rounded-full text-sm hover:bg-red-50 transition-colors"
          >
            Criar Arte
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="bg-gradient-to-br from-[#1a1a2e] to-[#C8102E] text-white py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-6">
              <Sparkles size={16} />
              <span>Powered by OpenAI DALL-E 3</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Crie artes para seus uniformes em segundos
            </h2>
            <p className="text-lg text-red-100 mb-10 max-w-xl mx-auto">
              Descreva o uniforme que você imagina e nossa IA gera imagens profissionais prontas para apresentar ao cliente.
            </p>
            <Link
              href="/gerador"
              className="inline-flex items-center gap-2 bg-white text-[#C8102E] font-bold px-8 py-4 rounded-full text-lg hover:bg-red-50 transition-colors shadow-xl"
            >
              <Sparkles size={20} />
              Começar a criar
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-12">O que você pode criar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard
                icon={<Layers size={28} className="text-[#C8102E]" />}
                title="Mockups de Uniformes"
                description="Visualize o uniforme completo com cores, logos e detalhes antes de produzir."
              />
              <FeatureCard
                icon={<Sparkles size={28} className="text-[#C8102E]" />}
                title="Logos & Identidade Visual"
                description="Crie ou adapte logotipos para bordados e estampas nos uniformes."
              />
              <FeatureCard
                icon={<Image size={28} className="text-[#C8102E]" />}
                title="Estampas & Bordados"
                description="Designs detalhados prontos para serem enviados para produção."
              />
              <FeatureCard
                icon={<Download size={28} className="text-[#C8102E]" />}
                title="Download em Alta Resolução"
                description="Baixe todas as imagens geradas em alta qualidade para uso profissional."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 bg-gray-50 text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Pronto para impressionar seus clientes?</h3>
          <p className="text-gray-500 mb-8">Gere artes profissionais em segundos, sem precisar de designer.</p>
          <Link
            href="/gerador"
            className="inline-flex items-center gap-2 bg-[#C8102E] text-white font-bold px-8 py-4 rounded-full text-lg hover:bg-red-700 transition-colors shadow-lg"
          >
            <Sparkles size={20} />
            Criar minha primeira arte
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] text-gray-400 text-center py-6 text-sm">
        © {new Date().getFullYear()} ROGGA UNIFORMES — Todos os direitos reservados
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="shrink-0 mt-1">{icon}</div>
      <div>
        <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
