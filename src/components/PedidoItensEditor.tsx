"use client";

export type ItemForm = { descricao: string; quantidade: string; valorUnitario: string };

export function itemFormVazio(): ItemForm {
  return { descricao: "", quantidade: "1", valorUnitario: "" };
}

export function totalItens(itens: ItemForm[]): number {
  return itens.reduce((soma, item) => {
    const qtd = Number(item.quantidade) || 0;
    const valor = Number(item.valorUnitario) || 0;
    return soma + qtd * valor;
  }, 0);
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * O que a vendedora precisa ver de cada produto na hora de fechar o preço.
 *
 * Vem do catálogo já com o piso calculado no servidor — a conta
 * `custo / (1 - imposto - margem)` mora em catalogoDb.calcularPrecos e não
 * pode ser refeita aqui, senão sai diferente nos dois lugares.
 */
export type ProdutoPreco = {
  id: string;
  descricao: string;
  unidade: string;
  custo: number;
  precos: { custoTotal: number; precoMinimo: number; precoEmpate: number };
};

export function ItensEditor({
  itens,
  setItens,
  produtos = [],
}: {
  itens: ItemForm[];
  setItens: (itens: ItemForm[]) => void;
  produtos?: ProdutoPreco[];
}) {
  /**
   * Casa o que está digitado com um produto do catálogo.
   *
   * Por descrição exata, e não por um id guardado à parte: a vendedora digita
   * livre, e amarrar o item a um id obrigaria a escolher da lista — que é
   * justamente o que ela não pode ser obrigada a fazer no balcão. Não achou,
   * a linha segue sem custo e sem piso, como era antes.
   */
  function produtoDe(descricao: string): ProdutoPreco | null {
    const alvo = descricao.trim().toLowerCase();
    if (!alvo) return null;
    return produtos.find((p) => p.descricao.trim().toLowerCase() === alvo) ?? null;
  }
  function atualizar(i: number, patch: Partial<ItemForm>) {
    setItens(itens.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function remover(i: number) {
    setItens(itens.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <datalist id="produtos-catalogo">
        {produtos.map((p) => (
          <option key={p.id} value={p.descricao} />
        ))}
      </datalist>

      {itens.map((item, i) => {
        const produto = produtoDe(item.descricao);
        const cobrado = Number(item.valorUnitario) || 0;
        // Só acusa quando há preço digitado: campo em branco ainda não é
        // decisão, e pintar de vermelho o que a pessoa nem preencheu vira
        // ruído que ela aprende a ignorar.
        const abaixoDoPiso =
          produto != null && cobrado > 0 && cobrado < produto.precos.precoMinimo;

        return (
        <div key={i} className="flex flex-wrap items-start gap-2">
          <div className="min-w-[160px] flex-1">
          <input
            value={item.descricao}
            list="produtos-catalogo"
            onChange={(e) => atualizar(i, { descricao: e.target.value })}
            placeholder="Ex: Saco 40L fardo"
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          {produto && (
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] tabular-nums">
              <span className="text-neutral-500">
                custo {currency.format(produto.precos.custoTotal)}
              </span>
              <span className={abaixoDoPiso ? "font-semibold text-red-600" : "text-neutral-500"}>
                mínimo {currency.format(produto.precos.precoMinimo)}
              </span>
              {abaixoDoPiso && (
                <span className="font-semibold text-red-600">abaixo do mínimo</span>
              )}
            </div>
          )}
          </div>
          <input
            type="number"
            min={0}
            value={item.quantidade}
            onChange={(e) => atualizar(i, { quantidade: e.target.value })}
            placeholder="Qtd"
            className="w-[70px] rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={item.valorUnitario}
            onChange={(e) => atualizar(i, { valorUnitario: e.target.value })}
            placeholder="Valor unit."
            className={`w-[100px] rounded-md border px-2 py-1.5 text-sm outline-none focus:border-brand ${
              abaixoDoPiso ? "border-red-400 bg-red-50" : "border-neutral-300"
            }`}
          />
          <span className="w-[90px] pt-1.5 text-right text-sm text-neutral-500">
            {currency.format((Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0))}
          </span>
          <button
            type="button"
            onClick={() => remover(i)}
            disabled={itens.length === 1}
            className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
        );
      })}
      <button
        type="button"
        onClick={() => setItens([...itens, itemFormVazio()])}
        className="text-xs font-medium text-brand hover:underline"
      >
        + Item
      </button>
    </div>
  );
}
