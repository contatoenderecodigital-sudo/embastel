import type { Metadata } from "next";
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
