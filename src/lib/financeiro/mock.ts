// DADOS DE EXEMPLO do módulo financeiro. Valores sintéticos e determinísticos
// (mesma semente = mesmos números), gerados a partir da data de hoje.
// Na demonstração, este arquivo gera as contas e a equipe de exemplo:
// as telas consomem DadosFinanceiro + VendasMes.
import {
  addDias,
  addMeses,
  diasNoMes,
  mesDe,
  mesesHistorico,
} from "./calculos";
import {
  UNIDADES,
  type DadosFinanceiro,
  type Funcionario,
  type Lancamento,
  type Unidade,
  type UnidadeLancamento,
  type VendasMes,
} from "./tipos";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Últimos 12 meses (o atual por último). */

// ---------------------------------------------------------------- vendas
// Faturamento diário de referência das duas lojas somadas.
const BASE_DIA = 6850;
// Domingo a sábado: fim de semana é o pico da padaria.
const SEMANA = [1.24, 0.9, 0.93, 0.95, 0.98, 1.05, 1.2];
// Dezembro (festas) e junho (São João) acima da média.
const SAZONAL = [
  0.92, 0.94, 0.97, 0.98, 1, 1.08, 1.04, 0.99, 0.98, 1.01, 1.03, 1.24,
];

/** Vendas fictícias, usadas só quando o banco de vendas não responde. */
export function gerarVendas(hoje: string): VendasMes {
  const rand = rng(7);
  const meses = mesesHistorico(hoje);
  const out: VendasMes = {};
  meses.forEach((mes, idx) => {
    const m = Number(mes.slice(5)) - 1;
    const tendencia = 1 + idx * 0.006;
    const dias: number[] = [];
    for (let d = 1; d <= diasNoMes(mes); d++) {
      const data = `${mes}-${String(d).padStart(2, "0")}`;
      if (data >= hoje) break; // hoje ainda está em andamento
      const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
      const ruido = 0.88 + rand() * 0.24;
      dias.push(r2(BASE_DIA * SEMANA[dow] * SAZONAL[m] * tendencia * ruido));
    }
    out[mes] = { total: r2(dias.reduce((s, v) => s + v, 0)), dias };
  });
  return out;
}

/** Faturamento médio dos meses fechados. */
function mediaMensal(vendas: VendasMes, hoje: string) {
  const fechados = mesesHistorico(hoje)
    .slice(0, -1)
    .map((m) => vendas[m]?.total ?? 0)
    .filter((v) => v > 0);
  return fechados.length
    ? fechados.reduce((s, v) => s + v, 0) / fechados.length
    : 0;
}

/** O caixa não separa as lojas: para os custos de exemplo, supõe 57% / 43%. */
const PARTICIPACAO: Record<Unidade, number> = {
  "Loja 1": 0.57,
  "Loja 2": 0.43,
};

// ---------------------------------------------------------------- lançamentos
type Fixo = {
  descricao: string;
  categoria: string;
  valor: Partial<Record<UnidadeLancamento, number>>;
  dia: number;
  fornecedor: string;
  forma: string;
  variacao: number;
};

