# Diário de bordo

Recado entre quem trabalha neste projeto — as duas pessoas e os dois Claudes,
um no PC do Eliezer e outro no da Kemilly.

**Se você é um Claude abrindo este projeto:**

1. **Leia as duas ou três entradas de cima antes de começar.** É onde está o
   que mudou desde a última vez, o que ficou pela metade e o que a outra ponta
   precisa saber. O `git log` conta o que foi feito; aqui conta o que ainda
   incomoda, o que foi decidido e o que está esperando resposta.
2. **Escreva uma entrada nova quando terminar** um trabalho que valha a pena a
   outra ponta saber. Não precisa registrar ajuste de uma linha.
3. **Entrada nova vai no TOPO**, logo abaixo desta explicação — assim ninguém
   precisa rolar até o fim pra ver o que é recente.

Formato: data, quem, e três blocos curtos. Escreva pra pessoa, não pro
computador: o que mudou na prática, e o que ela precisa fazer.

---

## 2026-08-24 (noite) — Claude no PC do Eliezer

**O imposto estava errado — 10% em vez de 7%**

Era chute meu e ninguém tinha conferido. O Simples da empresa é **7%**
(contador, 24/08). Chute pra cima aqui não é conservador, é caro: com 10% o
piso sai mais alto que o necessário e se desiste de lance que dava lucro.

Já corrigido no padrão e reaplicado em **todos os editais**. O efeito, só de
trocar o número:

| Edital | Lucro antes | Lucro agora |
|---|---|---|
| Taió | R$ 39.581 | **R$ 43.380** |
| Sananduva | R$ 26.286 | **R$ 28.718** |
| Santa Lúcia | R$ 1.650 | R$ 1.785 |
| Victor Graeff | R$ 872 | R$ 934 |

**R$ 6,4 mil** que estavam sendo escondidos por um chute.

**O que mudou na tabela**

- **Linha verde fecha, vermelha não fecha**, branca ainda sem custo. Na sala de
  disputa não dá tempo de ler número em 199 linhas.
- **Frete saiu de trás do botão** e virou coluna fixa. Frete é parte do custo,
  não detalhe de cálculo — com ele zerado o piso fica **otimista**, como se a
  mercadoria chegasse de graça. O campo fica âmbar enquanto ninguém cotou.
- **Passar o mouse no piso mostra a conta inteira**: custo, frete rateado pela
  quantidade, custo total, e a divisão por (100 − imposto − margem).

**O que a outra ponta precisa saber**

- **Frete está zerado em 100% dos lotes cotados.** Em Sananduva são 17 de 17.
  Enquanto não entrar, todo piso da planilha está otimista, e os lotes que
  fecham por pouco podem virar prejuízo.
- Sananduva agora: **7 lotes fecham, R$ 28.718**. O copo descartável sozinho é
  R$ 15.404 e o tapete de porta R$ 3.361.
- Quatro lotes de Sananduva **perdem por pouco** e mudam de lado se o
  fornecedor melhorar: álcool gel 5 L (falta 8%, custo teria que cair de
  R$ 32,50 pra R$ 30,01), rodo de espuma (9%), rodo tipo bola (11%) e pá de
  lixo (13%).

**Esperando resposta**

- Continua valendo tudo das entradas anteriores.

---


## 2026-08-24 (fim do dia) — Claude no PC do Eliezer

**O que mudou**

- **Botão "Publicar agora" dentro do painel.** No topo da tela inicial aparece
  um aviso quando tem código no GitHub que ainda não está no ar, com quem fez
  e há quantos dias. Clicou, o servidor puxa e reconstrói sozinho. O aviso
  some quando não há nada pendente — aviso que aparece sempre ninguém lê.
- **Publiquei o que estava parado.** O servidor estava no commit de 20/08 e o
  recorte por licitação da Kemilly (24/08) estava no GitHub havia quatro dias
  sem ir pro ar. Rodei tsc, eslint e build no código dela antes: passou nos
  três. Já está no ar.

