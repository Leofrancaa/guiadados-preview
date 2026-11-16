// Ferramenta do chat para as vendas (demonstração). Só roda no servidor.
import {
  daysBetween,
  faixaLabels,
  hourGrid,
  isIsoDate,
  presetLabels,
  presetRange,
  shiftDate,
  todayInStore,
  weekdayLong,
  weekdayStats,
  type FixedPreset,
  type PainelProdutos,
  type PainelVendas,
  type Situacao,
} from "@/lib/vendas";
import {
  cestasCompras,
  painelProdutos,
  painelVendas,
} from "@/lib/vendas-server";
import { resolverCategorias } from "@/lib/categorias-server";
import {
  dataComemorativa,
  datasNoPeriodo,
  janelasPagamento,
} from "@/lib/datas-comemorativas";

export function realSalesAvailable() {
  return true;
}

const round = (value: number) => Math.round(value * 100) / 100;

export const chatWeekdays = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
] as const;
export type ChatWeekday = (typeof chatWeekdays)[number];

/** Médias por dia: soma ÷ ocorrências dos dias da semana (dias completos). */
function dailyAverages(data: PainelVendas, dias: number[]) {
  const stats = weekdayStats(data).filter((day) => dias.includes(day.dia));
  const occurrences = stats.reduce((sum, day) => sum + day.ocorrencias, 0);
  const revenue = stats.reduce((sum, day) => sum + day.faturamento, 0);
  const orders = stats.reduce((sum, day) => sum + day.pedidos, 0);
  return {
    days: occurrences,
    averageRevenuePerDay: occurrences ? round(revenue / occurrences) : 0,
    averageOrdersPerDay: occurrences ? round(orders / occurrences) : 0,
    averageTicket: orders ? round(revenue / orders) : 0,
  };
}

function sameDateLastYear(date: string) {
  const y = Number(date.slice(0, 4)) - 1;
  const md = date.slice(5);
  return md === "02-29" ? `${y}-02-28` : `${y}-${md}`;
}

/** Mínimo, mediana e máximo de um dia da semana no período (dias com venda). */
function faixaNormal(data: PainelVendas, isoWeekday: number) {
  const dias = data.serie
    .filter((row) => {
      const wd = new Date(`${row.data}T12:00:00Z`).getUTCDay();
      return row.faturamento > 0 && (wd === 0 ? 7 : wd) === isoWeekday;
    })
    .map((row) => ({ revenue: row.faturamento, orders: row.pedidos }));
  if (!dias.length) return {};
  const sorted = (key: "revenue" | "orders") =>
    dias.map((d) => d[key]).sort((a, b) => a - b);
  const median = (values: number[]) => {
    const mid = Math.floor(values.length / 2);
    return values.length % 2
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  };
  const r = sorted("revenue");
  const o = sorted("orders");
  return {
    revenueMin: round(r[0]),
    revenueMedian: round(median(r)),
    revenueMax: round(r[r.length - 1]),
    ordersMin: o[0],
    ordersMax: o[o.length - 1],
  };
}

function resumoAnoAnterior(
  data: PainelVendas | null,
  range: { start: string; end: string },
) {
  if (!data || data.resumo.pedidos === 0)
    return { ...range, available: false as const };
  return {
    ...range,
    available: true as const,
    revenue: round(data.resumo.faturamento),
    orders: data.resumo.pedidos,
    averageTicket: round(data.resumo.ticket_medio),
    calendarEvents: datasNoPeriodo(range.start, range.end),
  };
}

