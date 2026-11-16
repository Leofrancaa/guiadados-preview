// Insights da GuIA: pacote de dados reais → IA (OpenRouter, reserva Groq) → JSON validado → cache
// no banco. SÓ roda no servidor.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  abc,
  daysBetween,
  hourGrid,
  movimentos,
  shiftDate,
  todayInStore,
  variation,
  weekdayLong,
  weekdayStats,
  type Cesta,
  type InsightsIA,
  type Situacao,
  comparisonName,
} from "@/lib/vendas";
import {
  cestasCompras,
  painelProdutos,
  painelVendas,
} from "@/lib/vendas-server";
import { isoWeekday } from "@/lib/retrospectiva";
import { comReserva, modelosIA } from "@/lib/ia";
import { segmentoAtual } from "@/lib/demo/segmento-server";
import type { Segmento } from "@/lib/demo/segmentos";
import { resolverCategorias } from "@/lib/categorias-server";

const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const pct = (value: number | null) => (value === null ? null : round(value, 1));

export const insightsSchema = z.object({
  manchete: z.string().min(10).max(180),
  resumo: z.string().min(40).max(700),
  insights: z
    .array(
      z.object({
        tipo: z.enum(["oportunidade", "alerta", "tendencia", "destaque"]),
        impacto: z.enum(["alto", "medio", "baixo"]),
        titulo: z.string().min(5).max(90),
        explicacao: z.string().min(20).max(420),
        evidencia: z.string().min(5).max(260),
        acao: z.string().min(10).max(260),
      }),
    )
    .min(4)
    .max(7),
  perguntas: z.array(z.string().min(8).max(120)).min(2).max(4),
});

/** Período usado para os pares de compra (a função limita a 120 dias). */
export function cestasRange(ini: string, fim: string) {
  return daysBetween(ini, fim) > 120
    ? { ini: shiftDate(fim, -89), fim }
    : { ini, fim };
}

