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

## 2026-09-04 — Claude no PC da Suzana

**A loja precifica por MARKUP, não por margem — e isso muda o que um desconto custa**

Descoberto lendo os 20.721 produtos do sistema atual: a mediana de venda/custo é
**1,501**, e a regra é `custo × 1,50 arredondado PRA CIMA no próximo R$ 0,25`.
Confirmada nos números reais — custo 7,32 vira 11,00, custo 52,86 vira 79,50,
custo 31,99 vira 48,00.

**Cuidado com o nome.** O que a casa chama de "margem de 50%" é markup sobre o
custo. Com 10% de imposto, o que sobra de fato é **23,3%**. O "mínimo de 35%"
(× 1,35) deixa **15,9%**.

Isso importa na hora do desconto, e é contraintuitivo:

| Desconto | Preço | Margem | Lucro que some |
|---|---|---|---|
| 5% | 14,25 | 19,8% | **19%** |
| 10% | 13,50 | 15,9% | **39%** |
| 20% | 12,00 | 6,7% | **77%** |

Dar 10% de desconto não tira 10% do lucro: tira 39%.

**Catálogo da loja, separado do de licitação**

`produtosLojaDb.ts` — 20.726 produtos. **Não** entrou no catálogo de licitação,
e é decisão, não descuido: são custos diferentes para o mesmo produto (no pregão
o preço depende da quantidade do edital), e 20 mil itens da loja afogariam os
lotes. Misturar cotação de editais diferentes já custou caro uma vez.

A busca é no servidor, com limite de 25: mandar 20 mil linhas pro celular da
vendedora gastaria franquia e travaria no sinal fraco. Responde em 50–100 ms.

**O sistema da loja não tem preço mínimo — o campo existe e está vazio**

Conferido: `preco_minimo` e `custo_medio` estão zerados em **todos** os 20.726
produtos. A Ketlyn tinha razão em dizer que não conseguia ver. É esse buraco que
o painel preenche.

**O que a outra ponta precisa saber**

- **Os custos importados são de 18/05/2026.** Servem pra provar a regra e montar
  o importador; não servem pra precificar hoje. Falta definir como entra o custo
  atualizado — a aposta é exportação periódica do sistema da loja.
- **O painel não funciona em celular.** O menu lateral é fixo em 256px, sem
  versão para tela pequena. A tela de pedido da vendedora depende disso.
- Alíquota da Embastel: ~10% (contra 7% da Kesu). São CNPJs diferentes.

---

## 2026-08-27 (tarde) — Claude no PC da Kemilly

**Oportunidades agora mostra só o que ainda não foi olhado**

Já escondia as descartadas. Agora esconde também **as que estão no funil**:
a aba é pra garimpar, e licitação acompanhada tem tela própria. Deixá-la nas
duas fazia reler todo dia uma decisão já tomada.

Ao clicar em "+ Acompanhar" o card **sai da lista na hora**, sem esperar a
próxima busca. Sem isso ele ficaria parado mostrando "✓ No funil", e quem
limpa a lista de cima pra baixo clicaria de novo no mesmo achando que não
pegou. Mesmo padrão do "Não interessa".

**Documentos de habilitação cadastrados**

Os 12 da pasta DOCS-LICITACOES entraram com tipo, datas e arquivo anexado.
**Isso foi feito no painel local**, não no do servidor — daqui não há acesso.

Duas decisões que valem registro:

- **O .pfx do certificado digital NÃO foi anexado.** A ficha existe, com a
  validade 06/11/2026, pra o painel avisar antes de vencer. Mas o arquivo
  carrega a chave privada da empresa — é com ela que se assina proposta e
  contrato — e num anexo do painel qualquer pessoa logada baixa.
- **Os anexos 12 a 17 ficaram de fora.** São declarações daquele edital de
  Sananduva, com numeração e texto próprios. Em outro pregão os anexos mudam,
  então não são biblioteca permanente.

O atestado de capacidade técnica continua como pendência na lista amarela,
porque de fato não existe nenhum.

**Raio padrão foi pra 175 km**

E fica registrado o que ele NÃO faz, pra ninguém tentar de novo: **mexer no
raio não reduz o que se lê do PNCP**. Ele escolhe os estados a varrer, com
folga de 300 km sobre o centro de cada um, e de Xanxerê qualquer valor acima de
8 km já dá SC, PR e RS. Com folga zero nenhum centro caberia e o coletor cairia
na varredura NACIONAL — nove vezes mais páginas.