**Por que o botão existe**

Publicar exigia SSH com chave de root, e só o Eliezer tem. Não foi decisão
deixar o trabalho parado — foi que ninguém foi avisado e quem fez não tinha
como publicar. O botão resolve os dois lados sem distribuir chave nenhuma:
quem entrou no painel já provou que tem a senha, é a mesma porta.

**O que a outra ponta precisa saber**

- **Kemilly: agora você publica sozinha.** Painel → o aviso amarelo no topo →
  "Publicar agora". Leva uns 2 minutos e o painel pisca no fim (o processo
  reinicia). Se der errado, ele **volta sozinho pra versão anterior** — o
  deploy compila numa pasta separada e só troca no fim.
- **Combinem mesmo assim.** Duas publicações ao mesmo tempo continuam sendo
  problema: a segunda pega o que a primeira acabou de subir. O botão recusa se
  já tiver uma rodando, mas avisar continua sendo mais barato.
- O que não foi `git push` não vai pro ar. O botão publica o que está no
  GitHub, não o que está na sua máquina.
- Detalhe técnico pra quem for mexer: o script é lançado **desanexado**, senão
  o `pm2 restart` que ele mesmo dispara mataria o processo no meio. O progresso
  vai pra `data/deploy.log` e a tela pergunta de tempos em tempos — inclusive
  depois do reinício, porque o estado mora no disco.

**Foram dois tropeços até funcionar, os dois só visíveis pelo botão**

**1. `npm ci` pulava as devDependencies.** O build morreu em "Cannot find
module '@tailwindcss/postcss'" — e **por SSH o mesmo deploy funcionava**. O
processo lançado pelo botão herda o ambiente do pm2, que roda com
NODE_ENV=production, e nesse modo o npm ignora devDependency. Corrigido nos
dois lados: `--include=dev` no script e NODE_ENV fora do ambiente do filho.

**2. O `pm2 restart` matava o próprio deploy.** O painel atualizava certinho,
mas a tela ficava "Publicando…" pra sempre. O pm2 mata a ÁRVORE de processos do
app pela cadeia de pais, e o `detached` do Node cria um grupo novo mas não uma
SESSÃO nova — o deploy ainda aparecia como filho do painel na hora do restart.
Resolvido com `setsid`, que o torna líder de sessão e o tira da árvore. O script
também ganhou um `trap EXIT` que grava o código de saída aconteça o que
acontecer.

Se algum dia voltar: **sintoma do 1** é o build falhar só pelo botão; **sintoma
do 2** é o painel atualizar mas a tela não sair de "Publicando…".

**A rede de proteção segurou nas duas vezes**

No primeiro erro o build falhou, o BUILD_ID não apareceu, **nada foi trocado e
o painel continuou no ar**. É essa rede que torna o botão seguro de usar — e
ela foi testada de verdade, não só no papel.

**Testado ponta a ponta:** o terceiro clique publicou sozinho em 40 segundos,
com o aviso verde "Publicado" aparecendo na tela no fim.

**Esperando resposta**

- Continua valendo tudo da entrada anterior (IPI da Ecosul, prazo e trava de
  preço, e o Termo de Referência de Taió).

---

## 2026-08-24 — Claude no PC do Eliezer

**O que mudou**

- **Primeira cotação de saco de lixo entrou.** Ecosul (Indústria e Com de
  Plásticos Mingori, Paulo Bento/RS — fone 54 99211-6850, vendedor JSG
  Representações), orçamento 28200 de 21/08/2026: **SACO PARA LIXO PRETO 100L,
  12 micras, R$ 62,67 o pacote c/100, pra 300 pacotes**. Está na tela de Preços
  dos fornecedores, e a Ecosul entrou na agenda com o telefone.

**Por que isso importa agora**

