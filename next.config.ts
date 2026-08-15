import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite compilar numa pasta separada da que está no ar.
  //
  // Sem isso, o `npm run build` reescrevia o .next enquanto o servidor servia
  // dali: por uns 15 segundos a página vinha pedindo arquivos de estilo que
  // ainda não tinham sido gerados, e o painel aparecia sem formatação nenhuma
  // pra quem estivesse usando. O script scripts/deploy-vps.sh compila em
  // .next-novo e só então troca as pastas — a interrupção passa a ser o
  // reinício do processo, uns 2 segundos.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async rewrites() {
    return [
      // A raiz do domínio é o site público da loja — um HTML estático que vive
      // em public/index.html, servido como está. O painel interno fica em
      // /painel, atrás de login. Um deploy só, dois públicos diferentes.
      { source: "/", destination: "/index.html" },
    ];
  },

  async headers() {
    return [
      {
        // O painel nunca deve ser indexado nem posto dentro de um iframe de
        // outro site.
        source: "/painel/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
