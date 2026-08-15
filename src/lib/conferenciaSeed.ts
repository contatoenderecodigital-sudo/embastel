// Lista inicial da conferência de estoque, transcrita das fotos que o usuário
// mandou em 13/08/2026 — listagens impressas com marcação à mão.
//
// REGRAS QUE ELE DEU:
//  - item riscado à caneta  -> fora da lista (não foi transcrito)
//  - item com "15D" ao lado -> conferência quinzenal
//  - item sem marca         -> conferência semanal
//
// ATENÇÃO: isto é transcrição de foto de papel. Código cortado na borda,
// risco ambíguo e "15D" que parece "19D" existem. A lista é editável na tela
// justamente por isso — corrigir aqui no código não é necessário.

export type PeriodicidadeSeed = "semanal" | "quinzenal";

export type ItemSeed = {
  codigo: string;
  descricao: string;
  periodicidade: PeriodicidadeSeed;
};

export const ITENS_INICIAIS: ItemSeed[] = [
  // ---------------------------------------------------------------- folha 1
  { codigo: "18635", descricao: "Sacola Lema 38x48 reforçada", periodicidade: "semanal" },
  { codigo: "25561", descricao: "Bandeja EPS média FF-54 preta", periodicidade: "semanal" },
  { codigo: "6848", descricao: "Hambúrguer isopor HF-101", periodicidade: "semanal" },
  { codigo: "22822", descricao: "Copo descartável 180ml", periodicidade: "semanal" },
  { codigo: "15774", descricao: "Bandeja alumínio lasanha 1150ml", periodicidade: "semanal" },
  { codigo: "18195", descricao: "Sacola reforçada 48x58", periodicidade: "semanal" },
  { codigo: "6847", descricao: "Hamburgueira isopor HF-03", periodicidade: "semanal" },
  { codigo: "25560", descricao: "Bandeja EPS média FF-54 amarela", periodicidade: "semanal" },
  { codigo: "20720", descricao: "Filme stretch 500x25mm", periodicidade: "quinzenal" },
  { codigo: "14382", descricao: "Lancheira HF-102 Fibraform", periodicidade: "semanal" },
  { codigo: "137", descricao: "Prato pinho nº 12 37cm", periodicidade: "semanal" },
  { codigo: "31453", descricao: "Saco 50x80 fardo (Libreplast)", periodicidade: "semanal" },
  { codigo: "7151", descricao: "Band cristal G-60M pizza", periodicidade: "quinzenal" },
  { codigo: "10915", descricao: "Hambúrguer isopor HF-132", periodicidade: "semanal" },
  { codigo: "8808", descricao: "Hambúrguer isopor HF-106", periodicidade: "semanal" },
  { codigo: "22326", descricao: "Copo descartável 300ml", periodicidade: "quinzenal" },
  { codigo: "20429", descricao: "Marmitex isopor 1100ml", periodicidade: "semanal" },
  { codigo: "5800", descricao: "Copo isopor térmico 180ml", periodicidade: "semanal" },
  { codigo: "5383", descricao: "Band isopor FR-003 C400", periodicidade: "semanal" },
  { codigo: "16008", descricao: "Embalagem alumínio 750ml", periodicidade: "semanal" },
  { codigo: "20819", descricao: "Band cristal PF-13 retangular", periodicidade: "semanal" },
  { codigo: "2391", descricao: "Caixa pizza octavada 35cm", periodicidade: "semanal" },
  { codigo: "22890", descricao: "H-70 média embalagem", periodicidade: "quinzenal" },
  { codigo: "21004", descricao: "Guardanapo Bela Vista 19x19", periodicidade: "quinzenal" },
  { codigo: "22695", descricao: "Prato PR-26 branco raso", periodicidade: "quinzenal" },
  { codigo: "26074", descricao: "Bandeja EPS média FF-54 amarela", periodicidade: "semanal" },
  { codigo: "22113", descricao: "Embalagem bolo F-32TA", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 2
  { codigo: "9047", descricao: "Band cristal H-56 alta", periodicidade: "quinzenal" },
  { codigo: "23336", descricao: "Bobina F. reto 35x50 8kg", periodicidade: "semanal" },
  { codigo: "27982", descricao: "H-65 M acondicionamento", periodicidade: "quinzenal" },
  { codigo: "2651", descricao: "Disco isopor c/ aba média MP-28", periodicidade: "quinzenal" },
  { codigo: "31599", descricao: "Capa fardo canela 52x37", periodicidade: "quinzenal" },
  { codigo: "24464", descricao: "Sacola M 38x48 reforçada", periodicidade: "semanal" },
  { codigo: "15613", descricao: "Hamburgueira isopor HF-01", periodicidade: "quinzenal" },
  { codigo: "22891", descricao: "H-78 M embalagem cristal", periodicidade: "quinzenal" },
  { codigo: "3217", descricao: "Band cristal G-302 freezer", periodicidade: "quinzenal" },
  { codigo: "19103", descricao: "PT-102 750ml Copobras", periodicidade: "semanal" },
  { codigo: "22688", descricao: "Bobina F. reto 30x40 5kg", periodicidade: "quinzenal" },
  { codigo: "26987", descricao: "Caixa pizza octavada 450mm", periodicidade: "quinzenal" },
  { codigo: "88", descricao: "Band cristal GA-18D", periodicidade: "quinzenal" },
  { codigo: "30116", descricao: "JF-20 unidade", periodicidade: "quinzenal" },
  { codigo: "2393", descricao: "Caixa pizza octavada 250mm", periodicidade: "quinzenal" },
  { codigo: "23435", descricao: "PT-104Q base fardo branca", periodicidade: "semanal" },
  { codigo: "22324", descricao: "Copo descartável 300ml", periodicidade: "quinzenal" },
  { codigo: "24358", descricao: "Caixa p/ entrega colorida", periodicidade: "quinzenal" },
  { codigo: "17528", descricao: "Embalagem alumínio 1500ml", periodicidade: "semanal" },
  { codigo: "3135", descricao: "Prato PR-15 branco 100un", periodicidade: "quinzenal" },
  { codigo: "21946", descricao: "Caixa p/ entrega virgem", periodicidade: "quinzenal" },
  { codigo: "21005", descricao: "Guardanapo Bela Vista 29x29", periodicidade: "quinzenal" },
  { codigo: "2518", descricao: "Band cristal freezer 500ml", periodicidade: "quinzenal" },
  { codigo: "14616", descricao: "Band cristal H-60 alta", periodicidade: "quinzenal" },
  { codigo: "31507", descricao: "Bobina estoque picotada", periodicidade: "semanal" },
  { codigo: "5801", descricao: "Copo isopor térmico 240ml", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 3
  { codigo: "16009", descricao: "Embalagem alumínio 750ml", periodicidade: "quinzenal" },
  { codigo: "6740", descricao: "Pote isopor p/ marmitex 750ml", periodicidade: "quinzenal" },
  { codigo: "5382", descricao: "Band isopor FR-002 C400", periodicidade: "quinzenal" },
  { codigo: "18033", descricao: "Sacola Lema 30x40cm", periodicidade: "quinzenal" },
  { codigo: "23972", descricao: "Estojo HC-106 Cristalcopo", periodicidade: "quinzenal" },
  { codigo: "28884", descricao: "Papel alumínio rolo 45cm", periodicidade: "quinzenal" },
  { codigo: "91", descricao: "Band cristal G-40M torta", periodicidade: "quinzenal" },
  { codigo: "16325", descricao: "Pote retangular freezer 1000ml", periodicidade: "quinzenal" },
  { codigo: "22898", descricao: "Marmita TC-110 XPS 1100ml", periodicidade: "quinzenal" },
  { codigo: "16308", descricao: "Band alumínio lasanha 1150ml", periodicidade: "quinzenal" },
  { codigo: "152", descricao: "Papel alumínio 45cm x 7,5m", periodicidade: "quinzenal" },
  { codigo: "5917", descricao: "Pote isopor p/ marmitex FM-1100", periodicidade: "quinzenal" },
  { codigo: "29199", descricao: "PF-78 bandeja PET branca", periodicidade: "quinzenal" },
  { codigo: "24806", descricao: "Sacola G 48x58 reforçada", periodicidade: "quinzenal" },
  { codigo: "20820", descricao: "Band cristal PF-20 retangular", periodicidade: "quinzenal" },
  { codigo: "2370", descricao: "Caixa p/ entrega colorida", periodicidade: "quinzenal" },

  // ---------------------------------------------------------------- folha 4
  { codigo: "113", descricao: "Bob picotada 16x30 1lt 015", periodicidade: "quinzenal" },
  { codigo: "20766", descricao: "Bandeja isopor c/ tampa FF-06", periodicidade: "semanal" },
  { codigo: "2153", descricao: "Pote p/ mel 1kg", periodicidade: "semanal" },
  { codigo: "29951", descricao: "Bandeja isopor FF-03 preta", periodicidade: "semanal" },
  { codigo: "24052", descricao: "Pote oval PS descartável vermelho", periodicidade: "semanal" },
  { codigo: "7730", descricao: "Garfo forte cristal c/50", periodicidade: "semanal" },
  { codigo: "26981", descricao: "Saco liso 10x15x0,10 c/100", periodicidade: "semanal" },
  { codigo: "652", descricao: "Band cristal G-60 alta", periodicidade: "quinzenal" },
  { codigo: "22689", descricao: "Bobina F. reto 35x50 8kg", periodicidade: "semanal" },
  { codigo: "12562", descricao: "Saco papel SOS 5kg", periodicidade: "semanal" },
  { codigo: "21000", descricao: "Papel toalha interfolhado Luce", periodicidade: "quinzenal" },

  // ---------------------------------------------------------------- folha 5
  { codigo: "22389", descricao: "Bobina reforçada 3kg", periodicidade: "quinzenal" },
  { codigo: "24579", descricao: "PF-18 bandeja PET retangular", periodicidade: "semanal" },
  { codigo: "20818", descricao: "Band cristal PF-10 retangular", periodicidade: "quinzenal" },
  { codigo: "173", descricao: "Sacola 24x34 cx c/1000", periodicidade: "quinzenal" },
  { codigo: "25191", descricao: "PT-100 transp. pote plástico", periodicidade: "quinzenal" },
  { codigo: "25599", descricao: "PF-32 A bandeja PET branca", periodicidade: "semanal" },
  { codigo: "27661", descricao: "PRF-15 branco prato fundo", periodicidade: "semanal" },
  { codigo: "21917", descricao: "Hamburgueira CH-01 branca", periodicidade: "semanal" },
  { codigo: "26642", descricao: "Band isopor FF-004 amarela", periodicidade: "semanal" },
  { codigo: "298", descricao: "Sacola plástica 90x100cm", periodicidade: "semanal" },
  { codigo: "30113", descricao: "JF-13 unidade", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 6
  { codigo: "17326", descricao: "Papel toalha sort creme", periodicidade: "quinzenal" },
  { codigo: "17327", descricao: "Papel toalha interfolhado sort branco", periodicidade: "quinzenal" },
  { codigo: "22694", descricao: "PRF-12 branco prato fundo", periodicidade: "semanal" },
  { codigo: "30746", descricao: "H-37 base branca alta", periodicidade: "semanal" },
  { codigo: "24867", descricao: "Papel kraft pardo natural saco", periodicidade: "semanal" },
  { codigo: "29546", descricao: "Espeto de bambu 25cm", periodicidade: "semanal" },
  { codigo: "22138", descricao: "Estojo HC-101 branco", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 7
  { codigo: "31433", descricao: "CH-102 Copobras c/100", periodicidade: "semanal" },
  { codigo: "27121", descricao: "Bobina strong 60cm", periodicidade: "semanal" },
  { codigo: "1083", descricao: "Band isopor FR-001 C400", periodicidade: "semanal" },
  { codigo: "1622", descricao: "Band isopor CR-008 C-100", periodicidade: "semanal" },
  { codigo: "17182", descricao: "Bandeja alumínio 530ml", periodicidade: "semanal" },
  { codigo: "16309", descricao: "Band alumínio lasanha 2000ml", periodicidade: "semanal" },
  { codigo: "24483", descricao: "Estojo HC-102 XPS 1300", periodicidade: "quinzenal" },
  { codigo: "12877", descricao: "Papel arroz tag", periodicidade: "quinzenal" },
  { codigo: "5595", descricao: "Band isopor FF-002 C400", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 8
  { codigo: "16311", descricao: "Band alumínio pizza 35cm c/ tampa", periodicidade: "semanal" },
  { codigo: "20824", descricao: "Pote quadrado PF-641", periodicidade: "quinzenal" },
  { codigo: "2517", descricao: "Band cristal freezer 400ml", periodicidade: "semanal" },
  { codigo: "30870", descricao: "Pote mel 1kg c/ tampa", periodicidade: "quinzenal" },
  { codigo: "22134", descricao: "Bobina rolo simples 25x35", periodicidade: "semanal" },
  { codigo: "21023", descricao: "Band cristal PF-32 APRP", periodicidade: "semanal" },
  { codigo: "30748", descricao: "H-56 base preta alta cx", periodicidade: "semanal" },
  { codigo: "24781", descricao: "Sacos plásticos 14x20", periodicidade: "semanal" },
  { codigo: "18369", descricao: "Saco SOS 10kg", periodicidade: "semanal" },
  { codigo: "28183", descricao: "Bandeja FF-04 preta", periodicidade: "semanal" },
  { codigo: "25278", descricao: "Emb. plástica outros G-687", periodicidade: "semanal" },
  { codigo: "661", descricao: "Band cristal G-80MA alta", periodicidade: "semanal" },
  { codigo: "3969", descricao: "Band cristal G-680 sobremesa", periodicidade: "semanal" },
  { codigo: "10970", descricao: "Papel toalha sort interfolhado", periodicidade: "semanal" },

  // ---------------------------------------------------------------- folha 9
  { codigo: "477", descricao: "Band cristal G-MT meia", periodicidade: "semanal" },
  { codigo: "18036", descricao: "Sacola Lema 48x58cm", periodicidade: "quinzenal" },
  { codigo: "27884", descricao: "Pote oval Kopus c/200", periodicidade: "semanal" },
  { codigo: "18370", descricao: "Saco SOS 45kg", periodicidade: "semanal" },
  { codigo: "29948", descricao: "Embalagem alumínio 1500ml", periodicidade: "quinzenal" },
  { codigo: "4718", descricao: "Saco p/ talher 4x23 pct", periodicidade: "quinzenal" },
  { codigo: "6992", descricao: "Band cristal G-34 colonial", periodicidade: "quinzenal" },
  { codigo: "18034", descricao: "Sacola Lema 38x48cm", periodicidade: "quinzenal" },
];