Na entrada de ontem você escreveu que saco de lixo era o buraco: R$ 112 mil em
quatro lotes, nenhum cotado. Este é o primeiro deles com preço na mão. E contra
o teto que você desconfiou — **saco de lixo 12 micras a R$ 128,80 o pacote** —
o custo de 62,67 (68,78 com IPI) deixa muito espaço. Vale conferir se o lote de
12 micras do edital é este mesmo produto antes de comemorar: a Ecosul cotou o
100 litros com espessura 0,0012, e a sua lista tem "100 litros" e "12 micras"
como lotes separados.

**O que a outra ponta precisa saber**

- **O preço gravado é 62,67, mas o que sai do caixa é 68,78 o pacote.** O
  orçamento traz Vl. Unit. 62,67; o IPI de R$ 1.833,10 entra por cima e o total
  a pagar é R$ 20.634,10 pelos 300 pacotes. O ICMS de R$ 2.256,12 está embutido,
  esse não soma. Gravei o 62,67 porque é o número comparável com o que os outros
  fornecedores mandam — mas se a Kesu não credita IPI, o custo real da planilha
  é 68,78, e usar 62,67 dá um piso otimista demais. Decisão pendente com o
  Eliezer.
- **Faltam os dois campos que mais decidem na Ecosul:** por quantos dias ela
  segura o preço e o prazo de entrega. Deixei em branco de propósito em vez de
  chutar. Alguém precisa perguntar pro JSG — a ata dura 12 meses.
- **Bug achado, não consertado:** `cotacoesDb.nomeDoProduto` corta a descrição
  no primeiro `[.,;:]`, então qualquer produto com decimal em vírgula perde o
  nome. "SACO PARA LIXO PRETO 100Lt 0,0012" virava "SACO PARA LIXO PRETO 100Lt
  0". Contornei escrevendo "100L" na mão. Pega 0,5 L, 1,5 kg, 0,03 mm — vale
  arrumar antes de lançar cotação em volume.
- Pagamento da Ecosul é a prazo em três parcelas: 8.100,00 em 18/09, 6.267,00
  em 25/09 e 6.267,10 em 02/10.

**Esperando resposta**

- Taió (pregão 130/2026) abre 25/08 às 9h. O Termo de Referência veio "à parte"
  e não temos os itens nem os lotes — sem ele não dá pra montar proposta. Se
  alguém tiver o anexo, joga na pasta que eu carrego.

---

## 2026-08-24 — Claude no PC da Suzana

**O que mudou**

- **Preços dos fornecedores agora tem recorte por licitação.** Um seletor no
  topo: em "Todas" a tela é a de sempre, sem mudança nenhuma. Escolhendo uma
  licitação, ela vira a planilha daquele edital — só os lotes dele, com teto do
  órgão, fornecedor, marca, custo, piso e empate na mesma linha. Quando a
  licitação ainda não tem lotes, aparece o botão de puxar do PNCP.
- O piso continua vindo **calculado do servidor**, nunca refeito na tela: a
  conta mora em `catalogoDb.calcularPrecos` e duplicá-la é como ela sai
  diferente nos dois lugares.
- Linha com **custo acima do teto do órgão fica vermelha** e diz isso. Veio de
  caso real: três lotes de Sananduva estavam com custo acima do que a
  prefeitura aceita pagar, e isso não aparecia em lugar nenhum antes.

**Por que, se a Disputa e piso já fazia isso**

A Suzana estava montando o pregão a partir da lista corrida, que junta todos os
editais. O resultado foi uma lista com cloro, lava-roupas e limpa-vidros de 5 L
que **não existem no edital de Sananduva** — eram de outro pregão. O recorte
existe pra que a tela de memória de preços também consiga responder "e neste
edital aqui?" sem a pessoa ter que trocar de tela e sem misturar.

**O que a outra ponta precisa saber**

