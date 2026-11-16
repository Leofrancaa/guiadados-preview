import { failure, guard, json } from "@/lib/api-route";
import { mesesHistorico } from "@/lib/financeiro/calculos";
import { agruparVendasPorMes } from "@/lib/financeiro/vendas";
import { todayInStore } from "@/lib/vendas";
import { segmentoAtual } from "@/lib/demo/segmento-server";
import {
  faturamentoDiario,
  painelVendas,
  VendasNaoConfiguradas,
  type FaturamentoDiario,
} from "@/lib/vendas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Faturamento do caixa desde janeiro do ano anterior, por mês e por dia, para a
 * receita do módulo financeiro. Mesmo critério da tela de Vendas: todos os
 * pedidos, as duas lojas juntas (o relatório não separa por loja).
 */
export async function GET(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const hoje = todayInStore();
  const ini = `${mesesHistorico(hoje)[0]}-01`;
  try {
    // Consulta leve (só a série diária); se ela ainda não existir no banco,
    // usa a consulta completa do painel, que devolve os mesmos números.
    let painel: FaturamentoDiario;
    try {
      painel = await faturamentoDiario(ini, hoje, "todas");
    } catch (error) {
      if (error instanceof VendasNaoConfiguradas) throw error;
      painel = await painelVendas(ini, hoje, "todas");
    }
    return json({
      hoje,
      atualizado_em: painel.atualizado_em,
      ultimo_pedido: painel.base.ultimo_pedido,
      vendas: agruparVendasPorMes(painel.serie, ini, hoje),
      empresa: (await segmentoAtual()).empresa,
    });
  } catch (error) {
    return failure(error, "api/financeiro/vendas");
  }
}
