// Catálogo dos documentos de habilitação em licitação.
//
// POR QUE UM CATÁLOGO, e não upload livre: na Licitar Digital a biblioteca é
// só "arquivo + data de vencimento", sem tipo. Sem tipo não dá pra dizer o
// que falta, não dá pra montar checklist, e a conferência de habilitação —
// que é onde se perde licitação já ganhada no preço — volta a ser você
// abrindo o edital em PDF e conferindo pasta por pasta.
//
// Os grupos seguem a Lei 14.133/2021, arts. 62 a 67: habilitação jurídica,
// regularidade fiscal/social/trabalhista, qualificação econômico-financeira e
// qualificação técnica.

export type CategoriaDocumento =
  | "juridica"
  | "fiscal"
  | "economica"
  | "tecnica"
  | "interno";

export const CATEGORIAS: Array<{
  id: CategoriaDocumento;
  nome: string;
  descricao: string;
}> = [
  {
    id: "juridica",
    nome: "Habilitação jurídica",
    descricao: "Quem é a empresa e quem pode assinar por ela.",
  },
  {
    id: "fiscal",
    nome: "Regularidade fiscal e trabalhista",
    descricao: "As certidões negativas. É o grupo que mais vence e mais derruba.",
  },
  {
    id: "economica",
    nome: "Qualificação econômico-financeira",
    descricao: "Prova de que a empresa aguenta o contrato.",
  },
  {
    id: "tecnica",
    nome: "Qualificação técnica",
    descricao: "Prova de que a empresa já fez o que está se propondo a fazer.",
  },
  {
    id: "interno",
    nome: "Controle interno",
    descricao: "Não vai no envelope, mas se vencer trava tudo do mesmo jeito.",
  },
];

