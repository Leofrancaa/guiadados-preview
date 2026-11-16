// Preparação para datas especiais: mostra como a loja vendeu na mesma data do
// ano anterior (dias, produtos e horários) para planejar produção e equipe.
// Cálculos puros sobre painel_vendas / painel_produtos (navegador e servidor).
import { pascoa } from "./datas-comemorativas";
import { dataComemorativa } from "./datas-comemorativas";
import {
  daysBetween,
  shiftDate,
  weekdayLong,
  weekdayStats,
  type PainelProdutos,
  type PainelVendas,
} from "./vendas";

type Janela = { ini: string; fim: string; principal: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** n-ésimo domingo de um mês. */
function domingo(year: number, month: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
  return iso(year, month, 1 + ((7 - first) % 7) + (n - 1) * 7);
}

/**
 * Ocasiões que mexem com o comércio. A janela inclui os dias de compra antes
 * da data; "principal" é o dia que costuma vender mais (em geral a véspera).
 * O ano é o do início da janela.
 */
export const OCASIOES: {
  id: string;
  nome: string;
  janela: (ano: number) => Janela;
}[] = [
  {
    id: "carnaval",
    nome: "Carnaval",
    janela: (a) => {
      const p = pascoa(a);
      return {
        ini: shiftDate(p, -50),
        fim: shiftDate(p, -46),
        principal: shiftDate(p, -50),
      };
    },
  },
  {
    id: "pascoa",
    nome: "Páscoa",
    janela: (a) => {
      const p = pascoa(a);
      return { ini: shiftDate(p, -3), fim: p, principal: shiftDate(p, -1) };
    },
  },
  {
    id: "maes",
    nome: "Dia das Mães",
    janela: (a) => {
      const d = domingo(a, 5, 2);
      return { ini: shiftDate(d, -2), fim: d, principal: shiftDate(d, -1) };
    },
  },
  {
    id: "sao-joao",
    nome: "São João",
    janela: (a) => ({
      ini: iso(a, 6, 20),
      fim: iso(a, 6, 24),
      principal: iso(a, 6, 23),
    }),
  },
  {
    id: "pais",
    nome: "Dia dos Pais",
    janela: (a) => {
      const d = domingo(a, 8, 2);
      return { ini: shiftDate(d, -2), fim: d, principal: shiftDate(d, -1) };
    },
  },
  {
    id: "criancas",
    nome: "Dia das Crianças",
    janela: (a) => ({
      ini: iso(a, 10, 9),
      fim: iso(a, 10, 12),
      principal: iso(a, 10, 11),
    }),
  },
  {
    id: "black-friday",
    nome: "Black Friday",
    janela: (a) => {
      const quinta = (() => {
        const first = new Date(Date.UTC(a, 10, 1, 12)).getUTCDay();
        return iso(a, 11, 1 + ((4 - first + 7) % 7) + 21);
      })();
      const sexta = shiftDate(quinta, 1);
      return {
        ini: shiftDate(sexta, -1),
        fim: shiftDate(sexta, 2),
        principal: sexta,
      };
    },
  },
  {
    id: "natal",
    nome: "Natal",
    janela: (a) => ({
      ini: iso(a, 12, 20),
      fim: iso(a, 12, 25),
      principal: iso(a, 12, 24),
    }),
  },
  {
    id: "ano-novo",
    nome: "Ano Novo",
    janela: (a) => ({
      ini: iso(a, 12, 28),
      fim: iso(a + 1, 1, 1),
      principal: iso(a, 12, 31),
    }),
  },
];

export type ProximaOcasiao = {
  id: string;
  nome: string;
  ano: number;
  ini: string;
  fim: string;
  principal: string;
  /** Dias até o início da janela (0 = já começou). */
  diasAte: number;
  emAndamento: boolean;
};

/** As próximas ocasiões a partir de hoje (inclui a que está em andamento). */
export function proximasOcasioes(today: string, limite = 5): ProximaOcasiao[] {
  const ano = Number(today.slice(0, 4));
  const lista: ProximaOcasiao[] = [];
  for (const a of [ano - 1, ano, ano + 1])
    for (const o of OCASIOES) {
      const j = o.janela(a);
      if (j.fim < today) continue;
      lista.push({
        id: o.id,
        nome: o.nome,
        ano: a,
        ...j,
        diasAte: Math.max(0, daysBetween(today, j.ini) - 1),
        emAndamento: j.ini <= today,
      });
    }
  return lista.sort((a, b) => a.ini.localeCompare(b.ini)).slice(0, limite);
}

const isoWeekday = (date: string) =>
  ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = segunda

export type DiaOcasiao = {
  data: string;
  diaSemana: string;
  evento?: string;
  faturamento: number;
  pedidos: number;
  ticket: number;
  /** Média do mesmo dia da semana nas 8 semanas antes (null sem base). */
  normal: number | null;
  diffPct: number | null;
};

export type ProdutoOcasiao = {
  codigo: string;
  produto: string;
  unidade: string;
  /** Total vendido na janela inteira. */
  qtd: number;
  /** Vendido só no dia mais forte. */
  qtdPico: number;
  /** Quanto sai num dia normal (estimativa pelas 8 semanas antes). */
  qtdNormalDia: number;
  faturamento: number;
  /** Faturamento acima do normal na janela. */
  extra: number;
  /** Quantas vezes um dia normal (por dia, na janela); null se não sai normalmente. */
  multiplo: number | null;
  /** Praticamente só vende nessa época. */
  sazonal: boolean;
};

export type Preparacao = {
  ocasiao: { id: string; nome: string };
  proxima: ProximaOcasiao;
  anterior: Janela & { ano: number };
  semDados: boolean;
  /** "complete" ou a cobertura dos produtos (anos guardados só em resumo). */
  cobertura: string;
  dias: DiaOcasiao[];
  totais: {
    faturamento: number;
    pedidos: number;
    ticket: number;
    normal: number | null;
    diffPct: number | null;
  };
  /** Dia que mais vendeu na janela do ano anterior (analisado em detalhe). */
  pico: DiaOcasiao | null;
  /** O mesmo dia da janela neste ano. */
  picoEsteAno: string | null;
  produtos: ProdutoOcasiao[];
  horas: {
    hora: number;
    faturamento: number;
    pedidos: number;
    normal: number;
  }[];
};

const pct = (a: number, b: number | null) =>
  b && b > 0 ? ((a - b) / b) * 100 : null;

export function calcPreparacao(input: {
  proxima: ProximaOcasiao;
  janela: PainelVendas;
  base: PainelVendas;
  prodJanela: PainelProdutos;
  prodBase: PainelProdutos;
  /** Dia mais forte da janela do ano anterior e os dados dele. */
  pico: string | null;
  dia: PainelVendas | null;
  prodDia: PainelProdutos | null;
}): Preparacao {
  const { proxima, janela, base, prodJanela, prodBase, pico, dia, prodDia } =
    input;
  const ocasiao = OCASIOES.find((o) => o.id === proxima.id)!;
  const anterior = { ...ocasiao.janela(proxima.ano - 1), ano: proxima.ano - 1 };

  const baseStats = weekdayStats(base);
  const normalDe = (date: string) => {
    const s = baseStats.find((d) => d.dia === isoWeekday(date));
    return s && s.ocorrencias > 0 ? s.mediaFaturamento : null;
  };
  const porDia = new Map(janela.serie.map((s) => [s.data, s]));
  const dias: DiaOcasiao[] = [];
  for (let d = anterior.ini; d <= anterior.fim; d = shiftDate(d, 1)) {
    const s = porDia.get(d);
    const fat = s?.faturamento ?? 0;
    const ped = s?.pedidos ?? 0;
    const normal = normalDe(d);
    dias.push({
      data: d,
      diaSemana: weekdayLong[isoWeekday(d) - 1],
      evento: dataComemorativa(d),
      faturamento: fat,
      pedidos: ped,
      ticket: ped ? fat / ped : 0,
      normal,
      diffPct: fat ? pct(fat, normal) : null,
    });
  }
  const semDados = janela.resumo.pedidos === 0;
  const temNormal = dias.every((d) => d.normal !== null);
  const normalTotal = temNormal
    ? dias.reduce((s, d) => s + (d.normal ?? 0), 0)
    : null;
  const r = janela.resumo;

  // Produtos: mix de um dia médio das 8 semanas antes, escalado para o nível
  // normal dos dias da semana da janela (estimativa).
  const nDias = dias.length;
  const baseDias = base.periodo.dias || 1;
  const baseMedia = base.resumo.faturamento / baseDias;
  const escala = normalTotal && baseMedia ? normalTotal / nDias / baseMedia : 1;
  const baseProd = new Map(prodBase.produtos.map((p) => [p.codigo, p]));
  const doDia = new Map((prodDia?.produtos ?? []).map((p) => [p.codigo, p]));
  const produtos = prodJanela.produtos
    .map((p): ProdutoOcasiao => {
      const b = baseProd.get(p.codigo);
      const qtdNormalDia = b ? (b.qtd / baseDias) * escala : 0;
      const fatNormalDia = b ? (b.faturamento / baseDias) * escala : 0;
      const porDiaQtd = p.qtd / nDias;
      return {
        codigo: p.codigo,
        produto: p.produto,
        unidade: p.unidade,
        qtd: p.qtd,
        qtdPico: doDia.get(p.codigo)?.qtd ?? 0,
        qtdNormalDia,
        faturamento: p.faturamento,
        extra: p.faturamento - fatNormalDia * nDias,
        multiplo: qtdNormalDia > 0 ? porDiaQtd / qtdNormalDia : null,
        sazonal: qtdNormalDia < porDiaQtd * 0.1,
      };
    })
    .filter((p) => p.extra > 0)
    .sort((a, b) => b.extra - a.extra)
    .slice(0, 12);

  // Horas do dia mais forte contra o mesmo dia da semana normal.
  const wd = pico ? isoWeekday(pico) : 0;
  const occ =
    base.dias_semana.find((d) => d.dia_semana === wd)?.ocorrencias ?? 0;
  const horasMap = new Map<
    number,
    { faturamento: number; pedidos: number; normal: number }
  >();
  for (const h of dia?.semana_hora ?? [])
    horasMap.set(h.hora, {
      faturamento: h.faturamento,
      pedidos: h.pedidos,
      normal: 0,
    });
  if (occ && dia)
    for (const h of base.semana_hora.filter((x) => x.dia_semana === wd)) {
      const cur = horasMap.get(h.hora) ?? {
        faturamento: 0,
        pedidos: 0,
        normal: 0,
      };
      cur.normal = h.faturamento / occ;
      horasMap.set(h.hora, cur);
    }
  const horas = [...horasMap.entries()]
    .map(([hora, v]) => ({ hora, ...v }))
    .filter((h) => h.faturamento > 1 || h.normal > 1)
    .sort((a, b) => a.hora - b.hora);

  return {
    ocasiao: { id: ocasiao.id, nome: ocasiao.nome },
    proxima,
    anterior,
    semDados,
    cobertura: prodJanela.produtos_cobertura ?? "complete",
    dias,
    totais: {
      faturamento: r.faturamento,
      pedidos: r.pedidos,
      ticket: r.pedidos ? r.faturamento / r.pedidos : 0,
      normal: normalTotal,
      diffPct: normalTotal ? pct(r.faturamento, normalTotal) : null,
    },
    pico: dias.find((d) => d.data === pico) ?? null,
    picoEsteAno: pico
      ? shiftDate(proxima.ini, daysBetween(anterior.ini, pico) - 1)
      : null,
    produtos,
    horas,
  };
}

/** Dia que mais faturou dentro da janela (null sem vendas). */
export function diaMaisForte(janela: PainelVendas) {
  const melhor = [...janela.serie].sort(
    (a, b) => b.faturamento - a.faturamento,
  )[0];
  return melhor && melhor.faturamento > 0 ? melhor.data : null;
}
