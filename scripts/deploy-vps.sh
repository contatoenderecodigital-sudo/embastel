#!/usr/bin/env bash
#
# Atualiza o painel no servidor sem deixar a tela quebrada no meio.
#
# O jeito ingênuo — `git pull && npm run build && pm2 restart` — reescreve a
# pasta .next enquanto o processo no ar está servindo dali. Durante os ~15
# segundos do build, quem abrisse o painel recebia o HTML novo pedindo
# arquivos de estilo que ainda não existiam: a tela vinha sem formatação
# nenhuma. Aconteceu de verdade em 13/08/2026, com o dono usando o painel.
#
# Aqui a compilação vai pra uma pasta separada e só troca no fim. A única
# interrupção passa a ser o reinício do processo, que leva uns 2 segundos.
#
# Uso, dentro de /www/wwwroot/painel-embastel:
#   bash scripts/deploy-vps.sh

set -euo pipefail

PASTA_APP="/www/wwwroot/painel-embastel"
PROCESSO="embastel-painel"
NOVA=".next-novo"
ANTIGA=".next-antiga"

cd "$PASTA_APP"

echo "==> Buscando o código novo"
ASSINATURA_ANTES=$(sha1sum "$0" | cut -d' ' -f1)
git fetch --quiet origin
git reset --hard origin/master --quiet
git log --oneline -1

# Este script atualiza a si mesmo, e o bash lê o arquivo enquanto executa.
#
# Quando o `git reset` acima traz uma versão nova DESTE arquivo, o resto da
# execução vira uma mistura: o bash já leu parte do texto antigo e continua
# lendo do offset em que estava, agora dentro do conteúdo novo. Na prática a
# correção que você acabou de publicar não roda nesta vez — só na próxima.
# Aconteceu em 16/08/2026 e custou um deploy que falhou por um motivo que já
# estava corrigido no commit.
#
# Se o script mudou, começa de novo do zero com a versão nova. A variável
# impede laço infinito caso algo dê errado na comparação.
if [ "$ASSINATURA_ANTES" != "$(sha1sum "$0" | cut -d' ' -f1)" ] &&
   [ -z "${DEPLOY_REEXECUTADO:-}" ]; then
  echo "==> O próprio script de deploy mudou; recomeçando com a versão nova"
  DEPLOY_REEXECUTADO=1 exec bash "$0" "$@"
fi

echo
echo "==> Instalando dependências (se mudaram)"
# --include=dev NÃO é redundante.
#
# Quando o deploy é disparado pelo botão do painel, o processo herda o ambiente
# do pm2, que roda com NODE_ENV=production — e nesse modo o npm PULA as
# devDependencies. O build morria em "Cannot find module '@tailwindcss/postcss'"
# só por esse caminho; por SSH funcionava, porque ali NODE_ENV não vem
# definido. Descoberto em 24/08/2026, no primeiro clique do botão.
npm ci --include=dev --no-audit --no-fund --silent

echo
echo "==> Compilando em $NOVA (o painel continua no ar durante isso)"
rm -rf "$NOVA"

# Descarta os tipos gerados no build anterior antes de compilar.
#
# O tsconfig manda o TypeScript ler `.next/types/**/*.ts`, que o Next gera
# com um arquivo de validação por rota. Quando uma rota é APAGADA, esse
# arquivo velho continua lá importando um módulo que não existe mais, e a
# checagem de tipos falha por causa do build passado, não do código novo.
# Aconteceu em 16/08/2026, ao remover /api/cron.
#
# Só os tipos são apagados; o resto do .next continua servindo o painel.
rm -rf .next/types .next/dev

NEXT_DIST_DIR="$NOVA" NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Só troca se o build realmente produziu algo utilizável. Sem esta checagem,
# um build que falhou no meio derrubaria o painel ao trocar as pastas.
if [ ! -f "$NOVA/BUILD_ID" ]; then
  echo "!! O build não gerou BUILD_ID — nada foi trocado, o painel continua no ar."
  exit 1
fi

echo
echo "==> Trocando as pastas e reiniciando"
rm -rf "$ANTIGA"
[ -d .next ] && mv .next "$ANTIGA"
mv "$NOVA" .next
pm2 restart "$PROCESSO" --update-env >/dev/null

sleep 4

echo
echo "==> Conferindo"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login)
if [ "$CODIGO" != "200" ]; then
  echo "!! O painel respondeu $CODIGO. Voltando pra versão anterior."
  rm -rf .next
  mv "$ANTIGA" .next
  pm2 restart "$PROCESSO" --update-env >/dev/null
  exit 1
fi

CSS=$(curl -s http://127.0.0.1:3001/login | grep -o '/_next/static/[^"]*\.css' | head -1)
CSS_OK=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3001$CSS")
echo "  página: HTTP $CODIGO"
echo "  estilo: HTTP $CSS_OK"

if [ "$CSS_OK" != "200" ]; then
  echo "!! O estilo não carregou. Voltando pra versão anterior."
  rm -rf .next
  mv "$ANTIGA" .next
  pm2 restart "$PROCESSO" --update-env >/dev/null
  exit 1
fi

rm -rf "$ANTIGA"
echo
echo "Pronto — painel atualizado."
