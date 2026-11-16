// Motor de dados SINTÉTICOS da demonstração. Gera, de forma determinística
// (mesma data = mesmos números), as vendas diárias de cada segmento e devolve
// os mesmos formatos das funções do banco do painel real (painel_vendas,
// painel_produtos, produto_detalhe, produto_historico, cestas_compras).
// Nada aqui vem de banco: tudo é calculado na memória do servidor.
import { dataComemorativa } from "@/lib/datas-comemorativas";
import {
  daysBetween,
  shiftDate,
  todayInStore,
  type Cesta,
  type PainelProdutos,
  type PainelVendas,
  type ProdutoDetalhe,
  type ProdutoHistorico,
  type Situacao,
} from "@/lib/vendas";
import type { Perfil, ProdutoSeg, Segmento } from "./segmentos";

export const INICIO = "2025-01-01";

// Linhas de venda por pedido em cada segmento (calibra a participação de cada produto).
const ITENS_POR_PEDIDO: Record<string, number> = {
  padaria: 2.9,
  mercado: 4.6,
  restaurante: 1.6,
  roupas: 1.7,
  farmacia: 2.2,
  acai: 2.2,
  pet: 1.9,
  salao: 1.5,
  agro: 2.1,
};

// Ajuste fino do tamanho da compra (kg e itens vendidos em quantidade).
const ESCALA_QTD: Record<string, number> = {
  padaria: 0.84,
  mercado: 0.78,
  acai: 0.85,
};

