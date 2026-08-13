import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Moldura from "@/components/Moldura";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Embastel · Painel",
  description: "Painel interno da Embastel Embalagens",
  // Painel interno não deve aparecer em busca nenhuma.
  robots: { index: false, follow: false },
};

// Declara que a página é clara, na marra.
//
// Não é redundante com o `color-scheme: light` do CSS: o Chrome e o Edge têm
// um "forçar modo escuro" (em chrome://flags e nas configurações do Edge) que
// escurece páginas por conta própria, invertendo cores e deixando tudo
// lavado. Esta meta tag é o sinal documentado de "esta página já se vira, não
// mexa" — sem ela, o navegador reescreve as cores do painel por cima.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full bg-[#f7f4f3] font-sans">
        <Moldura>{children}</Moldura>
      </body>
    </html>
  );
}
