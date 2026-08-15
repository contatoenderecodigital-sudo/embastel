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
git fetch --quiet origin
git reset --hard origin/master --quiet
git log --oneline -1

echo
echo "==> Instalando dependências (se mudaram)"
npm ci --no-audit --no-fund --silent

echo
echo "==> Compilando em $NOVA (o painel continua no ar durante isso)"
rm -rf "$NOVA"
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
