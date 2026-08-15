// As telas do painel são montadas a cada acesso, não guardadas prontas.
//
// POR QUE: o Next, por padrão, pré-renderiza estas páginas e as serve com
// Cache-Control de um ano. O nome dos arquivos de estilo muda a cada
// publicação, então um HTML guardado no navegador passa a pedir arquivos que
// não existem mais — e o painel abre completamente sem formatação, sem a
// pessoa ter o que fazer além de descobrir sozinha o atalho de limpar cache.
// Aconteceu em 13/08/2026 com o dono da loja, duas vezes.
//
// Tentei antes pelo next.config (o Next ignora, para página pré-renderizada)
// e pelo proxy.ts (funciona em desenvolvimento, mas em produção o cabeçalho
// da página estática prevalece). Aqui resolve na origem: sem pré-renderização
// não há HTML guardado, e o Next passa a responder no-store sozinho.
//
// Custo: nenhum na prática. Estas telas são client components que buscam os
// dados por API depois de carregar — a pré-renderização não estava
// adiantando nada, e são poucas pessoas usando.
export const dynamic = "force-dynamic";

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
