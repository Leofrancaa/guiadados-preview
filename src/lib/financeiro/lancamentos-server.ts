// Lançamentos do financeiro na DEMONSTRAÇÃO: ficam na memória do servidor,
// começando com contas de exemplo do segmento. Alterações valem só enquanto
// o servidor estiver no ar (e podem não aparecer em outra instância).
import { z } from "zod";
import { segmentoAtual } from "@/lib/demo/segmento-server";
import { todayInStore } from "@/lib/vendas";
import { faturamentoDiario } from "@/lib/vendas-server";
import { calcularDre, mesesHistorico } from "./calculos";
import { gerarDadosExemplo } from "./mock";
import { agruparVendasPorMes } from "./vendas";
import {
  FORMAS_PAGAMENTO,
  UNIDADES,
  grupoDe,
  type Funcionario,
  type Lancamento,
} from "./tipos";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Lançamento vindo do painel. "id" vazio cria um novo. */
export const lancamentoEntrada = z.object({
  id: z.string().regex(/^\d*$/).max(10),
  tipo: z.enum(["despesa", "receita"]),
  descricao: z.string().trim().max(200),
  categoria: z.string().trim().min(1).max(80),
  valor: z.number().finite().min(0).max(20_000_000),
  unidade: z.enum([...UNIDADES, "Geral"]),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  vencimento: data,
  pago: z.boolean(),
  dataPagamento: data.nullable(),
  forma: z.union([z.enum(FORMAS_PAGAMENTO), z.literal("")]),
  fornecedor: z.string().trim().max(120),
  recorrente: z.boolean(),
  obs: z.string().max(500),
});

type Base = {
  hoje: string;
  lancamentos: Lancamento[];
  funcionarios: Funcionario[];
  encargos: number | null;
  seq: number;
};

const bases = new Map<string, Base>();

/** Base do segmento (gerada uma vez por dia, a partir das vendas sintéticas). */
export async function baseDemo(): Promise<Base> {
  const seg = await segmentoAtual();
  const hoje = todayInStore();
  const hit = bases.get(seg.id);
  if (hit && hit.hoje === hoje) return hit;
  const ini = `${mesesHistorico(hoje)[0]}-01`;
  const painel = await faturamentoDiario(ini, hoje, "todas");
  const vendas = agruparVendasPorMes(painel.serie, ini, hoje);
  const dados = gerarDadosExemplo(hoje, vendas, {
    segmento: seg.id,
    ...seg.financeiro,
  });
  ajustarMargem(
    dados.lancamentos,
    dados.funcionarios,
    vendas,
    dados.config,
    hoje,
    seg.financeiro.margem,
    seg.id,
  );
  let seq = 0;
  const base: Base = {
    hoje,
    lancamentos: dados.lancamentos.map((l) => ({ ...l, id: String(++seq) })),
    funcionarios: dados.funcionarios.map((f, i) => ({
      ...f,
      id: String(i + 1),
    })),
    encargos: dados.config.encargos,
    seq: 0,
  };
  base.seq = Math.max(seq, base.funcionarios.length) + 1;
  bases.set(seg.id, base);
  return base;
}

type Dre = Parameters<typeof calcularDre>;

/**
 * Deixa o resultado de cada mês perto de uma margem típica do segmento
 * (custo de mercadoria e extras proporcionais), para o exemplo parecer real.
 */
function ajustarMargem(
  lancamentos: Lancamento[],
  funcionarios: Funcionario[],
  vendas: Dre[3],
  config: Dre[4],
  hoje: string,
  alvo: number,
  semente: string,
) {
  const meses = mesesHistorico(hoje);
  const atual = meses[meses.length - 1];
  const fatores: number[] = [];
  const extras: Lancamento[] = [];
  const extra = (
    mes: string,
    dia: string,
    descricao: string,
    categoria: string,
    valor: number,
    forma: Lancamento["forma"],
    fornecedor: string,
  ): Lancamento => {
    const venc = `${mes}-${dia}`;
    return {
      id: "",
      tipo: "despesa",
      descricao,
      categoria,
      valor: Math.round(valor * 100) / 100,
      unidade: "Geral",
      competencia: mes,
      vencimento: venc,
      pago: venc < hoje,
      dataPagamento: venc < hoje ? venc : null,
      forma,
      fornecedor,
      recorrente: false,
      obs: "",
    };
  };
  for (const mes of meses) {
    const cmv = lancamentos.filter(
      (l) =>
        l.competencia === mes &&
        l.tipo === "despesa" &&
        grupoDe(l.categoria) === "cmv",
    );
    const totalCmv = cmv.reduce((s, l) => s + l.valor, 0);
    if (!totalCmv) continue;
    let fator: number;
    let excesso = 0;
    if (mes === atual) {
      const ult = fatores.slice(-3);
      fator = ult.length ? ult.reduce((a, b) => a + b, 0) / ult.length : 1;
    } else {
      const dre = calcularDre(mes, lancamentos, funcionarios, vendas, config);
      if (!dre.receita) continue;
      const ruido = ((hashTexto(semente + mes) % 600) - 300) / 10000;
      excesso = dre.resultadoEmpresa - (alvo + ruido) * dre.receita;
      fator = Math.max(0.6, (totalCmv + 0.65 * excesso) / totalCmv);
      fatores.push(fator);
    }
    for (const l of cmv) l.valor = Math.round(l.valor * fator * 100) / 100;
    if (excesso > 0)
      extras.push(
        extra(
          mes,
          "26",
          "Horas extras e diárias de reforço",
          "Rescisões e extras",
          excesso * 0.22,
          "Transferência",
          "",
        ),
        extra(
          mes,
          "16",
          "Manutenção e pequenos reparos",
          "Manutenção de equipamentos",
          excesso * 0.13,
          "PIX",
          "Prestadores locais",
        ),
      );
  }
  lancamentos.push(...extras);
}

function hashTexto(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function listarLancamentos(ini: string) {
  const b = await baseDemo();
  return b.lancamentos.filter(
    (l) => l.vencimento >= ini || l.competencia >= ini.slice(0, 7),
  );
}

export async function salvarLancamentos(
  itens: z.infer<typeof lancamentoEntrada>[],
) {
  const b = await baseDemo();
  return itens.map((item) => {
    const id = item.id || String(++b.seq);
    const linha = { ...item, id } as Lancamento;
    const i = b.lancamentos.findIndex((l) => l.id === id);
    if (i >= 0) b.lancamentos[i] = linha;
    else b.lancamentos.push(linha);
    return linha;
  });
}

export async function pagarLancamentos(ids: number[], dia: string | null) {
  const b = await baseDemo();
  const alvo = new Set(ids.map(String));
  let n = 0;
  for (const l of b.lancamentos)
    if (alvo.has(l.id)) {
      l.pago = dia !== null;
      l.dataPagamento = dia;
      n++;
    }
  return n;
}

export async function removerLancamento(id: number) {
  const b = await baseDemo();
  const antes = b.lancamentos.length;
  b.lancamentos = b.lancamentos.filter((l) => l.id !== String(id));
  return antes - b.lancamentos.length;
}