export async function dataPack(ini: string, fim: string, situacao: Situacao) {
  const cr = cestasRange(ini, fim);
  const hoje = todayInStore();
  const parcial = fim === hoje;
  // Médias, rankings de dias e horários usam só dias COMPLETOS: hoje (em
  // andamento) distorceria tudo para baixo.
  const statsEnd = parcial ? shiftDate(hoje, -1) : fim;
  const [vendas, produtos, cestas, categoriaDe, statsData, hojeData] =
    await Promise.all([
      painelVendas(ini, fim, situacao),
      painelProdutos(ini, fim, situacao),
      cestasCompras(cr.ini, cr.fim, situacao).catch(() => [] as Cesta[]),
      resolverCategorias(),
      parcial && statsEnd >= ini ? painelVendas(ini, statsEnd, situacao) : null,
      parcial ? painelVendas(hoje, hoje, situacao) : null,
    ]);
  const stats = parcial ? statsData : vendas;
  const { resumo: r, anterior: a } = vendas;
  const curva = abc(produtos.produtos);
  const mov = movimentos(produtos.produtos, 6);
  const grid = stats ? hourGrid(stats) : { horas: [], linhas: [] };
  const horas = grid.linhas
    .flatMap((linha) =>
      linha.celulas.map((celula) => ({
        diaSemana: weekdayLong[linha.dia - 1],
        hora: `${celula.hora}h`,
        mediaPedidos: round(celula.pedidos, 1),
      })),
    )
    .filter((item) => item.mediaPedidos > 0)
    .sort((x, y) => y.mediaPedidos - x.mediaPedidos);
  const dias = [...(stats?.serie ?? [])]
    .filter((d) => d.faturamento > 0)
    .sort((x, y) => y.faturamento - x.faturamento);
  const rs = stats?.resumo;
  const top = (items: typeof mov.alta) =>
    items.map((item) => ({
      produto: item.produto,
      categoria: categoriaDe(item.produto, item.codigo),
      faturamento: round(item.faturamento),
      faturamentoAnterior: round(item.faturamento_anterior),
      diferenca: round(item.diferenca),
      variacaoPct: pct(item.variacao),
    }));
  const pack = {
    hoje: todayInStore(),
    periodo: {
      inicio: ini,
      fim,
      dias: vendas.periodo.dias,
      incluiHojeParcial: false,
      periodoAnterior: {
        inicio: vendas.periodo.ant_ini,
        fim: vendas.periodo.ant_fim,
        ultimoDiaAteHorario: vendas.periodo.ant_corte ?? null,
        descricao: comparisonName(vendas.periodo),
      },
      filtroSituacao: situacao,
    },
    totais: {
      faturamento: round(r.faturamento),
      pedidos: r.pedidos,
      ticketMedio: round(r.ticket_medio),
      itensPorPedido: r.pedidos ? round(r.itens / r.pedidos) : 0,
      diasComVenda: r.dias_com_venda,
    },
    // Só dias completos (sem hoje, que ainda está em andamento).
    mediasPorDiaCompleto: rs?.dias_com_venda
      ? {
          inicio: ini,
          fim: statsEnd,
          dias: rs.dias_com_venda,
          faturamentoMedioPorDia: round(rs.faturamento / rs.dias_com_venda),
          pedidosMediosPorDia: round(rs.pedidos / rs.dias_com_venda, 1),
        }
      : null,
    hojeAteAgora: hojeData ? hojeAteAgora(hojeData, grid) : null,
    periodoAnterior: {
      faturamento: round(a.faturamento),
      pedidos: a.pedidos,
      ticketMedio: round(a.ticket_medio),
      itensPorPedido: a.pedidos ? round(a.itens / a.pedidos) : 0,
    },
    variacoesPct: {
      faturamento: pct(variation(r.faturamento, a.faturamento)),
      pedidos: pct(variation(r.pedidos, a.pedidos)),
      ticketMedio: pct(variation(r.ticket_medio, a.ticket_medio)),
    },
    situacaoDosPedidos: vendas.situacoes.map((row) => ({
      situacao: row.situacao,
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
    })),
    melhoresDias: dias.slice(0, 3).map((d) => ({
      data: d.data,
      faturamento: round(d.faturamento),
      pedidos: d.pedidos,
    })),
    pioresDias: dias.slice(-3).map((d) => ({
      data: d.data,
      faturamento: round(d.faturamento),
      pedidos: d.pedidos,
    })),
    diasDaSemana: (stats ? weekdayStats(stats) : []).map((d) => ({
      dia: weekdayLong[d.dia - 1],
      faturamentoMedio: round(d.mediaFaturamento),
      pedidosMedios: round(d.mediaPedidos, 1),
      ticketMedio: round(d.ticket),
    })),
    horariosDePico: horas.slice(0, 6),
    horariosMaisFracos: horas.slice(-4),
    faixasDeTicket: vendas.faixas_ticket.map((row) => ({
      faixa: [
        "",
        "até R$10",
        "R$10-20",
        "R$20-30",
        "R$30-50",
        "R$50-100",
        "acima de R$100",
      ][row.faixa],
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
    })),
    formasDePagamento: vendas.pagamentos.map((row) => ({
      forma: row.forma,
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
      ticketMedio: row.pedidos ? round(row.faturamento / row.pedidos) : 0,
    })),
    produtos: {
      vendidos: curva.vendidos,
      curvaABC: curva.resumo.map((c) => ({
        classe: c.classe,
        produtos: c.produtos,
        pctFaturamento: round(c.shareFaturamento, 1),
      })),
      top10PorFaturamento: produtos.produtos.slice(0, 10).map((item) => ({
        produto: item.produto,
        categoria: categoriaDe(item.produto, item.codigo),
        unidade: item.unidade,
        quantidade: round(item.qtd, 1),
        faturamento: round(item.faturamento),
        pctDoFaturamento: r.faturamento
          ? round((item.faturamento / r.faturamento) * 100, 1)
          : 0,
        variacaoPct: pct(
          variation(item.faturamento, item.faturamento_anterior),
        ),
      })),
      emAlta: top(mov.alta),
      emQueda: top(mov.queda),
      pararamDeVender: mov.parados.slice(0, 6).map((item) => ({
        produto: item.produto,
        categoria: categoriaDe(item.produto, item.codigo),
        faturamentoAnterior: round(item.faturamento_anterior),
      })),
      novidades: mov.novos.slice(0, 6).map((item) => ({
        produto: item.produto,
        categoria: categoriaDe(item.produto, item.codigo),
        faturamento: round(item.faturamento),
      })),
    },
    paresCompradosJuntos: {
      periodo: cr,
      // só pares com associação real (lift > 1): levar A aumenta a chance de levar B
      pares: cestas
        .filter((c) => c.lift > 1)
        .slice(0, 10)
        .map((c) => ({
          a: c.a,
          categoriaA: categoriaDe(c.a),
          b: c.b,
          categoriaB: categoriaDe(c.b),
          pedidosJuntos: c.pedidos,
          pctDeQuemLevaA_TambemLevaB: round(c.conf_a_b * 100, 1),
          pctDeQuemLevaB_TambemLevaA: round(c.conf_b_a * 100, 1),
          lift: c.lift,
        })),
    },
    limitacoes:
      "Sem custos, margem, estoque, produção ou dados de clientes. PENDENTE = pedido não finalizado no caixa.",
  };
  return { pack, vendas, cestas, cestasPeriodo: cr };
}

