import { randomUUID } from "node:crypto";
import { casarCategorias } from "./casarCategorias";
import { jsonStore } from "./jsonStore";
import { listFornecedores } from "./fornecedoresDb";
import { normalizarTexto } from "./textoUtils";

// A agenda de fornecedor DE LICITAÇÃO — separada da agenda da loja de
// propósito.
//
// Não é a mesma lista com campos a mais. É outra pergunta. Na loja a pergunta
// é "quem me vende isso pra repor a prateleira". Na licitação é "com quem eu
// posso me comprometer com uma prefeitura", e a resposta depende de coisas que
// pro balcão não fazem a menor diferença:
//
//  - Ele fatura pra órgão público? Muito fornecedor simplesmente não faz, e
//    descobrir isso DEPOIS de ganhar o pregão é o pior momento possível: a
//    proposta já foi, o preço já está travado, e não entregar dá multa e
//    suspensão de licitar.
//  - Em quantos dias ele entrega? O edital manda o prazo. Se ele leva 25 dias
//    e o edital dá 10, o preço dele não serve, por melhor que seja.
//  - Qual a condição de pagamento? A prefeitura paga em 30 dias ou mais. Se o
//    fornecedor só vende à vista, quem financia a operação é a Embastel.
//  - Ele responde cotação? Edital fecha em 3 dias. Fornecedor que some é pior
//    que fornecedor caro — por isso o histórico de pedidas × respondidas.
//
// Nome do arquivo pedido pelo usuário em 19/08/2026: fornecedor_licitacao.

/** Se dá pra usar ele numa proposta. É o campo que mais elimina candidato. */
export type AtendeLicitacao = "sim" | "nao" | "nao_sei";

export type FornecedorLicitacao = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  /** Só dígitos, no formato que o WhatsApp aceita (55 + DDD + número). */
  telefone: string;
  email: string;
  /** Nome de quem atende a Embastel. */
  contato: string;
  /** Setor com quem se fala — televendas, representante, financeiro. */
  departamento: string;
  /** O que ele fornece. É por aqui que se acha quem cota um edital. */
  categorias: string[];

  atendeLicitacao: AtendeLicitacao;
  /** Dias que ele leva pra entregar. Comparado com o prazo do edital. */
  prazoEntregaDias: number | null;
  /** Ex.: "20 caixas", "R$ 1.500". Texto livre — cada um cobra do seu jeito. */
  pedidoMinimo: string;
  /** Ex.: "30 dias", "à vista", "boleto 28ddl". */
  condicaoPagamento: string;
  /** Siglas de UF pra onde ele entrega. Vazio = não perguntamos ainda. */
  ufsQueAtende: string[];

  // Histórico de resposta. Dois contadores, incrementados na mão por um botão
  // na tela — nada automático, porque a cotação sai por WhatsApp e telefone e
  // o painel não tem como saber sozinho.
  cotacoesPedidas: number;
  cotacoesRespondidas: number;
  ultimaCotacaoEm: string | null;

  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
};

type Dados = { fornecedores: FornecedorLicitacao[] };

/**
 * Categorias sugeridas — as mesmas famílias que o filtro de licitação procura,
 * pra categoria escrita aqui casar com o que os editais pedem.
 */
export const CATEGORIAS_SUGERIDAS = [
  "Saco de lixo",
  "Saco plástico",
  "Sacola",
  "Copo descartável",
  "Prato e talher descartável",
  "Marmitex e embalagem de comida",
  "Bandeja",
  "Papel toalha e higiênico",
  "Guardanapo",
  "Filme e alumínio",
  "Descartável de festa",
  "Forma de papel e confeitaria",
  "Copa e cozinha",
  "Utensílio",
  "Material de limpeza",
  "Higiene e EPI",
  "Papelaria e etiqueta",
];

/** UFs que a Embastel alcança na prática — o raio de busca de editais. */
export const UFS_SUGERIDAS = ["SC", "RS", "PR", "SP", "MS", "Brasil todo"];

function agora(): string {
  return new Date().toISOString();
}

function novoRegistro(nome: string): FornecedorLicitacao {
  const t = agora();
  return {
    id: randomUUID(),
    nome,
    razaoSocial: "",
    cnpj: "",
    telefone: "",
    email: "",
    contato: "",
    departamento: "",
    categorias: [],
    atendeLicitacao: "nao_sei",
    prazoEntregaDias: null,
    pedidoMinimo: "",
    condicaoPagamento: "",
    ufsQueAtende: [],
    cotacoesPedidas: 0,
    cotacoesRespondidas: 0,
    ultimaCotacaoEm: null,
    observacao: "",
    criadoEm: t,
    atualizadoEm: t,
  };
}

// Começa vazia: quem entra aqui é fornecedor conferido, um por um. Encher com
// os 35 nomes da loja daria uma lista que parece pronta e não é — e o erro
// caro desta tela é confiar num fornecedor que não fatura pra prefeitura.
const store = jsonStore<Dados>("fornecedor_licitacao.json", { fornecedores: [] });

