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
