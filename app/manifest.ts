import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular: o gerador abre como um app, com o
// símbolo da Rogga, sem a barra do navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rogga — Gerador de Artes",
    short_name: "Gerador Rogga",
    description: "Gerador de propostas de uniformes da Rogga Uniformes",
    start_url: "/gerador",
    display: "standalone",
    background_color: "#131317",
    theme_color: "#131317",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