/**
 * Hoje até agora: comparado com o mesmo dia da semana passada até o mesmo
 * horário (o banco já corta em ant_corte) e com a média desse dia da semana
 * até este horário, calculada pela grade de horas dos dias completos.
 */
function hojeAteAgora(
  hoje: Awaited<ReturnType<typeof painelVendas>>,
  grid: ReturnType<typeof hourGrid>,
) {
  const { resumo: r, anterior: a, periodo } = hoje;
  const corte = periodo.ant_corte ?? null;
  let tipico: { faturamento: number; pedidos: number } | null = null;
  if (corte) {
    const [h, m] = corte.split(":").map(Number);
    const linha = grid.linhas.find((l) => l.dia === isoWeekday(periodo.ini));
    if (linha) {
      tipico = { faturamento: 0, pedidos: 0 };
      for (const c of linha.celulas) {
        const peso = c.hora < h ? 1 : c.hora === h ? m / 60 : 0;
        tipico.faturamento += c.faturamento * peso;
        tipico.pedidos += c.pedidos * peso;
      }
    }
  }
  return {
    data: periodo.ini,
    diaSemana: weekdayLong[isoWeekday(periodo.ini) - 1],
    ateHorario: corte,
    faturamento: round(r.faturamento),
    pedidos: r.pedidos,
    ticketMedio: round(r.ticket_medio),
    comparadoCom: comparisonName(periodo),
    anterior: {
      faturamento: round(a.faturamento),
      pedidos: a.pedidos,
      ticketMedio: round(a.ticket_medio),
    },
    variacoesPct: {
      faturamento: pct(variation(r.faturamento, a.faturamento)),
      pedidos: pct(variation(r.pedidos, a.pedidos)),
    },
    mediaDesteDiaDaSemanaAteEsteHorario:
      tipico && tipico.faturamento > 0
        ? {
            faturamento: round(tipico.faturamento),
            pedidos: round(tipico.pedidos, 1),
            variacaoFaturamentoPct: pct(
              variation(r.faturamento, tipico.faturamento),
            ),
          }
        : null,
  };
}