const FIXOS: Fixo[] = [
  {
    descricao: "Aluguel do ponto",
    categoria: "Aluguel",
    valor: { "Loja 1": 9500, "Loja 2": 7200 },
    dia: 5,
    fornecedor: "Imobiliária Salvador",
    forma: "Boleto",
    variacao: 0,
  },
  {
    descricao: "Conta de energia",
    categoria: "Energia elétrica",
    valor: { "Loja 1": 6900, "Loja 2": 5300 },
    dia: 15,
    fornecedor: "Concessionária de energia",
    forma: "Débito automático",
    variacao: 0.09,
  },
  {
    descricao: "Conta de água",
    categoria: "Água",
    valor: { "Loja 1": 950, "Loja 2": 720 },
    dia: 12,
    fornecedor: "Concessionária de água",
    forma: "Débito automático",
    variacao: 0.1,
  },
  {
    descricao: "Gás para os fornos",
    categoria: "Gás",
    valor: { "Loja 1": 2500, "Loja 2": 1900 },
    dia: 20,
    fornecedor: "Distribuidora de gás",
    forma: "Boleto",
    variacao: 0.12,
  },
  {
    descricao: "Internet e telefone",
    categoria: "Internet e telefone",
    valor: { "Loja 1": 189.9, "Loja 2": 189.9 },
    dia: 10,
    fornecedor: "Provedor de internet",
    forma: "Boleto",
    variacao: 0,
  },
  {
    descricao: "Honorários contábeis",
    categoria: "Contabilidade",
    valor: { Geral: 1350 },
    dia: 10,
    fornecedor: "Escritório contábil",
    forma: "PIX",
    variacao: 0,
  },
  {
    descricao: "ERP DataPão",
    categoria: "Sistemas (ERP, ponto, painel)",
    valor: { Geral: 690 },
    dia: 10,
    fornecedor: "BM Informática",
    forma: "Boleto",
    variacao: 0,
  },
  {
    descricao: "Sistema de ponto",
    categoria: "Sistemas (ERP, ponto, painel)",
    valor: { Geral: 240 },
    dia: 8,
    fornecedor: "Sistema de ponto",
    forma: "Boleto",
    variacao: 0,
  },
  {
    descricao: "Painel GuIA",
    categoria: "Sistemas (ERP, ponto, painel)",
    valor: { Geral: 320 },
    dia: 10,
    fornecedor: "GuIA",
    forma: "PIX",
    variacao: 0,
  },
  {
    descricao: "Pró-labore dos sócios",
    categoria: "Pró-labore",
    valor: { Geral: 7000 },
    dia: 5,
    fornecedor: "",
    forma: "Transferência",
    variacao: 0,
  },
];

// Percentual do faturamento da loja no mês.
const VARIAVEIS = [
  {
    descricao: "Farinha, açúcar e fermento",
    categoria: "Farinha e insumos de panificação",
    pct: 0.13,
    dia: 28,
    fornecedor: "Moinho Recôncavo",
  },
  {
    descricao: "Laticínios e frios",
    categoria: "Laticínios e frios",
    pct: 0.085,
    dia: 22,
    fornecedor: "Laticínios do Sertão",
  },
  {
    descricao: "Embalagens e sacolas",
    categoria: "Embalagens",
    pct: 0.03,
    dia: 18,
    fornecedor: "EmbalaMais",
  },
  {
    descricao: "Bebidas e doces para revenda",
    categoria: "Mercadoria para revenda",
    pct: 0.105,
    dia: 25,
    fornecedor: "Distribuidora Bahia Bebidas",
  },
  {
    descricao: "Hortifruti",
    categoria: "Hortifruti",
    pct: 0.03,
    dia: 14,
    fornecedor: "Ceasa Salvador",
  },
];

// Custos que crescem com o porte da loja (espaço, fornos, retirada dos sócios).
const ESCALA_FIXOS = new Set([
  "Aluguel",
  "Energia elétrica",
  "Água",
  "Gás",
  "Pró-labore",
]);

const dataNoMes = (mes: string, dia: number) =>
  `${mes}-${String(Math.min(dia, diasNoMes(mes))).padStart(2, "0")}`;

/** Ajustes do segmento da demonstração (custos variáveis e cargos). */
export type PerfilFinanceiro = {
  segmento: string;
  variaveis: [string, string, number, string][];
  cargos: string[];
  porte: number;
};

const FORNO = new Set(["padaria", "restaurante"]);