/** Vendas por hora de um dia da semana, com acumulados para avaliar horário de funcionamento. */
function hourlyBreakdown(data: PainelVendas, weekday: ChatWeekday) {
  const dia = chatWeekdays.indexOf(weekday) + 1;
  const linha = hourGrid(data).linhas.find((row) => row.dia === dia);
  const celulas = (linha?.celulas ?? []).filter(
    (celula) => celula.pedidos > 0 || celula.faturamento > 0,
  );
  const total = celulas.reduce((sum, celula) => sum + celula.faturamento, 0);
  const first = celulas[0]?.hora ?? 0;
  const last = celulas.at(-1)?.hora ?? -1;
  const active = new Set(celulas.map((celula) => celula.hora));
  let before = 0;
  return {
    weekday,
    occurrences:
      data.dias_semana.find((row) => row.dia_semana === dia)?.ocorrencias ?? 0,
    averageRevenuePerDay: round(total),
    firstHourWithSales: celulas.length ? `${first}h` : null,
    lastHourWithSales: celulas.length ? `${last}h-${last + 1}h` : null,
    // horas sem nenhuma venda entre a primeira e a última (loja fechada ou parada)
    hoursWithoutSalesInBetween: Array.from(
      { length: Math.max(0, last - first + 1) },
      (_, i) => first + i,
    )
      .filter((hora) => !active.has(hora))
      .map((hora) => `${hora}h-${hora + 1}h`),
    hours: celulas.map((celula) => {
      const row = {
        hour: `${celula.hora}h-${celula.hora + 1}h`,
        averageOrders: round(celula.pedidos),
        averageRevenue: round(celula.faturamento),
        shareOfDayRevenuePct: total
          ? round((celula.faturamento / total) * 100)
          : 0,
        // receita média que deixaria de ocorrer abrindo só às `hora`h / fechando às `hora`h
        averageRevenueBeforeThisHour: round(before),
        averageRevenueFromThisHourOn: round(total - before),
      };
      before += celula.faturamento;
      return row;
    }),
  };
}

type Categoria = Awaited<ReturnType<typeof resolverCategorias>>;

/**
 * O que explica um período curto ter vendido acima/abaixo do normal:
 * compara cada dia com a média do MESMO dia da semana nas 8 semanas
 * anteriores e mostra de onde veio a diferença (pedidos × ticket,
 * categorias, produtos e horários).
 */