const instrucoes = (
  seg: Segmento,
) => `Você é a GuIA, analista de vendas da ${seg.empresa} (${seg.sobre}). Recebe um pacote JSON com os dados de vendas do caixa (nesta demonstração os números são fictícios, mas analise como se fossem reais e não comente isso) e escreve, em português do Brasil simples e direto para o dono, uma análise que conta a história do período e aponta o que fazer.
Regras:
- Use SOMENTE números presentes no pacote. Nunca invente, estime custos, margem, lucro, estoque ou dados de clientes (não existem). Pode fazer contas simples com os números do pacote (diferenças, porcentagens) e deve mostrar o resultado.
- Formato de números brasileiro: R$ 1.234,56; 12,5%. Datas como 24/10.
- "manchete": uma frase forte e verdadeira sobre o período (ex.: queda/alta de faturamento, ticket, destaque).
- "resumo": 2 a 4 frases contando a história: como foi o período em relação ao anterior, quando a loja vende, o que puxou o resultado.
- "insights": 4 a 7 itens, do mais importante para o menos importante, cobrindo assuntos diferentes (ex.: ticket médio e combos com base nos pares comprados juntos, horários/dias fortes e fracos, produtos em alta/queda/parados, formas de pagamento, pedidos pendentes). Cada item: titulo curto; explicacao do porquê importa; evidencia com os números exatos do pacote; acao concreta, pequena e testável (ex.: combo, exposição, reforço de equipe ou produção no horário forte, promoção em horário fraco); tipo (oportunidade, alerta, tendencia, destaque) e impacto (alto, medio, baixo).
- Cada produto vem com "categoria", tirada do cadastro. Use SEMPRE essa categoria para saber o que o produto é; nunca deduza pelo nome. Categoria "outros" não entra em combo. Cada ${seg.termo} do caixa aparece no pacote como "pedido".
- Combos, "leve junto" e vendas casadas: só sugira (a) com base em paresCompradosJuntos, citando o par e a % de quem leva um e também leva o outro, ou (b) entre categorias que se consomem juntas. Regras de combinação: ${seg.combos}. Nunca junte dois produtos num combo só porque ambos cresceram, caíram ou aparecem na mesma lista, e nunca proponha combo com produto que não está no pacote (ex.: inventar "suco de laranja 500 ml"); para a bebida, diga só "uma bebida" ou cite uma bebida que esteja no pacote.
- Quando um insight citar vários produtos em alta/queda, a ação deve fazer sentido para cada um deles; se não fizer, foque em um produto só ou dê uma ação específica para cada.
- Se incluiHojeParcial for true, hoje ainda está em andamento. Os totais do período já comparam com o período anterior cortado no mesmo horário (ultimoDiaAteHorario): diga isso com a descricao do período anterior (ex.: "contra o domingo passado até as 8h36").
- Hoje parcial NUNCA é o "pior dia", nunca entra em ranking de dias e nunca é comparado com médias ou mínimos de dias inteiros. melhoresDias, pioresDias, diasDaSemana, horários e mediasPorDiaCompleto já excluem hoje. Para falar de hoje, use SÓ hojeAteAgora: contra comparadoCom (mesmo horário) e contra mediaDesteDiaDaSemanaAteEsteHorario, dizendo o horário (ex.: "até as 8h05"). Se a diferença for pequena ou o dia mal começou, não gere alerta sobre hoje.
- Formas de pagamento: nunca sugira desconto, preço menor ou qualquer incentivo para pagar em dinheiro (aumenta risco de furto, erro de troco, tempo de caixa e perda de controle). Se quiser incentivar um meio mais barato que o cartão, sugira o Pix. Não afirme taxas de cartão ou Pix como fato (não estão no pacote).
- Se houver muitos pedidos PENDENTE, gere um alerta pedindo para o dono confirmar se contam como venda.
- "perguntas": 2 a 4 perguntas curtas que o dono poderia fazer ao chat para aprofundar.
- Tom: consultor de confiança, sem jargão, sem exageros, sem prometer resultados.`;

export async function gerarInsights(
  pack: unknown,
  { signal }: { signal?: AbortSignal } = {},
): Promise<{ conteudo: InsightsIA; modelo: string }> {
  const instructions = instrucoes(await segmentoAtual());
  return comReserva(
    modelosIA("low"),
    async (modelo) => {
      const result = await generateText({
        model: modelo.model,
        instructions,
        prompt: `PACOTE DE DADOS (JSON):\n${JSON.stringify(pack)}`,
        output: Output.object({ schema: insightsSchema, name: "insights" }),
        temperature: 0.3,
        maxOutputTokens: 2600,
        maxRetries: 0,
        abortSignal: signal ?? AbortSignal.timeout(50_000),
        providerOptions: modelo.providerOptions,
      });
      return {
        conteudo: insightsSchema.parse(result.output),
        modelo: modelo.id,
      };
    },
    "insights",
  );
}

type Salvo = { conteudo: InsightsIA; modelo: string; gerado_em: string } | null;

// Na demonstração as análises ficam só na memória do servidor.
const salvos = new Map<string, NonNullable<Salvo>>();
const chaveSalvo = async (ini: string, fim: string, situacao: Situacao) =>
  `${(await segmentoAtual()).id}|${ini}|${fim}|${situacao}`;

export async function insightsUltimo(
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<Salvo> {
  return salvos.get(await chaveSalvo(ini, fim, situacao)) ?? null;
}

export async function insightsSalvar(
  ini: string,
  fim: string,
  situacao: Situacao,
  modelo: string,
  conteudo: InsightsIA,
) {
  if (salvos.size > 300) salvos.delete(salvos.keys().next().value!);
  salvos.set(await chaveSalvo(ini, fim, situacao), {
    conteudo,
    modelo,
    gerado_em: new Date().toISOString(),
  });
}

/** Insight salvo ainda vale? Períodos fechados valem sempre; com hoje, 3 h. */
export function aindaValido(salvo: Salvo, fim: string, now = Date.now()) {
  if (!salvo) return false;
  if (fim < todayInStore()) return true;
  // com o dia em andamento, a análise envelhece rápido: refaz a cada hora
  return now - Date.parse(salvo.gerado_em) < 3600_000;
}