export function gerarLancamentos(
  hoje: string,
  vendas: VendasMes,
  perfil?: PerfilFinanceiro,
): Lancamento[] {
  const variaveis = perfil
    ? perfil.variaveis.map(([descricao, categoria, pct, fornecedor], i) => ({
        descricao,
        categoria,
        pct,
        fornecedor,
        dia: [28, 22, 18, 25, 14][i % 5],
      }))
    : VARIAVEIS;
  const fixos = FIXOS.filter(
    (f) => !perfil || f.categoria !== "Gás" || FORNO.has(perfil.segmento),
  ).map((f) =>
    f.descricao === "ERP DataPão"
      ? {
          ...f,
          descricao: "Sistema de gestão (ERP)",
          fornecedor: "Fornecedor do ERP",
        }
      : f,
  );
  const rand = rng(42);
  let seq = 0;
  const out: Lancamento[] = [];
  // Custos fixos de exemplo acompanham o porte real (referência: R$ 210 mil/mês).
  const fator = Math.min(
    1.8,
    Math.max(0.35, mediaMensal(vendas, hoje) / 210_000),
  );
  const add = (
    l: Omit<Lancamento, "id" | "pago" | "dataPagamento" | "obs" | "tipo"> &
      Partial<Lancamento>,
  ) =>
    out.push({
      id: `ex-${++seq}`,
      tipo: "despesa",
      pago: false,
      dataPagamento: null,
      obs: "",
      ...l,
    });

  const historico = mesesHistorico(hoje);
  const proximo = addMeses(mesDe(hoje), 1);

  for (const mes of [...historico, proximo]) {
    for (const f of fixos) {
      for (const [unidade, base] of Object.entries(f.valor) as [
        UnidadeLancamento,
        number,
      ][]) {
        add({
          descricao: f.descricao,
          categoria: f.categoria,
          valor: r2(
            base *
              (ESCALA_FIXOS.has(f.categoria) ? fator : 1) *
              (1 + (rand() - 0.5) * 2 * f.variacao),
          ),
          unidade,
          competencia: mes,
          vencimento: dataNoMes(mes, f.dia),
          forma: f.forma,
          fornecedor: f.fornecedor,
          recorrente: true,
        });
      }
    }
    if (mes === proximo) continue;

    for (const u of UNIDADES) {
      const fat = (vendas[mes]?.total ?? 0) * PARTICIPACAO[u];
      for (const v of variaveis) {
        add({
          descricao: v.descricao,
          categoria: v.categoria,
          valor: r2(fat * v.pct * (0.92 + rand() * 0.16)),
          unidade: u,
          competencia: mes,
          vencimento: dataNoMes(mes, v.dia),
          forma: "Boleto",
          fornecedor: v.fornecedor,
          recorrente: false,
        });
      }
      // Maquininha: desconta direto no repasse, já nasce pago.
      add({
        descricao: "Taxas da maquininha e PIX",
        categoria: "Taxas de cartão e PIX",
        valor: r2(fat * 0.016),
        unidade: u,
        competencia: mes,
        vencimento: dataNoMes(mes, 31),
        forma: "Débito automático",
        fornecedor: "Adquirente",
        recorrente: true,
        pago: true,
        dataPagamento: dataNoMes(mes, 31) < hoje ? dataNoMes(mes, 31) : hoje,
      });
      // Simples do mês vence no dia 20 do mês seguinte.
      add({
        descricao: "DAS – Simples Nacional",
        categoria: "Simples Nacional",
        valor: r2(fat * 0.065),
        unidade: u,
        competencia: mes,
        vencimento: dataNoMes(addMeses(mes, 1), 20),
        forma: "Boleto",
        fornecedor: "Receita Federal",
        recorrente: true,
      });
      if (rand() < 0.35) {
        add({
          descricao: "Manutenção de forno e masseira",
          categoria: "Manutenção de equipamentos",
          valor: r2(500 + rand() * 1800),
          unidade: u,
          competencia: mes,
          vencimento: dataNoMes(mes, 8 + Math.floor(rand() * 18)),
          forma: "PIX",
          fornecedor: "Refrigeração e Fornos Bahia",
          recorrente: false,
        });
      }
      const encomendas = Math.floor(rand() * 3);
      for (let i = 0; i < encomendas; i++) {
        add({
          tipo: "receita",
          descricao:
            rand() < 0.5
              ? "Encomenda de bolo e salgados"
              : "Coffee break para empresa",
          categoria: "Encomendas e eventos",
          valor: r2(350 + rand() * 2200),
          unidade: u,
          competencia: mes,
          vencimento: dataNoMes(mes, 3 + Math.floor(rand() * 25)),
          forma: "PIX",
          fornecedor: "",
          recorrente: false,
        });
      }
    }
    if (Number(mes.slice(5)) % 3 === 0) {
      add({
        descricao: "Dedetização trimestral",
        categoria: "Limpeza e dedetização",
        valor: 480,
        unidade: "Geral",
        competencia: mes,
        vencimento: dataNoMes(mes, 16),
        forma: "PIX",
        fornecedor: "Dedetizadora local",
        recorrente: false,
      });
      add({
        descricao: "Fardamento e exames periódicos",
        categoria: "Uniformes, EPIs e exames",
        valor: 620,
        unidade: "Geral",
        competencia: mes,
        vencimento: dataNoMes(mes, 12),
        forma: "PIX",
        fornecedor: "",
        recorrente: false,
      });
    }
  }

  // Investimento parcelado: forno turbo novo na Loja 2, em 6x, desde 5 meses atrás.
  const inicioForno = historico[historico.length - 6];
  for (let i = 0; i < 6; i++) {
    const mes = addMeses(inicioForno, i);
    add({
      descricao: `Forno turbo 10 esteiras (${i + 1}/6)`,
      categoria: "Equipamentos",
      valor: 2850,
      unidade: "Loja 2",
      competencia: mes,
      vencimento: dataNoMes(mes, 10),
      forma: "Boleto",
      fornecedor: "Fornos Industriais Nordeste",
      recorrente: false,
    });
  }
  add({
    descricao: "Pintura da fachada",
    categoria: "Reforma",
    valor: 4600,
    unidade: "Loja 1",
    competencia: historico[historico.length - 10],
    vencimento: dataNoMes(historico[historico.length - 10], 18),
    forma: "PIX",
    fornecedor: "",
    recorrente: false,
  });

  // Quita o que venceu, deixando duas contas recentes em atraso para o exemplo.
  const atrasadas = new Set(
    out
      .filter(
        (l) =>
          l.tipo === "despesa" &&
          !l.pago &&
          l.vencimento < hoje &&
          l.vencimento >= addDias(hoje, -12),
      )
      .sort((a, b) => b.valor - a.valor)
      .slice(1, 3)
      .map((l) => l.id),
  );
  for (const l of out) {
    if (l.pago || l.vencimento >= hoje || atrasadas.has(l.id)) continue;
    l.pago = true;
    l.dataPagamento = rand() < 0.1 ? addDias(l.vencimento, 2) : l.vencimento;
  }
  if (perfil && !FORNO.has(perfil.segmento))
    for (const l of out) {
      l.descricao = l.descricao
        .replace(
          "Manutenção de forno e masseira",
          "Manutenção de equipamentos e ar-condicionado",
        )
        .replace("Forno turbo 10 esteiras", "Reforma de vitrines e mobiliário");
      l.fornecedor = l.fornecedor
        .replace("Refrigeração e Fornos Bahia", "Climatização Bahia")
        .replace("Fornos Industriais Nordeste", "Marcenaria Nordeste");
    }
  return out;
}