- **O imposto padrão da disputa é 10%, e a Kesu é 7%** (Simples, confirmado com
  o contador em 24/08/2026). Com 10% o piso sai mais alto que o necessário e se
  perde disputa que dava pra ganhar. Ajustar nos padrões da disputa.
- **A lista de cotações de agosto não serve pra Sananduva.** Só 9 dos 47 lotes
  tinham custo aproveitável. Os itens de papel (higiênico, toalha,
  interfolhada — R$ 312 mil dos R$ 894 mil) ficam de fora por decisão da
  Suzana: a indústria cota direto e o distribuidor não acompanha o preço.
- **Onde está o dinheiro que sobrou:** saco de lixo, R$ 112 mil em quatro lotes
  (30, 50, 100 litros e o de 12 micras), nenhum cotado. É embalagem.
- Dois tetos do edital parecem altos demais e vale conferir antes de confiar:
  pano mágico a R$ 81,63 a unidade e saco de lixo 12 micras a R$ 128,80 o
  pacote.

**Esperando resposta**

- Pregão de Sananduva encerra 25/08 às 8h59 — conferir se o painel no ar
  mostrou o recorte certo durante a sessão.

---

## 2026-08-20 — Claude no PC do Eliezer

**O que mudou**

- **Menu dividido em Licitação e Loja**, com seletor no topo. Não é permissão:
  a senha é uma só. É recorte de tela, porque são duas equipes.
- **Fornecedores de licitação** virou agenda própria, separada da lista da
  loja (`data/fornecedor_licitacao.json`). São 20 contatos cadastrados, todos
  com o nono dígito do celular corrigido.
- **Disputa e piso** é a tela nova principal. Os lotes vêm do PNCP com um
  clique; preenche-se só o custo cotado, e ela calcula o piso do lance, o
  faturamento e o lucro por lote. Tem modo pregão pra usar durante a sessão.
- **Preços dos fornecedores**: histórico de quem cotou o quê, por quanto e pra
  qual quantidade. Enche-se sozinho quando um custo é preenchido na disputa.
- Corrigido: o link "Edital" abria o próprio painel em vez do edital (o PNCP
  devolve o link como um espaço em branco em ~1 de cada 6 licitações).
- Corrigido: a coleta anunciava "Última coleta falhou" em vermelho depois de
  salvar 22 mil licitações. Página recusada é rotina, agora sai em cinza.

**O que a outra ponta precisa saber**

- **A conta do piso divide, não multiplica**: `custo / (1 - imposto - margem)`.
  Com 10% e 15% sobre R$ 10 dá R$ 13,33, não R$ 12,50. Está em
  `catalogoDb.calcularPrecos` e é reaproveitada. Não duplique.
- **Casar produto com lote erra caro** e por isso tem três travas em
  `casarProdutos.ts` (capacidade, negação, todas as palavras). Todas vieram de
  erro real: "1 LITRO" recebendo preço de "05 LITROS", "ALVEJANTE SEM CLORO"
  recebendo cloro, "limpa vidro" casando com limpa alumínio. Se afrouxar
  qualquer uma, esses erros voltam.
- Vários lotes estão marcados **⚠ PREENCHER FORNECEDOR** / **⚠ PREENCHER
  MARCA**. É de propósito: o pregão exige declarar a marca item por item, e sem
  isso a proposta não pode ser enviada.

**Esperando resposta do Eliezer**

- Nome real de dois fornecedores: o dos plásticos (preço com +6,5% de IPI) e o
  dos panos/tapetes. Estão como placeholder e travam 10 lotes.
- O limpa vidros do Gota Limpa é de 500ml ou tem versão de 5 litros? Taió lote
  27 paga R$ 21,18 e seria o melhor lote da lista.
- O dispenser de papel toalha é interfolhado ou bobina auto-corte? Muda em qual
  edital ele serve.
- `ANTHROPIC_API_KEY` no servidor — três funções estão prontas e dormindo:
  "Resumir c/ IA", triagem automática e resposta do WhatsApp.
