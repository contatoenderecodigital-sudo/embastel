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

export function ItensEditor({
  itens,
  setItens,
}: {
  itens: ItemForm[];
  setItens: (itens: ItemForm[]) => void;
}) {
  function atualizar(i: number, patch: Partial<ItemForm>) {
    setItens(itens.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function remover(i: number) {
    setItens(itens.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {itens.map((item, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            value={item.descricao}
            onChange={(e) => atualizar(i, { descricao: e.target.value })}
            placeholder="Ex: Saco 40L fardo"
            className="min-w-[160px] flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
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
            className="w-[100px] rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <span className="w-[90px] text-right text-sm text-neutral-500">
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
      ))}
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