// ---------------------------------------------------------------- funcionários
type SementeFunc = Omit<Funcionario, "id" | "obs" | "desligamento" | "status"> &
  Partial<Pick<Funcionario, "desligamento" | "status" | "obs">>;

const FUNCIONARIOS: (hoje: string) => SementeFunc[] = (hoje) => [
  {
    nome: "José Carlos Bastos",
    cargo: "Gerente de loja",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2019-03-11",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 3900,
    vt: 0,
    va: 450,
  },
  {
    nome: "Antônio Ferreira Lima",
    cargo: "Padeiro",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2017-08-01",
    turno: "Madrugada (3h–11h)",
    jornadaSemanal: 44,
    salario: 2450,
    vt: 160,
    va: 450,
  },
  {
    nome: "Raimundo Nonato Silva",
    cargo: "Padeiro",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2021-02-15",
    turno: "Madrugada (3h–11h)",
    jornadaSemanal: 44,
    salario: 2300,
    vt: 160,
    va: 450,
  },
  {
    nome: "Cleide Santos Reis",
    cargo: "Confeiteira",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2020-06-02",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 2250,
    vt: 160,
    va: 450,
    status: "Férias",
  },
  {
    nome: "Lucas Oliveira Matos",
    cargo: "Auxiliar de padaria",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2024-04-08",
    turno: "Madrugada (3h–11h)",
    jornadaSemanal: 44,
    salario: 1700,
    vt: 160,
    va: 450,
  },
  {
    nome: "Daniela Souza Pires",
    cargo: "Atendente",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2023-01-16",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
  },
  {
    nome: "Patrícia Almeida Cruz",
    cargo: "Atendente",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2022-09-05",
    turno: "Tarde (13h–21h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
  },
  {
    nome: "Marta Conceição",
    cargo: "Operadora de caixa",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2018-11-19",
    turno: "Tarde (13h–21h)",
    jornadaSemanal: 44,
    salario: 1750,
    vt: 160,
    va: 450,
  },
  {
    nome: "Edvaldo Santana",
    cargo: "Salgadeiro",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2022-03-21",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 2050,
    vt: 160,
    va: 450,
  },
  {
    nome: "Rita de Cássia Nunes",
    cargo: "Auxiliar de limpeza",
    unidade: "Loja 1",
    contrato: "CLT",
    admissao: "2023-07-03",
    turno: "Intermediário (10h–18h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
    status: "Afastado",
    obs: "Afastamento pelo INSS desde o mês passado.",
  },
  {
    nome: "Bianca Rocha",
    cargo: "Estagiária de administração",
    unidade: "Loja 1",
    contrato: "Estágio",
    admissao: "2026-03-02",
    turno: "Intermediário (10h–18h)",
    jornadaSemanal: 30,
    salario: 1100,
    vt: 160,
    va: 0,
  },
  {
    nome: "Gilson Pereira",
    cargo: "Entregador",
    unidade: "Loja 1",
    contrato: "MEI/PJ",
    admissao: "2025-05-12",
    turno: "Intermediário (10h–18h)",
    jornadaSemanal: 30,
    salario: 1800,
    vt: 0,
    va: 0,
    obs: "Emite nota como MEI; moto própria.",
  },
  {
    nome: "Fabiana Moreira",
    cargo: "Gerente de loja",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2021-10-04",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 3600,
    vt: 0,
    va: 450,
  },
  {
    nome: "Josué Ribeiro",
    cargo: "Padeiro",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2021-10-04",
    turno: "Madrugada (3h–11h)",
    jornadaSemanal: 44,
    salario: 2350,
    vt: 160,
    va: 450,
  },
  {
    nome: "Valdirene Costa",
    cargo: "Confeiteira",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2024-08-12",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 2150,
    vt: 160,
    va: 450,
  },
  {
    nome: "Igor Batista",
    cargo: "Auxiliar de padaria",
    unidade: "Loja 2",
    contrato: "Experiência",
    admissao: addDias(hoje, -76),
    turno: "Madrugada (3h–11h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
  },
  {
    nome: "Larissa Mendes",
    cargo: "Atendente",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2025-02-03",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
  },
  {
    nome: "Sueli Barbosa",
    cargo: "Operadora de caixa",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2022-05-16",
    turno: "Tarde (13h–21h)",
    jornadaSemanal: 44,
    salario: 1750,
    vt: 160,
    va: 450,
  },
  {
    nome: "Kauã Teixeira",
    cargo: "Atendente",
    unidade: "Loja 2",
    contrato: "Temporário",
    admissao: addDias(hoje, -9),
    turno: "Tarde (13h–21h)",
    jornadaSemanal: 44,
    salario: 1650,
    vt: 160,
    va: 450,
    obs: "Reforço para o fim de ano, até 15/01.",
  },
  {
    nome: "Rogério Lopes",
    cargo: "Salgadeiro",
    unidade: "Loja 2",
    contrato: "CLT",
    admissao: "2020-01-13",
    desligamento: addDias(hoje, -130),
    status: "Desligado",
    turno: "Manhã (6h–14h)",
    jornadaSemanal: 44,
    salario: 2000,
    vt: 160,
    va: 450,
    obs: "Pediu demissão.",
  },
];

