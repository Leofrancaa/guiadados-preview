// Dados do relatório de contas a pagar enviado à contabilidade (Excel e PDF).
// Puro: sem navegador, para poder testar os totais.
import {
  ehAno,
  mesLabel,
  noPeriodo,
  statusDe,
  type StatusConta,
} from "./calculos";
import {
  CATEGORIAS,
  GRUPOS,
  GRUPOS_DESPESA,
  grupoDe,
  type Grupo,
  type Lancamento,
} from "./tipos";

export const SITUACAO: Record<StatusConta, string> = {
  pago: "Pago",
  atrasado: "Atrasado",
  "vence-hoje": "Vence hoje",
  pendente: "A vencer",
};

export type LinhaRelatorio = {
  n: number;
  competencia: string;
  vencimento: string;
  pagamento: string | null;
  descricao: string;
  categoria: string;
  grupo: string;
  forma: string;
  status: StatusConta;
  situacao: string;
  valor: number;
  obs: string;
};

export type ResumoCategoria = {
  grupo: string;
  categoria: string;
  qtde: number;
  total: number;
  pago: number;
  aberto: number;
};

export type ResumoGrupo = {
  grupo: string;
  total: number;
  pago: number;
  aberto: number;
  categorias: ResumoCategoria[];
};

export type Relatorio = {
  empresa: string;
  /** Período exportado: mês (AAAA-MM) ou ano (AAAA). */
  periodo: string;
  anual: boolean;
  /** "novembro de 2026" ou "ano de 2026". */
  periodoExtenso: string;
  emitidoEm: Date;
  hoje: string;
  linhas: LinhaRelatorio[];
  grupos: ResumoGrupo[];
  /** Totais por dia de vencimento (relatório do mês). */
  dias: { data: string; qtde: number; total: number; pago: number }[];
  /** Totais por mês de competência (relatório do ano). */
  meses: { mes: string; qtde: number; total: number; pago: number }[];
  total: number;
  pago: number;
  aberto: number;
  atrasado: number;
  aClassificar: number;
  arquivo: string;
};

const ordemCategoria = new Map(CATEGORIAS.map((c, i) => [c.nome, i]));
const soma = (xs: { valor: number }[]) =>
  Math.round(xs.reduce((s, x) => s + x.valor, 0) * 100) / 100;

export function montarRelatorio(
  lancamentos: Lancamento[],
  periodo: string,
  hoje: string,
  empresa = "Empresa de demonstração",
): Relatorio {
  const despesas = lancamentos
    .filter((l) => l.tipo === "despesa" && noPeriodo(l.competencia, periodo))
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) ||
        a.descricao.localeCompare(b.descricao, "pt-BR"),
    );

  const linhas: LinhaRelatorio[] = despesas.map((l, i) => {
    const status = statusDe(l, hoje);
    const g = grupoDe(l.categoria) as Grupo;
    return {
      n: i + 1,
      competencia: l.competencia,
      vencimento: l.vencimento,
      pagamento: l.pago ? l.dataPagamento : null,
      descricao: l.descricao,
      categoria: l.categoria,
      grupo: GRUPOS[g].label,
      forma: l.forma,
      status,
      situacao: SITUACAO[status],
      valor: l.valor,
      obs: l.obs,
    };
  });

  const grupos: ResumoGrupo[] = GRUPOS_DESPESA.map((g) => {
    const doGrupo = linhas.filter((l) => l.grupo === GRUPOS[g].label);
    const nomes = [...new Set(doGrupo.map((l) => l.categoria))].sort(
      (a, b) => (ordemCategoria.get(a) ?? 99) - (ordemCategoria.get(b) ?? 99),
    );
    const categorias = nomes.map((categoria) => {
      const ls = doGrupo.filter((l) => l.categoria === categoria);
      const pago = soma(ls.filter((l) => l.status === "pago"));
      const total = soma(ls);
      return {
        grupo: GRUPOS[g].label,
        categoria,
        qtde: ls.length,
        total,
        pago,
        aberto: Math.round((total - pago) * 100) / 100,
      };
    });
    const total = soma(doGrupo);
    const pago = soma(doGrupo.filter((l) => l.status === "pago"));
    return {
      grupo: GRUPOS[g].label,
      total,
      pago,
      aberto: Math.round((total - pago) * 100) / 100,
      categorias,
    };
  }).filter((g) => g.categorias.length);

  const resumir = (de: (l: LinhaRelatorio) => string) =>
    [...new Set(linhas.map(de))].sort().map((chave) => {
      const ls = linhas.filter((l) => de(l) === chave);
      return {
        chave,
        qtde: ls.length,
        total: soma(ls),
        pago: soma(ls.filter((l) => l.status === "pago")),
      };
    });

  const anual = ehAno(periodo);
  const total = soma(linhas);
  const pago = soma(linhas.filter((l) => l.status === "pago"));
  return {
    empresa,
    periodo,
    anual,
    periodoExtenso: anual
      ? `ano de ${periodo}`
      : mesLabel(periodo, "longo").replace("/", " de "),
    emitidoEm: new Date(),
    hoje,
    linhas,
    grupos,
    dias: resumir((l) => l.vencimento).map(({ chave, ...v }) => ({
      data: chave,
      ...v,
    })),
    meses: resumir((l) => l.competencia).map(({ chave, ...v }) => ({
      mes: chave,
      ...v,
    })),
    total,
    pago,
    aberto: Math.round((total - pago) * 100) / 100,
    atrasado: soma(linhas.filter((l) => l.status === "atrasado")),
    aClassificar: linhas.filter((l) => l.categoria === "A classificar").length,
    arquivo: `contas-a-pagar_${empresa.toLowerCase()}_${periodo}`,
  };
}
