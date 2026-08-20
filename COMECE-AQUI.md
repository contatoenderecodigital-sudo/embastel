# Começa por aqui, Kemilly

Guia pra colocar o painel pra rodar no seu computador e trabalhar nele junto
com o Eliezer. Leva uns 20 minutos na primeira vez.

Se travar em algum passo, copia a mensagem de erro inteira e manda — quase todo
problema aqui é uma coisa que faltou instalar.

---

## 1. Instalar os três programas

Instale nesta ordem. Todos são gratuitos e é só ir clicando em "próximo".

**Node.js** — https://nodejs.org — baixe a versão **LTS**.
É o que faz o painel rodar.

**Git** — https://git-scm.com/download/win
É o que sincroniza o código entre você e o Eliezer. Na instalação pode aceitar
tudo que vier marcado.

**VS Code** — https://code.visualstudio.com
O editor.

Depois de instalar os três, **feche e abra tudo de novo** (os programas só
enxergam o Node e o Git depois de reiniciar).

### Conferir se deu certo

Abra o VS Code, e no menu vá em **Terminal → Novo Terminal**. Digite:

```bash
node -v
git --version
```

Tem que aparecer um número em cada linha, tipo `v24.14.1`. Se aparecer
"comando não encontrado", reinicie o computador e tente de novo.

---

## 2. Baixar o projeto

No mesmo terminal, escolha onde quer guardar (a Área de Trabalho serve):

```bash
cd ~/Desktop
git clone https://github.com/contatoenderecodigital-sudo/embastel.git
cd embastel
```

Ele vai pedir login do GitHub — **é a mesma conta que o Eliezer usa**, ele te
passa. Depois de logar uma vez, o Windows guarda e não pergunta mais.

Agora abra a pasta no VS Code: **Arquivo → Abrir Pasta →** escolha `embastel`.

---

## 3. Ligar o painel

No terminal do VS Code, dentro da pasta do projeto:

```bash
npm install
```

Isso baixa as bibliotecas. Demora uns minutos na primeira vez e enche a tela de
texto — é normal. Só precisa fazer de novo quando o Eliezer avisar que mudou
alguma biblioteca.

```bash
npm run dev
```

Vai aparecer um endereço tipo `http://localhost:3000`. Abre no navegador e o
painel está lá.

**Pra parar:** `Ctrl + C` no terminal.

### O painel vai abrir vazio — e está certo

Nada de licitação, nada de fornecedor, nada de cliente. Os dados de verdade só
existem no servidor; o seu é uma cópia limpa pra mexer no código sem risco de
estragar o que está valendo.

Se quiser testar com dados, você cadastra à mão no seu — o que você digitar aí
**não aparece pra ninguém**.

---

## 4. O dia a dia com o Eliezer

Vocês usam a mesma conta do GitHub, então o código é literalmente o mesmo lugar.
Isso é prático e é perigoso: dá pra um apagar o trabalho do outro sem perceber.
Duas regras evitam 100% dos problemas.

### Regra 1 — SEMPRE puxar antes de começar

```bash
git pull
```

Primeira coisa do dia, toda vez. Traz o que o Eliezer fez.

### Regra 2 — Mandar o seu assim que terminar

```bash
git add .
git commit -m "escreva aqui o que você mudou"
git push
```

Não deixe trabalho parado no seu computador por dias. Quanto mais tempo sem
mandar, maior a chance de os dois terem mexido no mesmo arquivo.

### Se der conflito

Se o `git pull` reclamar de conflito, **não tente resolver sozinha na pressa** —
pede pro Claude: *"deu conflito no git, me ajuda a resolver"*. Ele lê e resolve.

---

## 5. Trabalhando com o Claude aqui dentro

Abre o Claude no VS Code e fala normal, em português, do que você precisa.
Exemplos que funcionam bem:

> na tela de fornecedores, tira o campo de e-mail que ninguém usa

> os lotes que não fecham deviam aparecer separados dos que fecham

> essa tela tá com informação demais, deixa só o essencial

Ele já conhece o projeto: tem um arquivo `AGENTS.md` na raiz que explica como
tudo funciona e por quê. Você não precisa explicar o contexto toda vez.

### O `DIARIO.md` é o recado entre os dois lados

Tem um arquivo `DIARIO.md` na raiz onde cada Claude escreve o que fez, o que
ficou pela metade e o que está esperando resposta. O do Eliezer escreve lá, o
seu lê antes de começar — e vice-versa.

Na prática: depois do `git pull`, vale abrir o `DIARIO.md` e ler as entradas de
cima. E quando terminar algo, peça: *"escreve no diário o que a gente fez"*.

**Você é quem usa essas telas todo dia.** Se algo está confuso ou dá trabalho
demais, isso é um problema de verdade e vale falar — várias coisas já mudaram
por causa disso.

---

## 6. Publicar (colocar no ar)

**Combine com o Eliezer antes.** Publicar substitui o painel que a loja usa.

O comando roda **no servidor**, não no seu computador:

```bash
bash scripts/deploy-vps.sh
```

Ele pega o que está no GitHub e coloca no ar. Então **o que não foi `git push`
não vai pro ar** — publicar sem ter mandado o seu código não adianta nada.

E o mais importante: se vocês dois publicarem ao mesmo tempo, um sobrescreve o
outro. Avise antes.

---

## 7. O que NÃO fazer

**Não mexa em nginx nem em SSL no servidor.** Foram configurados à mão e
mexer derruba o site e a renovação automática do certificado.

**Não apague a pasta `data/` do servidor.** É onde moram os dados de verdade —
conversas, licitações, fornecedores, tudo. Na sua máquina ela pode apagar à
vontade.

**Não coloque senha nem chave dentro do código.** Isso vai pro GitHub e fica
gravado pra sempre. Segredo vai no arquivo `.env.local`, que fica de fora do
Git de propósito.

---

## Cola rápida

| O que quero | O que digito |
|---|---|
| Ligar o painel | `npm run dev` |
| Parar | `Ctrl + C` |
| Pegar o que o Eliezer fez | `git pull` (e leia o `DIARIO.md`) |
| Mandar o que eu fiz | `git add .` → `git commit -m "..."` → `git push` |
| Ver em que pé estou | `git status` |
| Depois que mudou biblioteca | `npm install` |

**Antes de mandar código, confira que os três passam:**

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

Se algum reclamar, cola o erro pro Claude que ele arruma.