// Reforço de equipe para lojas grandes (faturamento acima de
// R$ 350 mil/mês): turnos dobrados no balcão, caixa e produção.
const EXTRAS: [string, string, Unidade, string, number][] = [
  ["Adriana Lopes", "Atendente", "Loja 1", "Tarde (13h–21h)", 1650],
  [
    "Bruno Cardoso",
    "Auxiliar de padaria",
    "Loja 1",
    "Madrugada (3h–11h)",
    1700,
  ],
  ["Camila Freitas", "Operadora de caixa", "Loja 1", "Manhã (6h–14h)", 1750],
  ["Diego Araújo", "Padeiro", "Loja 1", "Madrugada (3h–11h)", 2300],
  ["Elaine Viana", "Confeiteira", "Loja 1", "Intermediário (10h–18h)", 2150],
  ["Fernando Gomes", "Repositor", "Loja 1", "Intermediário (10h–18h)", 1650],
  ["Gabriela Neves", "Atendente", "Loja 1", "Manhã (6h–14h)", 1650],
  ["Henrique Paiva", "Chapeiro", "Loja 1", "Manhã (6h–14h)", 1900],
  ["Isabela Prado", "Atendente", "Loja 2", "Tarde (13h–21h)", 1650],
  [
    "João Vitor Sales",
    "Auxiliar de padaria",
    "Loja 2",
    "Madrugada (3h–11h)",
    1700,
  ],
  ["Karina Melo", "Operadora de caixa", "Loja 2", "Manhã (6h–14h)", 1750],
  ["Leandro Brito", "Padeiro", "Loja 2", "Madrugada (3h–11h)", 2300],
  ["Mônica Dias", "Salgadeira", "Loja 2", "Manhã (6h–14h)", 2000],
  ["Nilton Rocha", "Repositor", "Loja 2", "Intermediário (10h–18h)", 1650],
  [
    "Olívia Santos",
    "Auxiliar de limpeza",
    "Loja 2",
    "Intermediário (10h–18h)",
    1650,
  ],
  ["Paulo Sérgio Leal", "Chapeiro", "Loja 2", "Manhã (6h–14h)", 1900],
];

