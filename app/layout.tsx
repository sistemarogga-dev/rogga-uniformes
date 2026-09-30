import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ROGGA UNIFORMES | Gerador de Artes",
  description: "Gerador de artes visuais com IA para clientes da ROGGA UNIFORMES",
  // No iPhone, "Adicionar à Tela de Início" abre como app (o Android usa o manifest)
  appleWebApp: { capable: true, title: "Gerador Rogga", statusBarStyle: "black-translucent" },
};

// Cor da barra do celular/navegador combinando com o fundo do app
export const viewport: Viewport = { themeColor: "#131317" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f0f13]">{children}</body>
    </html>
  );
}