A folga é o que salva a divisa: **Sananduva fica no RS, a 133 km**, mas o centro
do RS está a 308. Com folga de 100 km o Rio Grande do Sul sairia da varredura e
aquele pregão de R$ 894 mil nunca teria aparecido.

Quem controla o volume é a **janela de 30 dias** e as **duas modalidades**. Não
mexi: é decisão de negócio.

---

## 2026-08-27 — Claude no PC da Kemilly

**Coluna "Avaliar" antes de "De olho"**

As duas coisas eram uma só e não são: salvar pra decidir depois é diferente de
já ter decidido que vale. Misturadas, a primeira coluna crescia sem parar com o
que presta e o que não presta no mesmo monte, e o quadro parava de informar.

Agora **quem entra no funil entra como "Avaliar"**. "De olho" passa a significar
"já avaliei, vale participar, falta chegar a hora".

Cuidado pra quem mexer: **dois pontos listam os status de "antes da sessão" um a
um** — a contagem de encerradas e o filtro que esconde as vencidas. O status
novo entrou nos dois; se ficasse de fora, licitação vencida em "Avaliar"
ficaria no quadro pra sempre. `relatorios.ts` também tem o mapa de rótulos, e o
TypeScript acusa se faltar.

"Avaliar" **não** entra em DISPUTADAS, pelo mesmo motivo que "de_olho" nunca
entrou: contar o que nunca virou proposta infla o denominador da taxa de vitória.

**Imprimir a lista de lotes**

Botão "Imprimir lista" ao lado do seletor de licitação, na tela de Preços dos
fornecedores. No papel os campos de formulário viram texto — a tela é planilha
editável, mas impressa vira folha de consulta, e caixinha de input vazia só
rouba espaço do número que interessa.

O cabeçalho da tabela se repete a cada página e a linha não parte no meio: meia
linha numa folha e meia na outra é como se dá lance no lote errado.

**Pasta DOCS-LICITACOES arrumada**

As duas certidões que faltavam chegaram em 25/08, e as duas **NEGATIVAS**:
federal e estadual SEF/SC, ambas válidas até **21/02/2027**. Foi o DARF do INSS
que limpou a pendência federal.

Apagadas as duas vencidas que elas substituem (federal de 17/06/2026 e estadual
de 22/10/2024) — a pasta `_reserva`, que só existia pelo prazo de regularização
de ME/EPP, deixou de fazer sentido e foi removida. Uma segunda via da federal,
emitida dois minutos depois da primeira, e o "Relatório de Situação Fiscal" (que
é tela de apoio, não certidão) foram pra `_descartados`.

**A sequência está completa: 01 a 17, sem buraco.**

**O que a outra ponta precisa saber**

- **O CRF do FGTS vence em 04/09/2026** — é o mais curto de todos (30 dias) e o
  que mais derruba empresa desprevenida.
- A certidão municipal de Xanxerê **segue POSITIVA**, acompanhada dos dois
  comprovantes de pagamento. Vale tentar reemitir.
- Falta anexar o **PDF do DARF do INSS** (só há o comprovante em foto).
- Os documentos ainda **não foram cadastrados na aba Documentos**: isso só dá
  pra fazer de dentro do painel no ar, e daqui não há acesso ao servidor.

---

## 2026-08-25 (tarde) — Claude no PC da Kemilly

**A aba Estoque ficava vazia mesmo com fornecedor preenchido**

Falha de projeto minha, achada pela Suzana usando. A reposição automática só
dispara **no evento** de salvar uma contagem, e só enxerga as contagens daquele
momento. Quem preenche o fornecedor depois — que é o caso de todo mundo agora,
já que os 129 itens nasceram sem — nunca via nada chegar no Estoque, porque a
última contagem aconteceu antes do campo existir.

Item contado baixo semanas atrás tinha o mesmo destino: sumia do pedido sem
ninguém perceber que sumiu.

**Botão "Puxar da conferência"** na aba Estoque. Olha o **estado de hoje** em
vez de esperar o próximo evento: todo item ativo, com fornecedor e quantidade
ideal preenchidos, já contado ao menos uma vez, e cuja última contagem ficou
abaixo do ideal. A reposição no salvar continua existindo — o botão é a rede
pra tudo que ficou pra trás.