const CARGOS_PADARIA = new Set([
  "Padeiro",
  "Confeiteira",
  "Auxiliar de padaria",
  "Salgadeiro",
  "Salgadeira",
  "Chapeiro",
  "Atendente",
]);

export function gerarFuncionarios(
  hoje: string,
  reforco = false,
  perfil?: PerfilFinanceiro,
): Funcionario[] {
  let base: SementeFunc[] = FUNCIONARIOS(hoje);
  if (reforco)
    EXTRAS.forEach(([nome, cargo, unidade, turno, salario], i) =>
      base.push({
        nome,
        cargo,
        unidade,
        turno,
        salario,
        contrato: "CLT",
        admissao: addDias(hoje, -(120 + i * 97)),
        jornadaSemanal: 44,
        vt: 160,
        va: 450,
      }),
    );
  if (perfil && perfil.segmento !== "padaria") {
    const n = Math.max(5, Math.round(base.length * Math.min(1, perfil.porte)));
    base = base.slice(0, n).map((f, i) => ({
      ...f,
      cargo: CARGOS_PADARIA.has(f.cargo)
        ? perfil.cargos[i % perfil.cargos.length]
        : f.cargo,
      turno: f.turno.startsWith("Madrugada") ? "Manhã (7h–15h)" : f.turno,
    }));
  }
  return base.map((f, i) => ({
    id: `fx-${i + 1}`,
    status: "Ativo",
    desligamento: null,
    obs: "",
    ...f,
  }));
}

/**
 * Despesas e equipe de exemplo. Com as vendas reais, os custos variáveis
 * (insumos, impostos, maquininha) saem em % do faturamento real de cada mês.
 */
export function gerarDadosExemplo(
  hoje: string,
  vendas: VendasMes = gerarVendas(hoje),
  perfil?: PerfilFinanceiro,
): DadosFinanceiro {
  return {
    versao: 4,
    lancamentos: gerarLancamentos(hoje, vendas, perfil),
    funcionarios: gerarFuncionarios(
      hoje,
      mediaMensal(vendas, hoje) > 350_000,
      perfil,
    ),
    // FGTS 8% + 13º (8,33%) + férias com 1/3 (11,11%) + FGTS sobre provisões ≈ 29%.
    // Simples Nacional (Anexo I) não recolhe INSS patronal sobre a folha.
    config: { encargos: 29 },
  };
}