export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Completa campos que não existiam quando o registro foi criado. */
function completar(f: FornecedorLicitacao): FornecedorLicitacao {
  return {
    ...f,
    razaoSocial: f.razaoSocial ?? "",
    cnpj: f.cnpj ?? "",
    telefone: f.telefone ?? "",
    email: f.email ?? "",
    contato: f.contato ?? "",
    departamento: f.departamento ?? "",
    categorias: f.categorias ?? [],
    atendeLicitacao: f.atendeLicitacao ?? "nao_sei",
    prazoEntregaDias: f.prazoEntregaDias ?? null,
    pedidoMinimo: f.pedidoMinimo ?? "",
    condicaoPagamento: f.condicaoPagamento ?? "",
    ufsQueAtende: f.ufsQueAtende ?? [],
    cotacoesPedidas: f.cotacoesPedidas ?? 0,
    cotacoesRespondidas: f.cotacoesRespondidas ?? 0,
    ultimaCotacaoEm: f.ultimaCotacaoEm ?? null,
    observacao: f.observacao ?? "",
    atualizadoEm: f.atualizadoEm ?? f.criadoEm,
  };
}

/**
 * Dá pra pedir cotação pra ele agora?
 *
 * Sem telefone não dá pra ligar; sem categoria ele nunca aparece na busca por
 * edital; e "não atende licitação" elimina de saída. O resto (prazo, condição
 * de pagamento) refina a escolha, mas não impede o telefonema.
 */
export function prontoParaCotar(f: FornecedorLicitacao): boolean {
  return (
    Boolean(f.telefone) && f.categorias.length > 0 && f.atendeLicitacao !== "nao"
  );
}

