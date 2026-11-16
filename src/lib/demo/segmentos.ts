// Segmentos da demonstração. Tudo aqui é FICTÍCIO: empresas, produtos e
// números servem só para mostrar o painel a quem ainda não é cliente.
// A padaria usa como referência o perfil de uma padaria real de duas lojas
// (horários, dias da semana, sazonalidade e ticket), sem nenhum dado dela.

export type Perfil = [pico: number, peso: number, largura: number][];

export type ProdutoSeg = {
  codigo: string;
  nome: string;
  unidade: "UN" | "KG";
  preco: number;
  categoria: string;
  /** Participação nas linhas de venda (relativa). */
  peso: number;
  /** Quantidade média por venda (kg para KG). */
  qtd: number;
  /** Perfil de horário (nome em Segmento.perfis). */
  perfil: string;
  /** Multiplicador por dia da semana (seg..dom). */
  dow?: number[];
  /** Multiplicador por mês (jan..dez). */
  meses?: number[];
  /** Multiplicador em datas (trecho do nome da data comemorativa → fator). */
  eventos?: Record<string, number>;
  /** Começou a vender nesta data. */
  inicio?: string;
  /** Parou de vender depois desta data. */
  fim?: string;
  /** Crescimento ao ano (0.3 = +30%/ano). */
  tendencia?: number;
};

export type Segmento = {
  id: string;
  nome: string;
  empresa: string;
  slogan: string;
  local: string;
  lojas: string;
  icone: string;
  resumo: string;
  exemplos: string[];
  /** O que a IA deve saber do negócio (português). */
  sobre: string;
  /** Unidade de atendimento usada nos textos: pedido, venda, atendimento. */
  termo: string;
  pedidosDia: number;
  /** Fator de cada dia da semana (seg..dom). */
  dow: number[];
  meses: number[];
  crescimento: number;
  abre: number;
  fecha: number;
  /** Horário de funcionamento por dia (seg..dom); null = fechado. */
  horarios?: ([number, number] | null)[];
  horaPedidos: Perfil;
  perfis: Record<string, Perfil>;
  eventos: Record<string, number>;
  /** Fecha nestas datas (trecho do nome). */
  fechaEm?: string[];
  pagamentos: [forma: string, participacao: number, ticket: number][];
  /** Dispersão do ticket (lognormal). */
  sigmaTicket: number;
  categorias: string[];
  combos: string;
  pares: [a: string, b: string, lift: number][];
  produtos: ProdutoSeg[];
  financeiro: {
    variaveis: [
      descricao: string,
      categoria: string,
      pct: number,
      fornecedor: string,
    ][];
    cargos: string[];
    porte: number;
    /** Margem líquida típica do exemplo (resultado / receita). */
    margem: number;
  };
};

type ProdIn = Omit<ProdutoSeg, "codigo">;
const P = (
  nome: string,
  unidade: "UN" | "KG",
  preco: number,
  categoria: string,
  peso: number,
  qtd: number,
  perfil: string,
  extra: Partial<ProdIn> = {},
): ProdIn => ({ nome, unidade, preco, categoria, peso, qtd, perfil, ...extra });

const comCodigo = (base: number, lista: ProdIn[]): ProdutoSeg[] =>
  lista.map((p, i) => ({ ...p, codigo: String(base + i * 7) }));

// Meses com pico de verão (Salvador: dez–mar quente, abr–jul chuvoso).
const VERAO = [
  1.25, 1.2, 1.1, 0.95, 0.85, 0.8, 0.82, 0.88, 0.95, 1.02, 1.1, 1.3,
];
const CHUVA = [0.7, 0.7, 0.85, 1.25, 1.5, 1.6, 1.55, 1.3, 1.05, 0.9, 0.8, 0.7];
const SO_DEZ = [0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0.15, 2.5, 9];
const JUNINO = [0, 0, 0, 0, 0.3, 4, 0.6, 0, 0, 0, 0, 0];
const FIM_SEMANA = [0.8, 0.8, 0.85, 0.9, 1.15, 1.45, 1.35];

