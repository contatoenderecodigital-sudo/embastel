import { randomUUID } from "node:crypto";
import { casarCategorias } from "./casarCategorias";
import { jsonStore } from "./jsonStore";
import { normalizarTexto } from "./textoUtils";

// A agenda de fornecedor DE LICITAÇÃO — separada da agenda da loja de
// propósito.
//
// Não é a mesma lista com campos a mais. É outra pergunta. Na loja é "quem me
// vende isso pra repor a prateleira". Aqui é "em cima de quem eu posso travar
// um preço com a prefeitura por meses".
//
// QUEM FATURA PRA QUEM: o fornecedor vende pra Embastel como sempre vendeu, e
// é a Embastel que fatura e entrega pro município. O fornecedor nem sabe que
// tem licitação no meio. (Este arquivo já teve um campo "fatura pra órgão
// público?" — não fazia sentido nenhum e saiu em 19/08/2026.)
//
// O que muda em relação à venda de balcão é o COMPROMISSO. Numa ata de
// registro de preços a Embastel trava o preço por até 12 meses e é obrigada a
// entregar no prazo do edital; quem não entrega paga multa e pode ser suspensa
// de licitar. Então o que interessa saber de cada fornecedor é:
//
//  - Por quantos dias ele segura o preço da cotação. É o campo mais importante
//    da tela: se ele reajusta no terceiro mês de uma ata de doze, o prejuízo
//    inteiro é da Embastel, porque com a prefeitura o preço já está travado.
//  - Em quantos dias entrega. O edital manda o prazo; se ele leva 25 e o
//    edital dá 10, o preço dele não serve por melhor que seja.
//  - Como cobra. A prefeitura paga em 30 dias ou mais, depois do empenho e do
//    aceite. Se o fornecedor só vende à vista, quem banca o intervalo é a
//    Embastel.
//  - Se manda ficha técnica e amostra. Edital costuma exigir, e sem isso a
//    proposta é desclassificada mesmo com o melhor preço.
//  - Se responde cotação. Edital fecha em 3 dias; quem some é pior que quem é
//    caro — daí o histórico de pedidas × respondidas.
//
// Nome do arquivo pedido pelo usuário em 19/08/2026: fornecedor_licitacao.

/**
 * Se dá pra contar com ele numa licitação. É julgamento do usuário, não conta
 * derivada: alguém que nunca segura preço, ou que já deu cano na entrega,
 * entra como "não" e some do "Quem cota".
 */
export type UsarEmLicitacao = "sim" | "nao" | "nao_sei";

/** Resposta de três estados usada nos campos de sim/não/ainda não perguntei. */
export type TresEstados = "sim" | "nao" | "nao_sei";

// O cadastro é curto de propósito. A primeira versão pedia razão social,
// CNPJ, e-mail e departamento; quem ia usar olhou e disse "tem muita
// informação, eu só queria o nome, o número e qual é a empresa" — e tem razão,
// porque cotação sai por WhatsApp, ninguém liga pro CNPJ do fornecedor pra
// pedir preço, e formulário comprido acaba não sendo preenchido. Os quatro
// campos saíram em 19/08/2026.
export type FornecedorLicitacao = {
  id: string;
  /** A empresa. É ela que cota, e é por ela que as categorias são guardadas. */
  nome: string;
  /** Só dígitos, no formato que o WhatsApp aceita (55 + DDD + número). */
  telefone: string;
  /** O vendedor com quem se fala nessa empresa. */
  contato: string;
  /** O que a empresa fornece. É por aqui que se acha quem cota um edital. */
  categorias: string[];

  usarEmLicitacao: UsarEmLicitacao;
  /**
   * Por quantos dias ele segura o preço que cotou.
   *
   * O campo que mais decide. A ata de registro de preços dura até 12 meses com
   * o preço travado do lado da prefeitura; se o fornecedor só garante 30 dias,
   * todo reajuste depois disso sai do bolso da Embastel.
   */
  seguraPrecoDias: number | null;
  /** Dias que ele leva pra entregar. Comparado com o prazo do edital. */
  prazoEntregaDias: number | null;
  /** Ex.: "20 caixas", "R$ 1.500". Texto livre — cada um cobra do seu jeito. */
  pedidoMinimo: string;
  /** Ex.: "30 dias", "à vista", "boleto 28ddl". */
  condicaoPagamento: string;
  /** Manda ficha técnica, laudo e amostra quando o edital exige. */
  mandaFichaTecnica: TresEstados;
  /** Ex.: "500 caixas por semana". Quanto ele aguenta de um pedido grande. */
  capacidade: string;
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
    telefone: "",
    contato: "",
    categorias: [],
    usarEmLicitacao: "nao_sei",
    seguraPrecoDias: null,
    prazoEntregaDias: null,
    pedidoMinimo: "",
    condicaoPagamento: "",
    mandaFichaTecnica: "nao_sei",
    capacidade: "",
    ufsQueAtende: [],
    cotacoesPedidas: 0,
    cotacoesRespondidas: 0,
    ultimaCotacaoEm: null,
    observacao: "",
    criadoEm: t,
    atualizadoEm: t,
  };
}

