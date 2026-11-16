// Módulo financeiro: tipos, plano de contas e constantes compartilhadas.
// Sem dependência de servidor: roda no navegador enquanto os dados são de exemplo.

export const UNIDADES = ["Loja 1", "Loja 2"] as const;
export type Unidade = (typeof UNIDADES)[number];
/** "Geral" = custo compartilhado pelas duas lojas (contador, sistemas, pró-labore). */
export type UnidadeLancamento = Unidade | "Geral";
export type FiltroUnidade = Unidade | "Todas";

export type Grupo =
  | "receita"
  | "imp"
  | "cmv"
  | "pes"
  | "ocu"
  | "srv"
  | "fin"
  | "inv"
  | "soc"
  | "cx";

export const GRUPOS: Record<Grupo, { label: string; curto: string }> = {
  receita: { label: "Receitas extras", curto: "Receitas" },
  imp: { label: "Impostos", curto: "Impostos" },
  cmv: { label: "Custo das mercadorias (CMV)", curto: "CMV" },
  pes: { label: "Pessoal", curto: "Pessoal" },
  ocu: { label: "Ocupação e utilidades", curto: "Ocupação" },
  srv: { label: "Serviços e outras despesas", curto: "Serviços" },
  fin: { label: "Financeiro (taxas e juros)", curto: "Financeiro" },
  inv: { label: "Investimentos", curto: "Investimentos" },
  soc: { label: "Sócios (retiradas e gastos pessoais)", curto: "Sócios" },
  // Saída de caixa que não é despesa: a parcela do empréstimo amortiza dívida
  // (só os juros são despesa) e a fatura do cartão paga compras de origem incerta.
  cx: {
    label: "Empréstimos e faturas de cartão",
    curto: "Empréstimos e cartões",
  },
};

/** Ordem dos grupos de despesa na DRE e nos gráficos. */
export const GRUPOS_DESPESA: Exclude<Grupo, "receita">[] = [
  "imp",
  "cmv",
  "pes",
  "ocu",
  "srv",
  "fin",
  "inv",
  "soc",
  "cx",
];

/** Grupos que saem do caixa mas não entram no resultado do mês. */
export const GRUPOS_FORA_RESULTADO: Exclude<Grupo, "receita">[] = ["cx"];

export const CATEGORIAS: { nome: string; grupo: Grupo }[] = [
  { nome: "Encomendas e eventos", grupo: "receita" },
  { nome: "Outras receitas", grupo: "receita" },
  { nome: "Simples Nacional", grupo: "imp" },
  { nome: "Taxas e licenças", grupo: "imp" },
  { nome: "Farinha e insumos de panificação", grupo: "cmv" },
  { nome: "Laticínios e frios", grupo: "cmv" },
  { nome: "Embalagens", grupo: "cmv" },
  { nome: "Mercadoria para revenda", grupo: "cmv" },
  { nome: "Hortifruti", grupo: "cmv" },
  { nome: "Carnes, aves e ovos", grupo: "cmv" },
  { nome: "Mercadorias e insumos (diversos)", grupo: "cmv" },
  { nome: "Salários e adiantamentos", grupo: "pes" },
  { nome: "Encargos e tributos sobre a folha", grupo: "pes" },
  { nome: "Benefícios (VA, VT, saúde)", grupo: "pes" },
  { nome: "Pró-labore", grupo: "pes" },
  { nome: "Uniformes, EPIs e exames", grupo: "pes" },
  { nome: "Rescisões e extras", grupo: "pes" },
  { nome: "Aluguel", grupo: "ocu" },
  { nome: "Energia elétrica", grupo: "ocu" },
  { nome: "Água", grupo: "ocu" },
  { nome: "Gás", grupo: "ocu" },
  { nome: "Internet e telefone", grupo: "ocu" },
  { nome: "Manutenção de equipamentos", grupo: "ocu" },
  { nome: "Combustível e transporte", grupo: "ocu" },
  { nome: "Contabilidade", grupo: "srv" },
  { nome: "Sistemas (ERP, ponto, painel)", grupo: "srv" },
  { nome: "Limpeza e dedetização", grupo: "srv" },
  { nome: "Honorários, consultorias e jurídico", grupo: "srv" },
  { nome: "Locação de equipamentos", grupo: "srv" },
  { nome: "Doações e patrocínios", grupo: "srv" },
  { nome: "A classificar", grupo: "srv" },
  { nome: "Taxas de cartão e PIX", grupo: "fin" },
  { nome: "Juros e multas", grupo: "fin" },
  { nome: "Empréstimos e financiamentos", grupo: "cx" },
  { nome: "Faturas de cartão de crédito", grupo: "cx" },
  { nome: "Equipamentos", grupo: "inv" },
  { nome: "Reforma", grupo: "inv" },
  { nome: "Retiradas dos sócios", grupo: "soc" },
  { nome: "Despesas pessoais dos sócios", grupo: "soc" },
];