const PADARIA: Segmento = {
  id: "padaria",
  nome: "Padaria e delicatessen",
  empresa: "Padaria Pão da Barra",
  slogan: "Padaria, café e delicatessen",
  local: "Salvador, BA",
  lojas: "2 lojas · Barra e Pituba",
  icone: "Croissant",
  resumo: "Pão quente, café da manhã, buffet de almoço, bolos e frios.",
  exemplos: ["Pão francês", "Buffet de almoço", "Bolo de aipim"],
  sobre:
    "padaria e delicatessen com duas lojas em Salvador (Barra e Pituba): pão francês, café da manhã e buffet de almoço por quilo, bolos, tortas, salgados, frios e um pouco de mercearia",
  termo: "pedido",
  pedidosDia: 480,
  dow: [1.03, 1, 0.99, 0.98, 1.03, 1.02, 0.8],
  meses: [0.93, 0.9, 0.95, 0.96, 1.0, 1.08, 0.99, 1.0, 0.99, 1.02, 1.01, 1.12],
  crescimento: 0.11,
  abre: 6,
  fecha: 21,
  horaPedidos: [
    [7.5, 1.0, 1.3],
    [12.4, 0.55, 0.9],
    [17.8, 1.35, 1.3],
  ],
  perfis: {
    manha: [[7.8, 1, 1.3]],
    almoco: [[12.5, 1, 0.9]],
    tarde: [[16.8, 1, 1.6]],
    noite: [[18.5, 1, 1.2]],
    pao: [
      [7, 1, 1.1],
      [17.5, 1.5, 1.3],
    ],
    dia: [
      [9, 1, 2],
      [16.5, 1, 2.2],
    ],
  },
  eventos: {
    "Véspera de Natal": 1.75,
    Natal: 0.55,
    "Véspera de Ano Novo": 1.5,
    "Ano Novo": 0.5,
    "Véspera do Dia das Mães": 1.35,
    "Sábado de Aleluia": 1.25,
    "Véspera de São João": 1.4,
    "Terça de Carnaval": 0.75,
    "Segunda de Carnaval": 0.8,
    "Sexta-feira Santa": 0.85,
    "Black Friday": 1.05,
  },
  pagamentos: [
    ["PIX", 0.42, 0.95],
    ["DÉBITO", 0.24, 1.05],
    ["CRÉDITO", 0.17, 1.35],
    ["DINHEIRO", 0.13, 0.7],
    ["VALE-REFEIÇÃO", 0.04, 1.4],
  ],
  sigmaTicket: 0.85,
  categorias: [
    "pães",
    "frios e laticínios",
    "bebidas",
    "bebidas alcoólicas",
    "doces e bolos",
    "salgados e lanches",
    "refeições",
    "mercearia",
  ],
  combos:
    "salgados e lanches + bebidas; pães + frios e laticínios; pães + café, café com leite ou suco; doces e bolos + café ou suco; buffet de almoço + só bebidas frias (suco, refresco, refrigerante, água), nunca café; buffet de café da manhã + café, café com leite ou suco. Todo combo precisa caber num mesmo momento de consumo (café da manhã, almoço ou lanche da tarde)",
  pares: [
    ["PÃO FRANCÊS", "MANTEIGA A GRANEL", 2.6],
    ["PÃO FRANCÊS", "QUEIJO MUSSARELA FATIADO", 2.3],
    ["PÃO FRANCÊS", "PRESUNTO FATIADO", 2.4],
    ["PÃO FRANCÊS", "LEITE INTEGRAL 1L", 1.9],
    ["CAFÉ COM LEITE", "MISTO QUENTE", 2.8],
    ["BUFFET CAFÉ DA MANHÃ", "CAFÉ COM LEITE", 2.1],
    ["BUFFET CAFÉ DA MANHÃ", "SUCO DE LARANJA 500ML", 1.7],
    ["BUFFET ALMOÇO", "REFRESCO 300ML", 2.5],
    ["BUFFET ALMOÇO", "SUCO DE LARANJA 500ML", 1.8],
    ["COXINHA DE FRANGO", "REFRESCO 300ML", 2.2],
    ["BOLO DE AIPIM", "CAFÉ EXPRESSO", 1.9],
    ["MINI SALGADOS", "REFRIGERANTE 2L", 2.7],
    ["TORTA DECORADA", "REFRIGERANTE 2L", 2.3],
    ["TORTA DECORADA", "MINI SALGADOS", 2.9],
    ["PÃO DE HAMBÚRGUER PCT", "QUEIJO MUSSARELA FATIADO", 2.0],
    ["CERVEJA LATA 350ML", "MINI SALGADOS", 1.7],
    ["PÃO DELÍCIA", "REQUEIJÃO DE CORTE", 1.8],
    ["PAMONHA", "CANJICA COPO", 3.1],
    ["CROISSANT DE AMÊNDOAS", "CAPPUCCINO 120ML", 2.4],
  ],
  produtos: comCodigo(1001, [
    P("PÃO FRANCÊS", "UN", 0.79, "pães", 22, 10, "pao"),
    P("BUFFET CAFÉ DA MANHÃ", "KG", 54.99, "refeições", 8.5, 0.33, "manha", {
      dow: [0.95, 0.95, 0.95, 0.95, 1, 1.25, 1.2],
    }),
    P("BUFFET ALMOÇO", "KG", 67.99, "refeições", 6.8, 0.41, "almoco", {
      dow: [1.05, 1.05, 1.05, 1.05, 1.08, 0.95, 0.65],
    }),
    P("CAFÉ COM LEITE", "UN", 3.99, "bebidas", 5.4, 1.2, "manha"),
    P("SUCO DE LARANJA 500ML", "UN", 11.99, "bebidas", 3.3, 1.1, "almoco", {
      meses: VERAO,
    }),
    P("MINI SALGADOS", "KG", 67.99, "salgados e lanches", 2.4, 0.2, "tarde", {
      dow: FIM_SEMANA,
    }),
    P("PÃO DELÍCIA", "KG", 54.99, "pães", 2.6, 0.24, "tarde"),
    P("BOLO DE AIPIM", "KG", 32.99, "doces e bolos", 1.6, 0.48, "tarde"),
    P("BAURU", "UN", 10.99, "salgados e lanches", 1.8, 1.2, "almoco"),
    P("REFRESCO 300ML", "UN", 4.99, "bebidas", 2.6, 1.15, "almoco", {
      meses: VERAO,
    }),
    P(
      "QUEIJO MUSSARELA FATIADO",
      "KG",
      55.99,
      "frios e laticínios",
      2.0,
      0.11,
      "pao",
    ),
    P("PRESUNTO FATIADO", "KG", 49.99, "frios e laticínios", 1.4, 0.12, "pao"),
    P("MANTEIGA A GRANEL", "KG", 55.99, "frios e laticínios", 1.1, 0.15, "pao"),
    P("LEITE INTEGRAL 1L", "UN", 6.49, "frios e laticínios", 1.5, 1.7, "pao"),
    P("CAFÉ EXPRESSO", "UN", 4.99, "bebidas", 2.3, 1.1, "manha"),
    P("FATIA DE TORTA", "KG", 67.99, "doces e bolos", 1.0, 0.27, "tarde"),
    P("BOLO DE TAPIOCA", "KG", 32.99, "doces e bolos", 1.2, 0.43, "tarde"),
    P("TORTA DECORADA", "KG", 69.99, "doces e bolos", 0.16, 1.7, "dia", {
      dow: [0.7, 0.7, 0.8, 0.9, 1.2, 1.7, 1.5],
      eventos: { Mães: 3, Natal: 2.5, "Ano Novo": 1.8 },
    }),
    P("SOPA DO DIA", "UN", 15.49, "refeições", 0.8, 1.15, "noite", {
      meses: CHUVA,
    }),
    P("MISTO QUENTE", "UN", 9.49, "salgados e lanches", 1.1, 1.3, "manha"),
    P("PÃO PIZZA", "UN", 10.99, "salgados e lanches", 0.9, 1.2, "tarde"),
    P("FATIA DE PIZZA", "UN", 10.99, "salgados e lanches", 0.8, 1.4, "noite", {
      dow: FIM_SEMANA,
    }),
    P("PUDIM", "KG", 36.99, "doces e bolos", 1.1, 0.23, "tarde"),
    P("CUSCUZ E RAÍZES", "KG", 36.99, "refeições", 0.9, 0.3, "manha", {
      meses: JUNINO.map((v) => 1 + v / 4),
    }),
    P(
      "REQUEIJÃO DE CORTE",
      "KG",
      64.99,
      "frios e laticínios",
      0.4,
      0.36,
      "tarde",
    ),
    P("NEGA MALUCA", "KG", 41.99, "doces e bolos", 1.0, 0.23, "tarde"),
    P("BOLO MESCLADO", "KG", 32.99, "doces e bolos", 0.7, 0.41, "tarde"),
    P(
      "COXINHA DE FRANGO",
      "UN",
      9.99,
      "salgados e lanches",
      0.7,
      1.25,
      "tarde",
    ),
    P("PÃO DE QUEIJO", "KG", 72.99, "salgados e lanches", 0.5, 0.19, "tarde"),
    P("PÃO ITALIANO", "KG", 24.99, "pães", 0.9, 0.3, "tarde"),
    P("BRIOCHE DE CALABRESA", "KG", 44.99, "pães", 0.55, 0.29, "tarde"),
    P("QUEIJO COALHO", "KG", 62.99, "frios e laticínios", 0.7, 0.16, "tarde", {
      meses: JUNINO.map((v) => 1 + v / 3),
    }),
    P("CAPPUCCINO 120ML", "UN", 12.49, "bebidas", 0.45, 1.2, "tarde", {
      meses: CHUVA.map((v) => 0.6 + v / 2.5),
    }),
    P("PÃO DE HAMBÚRGUER PCT", "UN", 22.99, "pães", 0.7, 1.1, "noite", {
      dow: FIM_SEMANA,
    }),
    P("BOLO DE CHOCOLATE", "KG", 32.99, "doces e bolos", 0.45, 0.45, "tarde"),
    P("REFRIGERANTE 2L", "UN", 12.99, "bebidas", 0.9, 1.05, "noite", {
      dow: FIM_SEMANA,
      meses: VERAO,
    }),
    P("ÁGUA MINERAL 500ML", "UN", 3.49, "bebidas", 1.4, 1.2, "dia", {
      meses: VERAO,
    }),
    P(
      "CERVEJA LATA 350ML",
      "UN",
      5.49,
      "bebidas alcoólicas",
      0.9,
      3.2,
      "noite",
      {
        dow: [0.6, 0.6, 0.7, 0.8, 1.4, 1.9, 1.5],
        meses: VERAO,
        eventos: { Carnaval: 2.5 },
      },
    ),
    P("PAMONHA", "UN", 12.49, "doces e bolos", 0.25, 1.4, "tarde", {
      meses: [0.4, 0.4, 0.5, 0.6, 1.6, 6, 1.4, 0.6, 0.5, 0.5, 0.4, 0.4],
    }),
    P("CANJICA COPO", "UN", 8.99, "doces e bolos", 0.12, 1.3, "tarde", {
      meses: JUNINO,
    }),
    P(
      "LICOR DE JENIPAPO 500ML",
      "UN",
      34.99,
      "bebidas alcoólicas",
      0.06,
      1.2,
      "tarde",
      { meses: JUNINO, eventos: { "São João": 3 } },
    ),
    P("PANETONE TRADICIONAL", "UN", 39.99, "doces e bolos", 0.16, 1.15, "dia", {
      meses: SO_DEZ,
    }),
    P("COLOMBA PASCAL", "UN", 46.99, "doces e bolos", 0.4, 1.1, "dia", {
      meses: [0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      eventos: { Santa: 3, Aleluia: 3.5 },
    }),
    P(
      "CROISSANT DE AMÊNDOAS",
      "UN",
      13.99,
      "doces e bolos",
      0.9,
      1.15,
      "manha",
      { inicio: "2026-07-14", tendencia: 1.2 },
    ),
    P("KIT CAFÉ COMPLETO", "UN", 21.99, "refeições", 0.9, 1, "manha", {
      inicio: "2025-09-01",
      tendencia: 0.9,
    }),
    P(
      "TORTA HOLANDESA FATIA",
      "UN",
      14.99,
      "doces e bolos",
      0.5,
      1.1,
      "tarde",
      { fim: "2026-09-28" },
    ),
    P(
      "SANDUÍCHE NATURAL",
      "UN",
      13.49,
      "salgados e lanches",
      0.7,
      1.1,
      "almoco",
      { tendencia: -0.35 },
    ),
    P("CAFÉ EM PÓ 500G", "UN", 27.99, "mercearia", 0.35, 1.05, "dia"),
    P("BISCOITO DE GOMA PCT", "UN", 8.99, "mercearia", 0.6, 1.2, "tarde"),
  ]),
  financeiro: {
    variaveis: [
      [
        "Farinha, açúcar e fermento",
        "Farinha e insumos de panificação",
        0.13,
        "Moinho Atlântico",
      ],
      [
        "Laticínios e frios",
        "Laticínios e frios",
        0.085,
        "Laticínios Recôncavo",
      ],
      ["Embalagens e sacolas", "Embalagens", 0.03, "EmbalaMais"],
      [
        "Bebidas e mercearia para revenda",
        "Mercadoria para revenda",
        0.1,
        "Distribuidora Bahia Bebidas",
      ],
      ["Hortifruti do buffet", "Hortifruti", 0.035, "Ceasa Salvador"],
    ],
    cargos: [
      "Padeiro",
      "Confeiteiro",
      "Balconista",
      "Operador de caixa",
      "Auxiliar de cozinha",
      "Barista",
    ],
    porte: 1,
    margem: 0.11,
  },
};

const MERCADO: Segmento = {
  id: "mercado",
  nome: "Mercado e mercearia",
  empresa: "Mercadinho Rio Vermelho",
  slogan: "Mercado de bairro",
  local: "Salvador, BA",
  lojas: "2 lojas · Rio Vermelho e Federação",
  icone: "ShoppingCart",
  resumo: "Mercearia, açougue, hortifruti, bebidas e limpeza.",
  exemplos: ["Arroz 5kg", "Carne moída", "Cerveja"],
  sobre:
    "mercado de bairro com duas lojas em Salvador (Rio Vermelho e Federação): mercearia, açougue, hortifruti, frios, bebidas, higiene e limpeza",
  termo: "compra",
  pedidosDia: 400,
  dow: [0.92, 0.88, 0.9, 0.93, 1.08, 1.32, 0.82],
  meses: [0.97, 0.93, 0.98, 0.97, 1.0, 1.02, 0.99, 0.98, 0.97, 1.0, 1.02, 1.16],
  crescimento: 0.07,
  abre: 7,
  fecha: 21,
  horarios: [
    [7, 21],
    [7, 21],
    [7, 21],
    [7, 21],
    [7, 21],
    [7, 21],
    [7, 13],
  ],
  horaPedidos: [
    [10.5, 1, 1.6],
    [18, 1.25, 1.5],
  ],
  perfis: {
    dia: [
      [10.5, 1, 1.8],
      [18, 1.2, 1.6],
    ],
    manha: [[9.5, 1, 1.6]],
    noite: [[18.8, 1, 1.4]],
  },
  eventos: {
    "Véspera de Natal": 1.8,
    Natal: 0.3,
    "Véspera de Ano Novo": 1.7,
    "Ano Novo": 0.3,
    "Sábado de Carnaval": 1.35,
    "Terça de Carnaval": 0.7,
    "Sábado de Aleluia": 1.3,
    "Véspera de São João": 1.45,
    "Véspera do Dia das Mães": 1.2,
    "Black Friday": 1.1,
  },
  pagamentos: [
    ["PIX", 0.36, 0.9],
    ["DÉBITO", 0.27, 1.0],
    ["CRÉDITO", 0.24, 1.35],
    ["DINHEIRO", 0.09, 0.6],
    ["VALE-ALIMENTAÇÃO", 0.04, 1.5],
  ],
  sigmaTicket: 1.0,
  categorias: [
    "mercearia",
    "açougue",
    "hortifruti",
    "frios e laticínios",
    "bebidas",
    "bebidas alcoólicas",
    "higiene e limpeza",
    "padaria",
  ],
  combos:
    "carnes + carvão, cerveja e refrigerante (churrasco de fim de semana); macarrão + molho de tomate e queijo ralado; café + leite + pão; produtos de limpeza entre si; hortifruti + carnes para o almoço",
  pares: [
    ["PICANHA BOVINA", "CARVÃO 4KG", 3.4],
    ["LINGUIÇA TOSCANA", "CARVÃO 4KG", 3.1],
    ["CERVEJA LATA 350ML", "CARVÃO 4KG", 2.6],
    ["CERVEJA LATA 350ML", "LINGUIÇA TOSCANA", 2.2],
    ["MACARRÃO ESPAGUETE 500G", "MOLHO DE TOMATE 340G", 3.2],
    ["CAFÉ 500G", "LEITE INTEGRAL 1L", 1.9],
    ["PÃO FRANCÊS", "MANTEIGA 200G", 2.3],
    ["ARROZ 5KG", "FEIJÃO CARIOCA 1KG", 2.8],
    ["DETERGENTE 500ML", "ESPONJA DUPLA FACE", 2.7],
    ["SABÃO EM PÓ 1,6KG", "AMACIANTE 2L", 2.9],
    ["TOMATE", "CEBOLA", 3.0],
    ["CARNE MOÍDA", "TOMATE", 1.8],
    ["FRANGO INTEIRO", "TEMPERO BAIANO", 2.4],
  ],
  produtos: comCodigo(2001, [
    P("PÃO FRANCÊS", "UN", 0.79, "padaria", 7, 8, "manha"),
    P("ARROZ 5KG", "UN", 27.9, "mercearia", 3, 1.05, "dia", {
      meses: [1.15, 0.95, 0.95, 0.95, 1, 1, 1, 1, 0.95, 1, 1, 1],
    }),
    P("FEIJÃO CARIOCA 1KG", "UN", 8.49, "mercearia", 3.2, 1.6, "dia"),
    P("CAFÉ 500G", "UN", 28.9, "mercearia", 2.6, 1.15, "dia"),
    P("ÓLEO DE SOJA 900ML", "UN", 7.99, "mercearia", 2.1, 1.3, "dia"),
    P("AÇÚCAR CRISTAL 1KG", "UN", 4.99, "mercearia", 2.2, 1.5, "dia"),
    P("LEITE INTEGRAL 1L", "UN", 5.99, "frios e laticínios", 4.5, 3, "dia"),
    P("MACARRÃO ESPAGUETE 500G", "UN", 4.79, "mercearia", 2.2, 1.6, "dia"),
    P("MOLHO DE TOMATE 340G", "UN", 3.29, "mercearia", 1.9, 1.7, "dia"),
    P("FARINHA DE MANDIOCA 1KG", "UN", 7.49, "mercearia", 1.5, 1.1, "dia"),
    P("TEMPERO BAIANO", "UN", 3.99, "mercearia", 0.9, 1.1, "dia"),
    P("CARNE MOÍDA", "KG", 39.9, "açougue", 2.6, 0.9, "dia"),
    P("PICANHA BOVINA", "KG", 79.9, "açougue", 0.9, 1.1, "noite", {
      dow: [0.6, 0.6, 0.6, 0.7, 1.3, 2.2, 1.9],
      eventos: { "Ano Novo": 2.5, Natal: 1.8, Pais: 2 },
    }),
    P("FRANGO INTEIRO", "KG", 14.9, "açougue", 2.0, 2.3, "dia", {
      dow: [0.9, 0.9, 0.9, 0.9, 1, 1.25, 1.4],
    }),
    P("LINGUIÇA TOSCANA", "KG", 26.9, "açougue", 1.3, 1, "noite", {
      dow: [0.6, 0.6, 0.6, 0.7, 1.3, 2.1, 1.9],
      meses: JUNINO.map((v) => 1 + v / 6),
    }),
    P("ALCATRA", "KG", 54.9, "açougue", 1.0, 1, "dia"),
    P("PEIXE VERMELHO", "KG", 49.9, "açougue", 0.5, 1.2, "dia", {
      eventos: { Santa: 6, "Quinta-feira Santa": 5 },
    }),
    P("BACALHAU DESFIADO", "KG", 89.9, "açougue", 0.12, 0.6, "dia", {
      eventos: { Santa: 12, Natal: 4 },
      meses: [0.5, 0.5, 1.6, 1.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6, 0.8, 2.2],
    }),
    P("TOMATE", "KG", 7.99, "hortifruti", 3, 0.9, "dia"),
    P("CEBOLA", "KG", 5.49, "hortifruti", 2.6, 0.8, "dia"),
    P("BANANA PRATA", "KG", 6.99, "hortifruti", 2.4, 1.3, "dia"),
    P("BATATA INGLESA", "KG", 6.49, "hortifruti", 1.8, 1.4, "dia"),
    P(
      "QUEIJO MUSSARELA FATIADO",
      "KG",
      52.9,
      "frios e laticínios",
      1.9,
      0.25,
      "dia",
    ),
    P("PRESUNTO FATIADO", "KG", 39.9, "frios e laticínios", 1.4, 0.25, "dia"),
    P("MANTEIGA 200G", "UN", 13.9, "frios e laticínios", 1.1, 1.05, "manha"),
    P("IOGURTE 170G", "UN", 3.49, "frios e laticínios", 1.6, 2.4, "dia", {
      meses: VERAO,
    }),
    P("CERVEJA LATA 350ML", "UN", 4.29, "bebidas alcoólicas", 3.6, 6, "noite", {
      dow: [0.6, 0.6, 0.7, 0.85, 1.4, 1.9, 1.5],
      meses: VERAO,
      eventos: { Carnaval: 2.2, "São João": 1.8 },
    }),
    P("REFRIGERANTE 2L", "UN", 10.99, "bebidas", 2.3, 1.3, "noite", {
      dow: FIM_SEMANA,
      meses: VERAO,
    }),
    P("ÁGUA MINERAL 1,5L", "UN", 3.49, "bebidas", 2.1, 3, "dia", {
      meses: VERAO,
    }),
    P("SUCO INTEGRAL 1L", "UN", 13.9, "bebidas", 0.8, 1.2, "dia", {
      tendencia: 0.25,
    }),
    P("CARVÃO 4KG", "UN", 24.9, "mercearia", 0.7, 1.05, "noite", {
      dow: [0.4, 0.4, 0.4, 0.6, 1.3, 2.5, 2.2],
      meses: VERAO,
    }),
    P("SABÃO EM PÓ 1,6KG", "UN", 22.9, "higiene e limpeza", 1.2, 1.05, "dia"),
    P("AMACIANTE 2L", "UN", 16.9, "higiene e limpeza", 0.9, 1.05, "dia"),
    P("DETERGENTE 500ML", "UN", 2.79, "higiene e limpeza", 1.8, 2, "dia"),
    P("ESPONJA DUPLA FACE", "UN", 1.99, "higiene e limpeza", 1.1, 2, "dia"),
    P(
      "PAPEL HIGIÊNICO 12 ROLOS",
      "UN",
      21.9,
      "higiene e limpeza",
      1.1,
      1,
      "dia",
    ),
    P("SABONETE 85G", "UN", 2.49, "higiene e limpeza", 1.0, 3, "dia"),
    P("PANETONE 400G", "UN", 24.9, "padaria", 0.35, 1.3, "dia", {
      meses: SO_DEZ,
    }),
    P("MILHO VERDE ESPIGA", "UN", 1.99, "hortifruti", 0.4, 6, "dia", {
      meses: JUNINO,
      eventos: { "São João": 2 },
    }),
    P("CHOCOLATE EM BARRA 90G", "UN", 7.49, "mercearia", 1.0, 1.3, "noite", {
      eventos: { Santa: 2.5, Aleluia: 3 },
    }),
    P("KOMBUCHA 300ML", "UN", 11.9, "bebidas", 0.6, 1.2, "dia", {
      inicio: "2026-06-02",
      tendencia: 1,
    }),
    P("REFRIGERANTE LATA 350ML", "UN", 4.99, "bebidas", 1.6, 2.2, "dia", {
      tendencia: -0.3,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Mercearia e bebidas para revenda",
        "Mercadoria para revenda",
        0.52,
        "Atacadão Distribuidor",
      ],
      [
        "Carnes do açougue",
        "Mercadoria para revenda",
        0.12,
        "Frigorífico Bahia",
      ],
      ["Hortifruti", "Hortifruti", 0.05, "Ceasa Salvador"],
      ["Embalagens e sacolas", "Embalagens", 0.012, "EmbalaMais"],
    ],
    cargos: [
      "Operador de caixa",
      "Repositor",
      "Açougueiro",
      "Auxiliar de hortifruti",
      "Fiscal de loja",
      "Entregador",
    ],
    porte: 0.85,
    margem: 0.06,
  },
};

const RESTAURANTE: Segmento = {
  id: "restaurante",
  nome: "Restaurante e lanchonete",
  empresa: "Restaurante Sabor de Itapuã",
  slogan: "Comida baiana, almoço e jantar",
  local: "Salvador, BA",
  lojas: "2 casas · Itapuã e Stella Maris",
  icone: "UtensilsCrossed",
  resumo: "Pratos executivos, moquecas, porções e bebidas.",
  exemplos: ["Moqueca de peixe", "Prato executivo", "Caipirinha"],
  sobre:
    "restaurante de comida baiana com duas casas em Salvador (Itapuã e Stella Maris): pratos executivos no almoço, moquecas e porções à noite, feijoada às quartas e sábados, bebidas",
  termo: "conta",
  pedidosDia: 150,
  dow: [0.82, 0.88, 0.95, 0.95, 1.12, 1.35, 1.25],
  meses: [1.18, 1.12, 1.05, 0.95, 0.9, 0.9, 1.0, 0.93, 0.92, 0.98, 1.0, 1.15],
  crescimento: 0.09,
  abre: 11,
  fecha: 23,
  horaPedidos: [
    [12.8, 1.2, 1.1],
    [20, 1, 1.4],
  ],
  perfis: {
    almoco: [[12.8, 1, 1.1]],
    jantar: [[20.2, 1, 1.3]],
    dia: [
      [12.8, 1.1, 1.2],
      [20, 1, 1.5],
    ],
  },
  eventos: {
    "Dia das Mães": 1.9,
    "Dia dos Pais": 1.6,
    "Dia dos Namorados": 1.7,
    Natal: 0.5,
    "Véspera de Natal": 0.7,
    "Véspera de Ano Novo": 0.6,
    "Ano Novo": 1.4,
    Carnaval: 1.25,
    Páscoa: 1.5,
    "Sexta-feira Santa": 1.4,
  },
  pagamentos: [
    ["CRÉDITO", 0.38, 1.15],
    ["PIX", 0.3, 0.9],
    ["DÉBITO", 0.2, 0.95],
    ["VALE-REFEIÇÃO", 0.08, 0.8],
    ["DINHEIRO", 0.04, 0.7],
  ],
  sigmaTicket: 0.75,
  categorias: [
    "pratos principais",
    "pratos executivos",
    "porções e petiscos",
    "sobremesas",
    "bebidas",
    "bebidas alcoólicas",
  ],
  combos:
    "prato executivo + suco ou refrigerante (almoço); moqueca + arroz/pirão extra + caipirinha ou cerveja (jantar); porções + cerveja; sobremesa + cafezinho no fim da refeição",
  pares: [
    ["MOQUECA DE PEIXE (2 PESSOAS)", "CAIPIRINHA DE LIMÃO", 2.4],
    ["MOQUECA DE CAMARÃO (2 PESSOAS)", "CAIPIRINHA DE LIMÃO", 2.3],
    ["PRATO EXECUTIVO FRANGO", "SUCO NATURAL 400ML", 2.6],
    ["PRATO EXECUTIVO CARNE", "SUCO NATURAL 400ML", 2.4],
    ["PORÇÃO DE ACARAJÉ (6 UN)", "CERVEJA 600ML", 2.8],
    ["PORÇÃO DE AIPIM FRITO", "CERVEJA 600ML", 2.7],
    ["FEIJOADA COMPLETA", "CAIPIRINHA DE LIMÃO", 2.9],
    ["COCADA DE FORNO", "CAFEZINHO", 2.2],
    ["MOQUECA DE PEIXE (2 PESSOAS)", "ARROZ E PIRÃO EXTRA", 3.2],
    ["BOBÓ DE CAMARÃO", "ARROZ E PIRÃO EXTRA", 2.6],
  ],
  produtos: comCodigo(3001, [
    P(
      "PRATO EXECUTIVO FRANGO",
      "UN",
      32.9,
      "pratos executivos",
      6,
      1.05,
      "almoco",
      { dow: [1.1, 1.1, 1.1, 1.1, 1.05, 0.6, 0.4] },
    ),
    P(
      "PRATO EXECUTIVO CARNE",
      "UN",
      36.9,
      "pratos executivos",
      5,
      1.05,
      "almoco",
      { dow: [1.1, 1.1, 1.1, 1.1, 1.05, 0.6, 0.4] },
    ),
    P(
      "PRATO EXECUTIVO PEIXE",
      "UN",
      38.9,
      "pratos executivos",
      3,
      1.05,
      "almoco",
      { dow: [1, 1, 1, 1, 1.3, 0.6, 0.4] },
    ),
    P(
      "MOQUECA DE PEIXE (2 PESSOAS)",
      "UN",
      119.9,
      "pratos principais",
      2,
      1,
      "dia",
      { dow: [0.6, 0.7, 0.8, 0.8, 1.2, 1.6, 1.7], eventos: { Santa: 2.8 } },
    ),
    P(
      "MOQUECA DE CAMARÃO (2 PESSOAS)",
      "UN",
      149.9,
      "pratos principais",
      1.3,
      1,
      "dia",
      { dow: [0.6, 0.7, 0.8, 0.8, 1.2, 1.6, 1.7], eventos: { Santa: 2.5 } },
    ),
    P("BOBÓ DE CAMARÃO", "UN", 89.9, "pratos principais", 1.1, 1, "dia", {
      dow: [0.7, 0.7, 0.8, 0.8, 1.2, 1.5, 1.6],
    }),
    P("FEIJOADA COMPLETA", "UN", 59.9, "pratos principais", 2.4, 1, "almoco", {
      dow: [0, 0, 2.3, 0, 0, 3.6, 0],
      meses: CHUVA.map((v) => 0.7 + v / 3),
    }),
    P("PICANHA NA CHAPA", "UN", 129.9, "pratos principais", 0.8, 1, "jantar", {
      dow: FIM_SEMANA,
    }),
    P("ARROZ E PIRÃO EXTRA", "UN", 14.9, "pratos principais", 2.2, 1.1, "dia"),
    P(
      "PORÇÃO DE ACARAJÉ (6 UN)",
      "UN",
      42.9,
      "porções e petiscos",
      2.2,
      1,
      "jantar",
    ),
    P(
      "PORÇÃO DE AIPIM FRITO",
      "UN",
      29.9,
      "porções e petiscos",
      2.4,
      1.05,
      "jantar",
    ),
    P(
      "BOLINHO DE BACALHAU (8 UN)",
      "UN",
      44.9,
      "porções e petiscos",
      1.4,
      1,
      "jantar",
      { inicio: "2026-05-05", tendencia: 0.8 },
    ),
    P(
      "CASQUINHA DE SIRI",
      "UN",
      24.9,
      "porções e petiscos",
      1.5,
      1.4,
      "jantar",
      { tendencia: -0.4 },
    ),
    P("COCADA DE FORNO", "UN", 16.9, "sobremesas", 1.8, 1.1, "dia"),
    P("PUDIM DE LEITE", "UN", 14.9, "sobremesas", 1.3, 1.1, "dia"),
    P("CAFEZINHO", "UN", 5.5, "bebidas", 2.5, 1.4, "almoco"),
    P("SUCO NATURAL 400ML", "UN", 12.9, "bebidas", 5.5, 1.3, "almoco", {
      meses: VERAO,
    }),
    P("REFRIGERANTE LATA", "UN", 7.5, "bebidas", 4.2, 1.4, "dia"),
    P("ÁGUA DE COCO", "UN", 9.9, "bebidas", 2.2, 1.3, "dia", { meses: VERAO }),
    P("ÁGUA MINERAL", "UN", 5.5, "bebidas", 2.5, 1.3, "dia"),
    P("CERVEJA 600ML", "UN", 16.9, "bebidas alcoólicas", 4.2, 2.6, "jantar", {
      dow: FIM_SEMANA,
      meses: VERAO,
    }),
    P(
      "CAIPIRINHA DE LIMÃO",
      "UN",
      22.9,
      "bebidas alcoólicas",
      2.6,
      1.6,
      "jantar",
      { dow: FIM_SEMANA, meses: VERAO },
    ),
    P("CHOPP 300ML", "UN", 11.9, "bebidas alcoólicas", 1.8, 2.2, "jantar", {
      inicio: "2025-11-10",
      tendencia: 0.5,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Peixes e frutos do mar",
        "Mercadoria para revenda",
        0.14,
        "Pescados Itapuã",
      ],
      [
        "Carnes, aves e mercearia",
        "Mercadoria para revenda",
        0.11,
        "Atacadão Distribuidor",
      ],
      [
        "Bebidas para revenda",
        "Mercadoria para revenda",
        0.08,
        "Distribuidora Bahia Bebidas",
      ],
      ["Hortifruti e dendê", "Hortifruti", 0.04, "Ceasa Salvador"],
      ["Embalagens de delivery", "Embalagens", 0.02, "EmbalaMais"],
    ],
    cargos: [
      "Cozinheiro",
      "Auxiliar de cozinha",
      "Garçom",
      "Bartender",
      "Operador de caixa",
      "Maître",
    ],
    porte: 0.8,
    margem: 0.12,
  },
};

const ROUPAS: Segmento = {
  id: "roupas",
  nome: "Loja de roupas e acessórios",
  empresa: "Ateliê Pelourinho Moda",
  slogan: "Moda praia, casual e acessórios",
  local: "Salvador, BA",
  lojas: "2 lojas · Pelourinho e Shopping da Bahia",
  icone: "Shirt",
  resumo: "Moda praia, vestidos, camisetas, calçados e acessórios.",
  exemplos: ["Biquíni", "Vestido midi", "Abadá customizado"],
  sobre:
    "loja de moda com duas unidades em Salvador (Pelourinho e Shopping da Bahia): moda praia, vestidos, camisetas, bermudas, calçados e acessórios; vende muito no verão, no Carnaval (fantasias e abadás customizados), Dia das Mães, Black Friday e Natal",
  termo: "venda",
  pedidosDia: 13,
  dow: [0.8, 0.82, 0.88, 0.92, 1.12, 1.55, 0.95],
  meses: [
    1.05, 1.15, 0.85, 0.82, 1.05, 0.95, 0.88, 0.85, 0.85, 0.92, 1.12, 1.6,
  ],
  crescimento: 0.14,
  abre: 9,
  fecha: 21,
  horarios: [
    [9, 19],
    [9, 19],
    [9, 19],
    [9, 19],
    [9, 19],
    [9, 20],
    [13, 20],
  ],
  horaPedidos: [
    [11.5, 0.8, 1.6],
    [16.5, 1.2, 2],
  ],
  perfis: {
    dia: [
      [11.5, 0.8, 1.6],
      [16.5, 1.2, 2],
    ],
  },
  eventos: {
    "Véspera do Dia das Mães": 2.6,
    "Dia das Mães": 0.8,
    "Véspera do Dia dos Pais": 2,
    "Dia dos Namorados": 1.8,
    "Black Friday": 3.2,
    "Véspera de Natal": 2.4,
    "Sábado de Carnaval": 0.4,
    "Domingo de Carnaval": 0.3,
    "Segunda de Carnaval": 0.3,
    "Terça de Carnaval": 0.3,
    "Véspera de Ano Novo": 1.6,
  },
  pagamentos: [
    ["CRÉDITO PARCELADO", 0.36, 1.45],
    ["CRÉDITO À VISTA", 0.22, 1.0],
    ["PIX", 0.28, 0.8],
    ["DÉBITO", 0.11, 0.8],
    ["DINHEIRO", 0.03, 0.6],
  ],
  sigmaTicket: 0.7,
  categorias: [
    "moda praia",
    "vestidos e saias",
    "camisetas e blusas",
    "bermudas e calças",
    "calçados",
    "acessórios",
    "carnaval",
  ],
  combos:
    "biquíni + saída de praia + chapéu; vestido + sandália + bolsa; camiseta + bermuda; acessórios (brinco, colar) como complemento de qualquer peça",
  pares: [
    ["BIQUÍNI ESTAMPADO", "SAÍDA DE PRAIA", 3.1],
    ["BIQUÍNI ESTAMPADO", "CHAPÉU DE PALHA", 2.4],
    ["VESTIDO MIDI LINHO", "SANDÁLIA DE COURO", 2.6],
    ["VESTIDO MIDI LINHO", "BOLSA DE PALHA", 2.2],
    ["CAMISETA BÁSICA ALGODÃO", "BERMUDA SARJA", 2.5],
    ["ABADÁ CUSTOMIZADO", "BRINCO ARTESANAL", 1.9],
    ["SANDÁLIA DE COURO", "BOLSA DE PALHA", 1.8],
  ],
  produtos: comCodigo(4001, [
    P("BIQUÍNI ESTAMPADO", "UN", 129.9, "moda praia", 4, 1.1, "dia", {
      meses: [1.6, 1.4, 1, 0.7, 0.6, 0.5, 0.5, 0.6, 0.8, 1.1, 1.4, 1.8],
    }),
    P("SAÍDA DE PRAIA", "UN", 149.9, "moda praia", 2.2, 1, "dia", {
      meses: VERAO,
    }),
    P("SUNGA", "UN", 79.9, "moda praia", 1.5, 1.05, "dia", { meses: VERAO }),
    P("VESTIDO MIDI LINHO", "UN", 239.9, "vestidos e saias", 3.2, 1, "dia"),
    P(
      "VESTIDO CURTO ESTAMPADO",
      "UN",
      169.9,
      "vestidos e saias",
      2.8,
      1.05,
      "dia",
    ),
    P("SAIA LONGA", "UN", 149.9, "vestidos e saias", 1.4, 1, "dia"),
    P(
      "CAMISETA BÁSICA ALGODÃO",
      "UN",
      59.9,
      "camisetas e blusas",
      5,
      1.6,
      "dia",
    ),
    P("BLUSA CROPPED", "UN", 79.9, "camisetas e blusas", 2.4, 1.2, "dia", {
      tendencia: -0.3,
    }),
    P(
      "CAMISA LINHO MASCULINA",
      "UN",
      189.9,
      "camisetas e blusas",
      1.6,
      1,
      "dia",
      { eventos: { Pais: 3 } },
    ),
    P("BERMUDA SARJA", "UN", 119.9, "bermudas e calças", 2.3, 1.05, "dia"),
    P("CALÇA PANTALONA", "UN", 179.9, "bermudas e calças", 1.4, 1, "dia"),
    P("SANDÁLIA DE COURO", "UN", 159.9, "calçados", 2.4, 1, "dia"),
    P("TÊNIS CASUAL", "UN", 249.9, "calçados", 1.2, 1, "dia"),
    P("BOLSA DE PALHA", "UN", 139.9, "acessórios", 1.6, 1, "dia", {
      meses: VERAO,
    }),
    P("CHAPÉU DE PALHA", "UN", 69.9, "acessórios", 1.3, 1, "dia", {
      meses: VERAO,
    }),
    P("BRINCO ARTESANAL", "UN", 49.9, "acessórios", 3, 1.25, "dia"),
    P("COLAR DE MIÇANGAS", "UN", 39.9, "acessórios", 2, 1.2, "dia"),
    P("ÓCULOS DE SOL", "UN", 129.9, "acessórios", 1.2, 1, "dia", {
      meses: VERAO,
    }),
    P("ABADÁ CUSTOMIZADO", "UN", 89.9, "carnaval", 1.8, 1.4, "dia", {
      meses: [3.5, 4.5, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.2, 1.2],
    }),
    P("FANTASIA DE CARNAVAL", "UN", 119.9, "carnaval", 0.9, 1.1, "dia", {
      meses: [3, 4, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.8],
    }),
    P(
      "CONJUNTO LINHO FEMININO",
      "UN",
      289.9,
      "vestidos e saias",
      1.5,
      1,
      "dia",
      { inicio: "2026-08-03", tendencia: 1.1 },
    ),
    P(
      "CAMISA ESTAMPA BAHIA",
      "UN",
      99.9,
      "camisetas e blusas",
      1.5,
      1.2,
      "dia",
      { fim: "2026-09-20" },
    ),
  ]),
  financeiro: {
    variaveis: [
      [
        "Compra de coleção",
        "Mercadoria para revenda",
        0.38,
        "Confecções Nordeste",
      ],
      [
        "Acessórios de artesãs locais",
        "Mercadoria para revenda",
        0.06,
        "Coletivo Artesãs da Bahia",
      ],
      ["Sacolas e embalagens", "Embalagens", 0.015, "EmbalaMais"],
    ],
    cargos: [
      "Vendedora",
      "Vendedor",
      "Gerente de loja",
      "Estoquista",
      "Operadora de caixa",
      "Costureira",
    ],
    porte: 0.25,
    margem: 0.14,
  },
};

const FARMACIA: Segmento = {
  id: "farmacia",
  nome: "Farmácia e perfumaria",
  empresa: "Farmácia Bonfim Saúde",
  slogan: "Medicamentos, higiene e beleza",
  local: "Salvador, BA",
  lojas: "2 lojas · Bonfim e Ribeira",
  icone: "Pill",
  resumo: "Medicamentos, dermocosméticos, higiene e conveniência.",
  exemplos: ["Dipirona", "Protetor solar", "Fraldas"],
  sobre:
    "farmácia com duas lojas em Salvador (Bonfim e Ribeira): medicamentos isentos de prescrição e genéricos, dermocosméticos, protetor solar, higiene, fraldas e conveniência",
  termo: "venda",
  pedidosDia: 80,
  dow: [1.08, 1.02, 1.0, 0.99, 1.02, 0.98, 0.78],
  meses: [
    0.98, 0.95, 0.98, 1.02, 1.06, 1.08, 1.06, 1.0, 0.96, 0.96, 0.96, 1.02,
  ],
  crescimento: 0.08,
  abre: 7,
  fecha: 22,
  horaPedidos: [
    [9.5, 1, 1.8],
    [18.5, 1.15, 1.8],
  ],
  perfis: {
    dia: [
      [9.5, 1, 1.8],
      [18.5, 1.15, 1.8],
    ],
    manha: [[9, 1, 1.6]],
    noite: [[19, 1, 1.6]],
  },
  eventos: {
    "Véspera do Dia das Mães": 1.3,
    "Black Friday": 1.25,
    Carnaval: 1.15,
    Natal: 0.55,
    "Ano Novo": 0.6,
  },
  pagamentos: [
    ["CRÉDITO", 0.33, 1.25],
    ["PIX", 0.3, 0.9],
    ["DÉBITO", 0.27, 0.9],
    ["DINHEIRO", 0.1, 0.6],
  ],
  sigmaTicket: 0.8,
  categorias: [
    "medicamentos",
    "genéricos",
    "dermocosméticos",
    "higiene pessoal",
    "infantil",
    "conveniência",
  ],
  combos:
    "antigripal + vitamina C + lenço; protetor solar + hidratante pós-sol; fralda + lenço umedecido; escova + creme dental + fio dental",
  pares: [
    ["ANTIGRIPAL CÁPSULAS", "VITAMINA C 1G", 2.6],
    ["ANTIGRIPAL CÁPSULAS", "PASTILHA PARA GARGANTA", 2.3],
    ["PROTETOR SOLAR FPS 50", "HIDRATANTE PÓS-SOL", 3],
    ["FRALDA INFANTIL PACOTE", "LENÇO UMEDECIDO", 3.3],
    ["CREME DENTAL 90G", "ESCOVA DE DENTES", 2.6],
    ["DIPIRONA 500MG", "SORO FISIOLÓGICO 500ML", 1.7],
    ["REPELENTE SPRAY", "PROTETOR SOLAR FPS 50", 1.8],
  ],
  produtos: comCodigo(5001, [
    P("DIPIRONA 500MG", "UN", 8.99, "genéricos", 6, 1.15, "dia", {
      meses: CHUVA.map((v) => 0.7 + v / 3),
    }),
    P("PARACETAMOL 750MG", "UN", 9.49, "genéricos", 4, 1.1, "dia", {
      meses: CHUVA.map((v) => 0.6 + v / 2.5),
    }),
    P("IBUPROFENO 400MG", "UN", 14.9, "genéricos", 3, 1.05, "dia"),
    P("LOSARTANA 50MG", "UN", 12.9, "genéricos", 3.6, 1.6, "manha"),
    P("ANTIGRIPAL CÁPSULAS", "UN", 24.9, "medicamentos", 2.2, 1.05, "noite", {
      meses: CHUVA,
    }),
    P("XAROPE PARA TOSSE", "UN", 32.9, "medicamentos", 1.6, 1, "noite", {
      meses: CHUVA,
    }),
    P("PASTILHA PARA GARGANTA", "UN", 14.9, "medicamentos", 1.2, 1.1, "dia", {
      meses: CHUVA,
    }),
    P("VITAMINA C 1G", "UN", 29.9, "medicamentos", 1.6, 1, "dia", {
      meses: CHUVA.map((v) => 0.6 + v / 2.5),
    }),
    P("OMEPRAZOL 20MG", "UN", 16.9, "genéricos", 2.4, 1.05, "dia", {
      eventos: { Natal: 1.8, "Ano Novo": 2, Carnaval: 1.6 },
    }),
    P("SORO FISIOLÓGICO 500ML", "UN", 8.49, "medicamentos", 1.6, 1.4, "dia"),
    P("PROTETOR SOLAR FPS 50", "UN", 69.9, "dermocosméticos", 2.2, 1.05, "dia", {
      meses: [1.7, 1.6, 1.2, 0.8, 0.6, 0.5, 0.55, 0.65, 0.85, 1.1, 1.4, 1.8],
      eventos: { Carnaval: 2.2 },
    }),
    P("HIDRATANTE PÓS-SOL", "UN", 42.9, "dermocosméticos", 0.9, 1, "dia", {
      meses: VERAO,
    }),
    P(
      "SÉRUM VITAMINA C FACIAL",
      "UN",
      119.9,
      "dermocosméticos",
      0.6,
      1,
      "dia",
      { inicio: "2025-10-06", tendencia: 0.9 },
    ),
    P("SHAMPOO 350ML", "UN", 24.9, "higiene pessoal", 2, 1.1, "dia"),
    P("DESODORANTE AEROSOL", "UN", 18.9, "higiene pessoal", 2.6, 1.2, "dia"),
    P("CREME DENTAL 90G", "UN", 7.49, "higiene pessoal", 2.6, 1.6, "dia"),
    P("ESCOVA DE DENTES", "UN", 12.9, "higiene pessoal", 1.4, 1.3, "dia"),
    P("ABSORVENTE C/16", "UN", 14.9, "higiene pessoal", 1.6, 1.3, "dia"),
    P("FRALDA INFANTIL PACOTE", "UN", 69.9, "infantil", 1.6, 1.2, "dia"),
    P("LENÇO UMEDECIDO", "UN", 14.9, "infantil", 1.8, 1.4, "dia"),
    P("REPELENTE SPRAY", "UN", 29.9, "conveniência", 1.3, 1, "noite", {
      meses: [1.3, 1.4, 1.6, 1.5, 1.3, 1, 0.8, 0.7, 0.7, 0.8, 0.9, 1.1],
    }),
    P("ÁGUA MINERAL 500ML", "UN", 3.5, "conveniência", 2, 1.4, "dia", {
      meses: VERAO,
    }),
    P("PRESERVATIVO C/3", "UN", 16.9, "conveniência", 0.9, 1.1, "noite", {
      eventos: { Carnaval: 6, Namorados: 2 },
    }),
    P("TESTE DE GRAVIDEZ", "UN", 19.9, "medicamentos", 0.5, 1, "dia"),
    P("POLIVITAMÍNICO 60 CÁPS", "UN", 54.9, "medicamentos", 0.9, 1, "manha", {
      tendencia: -0.25,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Medicamentos (distribuidora)",
        "Mercadoria para revenda",
        0.48,
        "Distribuidora Saúde Nordeste",
      ],
      [
        "Perfumaria e dermocosméticos",
        "Mercadoria para revenda",
        0.13,
        "Beleza Distribuição",
      ],
      ["Sacolas e embalagens", "Embalagens", 0.008, "EmbalaMais"],
    ],
    cargos: [
      "Farmacêutico",
      "Balconista",
      "Operador de caixa",
      "Repositor",
      "Entregador",
      "Gerente de loja",
    ],
    porte: 0.4,
    margem: 0.09,
  },
};

const ACAI: Segmento = {
  id: "acai",
  nome: "Açaí e sorveteria",
  empresa: "Açaí da Orla Ondina",
  slogan: "Açaí, sorvetes e milk-shakes",
  local: "Salvador, BA",
  lojas: "2 lojas · Ondina e Jardim de Alah",
  icone: "IceCreamCone",
  resumo: "Copos de açaí, sorvete por quilo, milk-shakes e adicionais.",
  exemplos: ["Açaí 500ml", "Sorvete por quilo", "Milk-shake"],
  sobre:
    "açaiteria e sorveteria com duas lojas na orla de Salvador (Ondina e Jardim de Alah): açaí no copo, sorvete por quilo, milk-shakes, picolés e adicionais; depende muito do calor, dos fins de semana e da movimentação da praia",
  termo: "pedido",
  pedidosDia: 75,
  dow: [0.72, 0.75, 0.8, 0.85, 1.05, 1.5, 1.6],
  meses: [1.35, 1.3, 1.15, 0.92, 0.75, 0.68, 0.7, 0.78, 0.88, 1.0, 1.12, 1.3],
  crescimento: 0.12,
  abre: 10,
  fecha: 22,
  horaPedidos: [
    [15.5, 1, 2],
    [20, 0.8, 1.3],
  ],
  perfis: {
    tarde: [
      [15.5, 1, 2],
      [20, 0.8, 1.3],
    ],
    noite: [[20, 1, 1.3]],
  },
  eventos: {
    Carnaval: 1.8,
    "Ano Novo": 1.4,
    Iemanjá: 1.9,
    Natal: 0.6,
    "Dia das Crianças": 1.7,
  },
  pagamentos: [
    ["PIX", 0.52, 0.95],
    ["DÉBITO", 0.2, 1.0],
    ["CRÉDITO", 0.2, 1.2],
    ["DINHEIRO", 0.08, 0.7],
  ],
  sigmaTicket: 0.6,
  categorias: ["açaí", "sorvetes", "milk-shakes", "adicionais", "bebidas"],
  combos:
    "açaí + adicionais (leite em pó, granola, frutas); sorvete + calda; milk-shake + adicional; água para quem vem da praia",
  pares: [
    ["AÇAÍ 500ML", "ADICIONAL LEITE EM PÓ", 3.1],
    ["AÇAÍ 500ML", "ADICIONAL GRANOLA", 2.8],
    ["AÇAÍ 300ML", "ADICIONAL LEITE CONDENSADO", 2.7],
    ["AÇAÍ 700ML", "ADICIONAL NUTELLA", 2.9],
    ["SORVETE POR QUILO", "CALDA DE CHOCOLATE", 2.6],
    ["MILK-SHAKE 400ML", "ADICIONAL NUTELLA", 2],
  ],
  produtos: comCodigo(6001, [
    P("AÇAÍ 300ML", "UN", 16.9, "açaí", 7, 1.05, "tarde"),
    P("AÇAÍ 500ML", "UN", 24.9, "açaí", 8, 1.1, "tarde"),
    P("AÇAÍ 700ML", "UN", 32.9, "açaí", 3.4, 1.05, "tarde"),
    P("AÇAÍ NA TIGELA 1L", "UN", 44.9, "açaí", 1.2, 1, "noite", {
      dow: FIM_SEMANA,
    }),
    P("SORVETE POR QUILO", "KG", 79.9, "sorvetes", 4.5, 0.32, "tarde"),
    P("PICOLÉ DE FRUTA", "UN", 6.5, "sorvetes", 3.2, 1.8, "tarde", {
      meses: VERAO,
    }),
    P("MILK-SHAKE 400ML", "UN", 22.9, "milk-shakes", 2.6, 1.1, "noite"),
    P("ADICIONAL LEITE EM PÓ", "UN", 3, "adicionais", 6, 1.1, "tarde"),
    P("ADICIONAL GRANOLA", "UN", 3, "adicionais", 4, 1.05, "tarde"),
    P("ADICIONAL LEITE CONDENSADO", "UN", 3.5, "adicionais", 4.4, 1.1, "tarde"),
    P("ADICIONAL NUTELLA", "UN", 7.5, "adicionais", 2.2, 1, "tarde"),
    P("ADICIONAL MORANGO", "UN", 4.5, "adicionais", 2.4, 1, "tarde"),
    P("CALDA DE CHOCOLATE", "UN", 3, "adicionais", 1.8, 1, "tarde"),
    P("ÁGUA MINERAL 500ML", "UN", 4, "bebidas", 2.4, 1.3, "tarde", {
      meses: VERAO,
    }),
    P("ÁGUA DE COCO 300ML", "UN", 7.9, "bebidas", 1.6, 1.2, "tarde", {
      meses: VERAO,
    }),
    P("AÇAÍ ZERO AÇÚCAR 500ML", "UN", 27.9, "açaí", 1.6, 1, "tarde", {
      inicio: "2026-03-09",
      tendencia: 1.1,
    }),
    P("SORVETE DE TAPIOCA BOLA", "UN", 9.9, "sorvetes", 1.2, 1.3, "tarde", {
      tendencia: -0.4,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Polpa de açaí",
        "Mercadoria para revenda",
        0.2,
        "Açaí do Pará Distribuidora",
      ],
      [
        "Sorvetes e insumos",
        "Mercadoria para revenda",
        0.12,
        "Gelatos Nordeste",
      ],
      ["Copos, colheres e embalagens", "Embalagens", 0.05, "EmbalaMais"],
      ["Frutas e adicionais", "Hortifruti", 0.04, "Ceasa Salvador"],
    ],
    cargos: [
      "Atendente",
      "Operador de caixa",
      "Auxiliar de produção",
      "Supervisor de loja",
      "Entregador",
    ],
    porte: 0.25,
    margem: 0.16,
  },
};

const PET: Segmento = {
  id: "pet",
  nome: "Pet shop",
  empresa: "Pet Shop Patamares",
  slogan: "Ração, banho e tosa",
  local: "Salvador, BA",
  lojas: "2 lojas · Patamares e Imbuí",
  icone: "PawPrint",
  resumo: "Rações, petiscos, acessórios, banho e tosa.",
  exemplos: ["Ração 15kg", "Banho e tosa", "Antipulgas"],
  sobre:
    "pet shop com duas lojas em Salvador (Patamares e Imbuí): rações, petiscos, acessórios, antipulgas e serviços de banho e tosa com hora marcada",
  termo: "venda",
  pedidosDia: 40,
  dow: [0.95, 0.92, 0.92, 0.95, 1.1, 1.5, 0.55],
  meses: [1.05, 0.95, 0.95, 0.95, 0.95, 0.95, 1.0, 0.98, 0.98, 1.0, 1.02, 1.25],
  crescimento: 0.1,
  abre: 8,
  fecha: 19,
  horarios: [
    [8, 19],
    [8, 19],
    [8, 19],
    [8, 19],
    [8, 19],
    [8, 18],
    [9, 13],
  ],
  horaPedidos: [
    [10.5, 1, 1.6],
    [16.5, 1, 1.8],
  ],
  perfis: {
    dia: [
      [10.5, 1, 1.6],
      [16.5, 1, 1.8],
    ],
    manha: [[10, 1, 1.4]],
  },
  eventos: { "Véspera de Natal": 1.6, "Black Friday": 1.8, Natal: 0.4 },
  pagamentos: [
    ["CRÉDITO", 0.42, 1.25],
    ["PIX", 0.33, 0.85],
    ["DÉBITO", 0.2, 0.9],
    ["DINHEIRO", 0.05, 0.6],
  ],
  sigmaTicket: 0.8,
  categorias: [
    "rações",
    "petiscos",
    "farmácia pet",
    "acessórios",
    "higiene",
    "serviços",
  ],
  combos:
    "banho e tosa + petisco ou perfume; ração + petisco; antipulgas + vermífugo; ração filhote + brinquedo",
  pares: [
    ["BANHO CÃO PORTE MÉDIO", "PERFUME PET", 2.5],
    ["BANHO E TOSA PORTE PEQUENO", "LAÇO E GRAVATINHA", 2.8],
    ["RAÇÃO CÃO ADULTO 15KG", "PETISCO BIFINHO", 2.1],
    ["ANTIPULGAS COMPRIMIDO", "VERMÍFUGO", 2.6],
    ["RAÇÃO GATO 10KG", "AREIA SANITÁRIA 4KG", 3.0],
  ],
  produtos: comCodigo(7001, [
    P("RAÇÃO CÃO ADULTO 15KG", "UN", 219.9, "rações", 3.2, 1, "dia"),
    P("RAÇÃO CÃO FILHOTE 3KG", "UN", 79.9, "rações", 1.4, 1, "dia"),
    P("RAÇÃO GATO 10KG", "UN", 189.9, "rações", 2.2, 1, "dia"),
    P("RAÇÃO ÚMIDA SACHÊ", "UN", 4.49, "rações", 3.5, 4, "dia"),
    P("RAÇÃO A GRANEL", "KG", 24.9, "rações", 2.2, 2, "dia"),
    P("AREIA SANITÁRIA 4KG", "UN", 29.9, "higiene", 2, 1.3, "dia"),
    P("PETISCO BIFINHO", "UN", 12.9, "petiscos", 3.3, 1.4, "dia"),
    P("OSSO NATURAL", "UN", 15.9, "petiscos", 1.4, 1.2, "dia"),
    P("ANTIPULGAS COMPRIMIDO", "UN", 99.9, "farmácia pet", 1.6, 1, "dia", {
      meses: VERAO,
    }),
    P("VERMÍFUGO", "UN", 34.9, "farmácia pet", 1.2, 1.1, "dia"),
    P("BANHO CÃO PORTE MÉDIO", "UN", 75, "serviços", 3, 1, "manha", {
      dow: [0.9, 0.9, 0.9, 0.9, 1.2, 1.7, 0],
    }),
    P("BANHO E TOSA PORTE PEQUENO", "UN", 95, "serviços", 2.4, 1, "manha", {
      dow: [0.9, 0.9, 0.9, 0.9, 1.2, 1.7, 0],
      eventos: { Natal: 2, "Ano Novo": 1.6 },
    }),
    P("TOSA HIGIÊNICA", "UN", 45, "serviços", 1.3, 1, "manha", {
      dow: [0.9, 0.9, 0.9, 0.9, 1.2, 1.7, 0],
    }),
    P("PERFUME PET", "UN", 29.9, "higiene", 1.2, 1, "dia"),
    P("SHAMPOO PET", "UN", 27.9, "higiene", 1, 1, "dia"),
    P("LAÇO E GRAVATINHA", "UN", 9.9, "acessórios", 1.4, 1.2, "dia"),
    P("COLEIRA AJUSTÁVEL", "UN", 39.9, "acessórios", 0.8, 1, "dia"),
    P("BRINQUEDO MORDEDOR", "UN", 24.9, "acessórios", 1.1, 1.1, "dia", {
      eventos: { Crianças: 2 },
    }),
    P("CAMA PET MÉDIA", "UN", 149.9, "acessórios", 0.4, 1, "dia", {
      meses: CHUVA.map((v) => 0.6 + v / 3),
    }),
    P("PLANO BANHO MENSAL", "UN", 260, "serviços", 0.6, 1, "manha", {
      inicio: "2026-04-01",
      tendencia: 1.2,
    }),
    P("RAÇÃO NATURAL CONGELADA", "KG", 54.9, "rações", 0.9, 1.4, "dia", {
      inicio: "2025-08-15",
      tendencia: 0.6,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Rações e petiscos para revenda",
        "Mercadoria para revenda",
        0.42,
        "PetDistri Nordeste",
      ],
      [
        "Medicamentos veterinários",
        "Mercadoria para revenda",
        0.06,
        "VetSul Distribuidora",
      ],
      ["Insumos de banho e tosa", "Mercadoria para revenda", 0.03, "Pet Clean"],
    ],
    cargos: [
      "Banhista",
      "Tosador",
      "Atendente",
      "Operador de caixa",
      "Auxiliar de loja",
      "Médico-veterinário",
    ],
    porte: 0.35,
    margem: 0.13,
  },
};

const SALAO: Segmento = {
  id: "salao",
  nome: "Salão de beleza (serviços)",
  empresa: "Studio Beleza da Graça",
  slogan: "Cabelo, unhas e estética",
  local: "Salvador, BA",
  lojas: "2 unidades · Graça e Caminho das Árvores",
  icone: "Scissors",
  resumo: "Cortes, escovas, coloração, tranças, unhas e estética.",
  exemplos: ["Escova", "Tranças box braids", "Manicure"],
  sobre:
    "salão de beleza com duas unidades em Salvador (Graça e Caminho das Árvores): vende SERVIÇOS (corte, escova, coloração, tranças, manicure, sobrancelha) e alguns produtos; cada atendimento é um 'pedido'; abre todos os dias, com horário reduzido na segunda e no domingo",
  termo: "atendimento",
  pedidosDia: 28,
  dow: [0.45, 0.85, 0.85, 0.95, 1.25, 1.55, 0.35],
  meses: [1.15, 1.25, 0.9, 0.9, 1.05, 1.0, 0.9, 0.9, 0.92, 0.98, 1.0, 1.4],
  crescimento: 0.13,
  abre: 9,
  fecha: 20,
  horarios: [
    [10, 18],
    [9, 20],
    [9, 20],
    [9, 20],
    [9, 20],
    [8, 19],
    [9, 14],
  ],
  horaPedidos: [
    [10.5, 1, 1.6],
    [15.5, 1.1, 2],
  ],
  perfis: {
    dia: [
      [10.5, 1, 1.6],
      [15.5, 1.1, 2],
    ],
  },
  eventos: {
    "Véspera de Natal": 1.6,
    "Véspera de Ano Novo": 1.7,
    "Sábado de Carnaval": 0.5,
    "Véspera do Dia das Mães": 1.5,
    "Véspera de São João": 1.3,
  },
  pagamentos: [
    ["PIX", 0.45, 0.9],
    ["CRÉDITO", 0.33, 1.25],
    ["DÉBITO", 0.17, 0.95],
    ["DINHEIRO", 0.05, 0.7],
  ],
  sigmaTicket: 0.75,
  categorias: ["cabelo", "tranças", "unhas", "estética", "produtos"],
  combos:
    "manicure + pedicure; escova + hidratação; corte + escova; sobrancelha como complemento de qualquer serviço; produto de manutenção depois de coloração ou tranças",
  pares: [
    ["MANICURE", "PEDICURE", 3.6],
    ["ESCOVA", "HIDRATAÇÃO", 2.9],
    ["CORTE FEMININO", "ESCOVA", 2.6],
    ["COLORAÇÃO", "HIDRATAÇÃO", 2.4],
    ["TRANÇAS BOX BRAIDS", "KIT MANUTENÇÃO TRANÇAS", 3.2],
  ],
  produtos: comCodigo(8001, [
    P("CORTE FEMININO", "UN", 90, "cabelo", 3, 1, "dia"),
    P("CORTE MASCULINO", "UN", 50, "cabelo", 2.6, 1, "dia"),
    P("ESCOVA", "UN", 60, "cabelo", 4, 1, "dia", {
      dow: [0.6, 0.8, 0.8, 0.9, 1.3, 1.6, 0.5],
    }),
    P("HIDRATAÇÃO", "UN", 80, "cabelo", 2, 1, "dia"),
    P("COLORAÇÃO", "UN", 180, "cabelo", 1.0, 1, "dia"),
    P("PROGRESSIVA", "UN", 280, "cabelo", 0.4, 1, "dia", { tendencia: -0.3 }),
    P("TRANÇAS BOX BRAIDS", "UN", 350, "tranças", 0.5, 1, "dia", {
      meses: [2, 2.2, 0.8, 0.7, 0.8, 0.8, 0.8, 0.8, 0.9, 1, 1.1, 1.8],
    }),
    P("NAGÔ / TRANÇA RAIZ", "UN", 150, "tranças", 1, 1, "dia", {
      meses: [1.8, 2.4, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.9, 1, 1.1, 1.5],
    }),
    P("MANICURE", "UN", 35, "unhas", 4.5, 1, "dia"),
    P("PEDICURE", "UN", 40, "unhas", 3.4, 1, "dia"),
    P("ALONGAMENTO EM GEL", "UN", 160, "unhas", 0.7, 1, "dia", {
      tendencia: 0.35,
    }),
    P("DESIGN DE SOBRANCELHA", "UN", 45, "estética", 2.4, 1, "dia"),
    P("LIMPEZA DE PELE", "UN", 150, "estética", 0.5, 1, "dia"),
    P("KIT MANUTENÇÃO TRANÇAS", "UN", 69.9, "produtos", 0.6, 1, "dia"),
    P("MÁSCARA CAPILAR 300G", "UN", 59.9, "produtos", 0.8, 1, "dia"),
    P("BOTOX CAPILAR", "UN", 220, "cabelo", 0.4, 1, "dia", {
      inicio: "2026-02-02",
      tendencia: 0.9,
    }),
  ]),
  financeiro: {
    variaveis: [
      [
        "Comissão dos profissionais",
        "Mercadoria para revenda",
        0.32,
        "Repasse a profissionais",
      ],
      [
        "Produtos e químicas",
        "Mercadoria para revenda",
        0.08,
        "Beleza Distribuição",
      ],
      ["Descartáveis", "Embalagens", 0.015, "EmbalaMais"],
    ],
    cargos: [
      "Cabeleireira",
      "Manicure",
      "Trancista",
      "Esteticista",
      "Recepcionista",
      "Auxiliar de limpeza",
    ],
    porte: 0.35,
    margem: 0.17,
  },
};

// Inspirado no perfil de uma revenda agropecuária e de materiais do
// interior da Bahia (insumos, irrigação, energia solar, veterinária e
// construção). Empresa, produtos e números fictícios.
const PLANTIO = [
  1.3, 0.9, 0.7, 0.6, 0.5, 0.5, 0.5, 0.55, 0.75, 1.25, 1.85, 1.7,
];
const SECA = [0.8, 0.8, 0.75, 0.8, 0.95, 1.1, 1.25, 1.35, 1.35, 1.2, 0.95, 0.8];

const AGRO: Segmento = {
  id: "agro",
  nome: "Agropecuária e materiais",
  empresa: "Sertão Verde Agro e Construção",
  slogan: "Tudo para o campo e para a cidade",
  local: "Irecê, BA",
  lojas: "2 lojas · Irecê e Lapão",
  icone: "Tractor",
  resumo:
    "Sementes, adubos, defensivos, irrigação, bombas, energia solar, veterinária e construção.",
  exemplos: ["Semente de feijão", "Bomba submersa", "Painel solar"],
  sobre:
    "revenda agropecuária e de materiais com duas lojas na região de Irecê (BA): sementes, adubos, defensivos, irrigação, bombas e material para poços, energia solar, produtos veterinários, ferramentas, material elétrico e de construção. Clientes são produtores rurais (feijão, milho, mamona, hortaliças irrigadas), pecuaristas e moradores da cidade; o plantio de sequeiro se concentra entre outubro e janeiro, e a irrigação e a nutrição animal pesam na seca (junho a outubro). Muita venda é a prazo (boleto)",
  termo: "venda",
  pedidosDia: 110,
  dow: [1.12, 1.02, 1.0, 1.0, 1.05, 0.95, 0.15],
  meses: [1.05, 0.9, 0.85, 0.85, 0.88, 0.92, 0.98, 1.0, 1.02, 1.12, 1.25, 1.1],
  crescimento: 0.12,
  abre: 7,
  fecha: 18,
  horarios: [
    [7, 18],
    [7, 18],
    [7, 18],
    [7, 18],
    [7, 18],
    [7, 13],
    [8, 12],
  ],
  horaPedidos: [
    [8.8, 1.2, 1.4],
    [14.8, 0.9, 1.5],
  ],
  perfis: {
    manha: [[8.5, 1, 1.3]],
    tarde: [[15, 1, 1.4]],
    dia: [
      [9, 1, 1.6],
      [15, 0.8, 1.7],
    ],
  },
  eventos: {
    "Véspera de Natal": 0.6,
    Natal: 0.15,
    "Véspera de Ano Novo": 0.5,
    "Ano Novo": 0.12,
    "Véspera de São João": 0.55,
    "São João": 0.15,
    Carnaval: 0.4,
    "Sexta-feira Santa": 0.2,
    "Black Friday": 1.15,
  },
  pagamentos: [
    ["BOLETO A PRAZO", 0.18, 2.6],
    ["PIX", 0.36, 0.8],
    ["CRÉDITO PARCELADO", 0.14, 1.6],
    ["DÉBITO", 0.18, 0.6],
    ["DINHEIRO", 0.14, 0.45],
  ],
  sigmaTicket: 1.15,
  categorias: [
    "sementes",
    "fertilizantes e corretivos",
    "defensivos",
    "irrigação",
    "bombas e motores",
    "energia solar",
    "veterinária e nutrição animal",
    "ferramentas e utilidades",
    "construção e elétrico",
  ],
  combos:
    "semente + adubo de plantio e ureia (kit de plantio por hectare); tubo de irrigação + conexões, registros e aspersores; bomba submersa + cabo elétrico e material de poço; painel solar + inversor (kit de energia ou bombeamento solar); sal mineral + vermífugo e vacina; pulverizador + defensivo com orientação técnica; arame farpado + grampos (cerca)",
  pares: [
    ["SEMENTE FEIJÃO CARIOCA 20KG", "ADUBO NPK 04-14-08 50KG", 3.2],
    ["SEMENTE MILHO HÍBRIDO 20KG", "UREIA 50KG", 3.0],
    ["SEMENTE MILHO HÍBRIDO 20KG", "ADUBO NPK 04-14-08 50KG", 2.6],
    ["TUBO PVC IRRIGAÇÃO 50MM 6M", "JOELHO PVC 50MM", 3.6],
    ["TUBO PVC IRRIGAÇÃO 50MM 6M", "REGISTRO ESFERA 50MM", 2.8],
    ["MANGUEIRA GOTEJAMENTO 500M", "CONECTOR INICIAL GOTEJO", 3.8],
    ["BOMBA SUBMERSA 1CV", "CABO PP 3X2,5MM 100M", 3.4],
    ["PAINEL SOLAR 550W", "INVERSOR SOLAR 3KW", 4.2],
    ["SAL MINERAL 30KG", "VERMÍFUGO BOVINO 1L", 2.3],
    ["PULVERIZADOR COSTAL 20L", "HERBICIDA 20L", 2.5],
    ["ARAME FARPADO 500M", "GRAMPO PARA CERCA 1KG", 3.3],
    ["CIMENTO 50KG", "TUBO PVC ESGOTO 100MM 6M", 2.0],
    ["FIO ELÉTRICO 2,5MM 100M", "LÂMPADA LED 12W", 2.1],
  ],
  produtos: comCodigo(9001, [
    P(
      "SEMENTE FEIJÃO CARIOCA 20KG",
      "UN",
      389.9,
      "sementes",
      1.4,
      1.2,
      "manha",
      { meses: PLANTIO },
    ),
    P(
      "SEMENTE MILHO HÍBRIDO 20KG",
      "UN",
      899.9,
      "sementes",
      0.6,
      1.1,
      "manha",
      { meses: PLANTIO },
    ),
    P("SEMENTE SORGO 20KG", "UN", 259.9, "sementes", 0.35, 1.4, "manha", {
      meses: PLANTIO.map((v) => v * v),
    }),
    P(
      "ADUBO NPK 04-14-08 50KG",
      "UN",
      189.9,
      "fertilizantes e corretivos",
      2.2,
      2.2,
      "manha",
      { meses: PLANTIO },
    ),
    P(
      "UREIA 50KG",
      "UN",
      179.9,
      "fertilizantes e corretivos",
      1.3,
      1.6,
      "manha",
      { meses: PLANTIO },
    ),
    P(
      "SUPERFOSFATO SIMPLES 50KG",
      "UN",
      139.9,
      "fertilizantes e corretivos",
      0.7,
      1.6,
      "manha",
      { meses: PLANTIO },
    ),
    P(
      "CALCÁRIO DOLOMÍTICO 50KG",
      "UN",
      24.9,
      "fertilizantes e corretivos",
      0.6,
      8,
      "manha",
      { meses: [0.6, 0.5, 0.5, 0.6, 0.8, 1.1, 1.3, 1.5, 1.6, 1.4, 0.9, 0.6] },
    ),
    P("HERBICIDA 20L", "UN", 429.9, "defensivos", 0.6, 1.1, "manha", {
      meses: PLANTIO,
    }),
    P("INSETICIDA 1L", "UN", 98.9, "defensivos", 1.3, 1.6, "dia", {
      meses: PLANTIO.map((v) => 0.5 + v / 2),
    }),
    P("FUNGICIDA 1L", "UN", 149.9, "defensivos", 0.7, 1.4, "dia", {
      meses: PLANTIO.map((v) => 0.5 + v / 2),
    }),
    P("TUBO PVC IRRIGAÇÃO 50MM 6M", "UN", 64.9, "irrigação", 2.2, 4, "dia", {
      meses: SECA,
    }),
    P("JOELHO PVC 50MM", "UN", 6.9, "irrigação", 2.0, 4, "dia", {
      meses: SECA,
    }),
    P("REGISTRO ESFERA 50MM", "UN", 46.9, "irrigação", 1.1, 2, "dia", {
      meses: SECA,
    }),
    P("ASPERSOR SETORIAL", "UN", 38.9, "irrigação", 1.0, 3, "dia", {
      meses: SECA,
    }),
    P("MANGUEIRA GOTEJAMENTO 500M", "UN", 429.9, "irrigação", 0.4, 1, "dia", {
      meses: SECA,
      tendencia: 0.25,
    }),
    P("CONECTOR INICIAL GOTEJO", "UN", 1.9, "irrigação", 0.6, 15, "dia", {
      meses: SECA,
      tendencia: 0.25,
    }),
    P("BOMBA SUBMERSA 1CV", "UN", 2190, "bombas e motores", 0.22, 1, "manha", {
      meses: SECA,
    }),
    P("MOTOR ELÉTRICO 3CV", "UN", 1690, "bombas e motores", 0.15, 1, "manha", {
      meses: SECA,
    }),
    P(
      "MOTOBOMBA A GASOLINA",
      "UN",
      1490,
      "bombas e motores",
      0.13,
      1,
      "manha",
      {
        meses: SECA,
        tendencia: -0.3,
      },
    ),
    P(
      "CABO PP 3X2,5MM 100M",
      "UN",
      699.9,
      "bombas e motores",
      0.28,
      1,
      "manha",
      { meses: SECA },
    ),
    P("PAINEL SOLAR 550W", "UN", 799.9, "energia solar", 0.25, 2, "dia", {
      tendencia: 0.45,
    }),
    P("INVERSOR SOLAR 3KW", "UN", 3490, "energia solar", 0.07, 1, "dia", {
      tendencia: 0.45,
    }),
    P("KIT BOMBEAMENTO SOLAR", "UN", 6990, "energia solar", 0.05, 1, "manha", {
      inicio: "2026-03-02",
      tendencia: 1.2,
      meses: SECA,
    }),
    P(
      "SAL MINERAL 30KG",
      "UN",
      99.9,
      "veterinária e nutrição animal",
      1.9,
      1.8,
      "manha",
      { meses: SECA },
    ),
    P(
      "RAÇÃO BOVINA 40KG",
      "UN",
      94.9,
      "veterinária e nutrição animal",
      1.6,
      2.5,
      "manha",
      { meses: SECA },
    ),
    P(
      "VERMÍFUGO BOVINO 1L",
      "UN",
      124.9,
      "veterinária e nutrição animal",
      0.9,
      1.2,
      "dia",
    ),
    P(
      "VACINA CLOSTRIDIOSE 50 DOSES",
      "UN",
      89.9,
      "veterinária e nutrição animal",
      0.6,
      1.5,
      "dia",
      { meses: [0.8, 0.8, 0.9, 1.2, 1.6, 1.3, 0.8, 0.7, 0.8, 1.2, 1.4, 0.9] },
    ),
    P(
      "PULVERIZADOR COSTAL 20L",
      "UN",
      289.9,
      "ferramentas e utilidades",
      0.5,
      1,
      "manha",
      { meses: PLANTIO.map((v) => 0.5 + v / 2) },
    ),
    P(
      "ARAME FARPADO 500M",
      "UN",
      389.9,
      "ferramentas e utilidades",
      0.5,
      1.3,
      "manha",
    ),
    P(
      "GRAMPO PARA CERCA 1KG",
      "UN",
      24.9,
      "ferramentas e utilidades",
      0.6,
      3,
      "manha",
    ),
    P(
      "ENXADA COM CABO",
      "UN",
      54.9,
      "ferramentas e utilidades",
      1.1,
      1.3,
      "dia",
      { meses: PLANTIO.map((v) => 0.6 + v / 3) },
    ),
    P(
      "CAIXA D'ÁGUA 1000L",
      "UN",
      489.9,
      "ferramentas e utilidades",
      0.35,
      1,
      "dia",
      { meses: SECA },
    ),
    P(
      "ÓLEO MOTOR 20W50 1L",
      "UN",
      34.9,
      "ferramentas e utilidades",
      1.0,
      2,
      "dia",
    ),
    P("CIMENTO 50KG", "UN", 38.9, "construção e elétrico", 2.2, 4, "dia", {
      meses: [0.9, 1.0, 1.05, 1.0, 1.0, 0.95, 1.0, 1.05, 1.1, 1.1, 1.0, 0.75],
    }),
    P(
      "TUBO PVC ESGOTO 100MM 6M",
      "UN",
      89.9,
      "construção e elétrico",
      0.8,
      3,
      "dia",
    ),
    P(
      "FIO ELÉTRICO 2,5MM 100M",
      "UN",
      199.9,
      "construção e elétrico",
      1.0,
      1.5,
      "dia",
    ),
    P("LÂMPADA LED 12W", "UN", 9.9, "construção e elétrico", 1.6, 4, "dia"),
    P(
      "TINTA ACRÍLICA 18L",
      "UN",
      299.9,
      "construção e elétrico",
      0.6,
      1.2,
      "tarde",
      { meses: [0.8, 0.8, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1.1, 1.2, 1.4, 1.5] },
    ),
  ]),
  financeiro: {
    variaveis: [
      [
        "Insumos agrícolas (sementes, adubos, defensivos)",
        "Mercadoria para revenda",
        0.38,
        "Distribuidora Agro Nordeste",
      ],
      [
        "Irrigação, bombas e energia solar",
        "Mercadoria para revenda",
        0.17,
        "Hidro Solar Distribuidora",
      ],
      [
        "Construção e elétrico",
        "Mercadoria para revenda",
        0.08,
        "Atacadão da Construção",
      ],
      [
        "Veterinária e nutrição animal",
        "Mercadoria para revenda",
        0.05,
        "VetAgro Distribuidora",
      ],
      [
        "Fretes de entrega na roça",
        "Combustível e transporte",
        0.015,
        "Transportadora Chapada",
      ],
    ],
    cargos: [
      "Vendedor técnico",
      "Engenheiro agrônomo",
      "Estoquista",
      "Motorista de entrega",
      "Operador de caixa",
      "Técnico em irrigação",
    ],
    porte: 1,
    margem: 0.08,
  },
};

export const SEGMENTOS: Segmento[] = [
  PADARIA,
  MERCADO,
  AGRO,
  RESTAURANTE,
  ROUPAS,
  FARMACIA,
  ACAI,
  PET,
  SALAO,
];

export const SEGMENTO_PADRAO = PADARIA.id;

export function segmentoPorId(id: string | null | undefined): Segmento | null {
  return SEGMENTOS.find((s) => s.id === id) ?? null;
}

/** Só o que a tela precisa (sem o catálogo inteiro). */
export type SegmentoResumo = Pick<
  Segmento,
  | "id"
  | "nome"
  | "empresa"
  | "slogan"
  | "local"
  | "lojas"
  | "icone"
  | "resumo"
  | "exemplos"
  | "termo"
>;

export function resumoSegmento(s: Segmento): SegmentoResumo {
  const {
    id,
    nome,
    empresa,
    slogan,
    local,
    lojas,
    icone,
    resumo,
    exemplos,
    termo,
  } = s;
  return {
    id,
    nome,
    empresa,
    slogan,
    local,
    lojas,
    icone,
    resumo,
    exemplos,
    termo,
  };
}