function driversVsNormal(
  data: PainelVendas,
  base: PainelVendas,
  prod: PainelProdutos,
  baseProd: PainelProdutos,
  categoriaDe: Categoria,
) {
  const dias = data.periodo.dias || 1;
  const baseStats = weekdayStats(base);
  const baseDia = (dia: number) => baseStats.find((d) => d.dia === dia);
  // Quantas vezes cada dia da semana aparece no período.
  const ocorr = data.dias_semana.filter((d) => d.ocorrencias > 0);
  if (ocorr.some((d) => !baseDia(d.dia_semana)?.ocorrencias)) return null;

  const normalRevenue =
    ocorr.reduce(
      (s, d) => s + d.ocorrencias * baseDia(d.dia_semana)!.mediaFaturamento,
      0,
    ) / dias;
  const normalOrders =
    ocorr.reduce(
      (s, d) => s + d.ocorrencias * baseDia(d.dia_semana)!.mediaPedidos,
      0,
    ) / dias;
  const revenue = data.resumo.faturamento / dias;
  const orders = data.resumo.pedidos / dias;
  const ticket = orders ? revenue / orders : 0;
  const normalTicket = normalOrders ? normalRevenue / normalOrders : 0;
  const extra = revenue - normalRevenue;
  // Decomposição: efeito de mais pedidos (com o ticket normal) + efeito do
  // ticket (com os pedidos do período). Soma = diferença total.
  const fromOrders = (orders - normalOrders) * normalTicket;
  const fromTicket = (ticket - normalTicket) * orders;

  // Produtos: mix de um dia médio das 8 semanas, escalado para o nível
  // normal desses dias da semana (estimativa).
  const baseDays = base.periodo.dias || 1;
  const baseAvg = base.resumo.faturamento / baseDays;
  const escala = baseAvg ? normalRevenue / baseAvg : 1;
  const normalProd = new Map(
    baseProd.produtos.map((p) => [
      p.codigo,
      {
        rev: (p.faturamento / baseDays) * escala,
        qtd: (p.qtd / baseDays) * escala,
      },
    ]),
  );
  const linhas = new Map<
    string,
    {
      name: string;
      category: string;
      unit: string;
      rev: number;
      qtd: number;
      nRev: number;
      nQtd: number;
    }
  >();
  for (const p of baseProd.produtos)
    linhas.set(p.codigo, {
      name: p.produto,
      category: categoriaDe(p.produto, p.codigo),
      unit: p.unidade,
      rev: 0,
      qtd: 0,
      nRev: normalProd.get(p.codigo)!.rev,
      nQtd: normalProd.get(p.codigo)!.qtd,
    });
  for (const p of prod.produtos) {
    const l = linhas.get(p.codigo) ?? {
      name: p.produto,
      category: categoriaDe(p.produto, p.codigo),
      unit: p.unidade,
      rev: 0,
      qtd: 0,
      nRev: 0,
      nQtd: 0,
    };
    l.rev = p.faturamento / dias;
    l.qtd = p.qtd / dias;
    linhas.set(p.codigo, l);
  }
  const todos = [...linhas.values()].map((l) => ({
    ...l,
    diff: l.rev - l.nRev,
  }));
  const porCategoria = new Map<string, { rev: number; nRev: number }>();
  for (const l of todos) {
    const c = porCategoria.get(l.category) ?? { rev: 0, nRev: 0 };
    c.rev += l.rev;
    c.nRev += l.nRev;
    porCategoria.set(l.category, c);
  }
  const sinal = extra >= 0 ? -1 : 1; // ordena pelo que mais empurrou na direção da diferença

  // Horários: mesmo dia da semana, hora a hora.
  const horas = new Map<number, { rev: number; nRev: number }>();
  for (const r of data.semana_hora) {
    const h = horas.get(r.hora) ?? { rev: 0, nRev: 0 };
    h.rev += r.faturamento / dias;
    horas.set(r.hora, h);
  }
  for (const d of ocorr)
    for (const r of base.semana_hora.filter(
      (x) => x.dia_semana === d.dia_semana,
    )) {
      const occ = baseDia(d.dia_semana)!.ocorrencias;
      const h = horas.get(r.hora) ?? { rev: 0, nRev: 0 };
      h.nRev += ((r.faturamento / occ) * d.ocorrencias) / dias;
      horas.set(r.hora, h);
    }

  const pct = (a: number, b: number) => (b ? round(((a - b) / b) * 100) : null);
  return {
    description:
      "Per-day figures of the period vs a NORMAL day = average of the same weekday(s) in the 8 weeks before. Use this to explain WHY the period sold more or less. extraRevenue = period minus normal. Product/category normal values are estimates (typical product mix scaled to the weekday level).",
    revenuePerDay: round(revenue),
    normalRevenuePerDay: round(normalRevenue),
    extraRevenuePerDay: round(extra),
    ordersPerDay: round(orders),
    normalOrdersPerDay: round(normalOrders),
    ordersDiffPct: pct(orders, normalOrders),
    averageTicket: round(ticket),
    normalAverageTicket: round(normalTicket),
    ticketDiffPct: pct(ticket, normalTicket),
    // quanto da diferença veio de mais/menos pedidos e quanto do ticket
    extraFromOrderCount: round(fromOrders),
    extraFromTicket: round(fromTicket),
    categories: [...porCategoria.entries()]
      .map(([category, c]) => ({
        category,
        revenuePerDay: round(c.rev),
        normalRevenuePerDay: round(c.nRev),
        extraRevenue: round(c.rev - c.nRev),
        diffPct: pct(c.rev, c.nRev),
      }))
      .sort((a, b) => sinal * (a.extraRevenue - b.extraRevenue))
      .slice(0, 6),
    products: todos
      .sort((a, b) => sinal * (a.diff - b.diff))
      .slice(0, 8)
      .map((l) => ({
        name: l.name,
        category: l.category,
        unit: l.unit,
        quantityPerDay: round(l.qtd),
        normalQuantityPerDay: round(l.nQtd),
        revenuePerDay: round(l.rev),
        normalRevenuePerDay: round(l.nRev),
        extraRevenue: round(l.diff),
      })),
    hours: [...horas.entries()]
      .map(([hora, h]) => ({
        hour: `${hora}h-${hora + 1}h`,
        revenuePerDay: round(h.rev),
        normalRevenuePerDay: round(h.nRev),
        extraRevenue: round(h.rev - h.nRev),
      }))
      .sort((a, b) => sinal * (a.extraRevenue - b.extraRevenue))
      .slice(0, 4),
  };
}

