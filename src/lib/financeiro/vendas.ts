// Agrupa a série diária de vendas em meses, para a receita do financeiro.
import { addDias, mesDe } from "./calculos";
import type { VendasMes } from "./tipos";

/** Dias sem venda entram como zero; o dia de hoje (em andamento) entra parcial. */
export function agruparVendasPorMes(
  serie: { data: string; faturamento: number }[],
  ini: string,
  fim: string,
): VendasMes {
  const porDia = new Map(
    serie.map((p) => [p.data.slice(0, 10), p.faturamento]),
  );
  const out: VendasMes = {};
  for (let d = ini; d <= fim; d = addDias(d, 1)) {
    const mes = mesDe(d);
    out[mes] ??= { total: 0, dias: [] };
    const v = Math.round((porDia.get(d) ?? 0) * 100) / 100;
    out[mes].dias.push(v);
    out[mes].total = Math.round((out[mes].total + v) * 100) / 100;
  }
  return out;
}

export type VendasFinanceiro = {
  hoje: string;
  atualizado_em: string | null;
  ultimo_pedido: string | null;
  vendas: VendasMes;
  empresa?: string;
};
