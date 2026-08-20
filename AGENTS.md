<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Painel interno da Embastel Embalagens

Distribuidora de embalagens e descartáveis em Xanxerê/SC. O painel é interno,
usado por duas equipes com necessidades diferentes — é por isso que o menu tem
um seletor **Licitação / Loja** no topo (`src/components/Sidebar.tsx`). Não é
permissão: a senha é uma só e todo mundo abre tudo. É recorte de tela.

**O lado de licitação é o que gera dinheiro novo** e é onde o trabalho se
concentra. A Embastel vende pra prefeituras via pregão eletrônico; o painel
varre o PNCP sozinho, acha os editais do perfil da loja, e ajuda a montar
preço.

## Como rodar

```bash
npm install
cp .env.local.example .env.local   # nada é obrigatório pro painel abrir
npm run dev
```

Os dados ficam em `data/`, que **não está no Git**. Na sua máquina o painel
abre vazio, e é assim mesmo: os dados de verdade moram no servidor.

## Escreva em português, e explique o PORQUÊ

Todo comentário do projeto está em português e responde "por que isto é
assim", nunca "o que esta linha faz". Quando um número ou uma regra parecer
arbitrária, o comentário conta de onde ela veio — de preferência com a data e
o caso real que a motivou. Exemplos que já estão no código:

- `casarCategorias.ts` explica que `"descartavel"` NÃO está dentro de
  `"descartaveis"` (o plural de "-ável" é "-áveis"), e que o piso de 5 letras
  do radical existe porque com 4 o "prato" casava com "prateleiras".
- `catalogoDb.ts` mostra a aritmética de por que o piso é `custo / 0,75` e não
  `custo × 1,25`: com 10% de imposto e 15% de margem sobre R$ 10, a conta certa
  dá R$ 13,33 e a errada dá R$ 12,50 — e a margem real vira 10%.

Se você mudar uma dessas regras, atualize a explicação junto. Elas são o motivo
de o bug não voltar.

## As decisões que não são óbvias

**Dados em arquivo JSON, não em banco.** `src/lib/jsonStore.ts` é o único
caminho de gravação. Ele existe pra corrigir perda de dados, não por
simplicidade: uma instância por arquivo, fila por arquivo, `.tmp` com nome
único e backup da última versão válida. Já houve corrupção de arquivo com dois
DELETE separados por 700 ms. Não escreva em `data/` por fora dele.

**A conta do piso.** Imposto e margem incidem sobre o PREÇO DE VENDA, então é
`custo / (1 - imposto% - margem%)`. Está em `catalogoDb.calcularPrecos` e é
reaproveitada pela planilha de disputa. Não duplique essa conta.

**O custo não é atributo do produto.** O preço que o fornecedor faz depende da
quantidade que aquele edital pede. Por isso existe `disputaDb.ts` (planilha por
edital, lotes puxados do PNCP) em vez de um catálogo com margem fixa — o
catálogo antigo continua no menu, mas não é o caminho principal.

**Casar produto com lote é o ponto mais frágil do sistema, e erra caro.**
Preço errado num lote é dinheiro perdido no pregão. As travas em
`casarProdutos.ts` e `cotacoesDb.sugerirParaLote` vieram todas de erro real
visto na tela: capacidade ("1 LITRO" e "05 LITROS" têm as mesmas palavras),
negação ("ALVEJANTE SEM CLORO" recebia cloro), e toda palavra do nome ter que
bater ("limpa vidro" casava com limpa alumínio, limpa forno e limpa pedra).
**Nada é gravado automaticamente** — a tela propõe e a pessoa confirma.

**O PNCP recusa páginas o tempo todo.** Algumas dezenas por varredura é
rotina, e não é erro: `pncpCollector.ts` separa `erro` (a rodada não trouxe
nada, vermelho) de `aviso` (leu o resto, cinza). Uma recusa isolada pula só
aquela página, nunca o bloco.

**O link do edital pode vir como um espaço em branco.** Espaço é truthy, então
sempre monte o endereço com `linkEdital.linkDoEdital()`.

## Publicar

```bash
bash scripts/deploy-vps.sh    # roda NO servidor
```

O deploy é azul/verde: compila numa pasta nova e só troca no fim, então o
painel não fica fora do ar. Ele faz `git reset --hard origin/master` — só sobe
o que já está no GitHub.

**Combinem quem publica.** Duas pessoas publicando ao mesmo tempo é a receita
pra uma sobrescrever a outra. Antes de publicar: `git pull` e confira que o
que está no master é o que você espera.

**Nunca mexa no nginx nem no SSL do servidor.** Eles foram montados à mão, com
um bloco custom no vhost (redirect www→apex com exceção pro `/.well-known/`, e
cache longo pro `/_next/static/`). Reescrever o vhost ou reemitir o
certificado por fora derruba a renovação automática.

## Antes de dizer que terminou

`npx tsc --noEmit && npx eslint src && npm run build` — os três passam antes de
qualquer commit.

Quando mexer em tela, **abra no navegador e confira**. Várias telas são client
components que só buscam os dados depois de montar: procurar o texto no HTML do
servidor não prova nada (já deu falso negativo aqui).
