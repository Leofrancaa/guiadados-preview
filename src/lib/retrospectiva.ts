// Retrospectiva: recordes de um ano ou mês e os destaques de um dia.
// Cálculos puros sobre o retorno de painel_vendas (navegador e servidor).
import {
  FIRST_YEAR,
  shiftDate,
  todayInStore,
  weekdayLong,
  weekdayStats,
  type PainelVendas,
} from "./vendas";
import { dataComemorativa } from "./datas-comemorativas";

export type DiaResumo = {
  data: string;
  faturamento: number;
  pedidos: number;
  ticket: number;
  /** Feriado ou data comemorativa (ex.: "Véspera de São João"). */
  evento?: string;
};

export type Retrospectiva = {
  periodo: {
    ini: string;
    fim: string;
    tipo: "ano" | "mes";
    /** O dia de hoje (em andamento) ficou de fora dos recordes. */
    excluiHoje: boolean;
  };
  totais: {
    faturamento: number;
    pedidos: number;
    ticket: number;
    diasComVenda: number;
    mediaPorDia: number;
  };
  campeao: DiaResumo | null;
  top5: DiaResumo[];
  recordes: {
    maisPedidos: DiaResumo | null;
    maiorTicket: DiaResumo | null;
    maisFraco: DiaResumo | null;
    melhorSemana: {
      ini: string;
      fim: string;
      faturamento: number;
      pedidos: number;
    } | null;
    melhorMes: {
      mes: string; // AAAA-MM
      faturamento: number;
      pedidos: number;
      parcial: boolean;
    } | null;
  };
};

export type HoraDestaque = {
  hora: number;
  faturamento: number;
  pedidos: number;
};

export type ProdutoDia = {
  codigo: string;
  produto: string;
  unidade: string;
  qtd: number;
  faturamento: number;
};

export type DestaquesDia = {
  dia: DiaResumo & { diaSemana: string };
  mediaPorDia: number;
  vsMediaPct: number | null;
  mediaDiaSemana: number;
  vsDiaSemanaPct: number | null;
  picoReceita: HoraDestaque | null;
  picoPedidos: HoraDestaque | null;
  pagamento: { forma: string; faturamento: number; sharePct: number } | null;
  topProdutos: ProdutoDia[];
  /** Produtos que venderam bem acima da própria média diária no período. */
  foraDoNormal: (ProdutoDia & { mediaQtd: number; vezes: number })[];
};

const round = (value: number) => Math.round(value * 100) / 100;
const pct = (value: number, base: number) =>
  base > 0 ? round(((value - base) / base) * 100) : null;

/** 1 = segunda … 7 = domingo. */
export function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * Período de um ano (mes = null) ou mês. Hoje, em andamento, fica fora dos
 * recordes; se o período for só hoje, ele entra.
 */
export function retroRange(
  ano: number,
  mes: number | null,
  today = todayInStore(),
): {
  ini: string;
  fim: string;
  tipo: "ano" | "mes";
  excluiHoje: boolean;
} | null {
  const year = Number(today.slice(0, 4));
  if (!Number.isInteger(ano) || ano < FIRST_YEAR || ano > year) return null;
  if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12))
    return null;
  const ini = `${ano}-${String(mes ?? 1).padStart(2, "0")}-01`;
  if (ini > today) return null;
  const end = mes === null ? `${ano}-12-31` : lastDayOfMonth(ano, mes);
  let fim = end < today ? end : today;
  const excluiHoje = fim === today && ini < today;
  if (excluiHoje) fim = shiftDate(today, -1);
  return { ini, fim, tipo: mes === null ? "ano" : "mes", excluiHoje };
}

function dia(row: PainelVendas["serie"][number]): DiaResumo {
  return {
    data: row.data,
    faturamento: round(row.faturamento),
    pedidos: row.pedidos,
    ticket: row.pedidos ? round(row.faturamento / row.pedidos) : 0,
    ...(dataComemorativa(row.data)
      ? { evento: dataComemorativa(row.data) }
      : {}),
  };
}