const isoWd = (date: string) =>
  ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * Cada dia do período contra a faixa normal do mesmo dia da semana (8
 * semanas antes). A margem de 5% evita chamar de "acima" um dia que só
 * encostou no teto.
 */
function diasVsNormal(data: PainelVendas, base: PainelVendas) {
  const stats = weekdayStats(base);
  const days = data.serie.map((row) => {
    const wd = isoWd(row.data);
    const media = stats.find((d) => d.dia === wd);
    const faixa = faixaNormal(base, wd) as {
      revenueMin?: number;
      revenueMax?: number;
    };
    const normal = media?.ocorrencias ? media.mediaFaturamento : null;
    const min = faixa.revenueMin ?? null;
    const max = faixa.revenueMax ?? null;
    const status =
      max === null || min === null
        ? "sem base"
        : row.faturamento > max * 1.05
          ? "acima do normal"
          : row.faturamento > max
            ? "no limite do normal (até 5% acima do maior dia normal)"
            : row.faturamento >= min * 0.95
              ? "normal"
              : "abaixo do normal";
    return {
      date: row.data,
      weekday: weekdayLong[wd - 1],
      calendarEvent: dataComemorativa(row.data) ?? null,
      revenue: round(row.faturamento),
      orders: row.pedidos,
      normalRevenue: normal === null ? null : round(normal),
      diffVsNormalPct: normal
        ? round(((row.faturamento - normal) / normal) * 100)
        : null,
      normalRange: min === null ? null : { min, max },
      status,
    };
  });
  return { days };
}

/** Horas de um dia contra a média do mesmo dia da semana na base. */
function horasVsNormal(dia: PainelVendas, base: PainelVendas, date: string) {
  const wd = isoWd(date);
  const occ =
    base.dias_semana.find((d) => d.dia_semana === wd)?.ocorrencias ?? 0;
  const horas = new Map<
    number,
    { rev: number; orders: number; nRev: number }
  >();
  for (const h of dia.semana_hora)
    horas.set(h.hora, { rev: h.faturamento, orders: h.pedidos, nRev: 0 });
  if (occ)
    for (const h of base.semana_hora.filter((x) => x.dia_semana === wd)) {
      const cur = horas.get(h.hora) ?? { rev: 0, orders: 0, nRev: 0 };
      cur.nRev = h.faturamento / occ;
      horas.set(h.hora, cur);
    }
  const lista = [...horas.entries()].map(([hora, h]) => ({
    hour: `${hora}h-${hora + 1}h`,
    hora,
    revenue: round(h.rev),
    orders: h.orders,
    normalRevenue: round(h.nRev),
    extraRevenue: round(h.rev - h.nRev),
  }));
  const comVenda = lista.filter((h) => h.revenue >= 50).map((h) => h.hora);
  return {
    peakRevenueHour:
      [...lista].sort((a, b) => b.revenue - a.revenue)[0]?.hour ?? null,
    topExtraHours: [...lista]
      .sort((a, b) => b.extraRevenue - a.extraRevenue)
      .slice(0, 4)
      .map((h) => ({
        hour: h.hour,
        revenue: h.revenue,
        orders: h.orders,
        normalRevenue: h.normalRevenue,
        extraRevenue: h.extraRevenue,
      })),
    // movimento real termina aqui (horas depois quase sem venda)
    lastHourWithRealSales: comVenda.length
      ? `${Math.max(...comVenda)}h-${Math.max(...comVenda) + 1}h`
      : null,
  };
}