export type TipoDocumento = {
  id: string;
  nome: string;
  categoria: CategoriaDocumento;
  /**
   * Quantos dias o documento costuma valer a partir da emissão. Serve só pra
   * sugerir a data de vencimento quando você digita a de emissão — o número
   * que vale é o que está impresso na certidão, e é ele que deve ser salvo.
   * null = não tem prazo padrão (ou não vence).
   */
  validadeDias: number | null;
  /** Exigido em praticamente todo edital — entra no checklist do que falta. */
  essencial: boolean;
  ondeEmitir: string | null;
  observacao: string | null;
};

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  // ---------------------------------------------------------------- jurídica
  {
    id: "contrato_social",
    nome: "Contrato social consolidado / Requerimento de empresário / CCMEI",
    categoria: "juridica",
    validadeDias: null,
    essencial: true,
    ondeEmitir: "https://www.gov.br/empresas-e-negocios/pt-br/redesim",
    observacao:
      "Tem que ser a versão CONSOLIDADA, com todas as alterações. Foi exatamente esse documento que travou o cadastro da Embastel na Licitar Digital.",
  },
  {
    id: "cartao_cnpj",
    nome: "Cartão CNPJ",
    categoria: "juridica",
    validadeDias: 90,
    essencial: true,
    ondeEmitir:
      "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
    observacao: "Não tem validade legal, mas quase todo edital pede emitido nos últimos 90 dias.",
  },
  {
    id: "identidade_socio",
    nome: "Documento de identificação do responsável legal (RG/CNH)",
    categoria: "juridica",
    validadeDias: null,
    essencial: true,
    ondeEmitir: null,
    observacao: "Precisa conter RG, CPF e foto.",
  },
  {
    id: "procuracao",
    nome: "Procuração e documento do procurador",
    categoria: "juridica",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao: "Só se quem participa do pregão não for o sócio administrador.",
  },
  {
    id: "certidao_simplificada",
    nome: "Certidão simplificada da Junta Comercial (JUCESC)",
    categoria: "juridica",
    validadeDias: 90,
    essencial: false,
    ondeEmitir: "https://www.jucesc.sc.gov.br/",
    observacao: "Muito pedida junto com o balanço, pra comprovar enquadramento (ME/EPP).",
  },

  // ------------------------------------------------------------------ fiscal
  {
    id: "cnd_federal",
    nome: "Certidão conjunta federal (Receita Federal + PGFN)",
    categoria: "fiscal",
    validadeDias: 180,
    essencial: true,
    ondeEmitir:
      "https://servicos.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
    observacao: "Cobre também as contribuições previdenciárias (INSS). Vale 180 dias.",
  },
  {
    id: "cnd_estadual",
    nome: "Certidão negativa estadual (SEF/SC)",
    categoria: "fiscal",
    validadeDias: null,
    essencial: true,
    ondeEmitir: "https://sat.sef.sc.gov.br/tax.net/Sat.CtaCte.Web/CertidaoNegativa.aspx",
    observacao: "A validade vem impressa na certidão — confira, não chute.",
  },
  {
    id: "cnd_municipal",
    nome: "Certidão negativa municipal (prefeitura da sede)",
    categoria: "fiscal",
    validadeDias: null,
    essencial: true,
    ondeEmitir: null,
    observacao: "Prefeitura de Xanxerê. A validade vem impressa na certidão.",
  },
  {
    id: "crf_fgts",
    nome: "CRF — Certificado de Regularidade do FGTS",
    categoria: "fiscal",
    validadeDias: 30,
    essencial: true,
    ondeEmitir: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    observacao:
      "VENCE EM 30 DIAS — é o que mais pega gente desprevenida. Vale a pena renovar todo mês, mesmo sem licitação à vista.",
  },
  {
    id: "cndt",
    nome: "CNDT — Certidão Negativa de Débitos Trabalhistas",
    categoria: "fiscal",
    validadeDias: 180,
    essencial: true,
    ondeEmitir: "https://cndt-certidao.tst.jus.br/inicio.faces",
    observacao: "Emitida pelo TST. Vale 180 dias.",
  },

  // --------------------------------------------------------------- econômica
  {
    id: "certidao_falencia",
    nome: "Certidão negativa de falência e recuperação judicial",
    categoria: "economica",
    validadeDias: 90,
    essencial: true,
    ondeEmitir: "https://certidoes.tjsc.jus.br/",
    observacao:
      "Emitida pelo TJ do estado da sede. Quando o edital não diz o prazo, a praxe é aceitar até 90 dias.",
  },
  {
    id: "balanco",
    nome: "Balanço patrimonial e demonstrações contábeis",
    categoria: "economica",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao:
      "Do último exercício social. Vence na virada do ano contábil — peça pro contador já assinado e registrado.",
  },
  {
    id: "indices_contabeis",
    nome: "Demonstrativo de índices contábeis (liquidez e endividamento)",
    categoria: "economica",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao: "Assinado pelo contador, com CRC. Vem junto do balanço.",
  },

  // ----------------------------------------------------------------- técnica
  {
    id: "atestado_capacidade",
    nome: "Atestado de capacidade técnica",
    categoria: "tecnica",
    validadeDias: null,
    essencial: true,
    ondeEmitir: null,
    observacao:
      "Emitido por cliente que a Embastel já atendeu, em papel timbrado, com CNPJ e contato de quem assina. Quanto mais parecido com o objeto do edital, melhor.",
  },
  {
    id: "alvara_funcionamento",
    nome: "Alvará de funcionamento",
    categoria: "tecnica",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao: "Prefeitura de Xanxerê. Costuma ser anual.",
  },
  {
    id: "alvara_sanitario",
    nome: "Alvará / licença sanitária",
    categoria: "tecnica",
    validadeDias: 365,
    essencial: false,
    ondeEmitir: null,
    observacao:
      "Importante no caso da Embastel: embalagem que encosta em alimento costuma cair em exigência sanitária.",
  },

  // ---------------------------------------------------------------- interno
  {
    id: "certificado_digital",
    nome: "Certificado digital e-CNPJ (A1 ou A3)",
    categoria: "interno",
    validadeDias: 365,
    essencial: true,
    ondeEmitir: null,
    observacao:
      "Não vai no envelope, mas sem ele não dá pra assinar proposta nem contrato. Vence em 1 ano e ninguém lembra.",
  },
  {
    id: "cadastro_portal",
    nome: "Cadastro em portal de licitação (Licitar Digital, BLL, ComprasNet…)",
    categoria: "interno",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao:
      "Registre aqui a data em que o cadastro precisa ser revalidado no portal. O da Licitar Digital está com pendência no contrato social desde 04/08/2025.",
  },
  {
    id: "outro",
    nome: "Outro documento",
    categoria: "interno",
    validadeDias: null,
    essencial: false,
    ondeEmitir: null,
    observacao: null,
  },
];

export function tipoPorId(id: string): TipoDocumento | null {
  return TIPOS_DOCUMENTO.find((t) => t.id === id) ?? null;
}