// Começa vazia: quem entra aqui é fornecedor conferido, um por um.
const store = jsonStore<Dados>("fornecedor_licitacao.json", { fornecedores: [] });

export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Completa campos que não existiam quando o registro foi criado. */
function completar(f: FornecedorLicitacao): FornecedorLicitacao {
  return {
    ...f,
    telefone: f.telefone ?? "",
    contato: f.contato ?? "",
    categorias: f.categorias ?? [],
    usarEmLicitacao: f.usarEmLicitacao ?? "nao_sei",
    seguraPrecoDias: f.seguraPrecoDias ?? null,
    prazoEntregaDias: f.prazoEntregaDias ?? null,
    pedidoMinimo: f.pedidoMinimo ?? "",
    condicaoPagamento: f.condicaoPagamento ?? "",
    mandaFichaTecnica: f.mandaFichaTecnica ?? "nao_sei",
    capacidade: f.capacidade ?? "",
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
 * edital; e quem está marcado como "não usar" sai de saída. O resto (prazo,
 * pagamento, ficha técnica) refina a escolha, mas não impede o telefonema.
 */
export function prontoParaCotar(f: FornecedorLicitacao): boolean {
  return (
    Boolean(f.telefone) && f.categorias.length > 0 && f.usarEmLicitacao !== "nao"
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
 * Quem está marcado como "não usar" fica de fora inteiro: mostrar ele na lista
 * só faz alguém gastar um telefonema à toa. Quem já é de confiança sobe na
 * frente do "ainda não sei", mesmo cobrindo menos categorias — é por ele que
 * se começa a ligar.
 */
export async function cotadoresParaTexto(texto: string): Promise<Cotador[]> {
  const alvo = normalizarTexto(texto);
  if (!alvo) return [];

  const encontrados: Cotador[] = [];
  for (const f of await listFornecedoresLicitacao()) {
    if (f.usarEmLicitacao === "nao") continue;
    const { batem, forca } = casarCategorias(f.categorias, alvo);
    if (batem.length) encontrados.push({ fornecedor: f, categoriasQueBatem: batem, forca });
  }

  return encontrados.sort((a, b) => {
    const confirmado = (c: Cotador) => (c.fornecedor.usarEmLicitacao === "sim" ? 1 : 0);
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
  if (entrada.telefone !== undefined) f.telefone = apenasDigitos(entrada.telefone);
  if (entrada.contato !== undefined) f.contato = entrada.contato.trim();
  if (entrada.categorias !== undefined) {
    f.categorias = entrada.categorias.map((c) => c.trim()).filter(Boolean);
  }
  // Valor de fora da lista vira "não sei" em vez de entrar cru: é este campo
  // que decide se ele aparece na busca por edital.
  const tresEstados = (v: string): TresEstados =>
    (["sim", "nao", "nao_sei"] as string[]).includes(v) ? (v as TresEstados) : "nao_sei";
  // Só aceita dia positivo; qualquer outra coisa vira "não sei", que é
  // diferente de zero — zero diria "não segura o preço nem um dia".
  const dias = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  if (entrada.usarEmLicitacao !== undefined) {
    f.usarEmLicitacao = tresEstados(entrada.usarEmLicitacao);
  }
  if (entrada.mandaFichaTecnica !== undefined) {
    f.mandaFichaTecnica = tresEstados(entrada.mandaFichaTecnica);
  }
  if (entrada.seguraPrecoDias !== undefined) {
    f.seguraPrecoDias = dias(entrada.seguraPrecoDias);
  }
  if (entrada.prazoEntregaDias !== undefined) {
    f.prazoEntregaDias = dias(entrada.prazoEntregaDias);
  }
  if (entrada.pedidoMinimo !== undefined) f.pedidoMinimo = entrada.pedidoMinimo.trim();
  if (entrada.condicaoPagamento !== undefined) {
    f.condicaoPagamento = entrada.condicaoPagamento.trim();
  }
  if (entrada.capacidade !== undefined) f.capacidade = entrada.capacidade.trim();
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

// Não existe importação da agenda da loja, e é de propósito: são fornecedores
// diferentes. Quem abastece a prateleira é indústria e distribuidor de linha
// de balcão; quem entra numa proposta pra prefeitura é outro grupo, com outro
// preço e outro compromisso. Existiu um botão "trazer da lista da loja" por
// algumas horas em 19/08/2026 — foi removido no mesmo dia, a pedido do
// usuário, porque misturava duas listas que não se cruzam.
