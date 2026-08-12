# Colocar no ar (Vercel)

Um deploy só serve as duas coisas:

| Endereço | O que é | Quem acessa |
| --- | --- | --- |
| `seudominio.com/` | Site da loja | Qualquer pessoa |
| `seudominio.com/painel` | Painel interno | Só quem tem a senha |

São **4 passos**. Leva uns 20 minutos.

---

## 1. Criar o banco de dados (5 min)

O painel guarda tudo em arquivos quando roda no seu computador. No Vercel isso
não funciona: o disco lá é somente leitura e some a cada requisição. Por isso
precisa de um banco — o plano grátis do Neon dá e sobra para o tamanho da loja.

1. Entre em **[neon.tech](https://neon.tech)** e crie uma conta (pode usar o
   GitHub).
2. **Create project** → nome `embastel`, região **AWS São Paulo (sa-east-1)**.
3. Na tela seguinte, copie a **Connection string**. É parecida com:
   ```
   postgresql://usuario:senha@ep-algo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Guarde: é o valor de `DATABASE_URL`.

### Levar os dados que já existem

O que está hoje no seu computador (74 clientes, 35 fornecedores, o funil de
licitações, tarefas) está na pasta `data/`. Para copiar tudo para o banco, rode
**uma vez**, no PowerShell, dentro da pasta do projeto:

```powershell
$env:DATABASE_URL="cole-aqui-a-connection-string"
node scripts/migrar-para-banco.mjs
```

Ele lista o que migrou e quantos registros tinha em cada um. Para só conferir o
que já está lá, sem gravar nada:

```powershell
node scripts/migrar-para-banco.mjs --listar
```

---

## 2. Mandar o código para o GitHub (2 min)

O repositório já está criado em
`https://github.com/contatoenderecodigital-sudo/embastel`. Na pasta do projeto:

```bash
git add -A
git commit -m "Painel Embastel: site publico + painel interno"
git push -u origin master
```

---

## 3. Publicar no Vercel (5 min)

1. Entre em **[vercel.com](https://vercel.com)** com a mesma conta do GitHub.
2. **Add New → Project** → escolha o repositório `embastel` → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre:

| Nome | Valor | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | a connection string do passo 1 | onde os dados ficam |
| `PAINEL_SENHA` | uma senha que você escolher | acesso ao `/painel` |
| `SESSION_SECRET` | um texto longo e aleatório qualquer | assina o cookie de quem entrou |
| `CRON_SECRET` | outro texto longo e aleatório | impede que estranhos disparem a coleta |

> Para gerar os textos aleatórios, rode no PowerShell:
> `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()`

4. **Deploy**.

### Depois que subir

O Vercel lê o `vercel.json` e liga sozinho as duas tarefas agendadas:

- `/api/cron/coleta` a cada 5 minutos — varre o PNCP aos poucos.
- `/api/cron/avisos` a cada 10 minutos — gera os avisos de prazo, WhatsApp e
  estoque.

A primeira varredura completa leva algumas horas se espalhando por essas
fatias de 5 em 5 minutos (são mais de 500 páginas do PNCP, e ele bloqueia quem
lê rápido demais). Depois disso ela só busca o que mudou.

> **Plano Hobby**: o Vercel limita crons a **uma execução por dia** no plano
> grátis. Se você ficar no Hobby, troque os dois `schedule` do `vercel.json`
> para `"0 6 * * *"` (uma vez por dia, 6h) — ou assine o Pro, onde o de 5 em 5
> minutos funciona como está.

---

## 4. Apontar o domínio (5 min)

No Vercel: **Settings → Domains → Add** e informe `embastelembalagens.com.br`.
Ele mostra os registros de DNS para cadastrar onde o domínio está registrado.
Enquanto isso não acontece, o endereço `embastel.vercel.app` já funciona.

---

## Opcional: ligar a inteligência artificial

Sem isso, tudo funciona — só três recursos ficam desligados.

1. Crie uma chave em **[console.anthropic.com](https://console.anthropic.com)**
   → API Keys.
2. No Vercel, cadastre `ANTHROPIC_API_KEY` com essa chave e faça **Redeploy**.

O que liga:

- **Triagem das licitações** — hoje o filtro é por palavra, e palavra erra: uma
  compra de *ureia acondicionada em embalagens de 50 kg* casa com "embalagem"
  mas é adubo; *bolos de pote de uma empresa de confeitaria* casa com
  "confeitaria" mas é bolo pronto. A IA lê cada licitação nova e responde se a
  Embastel vende aquilo, com o motivo aparecendo no card.
- **Resumir com IA** no funil de licitações.
- **Resposta automática do WhatsApp**.

Custo: usa o Claude Haiku 4.5 e só analisa o que é novo (uma dúzia por dia) —
centavos por mês.

---

## Opcional: WhatsApp

Precisa de um app Business na Meta. O passo a passo está no `README.md`, seção
"WhatsApp". As variáveis (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_VERIFY_TOKEN`) vão nas Environment Variables do Vercel do mesmo jeito,
e a URL do webhook passa a ser `https://seudominio.com/api/whatsapp/webhook`.

---

## Continuar rodando no seu computador

Continua funcionando igual, e sem depender de nada disso:

```bash
npm run dev
```

Sem `DATABASE_URL`, ele usa os arquivos em `data/`. Sem `PAINEL_SENHA`, abre sem
pedir login. É o mesmo código — só muda o que está configurado.

> Cuidado: se você rodar local **com** a `DATABASE_URL` de produção no
> `.env.local`, estará mexendo nos dados de verdade. Para testar sem risco,
> deixe essa linha comentada.

---

## Se algo der errado

| Sintoma | Causa provável |
| --- | --- |
| `/painel` pede senha e nunca entra | `PAINEL_SENHA` não foi cadastrada, ou tem espaço sobrando no fim |
| Painel abre vazio, sem os clientes | faltou rodar `scripts/migrar-para-banco.mjs`, ou a `DATABASE_URL` do Vercel é de outro banco |
| Licitações não atualizam | veja **Vercel → Deployments → Functions → Cron Logs**; se der 401, a `CRON_SECRET` está diferente |
| Erro de conexão com o banco | no Neon, confira se o projeto não foi suspenso por inatividade (o plano grátis hiberna, mas religa sozinho na primeira consulta) |

Os registros de cada execução ficam em **Vercel → Deployments → Runtime Logs**.