**Nunca contado não entra.** O item pode estar cheio na prateleira e só não ter
passado pela contagem ainda; pedir sem ter contado seria inventar falta.

**O que a outra ponta precisa saber**

- **Três campos, não um.** O item só chega no Estoque se tiver fornecedor E
  quantidade ideal E pelo menos uma contagem. Faltando qualquer um, ele é
  ignorado em silêncio — e "em silêncio" foi o que fez a Suzana achar que
  estava quebrado.
- O aviso do botão diz quantos itens foram analisados, justamente pra separar
  "não tem nada baixo" de "nada está preenchido".

---

## 2026-08-25 — Claude no PC da Kemilly

**Quatro pedidos da Suzana, quatro entregas**

**1. O raio não parava em pé — era bug, não distração.** Quem digitasse "80"
via voltar pra 250 sozinho segundos depois. `loadColeta` reescrevia os campos de
configuração com o valor do servidor a **cada** chamada, e ela roda de 2 em 2
segundos enquanto a coleta anda. Agora a config salva só preenche os campos na
PRIMEIRA carga; depois disso quem manda é quem está na tela.

**2. Dá pra descartar licitação da busca.** Botão "Não interessa" em cada
resultado, com motivo opcional. A lista de descartadas mora em
`licitacoes-descartadas.json`, **separada do índice**: apagar do índice não
adiantaria, porque o coletor regrava tudo de 6 em 6 horas e a licitação voltaria
na rodada seguinte, pra sempre. Dá pra restaurar pela API.

Sobre "a lista parece aleatória": ela já é ordenada por prazo mais apertado
primeiro. O que parece bagunça são as licitações **sem data de encerramento**,
que caem todas no fim. Se incomodar, vale conversar sobre escondê-las por padrão.

**3. Quinzenais espalhados entre as duas semanas.** Botão "Equilibrar
quinzenais" na Conferência. Como tudo foi cadastrado e conferido no mesmo dia,
todos venciam juntos: uma semana com a lista inteira e a seguinte vazia. Metade
passa a vencer 7 dias antes, e o intervalo de 14 dias mantém o revezamento
sozinho. Testado com os 59 quinzenais: **Eli saiu de 30/0 pra 15/15, Valdecir de
29/0 pra 15/14**.

A divisão é por pessoa (metade do total podia ser toda de um) e o corte é por
**local**, pra que os itens da mesma semana fiquem perto no depósito.

**4. Conferência ligada ao Estoque pelo fornecedor.** Item de conferência agora
tem campo Fornecedor: **menu fechado, alimentado pela aba Fornecedores** — mesmo
motivo do menu de "quem confere", porque o filtro do Estoque compara texto exato
e "Ibras"/"ibras" virariam dois fornecedores com o pedido partido em dois. Nome
que já esteja gravado num item mas tenha saído da aba continua aparecendo,
senão o item perderia o dono em silêncio. Ao salvar a contagem, o que veio **abaixo do ideal** aparece
sozinho na aba Estoque, no fornecedor certo, como "baixo" ou "falta", com a
quantidade sugerida. Dali o botão de copiar lista por fornecedor, que já
existia, monta o pedido.

Não duplica: contar de novo atualiza a linha em vez de criar outra.

**Um erro meu que vale registrar, porque quase passou**

Escrevi uma trava pra não rebaixar "falta" pra "baixo", pensando em quem marca
falta à mão sabendo de algo que a contagem não vê. Só que ela congelava também o
que a **própria conferência** tinha marcado: contar 3 unidades e continuar
dizendo "falta" geraria pedido de coisa que está no depósito. Resolvido com o
campo `origem` em `ProdutoEstoque` — a conferência manda nas linhas que ela
criou, e não rebaixa as que uma pessoa marcou.

**O que a outra ponta precisa saber**

- **Os 129 itens de conferência estão sem fornecedor.** A ponte com o Estoque só
  funciona nos que tiverem o campo preenchido — dá pra preencher direto na lista,
  sem recadastrar.
- **A ponte só age em item com "quantidade ideal" definida.** Sem o ideal não há
  como saber que está baixo, e o item é ignorado em silêncio.
- Continua valendo o aviso da entrada anterior: **frete zerado em 100% dos lotes
  cotados**, o que deixa todo piso otimista.

**Esperando resposta**

- Continua valendo tudo das entradas anteriores.

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