/**
 * Categoria da folha lançada como conta a pagar. Se o mês tem lançamento nela,
 * a DRE não soma de novo a folha estimada pelo cadastro de funcionários.
 */
export const CATEGORIA_FOLHA = "Salários e adiantamentos";

const grupoPorCategoria = new Map(CATEGORIAS.map((c) => [c.nome, c.grupo]));
export const grupoDe = (categoria: string): Grupo =>
  grupoPorCategoria.get(categoria) ?? "srv";

export const FORMAS_PAGAMENTO = [
  "Boleto",
  "PIX",
  "Transferência",
  "Cartão",
  "Débito automático",
  "Cheque",
  "Dinheiro",
] as const;

export type Lancamento = {
  id: string;
  tipo: "despesa" | "receita";
  descricao: string;
  categoria: string;
  valor: number;
  unidade: UnidadeLancamento;
  /** Mês de competência, AAAA-MM. A DRE usa este campo. */
  competencia: string;
  /** Vencimento (despesa) ou previsão de recebimento (receita), AAAA-MM-DD. */
  vencimento: string;
  pago: boolean;
  dataPagamento: string | null;
  forma: string;
  fornecedor: string;
  recorrente: boolean;
  obs: string;
};

export const CONTRATOS = [
  "CLT",
  "Experiência",
  "Temporário",
  "Estágio",
  "MEI/PJ",
] as const;
export type Contrato = (typeof CONTRATOS)[number];

export const TURNOS = [
  "Madrugada (3h–11h)",
  "Manhã (6h–14h)",
  "Intermediário (10h–18h)",
  "Tarde (13h–21h)",
] as const;

export const STATUS_FUNC = [
  "Ativo",
  "Férias",
  "Afastado",
  "Desligado",
] as const;
export type StatusFuncionario = (typeof STATUS_FUNC)[number];

export type Funcionario = {
  id: string;
  nome: string;
  cargo: string;
  unidade: Unidade;
  contrato: Contrato;
  admissao: string; // AAAA-MM-DD
  desligamento: string | null;
  turno: string;
  jornadaSemanal: number;
  salario: number;
  /** Custo mensal da empresa com vale-transporte (já sem o desconto de 6%). */
  vt: number;
  /** Vale-alimentação/refeição mensal. */
  va: number;
  status: StatusFuncionario;
  obs: string;
};

export type ConfigFinanceiro = {
  /** Encargos sobre o salário para CLT, em % (FGTS + provisões de 13º e férias). */
  encargos: number;
};

export type DadosFinanceiro = {
  versao: 4;
  lancamentos: Lancamento[];
  funcionarios: Funcionario[];
  config: ConfigFinanceiro;
};

/**
 * Vendas reais do caixa por mês (AAAA-MM): total e série diária.
 * O relatório do caixa não separa as lojas, então a receita é consolidada.
 */
export type VendasMes = Record<string, { total: number; dias: number[] }>;