export async function listFornecedoresLicitacao(): Promise<FornecedorLicitacao[]> {
  const data = await store.read();
  return data.fornecedores
    .map(completar)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function listCategorias(): Promise<string[]> {
  const data = await store.read();
  const todas = new Set<string>();
  for (const f of data.fornecedores) for (const c of f.categorias ?? []) todas.add(c);
  return [...todas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type Cotador = {
  fornecedor: FornecedorLicitacao;
  categoriasQueBatem: string[];
  forca: number;
};

/**
 * Quem cota este edital, do melhor pro pior.
 *
 * Quem já respondeu "não atende licitação" fica de fora inteiro: mostrar ele
 * na lista só faz alguém gastar um telefonema pra ouvir o mesmo não de novo.
 * O que já sabemos que fatura pra órgão público sobe na frente do "não sei",
 * mesmo cobrindo menos categorias — é por ele que se começa a ligar.
 */
export async function cotadoresParaTexto(texto: string): Promise<Cotador[]> {
  const alvo = normalizarTexto(texto);
  if (!alvo) return [];

  const encontrados: Cotador[] = [];
  for (const f of await listFornecedoresLicitacao()) {
    if (f.atendeLicitacao === "nao") continue;
    const { batem, forca } = casarCategorias(f.categorias, alvo);
    if (batem.length) encontrados.push({ fornecedor: f, categoriasQueBatem: batem, forca });
  }

  return encontrados.sort((a, b) => {
    const confirmado = (c: Cotador) => (c.fornecedor.atendeLicitacao === "sim" ? 1 : 0);
    if (confirmado(a) !== confirmado(b)) return confirmado(b) - confirmado(a);
    if (a.forca !== b.forca) return b.forca - a.forca;
    // Empate: quem costuma responder cotação vem antes de quem some.
    return taxaResposta(b.fornecedor) - taxaResposta(a.fornecedor);
  });
}

/** Fração de cotações respondidas. Quem nunca foi cotado fica no meio (0,5). */
export function taxaResposta(f: FornecedorLicitacao): number {
  if (!f.cotacoesPedidas) return 0.5;
  return f.cotacoesRespondidas / f.cotacoesPedidas;
}

type Entrada = Partial<Omit<FornecedorLicitacao, "id" | "criadoEm" | "atualizadoEm">>;

function aplicar(f: FornecedorLicitacao, entrada: Entrada): void {
  if (entrada.nome !== undefined) f.nome = entrada.nome.trim() || f.nome;
  if (entrada.razaoSocial !== undefined) f.razaoSocial = entrada.razaoSocial.trim();
  if (entrada.cnpj !== undefined) f.cnpj = apenasDigitos(entrada.cnpj);
  if (entrada.telefone !== undefined) f.telefone = apenasDigitos(entrada.telefone);
  if (entrada.email !== undefined) f.email = entrada.email.trim();
  if (entrada.contato !== undefined) f.contato = entrada.contato.trim();
  if (entrada.departamento !== undefined) f.departamento = entrada.departamento.trim();
  if (entrada.categorias !== undefined) {
    f.categorias = entrada.categorias.map((c) => c.trim()).filter(Boolean);
  }
  if (entrada.atendeLicitacao !== undefined) {
    // Valor de fora da lista vira "não sei" em vez de entrar cru: o campo
    // decide se ele aparece na busca por edital.
    f.atendeLicitacao = (["sim", "nao", "nao_sei"] as string[]).includes(
      entrada.atendeLicitacao
    )
      ? entrada.atendeLicitacao
      : "nao_sei";
  }
  if (entrada.prazoEntregaDias !== undefined) {
    const n = Number(entrada.prazoEntregaDias);
    f.prazoEntregaDias = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (entrada.pedidoMinimo !== undefined) f.pedidoMinimo = entrada.pedidoMinimo.trim();
  if (entrada.condicaoPagamento !== undefined) {
    f.condicaoPagamento = entrada.condicaoPagamento.trim();
  }
  if (entrada.ufsQueAtende !== undefined) {
    f.ufsQueAtende = entrada.ufsQueAtende.map((u) => u.trim()).filter(Boolean);
  }
  if (entrada.observacao !== undefined) f.observacao = entrada.observacao.trim();
  f.atualizadoEm = agora();
}

export async function addFornecedorLicitacao(
  entrada: Entrada
): Promise<FornecedorLicitacao> {
  return store.update((data) => {
    const f = novoRegistro(entrada.nome?.trim() || "Sem nome");
    aplicar(f, { ...entrada, nome: undefined });
    data.fornecedores.push(f);
    return f;
  });
}

export async function updateFornecedorLicitacao(
  id: string,
  entrada: Entrada
): Promise<FornecedorLicitacao | null> {
  return store.update((data) => {
    const bruto = data.fornecedores.find((x) => x.id === id);
    if (!bruto) return null;
    Object.assign(bruto, completar(bruto));
    aplicar(bruto, entrada);
    return bruto;
  });
}

/**
 * Marca que uma cotação foi pedida, ou que ele respondeu.
 *
 * "Respondeu" também conta como pedida quando o contador está zerado: acontece
 * de a pessoa lembrar de marcar só depois que a resposta chegou, e sem isso a
 * taxa passaria de 100%.
 */
export async function registrarCotacao(
  id: string,
  evento: "pedida" | "respondida"
): Promise<FornecedorLicitacao | null> {
  return store.update((data) => {
    const bruto = data.fornecedores.find((x) => x.id === id);
    if (!bruto) return null;
    Object.assign(bruto, completar(bruto));
    if (evento === "pedida") {
      bruto.cotacoesPedidas += 1;
      bruto.ultimaCotacaoEm = agora();
    } else {
      bruto.cotacoesRespondidas += 1;
      if (bruto.cotacoesRespondidas > bruto.cotacoesPedidas) {
        bruto.cotacoesPedidas = bruto.cotacoesRespondidas;
      }
    }
    bruto.atualizadoEm = agora();
    return bruto;
  });
}

export async function deleteFornecedorLicitacao(id: string): Promise<void> {
  await store.update((data) => {
    data.fornecedores = data.fornecedores.filter((f) => f.id !== id);
  });
}

/**
 * Traz da agenda da loja quem ainda não está aqui, pra não redigitar 35 nomes.
 *
 * Só copia o cadastro (nome, telefone, categorias). Tudo que é de licitação —
 * se fatura pra órgão público, prazo, condição de pagamento — entra como "não
 * sei", porque ninguém perguntou isso pra eles ainda. Copiar como "sim" seria
 * inventar o dado justamente no campo em que errar custa multa.
 *
 * Compara por CNPJ quando existe, e por nome quando não — a lista da loja está
 * quase toda sem CNPJ.
 */
export async function importarDaLoja(): Promise<{ importados: number }> {
  const daLoja = await listFornecedores();
  return store.update((data) => {
    const jaTem = new Set<string>();
    for (const f of data.fornecedores) {
      if (f.cnpj) jaTem.add(`cnpj:${f.cnpj}`);
      jaTem.add(`nome:${normalizarTexto(f.nome)}`);
    }

    let importados = 0;
    for (const origem of daLoja) {
      const chaveCnpj = origem.cnpj ? `cnpj:${origem.cnpj}` : null;
      const chaveNome = `nome:${normalizarTexto(origem.nome)}`;
      if ((chaveCnpj && jaTem.has(chaveCnpj)) || jaTem.has(chaveNome)) continue;

      const novo = novoRegistro(origem.nome);
      novo.razaoSocial = origem.razaoSocial;
      novo.cnpj = origem.cnpj;
      novo.telefone = origem.telefone;
      novo.email = origem.email;
      novo.contato = origem.contato;
      novo.departamento = origem.departamento;
      novo.categorias = [...origem.categorias];
      data.fornecedores.push(novo);

      if (chaveCnpj) jaTem.add(chaveCnpj);
      jaTem.add(chaveNome);
      importados++;
    }
    return { importados };
  });
}