export const chatPeriods = [
  "hoje",
  "ontem",
  "7d",
  "30d",
  "mes",
  "mes-anterior",
  "ano",
  "personalizado",
] as const satisfies readonly FixedPreset[];

/**
 * Converte o período pedido pela IA nas mesmas datas dos filtros da tela,
 * para os números do chat baterem com a visão geral.
 */
export function resolveChatPeriod(
  period: FixedPreset,
  startDate?: string,
  endDate?: string,
  today = todayInStore(),
): { start: string; end: string; label: string } | { error: string } {
  if (period !== "personalizado") {
    const range = presetRange(period, today);
    return { start: range.ini, end: range.fim, label: presetLabels[period] };
  }
  if (!startDate || !endDate)
    return {
      error:
        "Para período personalizado, informe startDate e endDate (AAAA-MM-DD).",
    };
  return { start: startDate, end: endDate, label: "Personalizado" };
}

export async function realSalesReport(
  startDate: string,
  endDate: string,
  situacao: Situacao = "todas",
  periodLabel = "Personalizado",
  hourlyFor?: ChatWeekday,
) {
  const today = todayInStore();
  // Período no futuro: não há vendas. Diz ao modelo qual período consultar
  // (o mesmo do ano anterior) em vez de deixá-lo sem dados.
  if (isIsoDate(startDate) && isIsoDate(endDate) && startDate > today) {
    const ano = (d: string) =>
      `${Number(d.slice(0, 4)) - 1}${d.slice(4) === "-02-29" ? "-02-28" : d.slice(4)}`;
    return {
      error: `Não há vendas de ${startDate} a ${endDate}: esse período ainda não aconteceu (hoje é ${today}). Para planejar, consulte o mesmo período do ano anterior: chame getRealSales de novo com period personalizado, startDate ${ano(startDate)} e endDate ${ano(endDate)}. Nunca estime nem invente números.`,
    };
  }
  if (isIsoDate(startDate) && isIsoDate(endDate) && endDate > today) {
    return {
      error: `O período termina no futuro (hoje é ${today}). Chame getRealSales de novo com endDate ${today} ou com o mesmo período do ano anterior. Nunca estime nem invente números.`,
    };
  }
  if (
    !isIsoDate(startDate) ||
    !isIsoDate(endDate) ||
    startDate > endDate ||
    endDate > today ||
    daysBetween(startDate, endDate) > 800
  )
    return {
      error: `Período inválido. Use datas AAAA-MM-DD até hoje (${today}), com no máximo 800 dias.`,
    };
  const includesToday = endDate === today;
  // Médias por dia da semana/hora só com dias completos: o dia de hoje ainda
  // está em andamento e puxaria as médias para baixo.
  const statsEnd =
    includesToday && startDate < endDate ? shiftDate(today, -1) : endDate;
  // Período curto (até 7 dias): as médias do próprio período são o próprio
  // dia. A base de comparação são as 8 semanas anteriores.
  const days = daysBetween(startDate, endDate) + 1;
  const baseStart = shiftDate(startDate, -56);
  const baseEnd = shiftDate(startDate, -1);
  // Mesmo período no ano anterior, de duas formas: alinhado pelo dia da
  // semana (364 dias antes) e pelas mesmas datas (bom para feriados fixos).
  const lyWeekday = {
    start: shiftDate(startDate, -364),
    end: shiftDate(endDate, -364),
  };
  const lyDates = {
    start: sameDateLastYear(startDate),
    end: sameDateLastYear(endDate),
  };
  // Fatores do dia: só para períodos curtos já fechados (hoje está parcial).
  // Até 14 dias cobre as festas mais longas (ex.: padroeira, 10 dias).
  const curto = days <= 14;
  const comFatores = curto && !includesToday;
  const [
    data,
    categoriaDe,
    statsData,
    baseData,
    lyWeekdayData,
    lyDatesData,
    prodData,
    baseProdData,
  ] = await Promise.all([
    painelVendas(startDate, endDate, situacao),
    resolverCategorias(),
    statsEnd === endDate ? null : painelVendas(startDate, statsEnd, situacao),
    curto ? painelVendas(baseStart, baseEnd, situacao) : null,
    curto ? painelVendas(lyWeekday.start, lyWeekday.end, situacao) : null,
    curto ? painelVendas(lyDates.start, lyDates.end, situacao) : null,
    comFatores ? painelProdutos(startDate, endDate, situacao) : null,
    comFatores ? painelProdutos(baseStart, baseEnd, situacao) : null,
  ]);
  const drivers =
    baseData && prodData && baseProdData
      ? driversVsNormal(data, baseData, prodData, baseProdData, categoriaDe)
      : null;
  // Vários dias: classifica cada dia contra a faixa normal e detalha as
  // horas do dia mais forte (é ele que pede reforço de equipe).
  const dias =
    comFatores && baseData && data.serie.length > 1
      ? diasVsNormal(data, baseData)
      : null;
  const maisForte = dias?.days[0]
    ? [...dias.days].sort((a, b) => b.revenue - a.revenue)[0]
    : null;
  const [diaForte, prodForte] =
    maisForte && baseData
      ? await Promise.all([
          painelVendas(maisForte.date, maisForte.date, situacao),
          painelProdutos(maisForte.date, maisForte.date, situacao),
        ])
      : [null, null];
  const horasMaisForte =
    diaForte && baseData
      ? horasVsNormal(diaForte, baseData, maisForte!.date)
      : null;
  // Produtos do dia mais forte em quantidade, contra um dia normal desse
  // dia da semana (mix das 8 semanas escalado ao nível do dia da semana).
  const produtosMaisForte =
    prodForte && baseData && baseProdData && maisForte?.normalRevenue
      ? (() => {
          const baseDias = baseData.periodo.dias || 1;
          const mediaBase = baseData.resumo.faturamento / baseDias;
          const escala = mediaBase ? maisForte.normalRevenue! / mediaBase : 1;
          const normal = new Map(
            baseProdData.produtos.map((p) => [p.codigo, p]),
          );
          return prodForte.produtos
            .map((p) => {
              const b = normal.get(p.codigo);
              const nQtd = b ? (b.qtd / baseDias) * escala : 0;
              const nRev = b ? (b.faturamento / baseDias) * escala : 0;
              return {
                name: p.produto,
                category: categoriaDe(p.produto, p.codigo),
                unit: p.unidade,
                quantity: round(p.qtd),
                normalQuantity: round(nQtd),
                revenue: round(p.faturamento),
                extraRevenue: round(p.faturamento - nRev),
                // Quantidade redonda e muito acima do normal em item vendido
                // por unidade: cara de encomenda (hipótese, não fato).
                possibleBulkOrder:
                  p.unidade.toUpperCase() === "UN" &&
                  p.qtd >= 50 &&
                  p.qtd % 10 === 0 &&
                  p.qtd >= 4 * Math.max(nQtd, 1),
              };
            })
            .sort((a, b) => b.extraRevenue - a.extraRevenue)
            .slice(0, 8);
        })()
      : null;
  const stats = statsData ?? data;
  const { resumo, anterior } = data;
  const peaks = hourGrid(stats)
    .linhas.flatMap((linha) =>
      linha.celulas.map((celula) => ({
        weekday: weekdayLong[linha.dia - 1],
        hour: `${celula.hora}h-${celula.hora + 1}h`,
        averageOrders: round(celula.pedidos),
      })),
    )
    .sort((a, b) => b.averageOrders - a.averageOrders)
    .slice(0, 5);
  return {
    source: "point-of-sale data of the business (demo)",
    period: {
      label: periodLabel,
      start: startDate,
      end: endDate,
      days: data.periodo.dias,
    },
    includesToday,
    statusFilter: situacao,
    availableData: data.base,
    importedAt: data.atualizado_em,
    totals: {
      revenue: round(resumo.faturamento),
      orders: resumo.pedidos,
      averageTicket: round(resumo.ticket_medio),
      itemsPerOrder: resumo.pedidos ? round(resumo.itens / resumo.pedidos) : 0,
      // ticket = itens por pedido × preço médio por item
      averageItemPrice: resumo.itens
        ? round(resumo.faturamento / resumo.itens)
        : 0,
      daysWithSales: resumo.dias_com_venda,
    },
    previousPeriod: {
      start: data.periodo.ant_ini,
      end: data.periodo.ant_fim,
      // período que inclui hoje: o último dia da comparação vai só até este horário
      lastDayUntil: data.periodo.ant_corte ?? null,
      revenue: round(anterior.faturamento),
      orders: anterior.pedidos,
      averageTicket: round(anterior.ticket_medio),
    },
    orderStatus: data.situacoes,
    topProductsByRevenue: data.produtos.slice(0, 15).map((item) => ({
      name: item.produto,
      category: categoriaDe(item.produto, item.codigo),
      unit: item.unidade,
      quantity: round(item.qtd),
      revenue: round(item.faturamento),
      timesSold: item.vendas,
      shareOfRevenuePct: resumo.faturamento
        ? round((item.faturamento / resumo.faturamento) * 100)
        : 0,
    })),
    distinctProductsSold: data.produtos_distintos,
    // complete = detalhe diário; monthly/partial/dayTop15 = anos guardados só em resumo
    productsCoverage:
      data.produtos_cobertura === "mensal"
        ? "monthly"
        : data.produtos_cobertura === "parcial"
          ? "partial"
          : data.produtos_cobertura === "top_dia"
            ? "dayTop15"
            : "complete",
    paymentMethods: data.pagamentos.map((row) => ({
      method: row.forma,
      orders: row.pedidos,
      revenue: round(row.faturamento),
      averageTicket: row.pedidos ? round(row.faturamento / row.pedidos) : 0,
    })),
    // Tudo abaixo (médias por dia, dias da semana, horários) usa só dias completos.
    averagesPeriod: {
      start: startDate,
      end: statsEnd,
      excludesTodayPartialDay: statsEnd !== endDate,
    },
    dailyAverages: {
      allDays: dailyAverages(stats, [1, 2, 3, 4, 5, 6, 7]),
      mondayToFriday: dailyAverages(stats, [1, 2, 3, 4, 5]),
      saturday: dailyAverages(stats, [6]),
      sunday: dailyAverages(stats, [7]),
    },
    weekdays: weekdayStats(stats).map((day) => ({
      weekday: weekdayLong[day.dia - 1],
      occurrences: day.ocorrencias,
      averageRevenuePerDay: round(day.mediaFaturamento),
      averageOrdersPerDay: round(day.mediaPedidos),
      averageTicket: round(day.ticket),
    })),
    busiestHours: peaks,
    // Feriados e datas comemorativas no período (explicam picos e quedas).
    calendarEvents: datasNoPeriodo(startDate, endDate),
    ...(baseData
      ? {
          baseline: {
            description:
              "The 8 weeks right before the period: use it to judge whether these days were above or below normal",
            start: baseStart,
            end: baseEnd,
            daily: dailyAverages(baseData, [1, 2, 3, 4, 5, 6, 7]),
            sameWeekdays: weekdayStats(baseData)
              .filter((day) => day.ocorrencias > 0)
              .map((day) => ({
                weekday: weekdayLong[day.dia - 1],
                occurrences: day.ocorrencias,
                averageRevenuePerDay: round(day.mediaFaturamento),
                averageOrdersPerDay: round(day.mediaPedidos),
                averageTicket: round(day.ticket),
                // faixa normal: dias desse dia da semana nas 8 semanas (com venda)
                ...faixaNormal(baseData, day.dia),
              })),
          },
          lastYear: {
            sameWeekday: resumoAnoAnterior(lyWeekdayData, lyWeekday),
            sameDates: resumoAnoAnterior(lyDatesData, lyDates),
          },
        }
      : {}),
    ...(drivers ? { drivers } : {}),
    ...(dias && maisForte
      ? {
          days: dias.days,
          strongestDay: {
            ...maisForte,
            note: "The day that sold the most in the period: lead with it (date, weekday, calendar event, % vs a normal day).",
            hours: horasMaisForte,
            // quantidades vendidas nesse dia: base para sugerir produção
            products: produtosMaisForte,
          },
        }
      : {}),
    // Janelas de pagamento de benefícios no período: hipóteses, não causas.
    paymentWindows: janelasPagamento(startDate, endDate),
    ...(hourlyFor ? { hourly: hourlyBreakdown(stats, hourlyFor) } : {}),
    ticketBands: data.faixas_ticket.map((row) => ({
      band: faixaLabels[row.faixa],
      orders: row.pedidos,
      revenue: round(row.faturamento),
    })),
  };
}

