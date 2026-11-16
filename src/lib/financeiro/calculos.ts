// Cálculos puros do módulo financeiro (DRE, folha, contas a pagar).
// Datas são strings AAAA-MM-DD / AAAA-MM tratadas em UTC, sem deslocamento de fuso.
import {
  CATEGORIA_FOLHA,
  GRUPOS_DESPESA,
  GRUPOS_FORA_RESULTADO,
  grupoDe,
  type ConfigFinanceiro,
  type FiltroUnidade,
  type Funcionario,
  type Grupo,
  type Lancamento,
  type VendasMes,
} from "./tipos";

// ---------------------------------------------------------------- datas
export const mesDe = (data: string) => data.slice(0, 7);

export function addMeses(mes: string, n: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function diasNoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Mesmo dia em outro mês, limitado ao último dia (31/01 + 1 mês = 28/02). */
export function addMesesData(data: string, n: number) {
  const mes = addMeses(mesDe(data), n);
  const dia = Math.min(Number(data.slice(8, 10)), diasNoMes(mes));
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

export function addDias(data: string, n: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDias(a: string, b: string) {
  return Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000,
  );
}

/**
 * Meses que o financeiro mostra: de janeiro do ano anterior até o mês atual
 * (até 24 meses, dentro do limite de 800 dias das consultas de vendas).
 */
export function mesesHistorico(hoje: string) {
  const atual = mesDe(hoje);
  const out: string[] = [];
  for (
    let m = `${Number(hoje.slice(0, 4)) - 1}-01`;
    m <= atual;
    m = addMeses(m, 1)
  )
    out.push(m);
  return out;
}

export function mesLabel(mes: string, estilo: "curto" | "longo" = "curto") {
  const txt = new Intl.DateTimeFormat("pt-BR", {
    month: estilo === "curto" ? "short" : "long",
    year: estilo === "curto" ? "2-digit" : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mes}-15T12:00:00Z`));
  return txt.replace(".", "").replace(" de ", "/");
}

// ---------------------------------------------------------------- período
/** Período de filtro: um mês (AAAA-MM) ou um ano inteiro (AAAA). */
export const ehAno = (periodo: string) => /^\d{4}$/.test(periodo);

/** A data (AAAA-MM-DD) ou competência (AAAA-MM) cai no período? */
export const noPeriodo = (data: string, periodo: string) =>
  data.startsWith(periodo);

export const periodoLabel = (periodo: string) =>
  ehAno(periodo) ? `${periodo} (ano inteiro)` : mesLabel(periodo, "longo");

// ---------------------------------------------------------------- status
export type StatusConta = "pago" | "atrasado" | "vence-hoje" | "pendente";

export function statusDe(l: Lancamento, hoje: string): StatusConta {
  if (l.pago) return "pago";
  if (l.vencimento < hoje) return "atrasado";
  if (l.vencimento === hoje) return "vence-hoje";
  return "pendente";
}

// ---------------------------------------------------------------- folha
export function custoMensal(f: Funcionario, cfg: ConfigFinanceiro) {
  const semEncargos = f.contrato === "Estágio" || f.contrato === "MEI/PJ";
  const encargos = semEncargos ? 0 : (f.salario * cfg.encargos) / 100;
  return f.salario + encargos + f.vt + f.va;
}

/** O funcionário pesa na folha de um mês se estava contratado em algum dia dele. */
export function ativoNoMes(f: Funcionario, mes: string) {
  const ini = `${mes}-01`;
  const fim = `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
  if (f.admissao > fim) return false;
  if (f.desligamento && f.desligamento < ini) return false;
  return true;
}

export function folhaDoMes(
  funcionarios: Funcionario[],
  mes: string,
  unidade: FiltroUnidade,
  cfg: ConfigFinanceiro,
) {
  return funcionarios
    .filter(
      (f) =>
        (unidade === "Todas" || f.unidade === unidade) && ativoNoMes(f, mes),
    )
    .reduce((s, f) => s + custoMensal(f, cfg), 0);
}

/** "2 anos e 3 meses", "8 meses", "12 dias". */
export function tempoDeCasa(admissao: string, ate: string) {
  const [ya, ma, da] = admissao.split("-").map(Number);
  const [yb, mb, db] = ate.split("-").map(Number);
  let meses = (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0);
  if (meses < 1) {
    const dias = Math.max(0, diffDias(ate, admissao));
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  const anos = Math.floor(meses / 12);
  meses %= 12;
  const pa = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const pm = meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "";
  return [pa, pm].filter(Boolean).join(" e ");
}

/** Contrato de experiência: até 90 dias (45 + 45 prorrogáveis). */
export const fimExperiencia = (admissao: string) => addDias(admissao, 89);

/** Data em que o próximo período aquisitivo de férias se completa. */
export function proximoPeriodoFerias(admissao: string, hoje: string) {
  let n = 1;
  while (addMesesData(admissao, 12 * n) <= hoje) n++;
  return addMesesData(admissao, 12 * n);
}

// ---------------------------------------------------------------- DRE
export type Dre = {
  mes: string;
  vendas: number;
  receitasExtras: number;
  receita: number;
  grupos: Record<Exclude<Grupo, "receita">, number>;
  folha: number;
  despesas: number;
  margemBruta: number;
  resultadoOperacional: number;
  /** Antes das retiradas e gastos pessoais dos sócios. */
  resultadoEmpresa: number;
  /** Resultado do mês, depois dos sócios (sem empréstimos e faturas de cartão). */
  resultado: number;
  /** Sobra de caixa: o resultado menos parcelas de empréstimo e faturas de cartão. */
  caixa: number;
  margem: number;
  /** Faturamento mensal que cobre os custos fixos. */
  pontoEquilibrio: number;
  diasComVenda: number;
};

export function vendasDe(vendas: VendasMes, mes: string) {
  return vendas[mes] ?? { total: 0, dias: [] as number[] };
}

/** Filtro de loja das listas: custos "Geral" aparecem em qualquer loja. */
export const daLoja = (unidade: string, u: FiltroUnidade) =>
  u === "Todas" || unidade === u || unidade === "Geral";

/** Resultado do mês, consolidado das duas lojas (a receita do caixa não separa). */
export function calcularDre(
  mes: string,
  lancamentos: Lancamento[],
  funcionarios: Funcionario[],
  vendas: VendasMes,
  cfg: ConfigFinanceiro,
): Dre {
  const v = vendasDe(vendas, mes);
  const grupos = Object.fromEntries(
    GRUPOS_DESPESA.map((g) => [g, 0]),
  ) as Dre["grupos"];
  let receitasExtras = 0;
  for (const l of lancamentos) {
    if (l.competencia !== mes) continue;
    if (l.tipo === "receita") receitasExtras += l.valor;
    else {
      const g = grupoDe(l.categoria);
      if (g !== "receita") grupos[g] += l.valor;
    }
  }
  // A folha estimada pelo cadastro só entra em mês com contas lançadas e sem a
  // folha lançada nelas: mês vazio fica vazio, em vez de mostrar só a estimativa.
  const doMes = lancamentos.filter(
    (l) => l.competencia === mes && l.tipo === "despesa",
  );
  const folha =
    doMes.length === 0 || doMes.some((l) => l.categoria === CATEGORIA_FOLHA)
      ? 0
      : folhaDoMes(funcionarios, mes, "Todas", cfg);
  grupos.pes += folha;

  const receita = v.total + receitasExtras;
  const variaveis = grupos.imp + grupos.cmv + grupos.fin;
  const fixos = grupos.pes + grupos.ocu + grupos.srv;
  const margemBruta = receita - grupos.imp - grupos.cmv;
  const resultadoOperacional = margemBruta - fixos - grupos.fin;
  const resultadoEmpresa = resultadoOperacional - grupos.inv;
  const resultado = resultadoEmpresa - grupos.soc;
  const despesas = GRUPOS_DESPESA.filter(
    (g) => !GRUPOS_FORA_RESULTADO.includes(g),
  ).reduce((s, g) => s + grupos[g], 0);
  const contribuicao = receita ? 1 - variaveis / receita : 0;

  return {
    mes,
    vendas: v.total,
    receitasExtras,
    receita,
    grupos,
    folha,
    despesas,
    margemBruta,
    resultadoOperacional,
    resultadoEmpresa,
    resultado,
    caixa: resultado - grupos.cx,
    margem: receita ? (resultado / receita) * 100 : 0,
    pontoEquilibrio: contribuicao > 0 ? fixos / contribuicao : 0,
    diasComVenda: v.dias.filter((d) => d > 0).length,
  };
}

// ---------------------------------------------------------------- categorias
/** Nome usado para a folha estimada pelo cadastro (quando não foi lançada). */
export const CATEGORIA_FOLHA_ESTIMADA = "Folha estimada (cadastro)";

/**
 * Despesas do mês por categoria, pela competência, com os mesmos critérios da
 * DRE: sem empréstimos e faturas de cartão (só mexem no caixa) e com a folha
 * estimada do mês (Dre.folha) quando ela entra no resultado. A soma bate com
 * Dre.despesas.
 */
export function despesasPorCategoria(
  mes: string,
  lancamentos: Lancamento[],
  folhaEstimada: number,
): Map<string, { grupo: Grupo; valor: number }> {
  const out = new Map<string, { grupo: Grupo; valor: number }>();
  for (const l of lancamentos) {
    if (l.competencia !== mes || l.tipo !== "despesa") continue;
    const grupo = grupoDe(l.categoria);
    if (grupo === "receita" || GRUPOS_FORA_RESULTADO.includes(grupo)) continue;
    const atual = out.get(l.categoria);
    out.set(l.categoria, { grupo, valor: (atual?.valor ?? 0) + l.valor });
  }
  if (folhaEstimada > 0)
    out.set(CATEGORIA_FOLHA_ESTIMADA, { grupo: "pes", valor: folhaEstimada });
  return out;
}

// ---------------------------------------------------------------- recorrência
export type Repeticao =
  | { tipo: "unica" }
  | { tipo: "mensal"; meses: number }
  | { tipo: "parcelada"; parcelas: number };

/** Expande um lançamento do formulário em um ou vários (recorrente/parcelado). */
export function expandirLancamento(
  base: Omit<Lancamento, "id">,
  repeticao: Repeticao,
  novoId: () => string,
): Lancamento[] {
  if (repeticao.tipo === "unica") return [{ ...base, id: novoId() }];
  const n = repeticao.tipo === "mensal" ? repeticao.meses : repeticao.parcelas;
  const total = Math.round(base.valor * 100);
  return Array.from({ length: n }, (_, i) => {
    let valor = base.valor;
    let descricao = base.descricao;
    if (repeticao.tipo === "parcelada") {
      // Distribui os centavos para a soma bater com o total.
      const cent = Math.floor(total / n) + (i < total % n ? 1 : 0);
      valor = cent / 100;
      descricao = `${base.descricao} (${i + 1}/${n})`;
    }
    return {
      ...base,
      id: novoId(),
      valor,
      descricao,
      recorrente: repeticao.tipo === "mensal",
      competencia: addMeses(base.competencia, i),
      vencimento: addMesesData(base.vencimento, i),
      pago: i === 0 ? base.pago : false,
      dataPagamento: i === 0 ? base.dataPagamento : null,
    };
  });
}
