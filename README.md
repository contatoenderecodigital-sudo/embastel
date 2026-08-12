# Painel Embastel Embalagens

Painel interno da loja, rodando localmente (`npm run dev`, http://localhost:3000).

Módulos: **Licitações** (o foco), **Tarefas**, **WhatsApp**, **Estoque**, **Fornecedores**,
**Clientes**, **Pedidos**, **Romaneio**, **Comissões** e **Marketing** (fichas de produto
e promoções).

## Como rodar

```bash
npm install
npm run dev
```

## Licitações — como funciona

Este é o módulo que gera receita, então vale entender a arquitetura.

### O problema que a versão anterior tinha

A busca conversava com o PNCP ao vivo, durante o clique do usuário. Como uma
consulta dessas demora, ela lia só as **4 primeiras páginas** (200 registros) de
cada Estado × modalidade. Medindo em 12/08/2026 quanto isso representava:

| Santa Catarina, últimos 30 dias | Pregão Eletrônico | Dispensa |
| ------------------------------- | ----------------- | -------- |
| Licitações publicadas           | 2.310 (47 páginas) | 3.050 (61 páginas) |
| Batiam com o perfil da Embastel | 18                | 12       |
| ...e ainda estavam abertas      | 9                 | 1        |
| ...que a busca antiga encontrava | **0**            | **0**    |

As 10 oportunidades reais daquele dia estavam nas páginas 26, 29, 32, 33, 42, 43 e
56 — todas fora do alcance. A busca levava **2min33s** para devolver **zero
resultados**.

### Como funciona agora

**Um coletor em segundo plano** (`src/lib/pncpCollector.ts`) varre o PNCP inteiro —
todas as páginas, de todos os Estados dentro do raio, de todas as modalidades
escolhidas — e guarda tudo num índice local (`data/licitacoes-indice.json`), já com
a coordenada de cada município resolvida.

**A busca da tela** (`src/lib/pncp.ts`) só filtra esse índice em memória. Não toca em
rede nenhuma: responde em milissegundos, e por isso os filtros aplicam sozinhos
enquanto você digita, sem botão "Buscar".

O coletor:

- Roda quando o servidor sobe (via `src/instrumentation.ts`) e depois a cada
  **6 horas** (ajustável em `licitacaoIntervaloHoras`).
- Também pode ser disparado na hora pelo botão **"Atualizar agora"**, com barra de
  progresso ao vivo.
- Guarda só o que ainda dá pra disputar (prazo no futuro + 2 dias de carência).
- **Não morre por causa de uma página ruim**: o PNCP responde 429 com frequência
  numa leitura longa. Cada página tem 6 tentativas com espera crescente (3s → 60s);
  se ainda assim falhar, ele registra, desacelera o ritmo pelo resto da rodada e
  segue para o próximo bloco. Índice parcial vale mais que índice nenhum.
- Quando entra uma licitação nova que bate com as palavras-chave **e** está dentro
  do raio, ele cria uma **notificação**.

A primeira coleta demora bastante (lê centenas de páginas e consulta o Nominatim
para localizar cada cidade nova, a 1 requisição por segundo). As seguintes são bem
mais rápidas, porque as cidades já ficam em cache.

### Configuração da coleta

Em "Ajustes da coleta", na própria tela: endereço da loja (centro do raio), raio em
km, e quais modalidades ler. Quanto mais modalidades, mais demorada cada rodada —
Pregão Eletrônico e Dispensa cobrem quase toda compra de material.

### Funil

Cinco colunas: **De olho → Preparando proposta → Proposta enviada → Ganhou /
Perdeu**. Cada card tem anotação livre, prazo com cor (vermelho ≤2 dias, amarelo
≤7), valor, e o botão **"Resumir com IA"**.

Licitações com prazo vencido somem das colunas por padrão (tem um "Mostrar
encerradas" pra revê-las). O topo mostra quanto tem **em jogo** no funil.

> **Sobre participar**: nenhum sistema (nem os pagos) envia a proposta por você.
> Isso acontece sempre no portal de origem, com login e certificado digital
> (e-CNPJ) da empresa. O painel ajuda a *encontrar, avaliar e organizar*.

## Notificações

O painel avisa de verdade, não só com um pontinho na tela:

- **Sino no canto superior direito**, com contador de não lidas.
- **Som** quando chega algo novo (bipe gerado na hora pela Web Audio API — sem
  arquivo de som no projeto).
- **Notificação do sistema operacional**, se você autorizar no primeiro clique —
  aparece mesmo com o painel numa aba de fundo.
- **Contador no título da aba** (`(3) Embastel · Painel`).

O que vira aviso (`src/lib/avisosAutomaticos.ts`, roda a cada 5 minutos):

| Aviso | Quando |
| ----- | ------ |
| Licitação nova | Entrou no PNCP batendo com o perfil e dentro do raio |
| Prazo apertado | Licitação do funil a 3 dias e de novo a 1 dia do fim |
| WhatsApp | A IA não teve segurança de responder sozinha |
| Estoque | Produto marcado como em falta |

**Limitação**: o painel roda local. Com ele fechado, ninguém é avisado. Notificação
por WhatsApp/e-mail com o computador desligado depende de hospedagem (ver
"Próximos passos").

## Armazenamento dos dados

Tudo em JSON dentro de `data/` (fora do git). O acesso passa por
`src/lib/jsonStore.ts`, que existe por causa de um bug real de perda de dados.

**O que acontecia**: cada lib chamava `JSONFilePreset()` (lowdb) a cada requisição.
O lowdb grava pelo `steno`, que serializa gravações e escreve de forma atômica — mas
o trinco é *por instância* do Writer, e o arquivo temporário tem nome fixo derivado
do arquivo final. Criando um Writer novo por requisição, duas requisições
simultâneas viravam dois Writers sem trava entre si escrevendo no **mesmo** `.tmp`.
Observado em teste: dois DELETE com 700ms de diferença deixaram o
`data/licitacoes-acompanhadas.json` sintaticamente inválido, e a partir daí **toda
rota do módulo respondia 500**.

**Como está resolvido**, em quatro camadas:

1. Uma instância por arquivo, compartilhada por todas as rotas.
2. Fila por arquivo: ler-alterar-gravar roda inteiro sob trava, então duas
   alterações simultâneas não se sobrescrevem.
3. Arquivo temporário com nome único por processo/gravação — o pior caso vira "a
   última gravação vence", nunca "o arquivo quebrou".
4. Backup da última versão válida em `data/.backup/` antes de cada gravação, com
   **recuperação automática** na leitura: se o arquivo principal estiver ilegível,
   ele é movido para `.corrompido-<timestamp>` e o backup assume.

O `rename` final tem retry (10 tentativas): no Windows ele falha com `EPERM`/`EBUSY`
quando o antivírus ou o indexador está com o arquivo aberto naquele instante — não é
erro de verdade, e sem o retry uma coleta de 10 minutos morria na metade gravando um
contador de progresso.

## WhatsApp — configuração

Usa a **WhatsApp Cloud API oficial da Meta** (gratuita até 1000 conversas/mês):

1. Crie um App "Business" em [developers.facebook.com](https://developers.facebook.com)
   e adicione o produto **WhatsApp**.
2. Copie `.env.local.example` para `.env.local` e preencha `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_VERIFY_TOKEN`.
3. Para **receber** mensagens, a Meta precisa alcançar `/api/whatsapp/webhook` numa
   URL pública. Rodando local, use [ngrok](https://ngrok.com/): `ngrok http 3000`.
4. No painel da Meta (WhatsApp > Configuração > Webhook), cadastre a URL do ngrok +
   `/api/whatsapp/webhook`, o mesmo verify token, e inscreva-se no campo `messages`.

### IA respondendo sozinha (desligada por padrão)

Precisa de `ANTHROPIC_API_KEY` no `.env.local` (chave em
[console.anthropic.com](https://console.anthropic.com)). O modelo é o **Claude Haiku
4.5** — uma troca de mensagens custa fração de centavo. A mesma chave serve para o
"Resumir com IA" das licitações.

Cadastre os **"Avisos de hoje"** (ex: "sem estoque de guardanapo") — é o contexto que
a IA usa. Ligando o botão, cada mensagem nova passa por ela, que **responde sozinha**
o que é simples e coberto pelos avisos, ou **marca "precisa de você"** quando envolve
preço, negociação, reclamação ou nota fiscal — nesse caso não responde nada, só
sinaliza. Assim que você responde manualmente, a IA pausa naquela conversa.

> O resumo de licitação usa só os dados públicos do PNCP (objeto, valor, prazo,
> órgão) — **não lê o PDF do edital**. O endpoint de arquivos do PNCP deu timeout
> repetido em teste; está documentado em `src/lib/licitacaoSummary.ts`.

## Próximos passos

- **Hospedagem**: hoje o painel só roda local, e sem ele aberto não há coleta nem
  aviso. Publicando (Vercel, ou junto do site embastelembalagens.com.br) o coletor
  roda 24h e dá pra mandar alerta no WhatsApp/e-mail de verdade.
- **Cobertura multi-portal**: hoje só o PNCP. Fora dele existem Diários Oficiais,
  Licitações-e/BLL e portais próprios de prefeitura.
- **Ler o edital completo**: baixar o PDF e deixar a IA conferir exigências de
  habilitação (certidões, atestados) antes de você investir tempo na proposta.
- **Histórico de preços**: guardar o que foi homologado nas licitações passadas pra
  saber a que preço dá pra brigar.