/** Maior período aceito pela análise de cesta (limite da função no banco). */
const CESTA_MAX_DIAS = 120;

/**
 * Pares de produtos comprados juntos no mesmo pedido (análise de cesta), para
 * a ferramenta getBasketPairs do chat. Períodos acima de 120 dias viram os
 * últimos 90 dias do intervalo, como nos insights.
 */
export async function basketPairsReport(
  startDate: string,
  endDate: string,
  situacao: Situacao = "todas",
  periodLabel = "Personalizado",
) {
  const today = todayInStore();
  if (
    !isIsoDate(startDate) ||
    !isIsoDate(endDate) ||
    startDate > endDate ||
    endDate > today
  )
    return {
      error: `Período inválido. Use datas AAAA-MM-DD até hoje (${today}). Nunca estime nem invente números.`,
    };
  const reduced = daysBetween(startDate, endDate) + 1 > CESTA_MAX_DIAS;
  const start = reduced ? shiftDate(endDate, -89) : startDate;
  const [cestas, categoriaDe] = await Promise.all([
    cestasCompras(start, endDate, situacao),
    resolverCategorias(),
  ]);
  const pairs = cestas
    .filter((c) => c.lift > 1)
    .map((c) => ({
      productA: c.a,
      categoryA: categoriaDe(c.a),
      productB: c.b,
      categoryB: categoriaDe(c.b),
      ordersWithBoth: c.pedidos,
      pctOfAllOrders: Math.round(c.suporte * 1000) / 10,
      pctOfBuyersOfA_AlsoTakeB: Math.round(c.conf_a_b * 1000) / 10,
      pctOfBuyersOfB_AlsoTakeA: Math.round(c.conf_b_a * 1000) / 10,
      lift: c.lift,
    }));
  return {
    period: {
      label: reduced ? `${periodLabel} (últimos 90 dias)` : periodLabel,
      startDate: start,
      endDate,
      reducedFromStartDate: reduced ? startDate : undefined,
      includesToday: endDate === today,
    },
    statusFilter: situacao,
    pairs,
    note:
      pairs.length === 0
        ? "Nenhum par apareceu junto em pelo menos 10 pedidos com associação acima do acaso neste período."
        : "Só pares em pelo menos 10 pedidos e com lift >= 1,2 (aparecem juntos mais do que o acaso explicaria). Ordenados por pedidos com os dois.",
  };
}
