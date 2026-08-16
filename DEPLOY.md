# Colocar no ar

O painel roda numa VPS própria (Ubuntu + aaPanel), num processo Node gerenciado
pelo pm2, atrás do nginx. Um deploy só serve as duas coisas:

- `embastelembalagens.com.br` — o site público da loja
- `embastelembalagens.com.br/painel` — o painel interno, atrás de login

## Atualizar (o dia a dia)

Do seu computador, depois de dar `git push`:

```bash
ssh root@45.61.157.208
cd /www/wwwroot/painel-embastel
bash scripts/deploy-vps.sh
```

O script busca o código, instala dependências se mudaram, **compila numa pasta
separada** e só troca no fim. Isso importa: o jeito ingênuo
(`git pull && npm run build && pm2 restart`) reescreve a pasta que o processo
no ar está servindo, e durante os ~15 segundos do build quem abrisse o painel
via a tela sem formatação nenhuma. Aconteceu de verdade em 13/08/2026.

Se o build falhar no meio, nada é trocado e o painel continua no ar com a
versão anterior. No fim ele confere se a página e o CSS respondem 200 e,
se não responderem, volta sozinho pra versão antiga.

## Onde as coisas ficam

| O quê | Onde |
|---|---|
| Código | `/www/wwwroot/painel-embastel` |
| Dados (JSON e arquivos enviados) | `/www/wwwroot/painel-embastel/data` |
| Configuração | `/www/wwwroot/painel-embastel/.env` |
| Processo | pm2, nome `embastel-painel`, porta 3001 |
| nginx | `.../vhost/nginx/extension/embastelembalagens.com.br/painel.conf` |

Os dados ficam em **arquivos**, não em banco. A pasta `data/` tem trava por
arquivo, escrita atômica e backup automático — ver `src/lib/jsonStore.ts`.
Ela **não** está no git, e é a única coisa que precisa de backup.

## Variáveis de ambiente

Ficam em `/www/wwwroot/painel-embastel/.env`:

| Nome | Para quê | Obrigatória |
|---|---|---|
| `PAINEL_SENHA` | senha única de acesso ao painel | sim |
| `SESSION_SECRET` | assina o cookie de sessão (texto longo e aleatório) | sim |
| `PORT` | porta do processo (3001) | sim |
| `ANTHROPIC_API_KEY` | liga a triagem por IA das licitações, o resumo de edital e a resposta automática no WhatsApp | não |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | integração com o WhatsApp Business | não |

Sem `ANTHROPIC_API_KEY` o painel funciona igual — as partes de IA
simplesmente não aparecem, em vez de dar erro.

Depois de mexer no `.env`: `pm2 restart embastel-painel`.

## Trabalhos em segundo plano

Sobem junto com o processo (`src/instrumentation.ts`) e não dependem de cron
externo:

| O quê | Ritmo |
|---|---|
| Coleta de licitações no PNCP | a cada 6h (ajustável na tela de Licitações) |
| Verificador de prazos e avisos | a cada 5 min |
| Leitura dos lotes das licitações | a cada 5 min |
| Histórico de preço arrematado | a cada 10 min, até completar 12 meses |

## Rodar na sua máquina

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. Crie um `.env.local` com `PAINEL_SENHA` e
`SESSION_SECRET` para testar o login; sem eles o painel abre sem pedir senha.

> Os dados de desenvolvimento ficam na pasta `data/` do seu computador, separada
> da do servidor.

## Quando algo dá errado

| Sintoma | Onde olhar |
|---|---|
| Painel fora do ar | `pm2 logs embastel-painel` |
| Painel abre sem formatação | build trocado pela metade — rode o deploy de novo |
| Licitações não atualizam | tela de Licitações → o painel de coleta mostra a etapa e o erro |
| Página velha teimando | o nginx tem `proxy_cache off` nos blocos do painel; confira se o `painel.conf` não foi reescrito |

Registro de tudo: `pm2 logs embastel-painel --lines 200`.