export function calcRetrospectiva(
  data: PainelVendas,
  periodo: Retrospectiva["periodo"],
): Retrospectiva {
  const dias = data.serie.filter((row) => row.faturamento > 0).map(dia);
  const { resumo } = data;
  const diasComVenda = dias.length;
  const mediaPedidos = diasComVenda ? resumo.pedidos / diasComVenda : 0;
  const by = <K extends "faturamento" | "pedidos" | "ticket">(
    key: K,
    pool = dias,
  ) =>
    pool.length
      ? pool.reduce((best, item) => (item[key] > best[key] ? item : best))
      : null;
  const ranking = [...dias].sort((a, b) => b.faturamento - a.faturamento);

  // Ticket: só dias com movimento normal (evita um dia com 3 pedidos grandes).
  const movimentados = dias.filter((d) => d.pedidos >= mediaPedidos * 0.5);

  // Semanas completas (segunda a domingo) dentro do período.
  const semanas = new Map<string, { faturamento: number; pedidos: number }>();
  for (const d of dias) {
    const inicio = shiftDate(d.data, -(isoWeekday(d.data) - 1));
    const item = semanas.get(inicio) ?? { faturamento: 0, pedidos: 0 };
    item.faturamento += d.faturamento;
    item.pedidos += d.pedidos;
    semanas.set(inicio, item);
  }
  let melhorSemana: Retrospectiva["recordes"]["melhorSemana"] = null;
  for (const [ini, item] of semanas) {
    const fim = shiftDate(ini, 6);
    if (ini < periodo.ini || fim > periodo.fim) continue;
    if (!melhorSemana || item.faturamento > melhorSemana.faturamento)
      melhorSemana = {
        ini,
        fim,
        faturamento: round(item.faturamento),
        pedidos: item.pedidos,
      };
  }

  let melhorMes: Retrospectiva["recordes"]["melhorMes"] = null;
  if (periodo.tipo === "ano") {
    const meses = new Map<string, { faturamento: number; pedidos: number }>();
    for (const d of dias) {
      const key = d.data.slice(0, 7);
      const item = meses.get(key) ?? { faturamento: 0, pedidos: 0 };
      item.faturamento += d.faturamento;
      item.pedidos += d.pedidos;
      meses.set(key, item);
    }
    if (meses.size >= 2)
      for (const [mes, item] of meses)
        if (!melhorMes || item.faturamento > melhorMes.faturamento)
          melhorMes = {
            mes,
            faturamento: round(item.faturamento),
            pedidos: item.pedidos,
            parcial:
              periodo.fim.slice(0, 7) === mes &&
              periodo.fim !==
                lastDayOfMonth(Number(mes.slice(0, 4)), Number(mes.slice(5))),
          };
  }

  return {
    periodo,
    totais: {
      faturamento: round(resumo.faturamento),
      pedidos: resumo.pedidos,
      ticket: round(resumo.ticket_medio),
      diasComVenda,
      mediaPorDia: diasComVenda ? round(resumo.faturamento / diasComVenda) : 0,
    },
    campeao: ranking[0] ?? null,
    top5: ranking.slice(0, 5),
    recordes: {
      maisPedidos: by("pedidos"),
      maiorTicket: by("ticket", movimentados),
      maisFraco: ranking.length > 1 ? ranking[ranking.length - 1] : null,
      melhorSemana,
      melhorMes,
    },
  };
}

function horas(data: PainelVendas): HoraDestaque[] {
  const map = new Map<number, HoraDestaque>();
  for (const row of data.semana_hora) {
    const item = map.get(row.hora) ?? {
      hora: row.hora,
      faturamento: 0,
      pedidos: 0,
    };
    item.faturamento += row.faturamento;
    item.pedidos += row.pedidos;
    map.set(row.hora, item);
  }
  return [...map.values()].map((h) => ({
    ...h,
    faturamento: round(h.faturamento),
  }));
}

/** Destaques de um dia, comparado ao período em que ele está. */
export function calcDestaquesDia(
  diaData: PainelVendas,
  periodo: PainelVendas,
): DestaquesDia {
  const data = diaData.periodo.ini;
  const { resumo } = diaData;
  const diasComVenda = Math.max(
    1,
    periodo.serie.filter((row) => row.faturamento > 0).length,
  );
  const mediaPorDia = round(periodo.resumo.faturamento / diasComVenda);
  const semana = weekdayStats(periodo).find((d) => d.dia === isoWeekday(data));
  const mediaDiaSemana = round(semana?.mediaFaturamento ?? 0);

  const lista = horas(diaData);
  const top = <K extends "faturamento" | "pedidos">(key: K) =>
    lista.length
      ? lista.reduce((best, item) => (item[key] > best[key] ? item : best))
      : null;

  const pag = diaData.pagamentos[0];
  const base = new Map(periodo.produtos.map((p) => [p.codigo, p]));
  const foraDoNormal = diaData.produtos
    .slice(0, 40)
    .flatMap((p) => {
      const ref = base.get(p.codigo);
      if (!ref || ref.qtd <= 0) return [];
      const mediaQtd = ref.qtd / diasComVenda;
      const vezes = mediaQtd > 0 ? p.qtd / mediaQtd : 0;
      // Relevante no dia (≥ 0,5% do faturamento) e bem acima do normal.
      if (vezes < 1.8 || p.faturamento < resumo.faturamento * 0.005) return [];
      return [
        {
          codigo: p.codigo,
          produto: p.produto,
          unidade: p.unidade,
          qtd: round(p.qtd),
          faturamento: round(p.faturamento),
          mediaQtd: round(mediaQtd),
          vezes: Math.round(vezes * 10) / 10,
        },
      ];
    })
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, 3);

  return {
    dia: {
      data,
      faturamento: round(resumo.faturamento),
      pedidos: resumo.pedidos,
      ticket: round(resumo.ticket_medio),
      diaSemana: weekdayLong[isoWeekday(data) - 1],
      ...(dataComemorativa(data) ? { evento: dataComemorativa(data) } : {}),
    },
    mediaPorDia,
    vsMediaPct: pct(resumo.faturamento, mediaPorDia),
    mediaDiaSemana,
    vsDiaSemanaPct: pct(resumo.faturamento, mediaDiaSemana),
    picoReceita: top("faturamento"),
    picoPedidos: top("pedidos"),
    pagamento: pag
      ? {
          forma: pag.forma,
          faturamento: round(pag.faturamento),
          sharePct: resumo.faturamento
            ? round((pag.faturamento / resumo.faturamento) * 100)
            : 0,
        }
      : null,
    topProdutos: diaData.produtos.slice(0, 5).map((p) => ({
      codigo: p.codigo,
      produto: p.produto,
      unidade: p.unidade,
      qtd: round(p.qtd),
      faturamento: round(p.faturamento),
    })),
    foraDoNormal,
  };
}
