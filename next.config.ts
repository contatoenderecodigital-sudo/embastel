import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
