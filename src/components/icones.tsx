// Ícones usados em mais de uma tela.
//
// O do WhatsApp é o logo da marca, não um balão de fala genérico: quem olha o
// menu ou o aviso reconhece a origem antes de ler o texto. Por ser marca, é
// desenho preenchido (`fill`) em viewBox 24, enquanto os outros ícones do
// painel são de contorno (`stroke`) em viewBox 20 — quem desenha precisa
// trocar o modo do <svg>, e é por isso que existe o `preenchido` nas listas.

export const PATH_WHATSAPP = (
  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.19-.53.06-.25-.12-1.05-.38-1.99-1.23-.74-.65-1.23-1.46-1.38-1.71-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.46-.6 1.67-1.18.2-.57.2-1.07.14-1.17-.06-.11-.22-.17-.46-.29z" />
);

/** Logo do WhatsApp já dentro de um <svg>, para usar solto. */
export function IconeWhatsApp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      {PATH_WHATSAPP}
    </svg>
  );
}

// Verde da marca. Usado no fundo dos avisos de WhatsApp — quem sinaliza
// urgência ali é o pontinho de "não lida", não a cor do ícone.
export const COR_WHATSAPP = "bg-[#25D366]/15 text-[#128C7E]";