// ------------------------------------------------------------ aleatoriedade
function hash(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gerador(seed: number) {
  let s = seed;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, normal };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function erf(x: number) {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
}
const phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

// ------------------------------------------------------------ horário
const dowDe = (data: string) =>
  (new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = segunda

function curva(perfil: Perfil, ini: number, fim: number) {
  const out = new Array<number>(24).fill(0);
  for (let h = ini; h < fim; h++) {
    const x = h + 0.5;
    for (const [pico, peso, larg] of perfil)
      out[h] += peso * Math.exp(-((x - pico) ** 2) / (2 * larg * larg));
    out[h] += 0.02; // nunca zero dentro do horário
  }
  return out;
}

const soma = (a: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
};

function normaliza(a: number[]) {
  const s = soma(a);
  return s ? a.map((v) => v / s) : a;
}

// ------------------------------------------------------------ modelo
type Modelo = {
  seg: Segmento;
  produtos: ProdutoSeg[];
  prob: number[];
  /** [dow][hora] participação dos pedidos. */
  horaSeg: number[][];
  /** [produto][dow][hora] participação das vendas do produto. */
  horaProd: number[][][];
  /** [produto][dow] fator pelo horário do dia (dias curtos vendem menos à noite). */
  massaProd: number[][];
  aberto: ([number, number] | null)[];
  liftCache: Map<string, number>;
  porNome: Map<string, number>;
  dias: Map<string, Dia>;
};

type Dia = {
  data: string;
  pedidos: number;
  fat: number;
  itens: number;
  pend: number;
  hp: number[];
  hf: number[];
  pq: Float64Array;
  pfat: Float64Array;
  pv: Float64Array;
  pagPed: number[];
  pagFat: number[];
  fxPed: number[];
  fxFat: number[];
  preco: Float64Array;
};

const modelos = new Map<string, Modelo>();

function modelo(seg: Segmento): Modelo {
  const hit = modelos.get(seg.id);
  if (hit) return hit;
  const aberto = Array.from(
    { length: 7 },
    (_, d) =>
      seg.horarios?.[d] ??
      (seg.dow[d] > 0 ? ([seg.abre, seg.fecha] as [number, number]) : null),
  );
  const horaSeg = aberto.map((a) =>
    a ? normaliza(curva(seg.horaPedidos, a[0], a[1])) : new Array(24).fill(0),
  );
  const pesoTotal = seg.produtos.reduce((s, p) => s + p.peso, 0);
  const itens = ITENS_POR_PEDIDO[seg.id] ?? 2;
  const horaProd: number[][][] = [];
  const massaProd: number[][] = [];
  for (const p of seg.produtos) {
    const perfil = seg.perfis[p.perfil] ?? seg.horaPedidos;
    const cheio = soma(curva(perfil, seg.abre, seg.fecha));
    horaProd.push(
      aberto.map((a) =>
        a ? normaliza(curva(perfil, a[0], a[1])) : new Array(24).fill(0),
      ),
    );
    massaProd.push(
      aberto.map((a) => {
        if (!a) return 0;
        const parte = soma(curva(perfil, a[0], a[1])) / cheio;
        const base =
          soma(curva(seg.horaPedidos, a[0], a[1])) /
          soma(curva(seg.horaPedidos, seg.abre, seg.fecha));
        return Math.min(1.6, parte / Math.max(base, 0.05));
      }),
    );
  }
  const m: Modelo = {
    seg,
    produtos: seg.produtos,
    prob: seg.produtos.map((p) => (p.peso / pesoTotal) * itens),
    horaSeg,
    horaProd,
    massaProd,
    aberto,
    liftCache: new Map(),
    porNome: new Map(seg.produtos.map((p, i) => [p.nome, i])),
    dias: new Map(),
  };
  modelos.set(seg.id, m);
  return m;
}

/** Preço praticado na data: dois reajustes ao longo do histórico. */
function precoEm(p: ProdutoSeg, data: string) {
  const h = hash(p.codigo);
  const r1 = shiftDate("2025-03-01", h % 120);
  const r2d = shiftDate("2026-01-12", (h >> 8) % 140);
  const fator = data < r1 ? 1 / 1.12 : data < r2d ? 1 / 1.055 : 1;
  return arredondaPreco(p.preco * fator, p.preco);
}

function arredondaPreco(v: number, ref: number) {
  if (Number.isInteger(ref)) return Math.max(5, Math.round(v / 5) * 5);
  if (ref >= 100) return r2(Math.round(v) - 0.1);
  if (ref < 2) return r2(v);
  return r2(Math.floor(v * 10) / 10 + 0.09);
}

function fatorEvento(tabela: Record<string, number> | undefined, nome: string) {
  if (!tabela || !nome) return 1;
  let f = 1;
  for (const [chave, v] of Object.entries(tabela))
    if (nome.includes(chave)) f *= v;
  return f;
}

function gerarDia(m: Modelo, data: string): Dia {
  const { seg } = m;
  const P = m.produtos.length;
  const dow = dowDe(data);
  const mes = Number(data.slice(5, 7)) - 1;
  const dia = Number(data.slice(8, 10));
  const evento = dataComemorativa(data) ?? "";
  const rnd = gerador(hash(`${seg.id}|${data}`));
  const vazio = (): Dia => ({
    data,
    pedidos: 0,
    fat: 0,
    itens: 0,
    pend: 0,
    hp: new Array(24).fill(0),
    hf: new Array(24).fill(0),
    pq: new Float64Array(P),
    pfat: new Float64Array(P),
    pv: new Float64Array(P),
    pagPed: seg.pagamentos.map(() => 0),
    pagFat: seg.pagamentos.map(() => 0),
    fxPed: new Array(6).fill(0),
    fxFat: new Array(6).fill(0),
    preco: new Float64Array(m.produtos.map((p) => precoEm(p, data))),
  });
  const fechado =
    !m.aberto[dow] ||
    seg.dow[dow] <= 0 ||
    evento
      .split(" / ")
      .some(
        (parte) =>
          !parte.startsWith("Véspera") &&
          (seg.fechaEm ?? []).some((k) => parte.includes(k)),
      );
  if (fechado) return vazio();

  const anos = daysBetween(INICIO, data) / 365;
  const tendencia = (1 + seg.crescimento) ** anos;
  const pagamento =
    dia >= 5 && dia <= 7 ? 1.04 : dia >= 20 && dia <= 22 ? 1.03 : 1;
  const ruido = Math.exp(rnd.normal() * 0.06);
  const pedidos = Math.max(
    Math.ceil(seg.pedidosDia * 0.15),
    Math.round(
      seg.pedidosDia *
        seg.dow[dow] *
        seg.meses[mes] *
        tendencia *
        fatorEvento(seg.eventos, evento) *
        pagamento *
        ruido,
    ),
  );
  const d = vazio();
  if (!pedidos) return d;
  d.pedidos = pedidos;

  for (let i = 0; i < P; i++) {
    const p = m.produtos[i];
    if ((p.inicio && data < p.inicio) || (p.fim && data > p.fim)) continue;
    let mult =
      (p.dow?.[dow] ?? 1) *
      (p.meses?.[mes] ?? 1) *
      fatorEvento(p.eventos, evento) *
      m.massaProd[i][dow];
    if (p.tendencia) {
      const desde = p.inicio && p.inicio > INICIO ? p.inicio : INICIO;
      const t = daysBetween(desde, data) / 365;
      mult *= Math.max(0.15, (1 + p.tendencia) ** t);
      if (p.inicio)
        mult *= Math.min(1, 0.25 + daysBetween(p.inicio, data) / 60);
    }
    if (p.fim) {
      const falta = daysBetween(data, p.fim);
      if (falta < 50) mult *= 0.35 + falta / 77;
    }
    if (mult <= 0) continue;
    const esperado = pedidos * m.prob[i] * mult * Math.exp(rnd.normal() * 0.13);
    const vendas = Math.max(
      0,
      Math.round(esperado + rnd.normal() * Math.sqrt(esperado) * 0.6),
    );
    if (!vendas) continue;
    const escala =
      p.unidade === "KG" || p.qtd >= 2 ? (ESCALA_QTD[seg.id] ?? 1) : 1;
    let qtd = vendas * p.qtd * escala * Math.exp(rnd.normal() * 0.05);
    qtd = p.unidade === "KG" ? r3(qtd) : Math.max(vendas, Math.round(qtd));
    d.pv[i] = vendas;
    d.pq[i] = qtd;
    d.pfat[i] = r2(qtd * d.preco[i]);
    d.fat += d.pfat[i];
    d.itens += vendas;
    const hp = m.horaProd[i][dow];
    for (let h = 0; h < 24; h++) d.hf[h] += d.pfat[i] * hp[h];
  }
  d.fat = r2(d.fat);

  // Pedidos por hora (maiores restos).
  const hs = m.horaSeg[dow];
  const brutos = hs.map((v) => v * pedidos);
  const inteiros = brutos.map(Math.floor);
  let resto = pedidos - soma(inteiros);
  const ordem = brutos
    .map((v, h) => [v - Math.floor(v), h])
    .sort((a, b) => b[0] - a[0]);
  for (const [, h] of ordem) {
    if (resto <= 0) break;
    if (hs[h] > 0) {
      inteiros[h]++;
      resto--;
    }
  }
  d.hp = inteiros;

  // Compra grande esporádica (encomenda, safra, festa, prefeitura): ~3% dos
  // dias ganham um pedido avulso com muita quantidade de 1 ou 2 produtos.
  if (rnd.next() < 0.03) {
    const candidatos = m.produtos
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => d.pv[i] > 0 && p.peso >= 0.5);
    const escolhidos = candidatos
      .sort(
        (a, b) => hash(`${data}|${a.p.codigo}`) - hash(`${data}|${b.p.codigo}`),
      )
      .slice(0, 1 + Math.floor(rnd.next() * 2));
    let extra = 0;
    for (const { p, i } of escolhidos) {
      const mult = 12 + Math.floor(rnd.next() * 20);
      const q =
        p.unidade === "KG"
          ? r3(p.qtd * mult)
          : Math.max(10, Math.round((p.qtd * mult) / 5) * 5);
      const f = r2(q * d.preco[i]);
      d.pq[i] += q;
      d.pfat[i] = r2(d.pfat[i] + f);
      d.pv[i] += 1;
      d.itens += 1;
      extra += f;
    }
    if (extra) {
      const h = hs.indexOf(Math.max(...hs));
      d.hp[h] += 1;
      d.hf[h] += extra;
      d.pedidos += 1;
      d.fat = r2(d.fat + extra);
    }
  }

  d.pend = 0.02 + rnd.next() * 0.025;

  // Formas de pagamento (Pix cresce com o tempo).
  const shares = seg.pagamentos.map(([forma, s]) =>
    forma === "PIX" ? s * (1 + 0.12 * anos) : s,
  );
  const ts = soma(shares);
  const peso = seg.pagamentos.map(([, , t], i) => (shares[i] / ts) * t);
  const tp = soma(peso);
  let acum = 0;
  seg.pagamentos.forEach((_, i) => {
    const n =
      i === seg.pagamentos.length - 1
        ? pedidos - acum
        : Math.round((pedidos * shares[i]) / ts);
    d.pagPed[i] = Math.max(0, n);
    acum += d.pagPed[i];
    d.pagFat[i] = r2((d.fat * peso[i]) / tp);
  });

  // Faixas de ticket: distribuição lognormal em torno do ticket do dia.
  const ticket = d.fat / pedidos;
  const s = seg.sigmaTicket;
  const mu = Math.log(ticket) - (s * s) / 2;
  const limites = [0, 10, 20, 30, 50, 100, Infinity];
  for (let f = 0; f < 6; f++) {
    const a = limites[f];
    const b = limites[f + 1];
    const za = a > 0 ? (Math.log(a) - mu) / s : -Infinity;
    const zb = b < Infinity ? (Math.log(b) - mu) / s : Infinity;
    const prob = phi(zb) - phi(za);
    const parcial = phi(zb - s) - phi(za - s);
    d.fxPed[f] = pedidos * prob;
    d.fxFat[f] = pedidos * ticket * parcial;
  }
  return d;
}

function diaCompleto(m: Modelo, data: string) {
  let d = m.dias.get(data);
  if (!d) {
    d = gerarDia(m, data);
    m.dias.set(data, d);
  }
  return d;
}

/** Dia cortado num horário (minutos desde 0h): hoje e a comparação "até agora". */
function diaAte(m: Modelo, data: string, minutos: number): Dia {
  const d = diaCompleto(m, data);
  if (!d.pedidos) return d;
  const dow = dowDe(data);
  const frac = Array.from({ length: 24 }, (_, h) =>
    h < Math.floor(minutos / 60)
      ? 1
      : h === Math.floor(minutos / 60)
        ? (minutos % 60) / 60
        : 0,
  );
  const hp = d.hp.map((v, h) => Math.round(v * frac[h]));
  const pedidos = soma(hp);
  const P = m.produtos.length;
  const out: Dia = {
    ...d,
    pedidos,
    hp,
    hf: d.hf.map((v, h) => v * frac[h]),
    pq: new Float64Array(P),
    pfat: new Float64Array(P),
    pv: new Float64Array(P),
    fat: 0,
    itens: 0,
  };
  // Vendas de cada produto até o horário, distribuídas pelos maiores restos
  // para os totais baterem com os pedidos (todo pedido tem ao menos 1 item).
  const parcial = new Float64Array(P);
  for (let i = 0; i < P; i++) {
    if (!d.pv[i]) continue;
    const hpP = m.horaProd[i][dow];
    let f = 0;
    for (let h = 0; h < 24; h++) f += hpP[h] * frac[h];
    parcial[i] = d.pv[i] * f;
  }
  const alvo = pedidos ? Math.max(pedidos, Math.round(soma(parcial))) : 0;
  const inteiro = Array.from(parcial, Math.floor);
  let falta = alvo - soma(inteiro);
  const restos = Array.from(parcial, (v, i) => [v - Math.floor(v), i])
    .filter(([, i]) => d.pv[i] > inteiro[i])
    .sort((a, b) => b[0] - a[0]);
  for (let k = 0; falta > 0 && restos.length; k = (k + 1) % restos.length) {
    inteiro[restos[k][1]]++;
    falta--;
    if (
      k === restos.length - 1 &&
      falta > 0 &&
      restos.every(([, i]) => inteiro[i] >= d.pv[i])
    )
      break;
  }
  for (let i = 0; i < P; i++) {
    const v = Math.min(inteiro[i], d.pv[i]);
    if (!v) continue;
    const r = v / d.pv[i];
    const q =
      m.produtos[i].unidade === "KG"
        ? r3(d.pq[i] * r)
        : Math.max(v, Math.round(d.pq[i] * r));
    out.pv[i] = v;
    out.pq[i] = q;
    out.pfat[i] = r2(q * d.preco[i]);
    out.fat += out.pfat[i];
    out.itens += v;
  }
  out.fat = r2(out.fat);
  // Faturamento por hora acompanha o total do corte.
  const somaHf = soma(out.hf);
  out.hf = somaHf
    ? out.hf.map((v) => (v * out.fat) / somaHf)
    : out.hf.map(() => 0);
  const F = d.pedidos ? pedidos / d.pedidos : 0;
  const Ff = d.fat ? out.fat / d.fat : 0;
  out.pagPed = d.pagPed.map((v) => Math.round(v * F));
  out.pagFat = d.pagFat.map((v) => r2(v * Ff));
  out.fxPed = d.fxPed.map((v) => v * F);
  out.fxFat = d.fxFat.map((v) => v * Ff);
  return out;
}

// ------------------------------------------------------------ "agora"

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Hoje e o horário de corte. Na demonstração o dia de hoje já vem completo
 * (corte no fim do dia): todo dia até hoje tem vendas, e nada depois de hoje.
 */
function relogio() {
  return { hoje: todayInStore(), corte: 24 * 60 };
}

function diaVisivel(m: Modelo, data: string, hoje: string, corte: number) {
  if (data > hoje) return null;
  return data === hoje ? diaAte(m, data, corte) : diaCompleto(m, data);
}

function ultimoDiaComVenda(m: Modelo) {
  const { hoje, corte } = relogio();
  for (let d = hoje, i = 0; i < 15; i++, d = shiftDate(d, -1)) {
    const dia = diaVisivel(m, d, hoje, corte);
    if (dia && dia.pedidos > 0) {
      let ultimaHora = 0;
      dia.hp.forEach((v, h) => {
        if (v > 0) ultimaHora = h;
      });
      const min = ultimaHora * 60 + 52;
      return { data: d, pedido: `${d}T${hhmm(min)}:00` };
    }
  }
  return { data: null, pedido: null };
}

/** Última "coleta": alguns minutos depois do último pedido. */
function atualizadoEm(ultimoPedido: string | null) {
  if (!ultimoPedido) return null;
  const [d, h] = ultimoPedido.split("T");
  const [hh] = h.split(":").map(Number);
  return `${d}T${String(Math.min(23, hh + 1)).padStart(2, "0")}:00:00-03:00`;
}

// ------------------------------------------------------------ períodos
/** Mesma regra do banco (staging.periodo_anterior). */
export function periodoAnterior(ini: string, fim: string) {
  if (ini === fim) return { ini: shiftDate(ini, -7), fim: shiftDate(ini, -7) };
  const mesSeguinte = (d: string) => {
    const [y, mo] = d.split("-").map(Number);
    return mo === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  };
  const menosUmMes = (d: string) => {
    const [y, mo, da] = d.split("-").map(Number);
    const ny = mo === 1 ? y - 1 : y;
    const nm = mo === 1 ? 12 : mo - 1;
    const ultimo = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(da, ultimo)).padStart(2, "0")}`;
  };
  if (ini.endsWith("-01") && fim < mesSeguinte(ini)) {
    const a = menosUmMes(ini);
    const f = shiftDate(a, daysBetween(ini, fim) - 1);
    const lim = shiftDate(ini, -1);
    return { ini: a, fim: f < lim ? f : lim };
  }
  if (ini.slice(5) === "01-01" && fim.slice(0, 4) === ini.slice(0, 4)) {
    const y = Number(ini.slice(0, 4)) - 1;
    const fimAnt = `${y}${fim.slice(4)}`;
    return {
      ini: `${y}-01-01`,
      fim: fimAnt === `${y}-02-29` ? `${y}-02-28` : fimAnt,
    };
  }
  return {
    ini: shiftDate(ini, -daysBetween(ini, fim)),
    fim: shiftDate(ini, -1),
  };
}

const fatorSit = (d: Dia, sit: Situacao) =>
  sit === "todas" ? 1 : sit === "pendente" ? d.pend : 1 - d.pend;

type Acumulado = {
  pedidos: number;
  fat: number;
  itens: number;
  serie: { data: string; pedidos: number; faturamento: number }[];
  sh: { ped: number; fat: number }[][];
  pq: Float64Array;
  pfat: Float64Array;
  pv: Float64Array;
  pdias: Float64Array;
  pult: (string | null)[];
  pag: { ped: number; fat: number }[];
  fx: { ped: number; fat: number }[];
  fin: { ped: number; fat: number };
  pen: { ped: number; fat: number };
};

function acumular(
  m: Modelo,
  ini: string,
  fim: string,
  sit: Situacao,
  corteFinal?: number | null,
): Acumulado {
  const { hoje, corte } = relogio();
  const P = m.produtos.length;
  const a: Acumulado = {
    pedidos: 0,
    fat: 0,
    itens: 0,
    serie: [],
    sh: Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ ped: 0, fat: 0 })),
    ),
    pq: new Float64Array(P),
    pfat: new Float64Array(P),
    pv: new Float64Array(P),
    pdias: new Float64Array(P),
    pult: new Array(P).fill(null),
    pag: m.seg.pagamentos.map(() => ({ ped: 0, fat: 0 })),
    fx: Array.from({ length: 6 }, () => ({ ped: 0, fat: 0 })),
    fin: { ped: 0, fat: 0 },
    pen: { ped: 0, fat: 0 },
  };
  for (let data = ini; data <= fim; data = shiftDate(data, 1)) {
    let d: Dia | null;
    if (data === fim && corteFinal != null)
      d =
        data > hoje
          ? null
          : diaAte(
              m,
              data,
              data === hoje ? Math.min(corte, corteFinal) : corteFinal,
            );
    else d = diaVisivel(m, data, hoje, corte);
    if (!d || !d.pedidos) continue;
    const k = fatorSit(d, sit);
    const ped = Math.round(d.pedidos * k);
    const fat = d.fat * k;
    a.fin.ped += Math.round(d.pedidos * (1 - d.pend));
    a.fin.fat += d.fat * (1 - d.pend);
    a.pen.ped += d.pedidos - Math.round(d.pedidos * (1 - d.pend));
    a.pen.fat += d.fat * d.pend;
    if (!ped) continue;
    a.pedidos += ped;
    a.fat += fat;
    a.itens += Math.round(d.itens * k);
    a.serie.push({ data, pedidos: ped, faturamento: r2(fat) });
    const dow = dowDe(data);
    for (let h = 0; h < 24; h++) {
      if (!d.hp[h] && !d.hf[h]) continue;
      a.sh[dow][h].ped += d.hp[h] * k;
      a.sh[dow][h].fat += d.hf[h] * k;
    }
    for (let i = 0; i < P; i++) {
      if (!d.pv[i]) continue;
      const v = Math.round(d.pv[i] * k);
      if (!v) continue;
      a.pv[i] += v;
      a.pq[i] += d.pq[i] * k;
      a.pfat[i] += d.pfat[i] * k;
      a.pdias[i] += 1;
      a.pult[i] = data;
    }
    d.pagPed.forEach((v, i) => {
      a.pag[i].ped += v * k;
      a.pag[i].fat += d.pagFat[i] * k;
    });
    d.fxPed.forEach((v, f) => {
      a.fx[f].ped += v * k;
      a.fx[f].fat += d.fxFat[f] * k;
    });
  }
  return a;
}

function contexto(ini: string, fim: string) {
  const { hoje, corte } = relogio();
  const ant = periodoAnterior(ini, fim);
  const antCorte = fim === hoje && corte < 24 * 60 ? corte : null;
  return { hoje, corte, ant, antCorte };
}

// ------------------------------------------------------------ "RPCs"
export function painelVendas(
  seg: Segmento,
  ini: string,
  fim: string,
  sit: Situacao,
): PainelVendas {
  const m = modelo(seg);
  const { ant, antCorte } = contexto(ini, fim);
  const a = acumular(m, ini, fim, sit);
  const b = acumular(m, ant.ini, ant.fim, sit, antCorte);
  const ocorr = new Array(7).fill(0);
  for (let d = ini; d <= fim; d = shiftDate(d, 1)) ocorr[dowDe(d)]++;
  const ult = ultimoDiaComVenda(m);
  const semanaHora: PainelVendas["semana_hora"] = [];
  a.sh.forEach((horas, dow) =>
    horas.forEach((c, h) => {
      if (c.ped >= 0.5)
        semanaHora.push({
          dia_semana: dow + 1,
          hora: h,
          pedidos: Math.round(c.ped),
          faturamento: r2(c.fat),
          ocorrencias: ocorr[dow],
        });
    }),
  );
  const prods = m.produtos
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => a.pv[i] > 0)
    .sort((x, y) => a.pfat[y.i] - a.pfat[x.i]);
  return {
    periodo: {
      ini,
      fim,
      dias: daysBetween(ini, fim),
      ant_ini: ant.ini,
      ant_fim: ant.fim,
      ant_corte: antCorte != null ? hhmm(antCorte) : null,
      situacao: sit,
    },
    base: {
      primeiro_dia: INICIO,
      ultimo_dia: ult.data,
      ultimo_pedido: ult.pedido,
    },
    atualizado_em: atualizadoEm(ult.pedido),
    produtos_cobertura: null,
    resumo: {
      faturamento: r2(a.fat),
      pedidos: a.pedidos,
      ticket_medio: a.pedidos ? r2(a.fat / a.pedidos) : 0,
      itens: a.itens,
      dias_com_venda: a.serie.length,
    },
    anterior: {
      faturamento: r2(b.fat),
      pedidos: b.pedidos,
      ticket_medio: b.pedidos ? r2(b.fat / b.pedidos) : 0,
      itens: b.itens,
    },
    situacoes: [
      {
        situacao: "FINALIZADO",
        pedidos: a.fin.ped,
        faturamento: r2(a.fin.fat),
      },
      { situacao: "PENDENTE", pedidos: a.pen.ped, faturamento: r2(a.pen.fat) },
    ].filter((s) => s.pedidos > 0),
    serie: a.serie,
    semana_hora: semanaHora,
    dias_semana: ocorr
      .map((o, d) => ({ dia_semana: d + 1, ocorrencias: o }))
      .filter((x) => x.ocorrencias),
    produtos: prods.slice(0, 100).map(({ p, i }) => ({
      codigo: p.codigo,
      produto: p.nome,
      unidade: p.unidade,
      qtd: r3(a.pq[i]),
      faturamento: r2(a.pfat[i]),
      vendas: a.pv[i],
    })),
    produtos_distintos: prods.length,
    pagamentos: seg.pagamentos
      .map(([forma], i) => ({
        forma,
        pedidos: Math.round(a.pag[i].ped),
        faturamento: r2(a.pag[i].fat),
      }))
      .filter((x) => x.pedidos > 0)
      .sort((x, y) => y.faturamento - x.faturamento),
    faixas_ticket: a.fx
      .map((f, i) => ({
        faixa: i + 1,
        pedidos: Math.round(f.ped),
        faturamento: r2(f.fat),
      }))
      .filter((f) => f.pedidos > 0),
  };
}

export function faturamentoDiario(
  seg: Segmento,
  ini: string,
  fim: string,
  sit: Situacao,
) {
  const p = painelVendas(seg, ini, fim, sit);
  return {
    serie: p.serie,
    atualizado_em: p.atualizado_em,
    base: {
      ultimo_dia: p.base.ultimo_dia,
      ultimo_pedido: p.base.ultimo_pedido,
    },
  };
}

export function painelProdutos(
  seg: Segmento,
  ini: string,
  fim: string,
  sit: Situacao,
): PainelProdutos {
  const m = modelo(seg);
  const { ant, antCorte } = contexto(ini, fim);
  const a = acumular(m, ini, fim, sit);
  const b = acumular(m, ant.ini, ant.fim, sit, antCorte);
  const linhas = m.produtos
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => a.pv[i] > 0 || b.pv[i] > 0)
    .sort((x, y) => a.pfat[y.i] - a.pfat[x.i] || b.pfat[y.i] - b.pfat[x.i]);
  return {
    periodo: {
      ini,
      fim,
      dias: daysBetween(ini, fim),
      ant_ini: ant.ini,
      ant_fim: ant.fim,
      ant_corte: antCorte != null ? hhmm(antCorte) : null,
      situacao: sit,
    },
    produtos_cobertura: null,
    totais: {
      faturamento: r2(a.fat),
      faturamento_anterior: r2(b.fat),
      pedidos: a.pedidos,
      pedidos_anterior: b.pedidos,
    },
    produtos: linhas.map(({ p, i }) => ({
      codigo: p.codigo,
      produto: p.nome,
      unidade: p.unidade,
      qtd: r3(a.pq[i]),
      faturamento: r2(a.pfat[i]),
      vendas: a.pv[i],
      dias_vendidos: a.pdias[i],
      ultima_venda: a.pult[i],
      qtd_anterior: r3(b.pq[i]),
      faturamento_anterior: r2(b.pfat[i]),
    })),
  };
}

// ------------------------------------------------------------ compras juntas
function lift(m: Modelo, a: number, b: number) {
  const chave = a < b ? `${a}|${b}` : `${b}|${a}`;
  const hit = m.liftCache.get(chave);
  if (hit !== undefined) return hit;
  const na = m.produtos[a].nome;
  const nb = m.produtos[b].nome;
  const par = m.seg.pares.find(
    ([x, y]) => (x === na && y === nb) || (x === nb && y === na),
  );
  let v: number;
  if (par) v = par[2];
  else {
    const h = hash(chave) / 4294967296;
    v = 0.55 + 0.55 * h;
    if (m.produtos[a].perfil === m.produtos[b].perfil) v *= 1.2;
    if (m.produtos[a].categoria === m.produtos[b].categoria) v *= 0.85;
  }
  m.liftCache.set(chave, v);
  return v;
}

function coocorrencia(
  m: Modelo,
  a: number,
  b: number,
  va: number,
  vb: number,
  total: number,
) {
  if (!va || !vb || !total) return 0;
  const conf = Math.min(0.92, (vb / total) * lift(m, a, b));
  return Math.min(Math.round(va * conf), vb);
}

export function cestasCompras(
  seg: Segmento,
  ini: string,
  fim: string,
  sit: Situacao,
  limite = 15,
): Cesta[] {
  const m = modelo(seg);
  const a = acumular(m, ini, fim, sit);
  const total = a.pedidos;
  const out: Cesta[] = [];
  const P = m.produtos.length;
  for (let i = 0; i < P; i++)
    for (let j = i + 1; j < P; j++) {
      const n = coocorrencia(m, i, j, a.pv[i], a.pv[j], total);
      if (n < 10) continue;
      const l = (n * total) / (a.pv[i] * a.pv[j]);
      if (l < 1.2) continue;
      out.push({
        a: m.produtos[i].nome,
        b: m.produtos[j].nome,
        pedidos: n,
        suporte: r3(n / total),
        conf_a_b: Math.round((n / a.pv[i]) * 10000) / 10000,
        conf_b_a: Math.round((n / a.pv[j]) * 10000) / 10000,
        lift: r2(l),
      });
    }
  return out
    .sort((x, y) => y.pedidos - x.pedidos)
    .slice(0, Math.max(1, Math.min(limite, 50)));
}

// ------------------------------------------------------------ produto
export function produtoDetalhe(
  seg: Segmento,
  codigo: string,
  ini: string,
  fim: string,
  sit: Situacao,
): ProdutoDetalhe {
  const m = modelo(seg);
  const idx = m.produtos.findIndex((p) => p.codigo === codigo);
  const p = m.produtos[idx];
  const { hoje, corte } = relogio();
  const base: ProdutoDetalhe = {
    codigo,
    produto: p?.nome ?? null,
    unidade: p?.unidade ?? null,
    periodo: { ini, fim, dias: daysBetween(ini, fim), situacao: sit },
    resumo: {
      faturamento: 0,
      qtd: 0,
      vendas: 0,
      pedidos_com: 0,
      total_pedidos: 0,
      preco_min: null,
      preco_max: null,
      primeira_venda: null,
      ultima_venda: null,
    },
    ticket: { com: null, sem: null },
    serie: [],
    semana_hora: [],
    precos: [],
    juntos: [],
  };
  if (idx < 0) return base;
  const sh = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ v: 0, q: 0 })),
  );
  const precos: { preco: number; vendas: number; de: string; ate: string }[] =
    [];
  let totalPed = 0;
  let totalFat = 0;
  for (let data = ini; data <= fim; data = shiftDate(data, 1)) {
    const d = diaVisivel(m, data, hoje, corte);
    if (!d || !d.pedidos) continue;
    const k = fatorSit(d, sit);
    totalPed += Math.round(d.pedidos * k);
    totalFat += d.fat * k;
    const v = Math.round(d.pv[idx] * k);
    if (!v) continue;
    const q = d.pq[idx] * k;
    const f = d.pfat[idx] * k;
    base.serie.push({ data, qtd: r3(q), faturamento: r2(f), vendas: v });
    base.resumo.faturamento += f;
    base.resumo.qtd += q;
    base.resumo.vendas += v;
    base.resumo.primeira_venda ??= data;
    base.resumo.ultima_venda = data;
    const dow = dowDe(data);
    const hp = m.horaProd[idx][dow];
    for (let h = 0; h < 24; h++) {
      sh[dow][h].v += v * hp[h];
      sh[dow][h].q += q * hp[h];
    }
    const preco = d.preco[idx];
    const ultimo = precos[precos.length - 1];
    if (ultimo && ultimo.preco === preco) {
      ultimo.vendas += v;
      ultimo.ate = data;
    } else precos.push({ preco, vendas: v, de: data, ate: data });
  }
  const r = base.resumo;
  r.faturamento = r2(r.faturamento);
  r.qtd = r3(r.qtd);
  r.pedidos_com = r.vendas;
  r.total_pedidos = totalPed;
  if (precos.length) {
    r.preco_min = Math.min(...precos.map((x) => x.preco));
    r.preco_max = Math.max(...precos.map((x) => x.preco));
  }
  if (r.vendas && totalPed > r.vendas) {
    const media = totalFat / totalPed;
    const com = media + (r.faturamento / r.vendas) * 0.75;
    const sem = (totalFat - com * r.vendas) / (totalPed - r.vendas);
    base.ticket = { com: r2(com), sem: r2(Math.max(sem, 0)) };
  }
  sh.forEach((horas, dow) =>
    horas.forEach((c, h) => {
      if (c.v >= 0.5)
        base.semana_hora.push({
          dia_semana: dow + 1,
          hora: h,
          vendas: Math.round(c.v),
          qtd: r3(c.q),
        });
    }),
  );
  base.precos = precos;
  if (r.vendas) {
    const a = acumular(m, ini, fim, sit);
    base.juntos = m.produtos
      .map((o, j) => ({
        o,
        j,
        n: j === idx ? 0 : coocorrencia(m, idx, j, r.vendas, a.pv[j], totalPed),
      }))
      .filter((x) => x.n > 0)
      .sort((x, y) => y.n - x.n)
      .slice(0, 12)
      .map(({ o, j, n }) => ({
        codigo: o.codigo,
        produto: o.nome,
        pedidos: n,
        confianca: Math.round((n / r.vendas) * 10000) / 10000,
        lift: a.pv[j] ? r2(n / r.vendas / (a.pv[j] / totalPed)) : null,
      }));
  }
  return base;
}

export function produtoHistorico(
  seg: Segmento,
  codigo: string,
  sit: Situacao,
): ProdutoHistorico {
  const m = modelo(seg);
  const idx = m.produtos.findIndex((p) => p.codigo === codigo);
  const { hoje, corte } = relogio();
  const serie: ProdutoHistorico["serie"] = [];
  if (idx >= 0)
    for (let data = INICIO; data <= hoje; data = shiftDate(data, 1)) {
      const d = diaVisivel(m, data, hoje, corte);
      if (!d || !d.pv[idx]) continue;
      const k = fatorSit(d, sit);
      serie.push({
        data,
        qtd: r3(d.pq[idx] * k),
        faturamento: r2(d.pfat[idx] * k),
      });
    }
  return { codigo, situacao: sit, ini: INICIO, fim: hoje, serie };
}

/** Categoria de cada produto do segmento (por código e por nome). */
export function categoriaDe(seg: Segmento) {
  const porCodigo = new Map(seg.produtos.map((p) => [p.codigo, p.categoria]));
  const porNome = new Map(seg.produtos.map((p) => [p.nome, p.categoria]));
  return (nome: string, codigo?: string) =>
    (codigo && porCodigo.get(codigo)) || porNome.get(nome) || "outros";
}
