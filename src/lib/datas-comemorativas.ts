// Feriados e datas comemorativas que mexem com as vendas do comércio em
// Salvador (BA). Usado pela IA (contexto do dia) e pela retrospectiva (etiqueta do dia).

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** n-ésimo dia da semana do mês (weekday: 0 = domingo). */
function nth(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
  return iso(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

const cache = new Map<number, Map<string, string>>();

export function datasDoAno(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const map = new Map<string, string>();
  const add = (date: string, nome: string) =>
    map.set(date, map.has(date) ? `${map.get(date)} / ${nome}` : nome);
  const easter = pascoa(year);
  const maes = nth(year, 5, 0, 2);
  const pais = nth(year, 8, 0, 2);
  const blackFriday = addDays(nth(year, 11, 4, 4), 1);

  add(iso(year, 1, 1), "Ano Novo");
  add(addDays(easter, -50), "Sábado de Carnaval");
  add(addDays(easter, -49), "Domingo de Carnaval");
  add(addDays(easter, -48), "Segunda de Carnaval");
  add(addDays(easter, -47), "Terça de Carnaval");
  add(addDays(easter, -46), "Quarta-feira de Cinzas");
  add(addDays(easter, -3), "Quinta-feira Santa");
  add(addDays(easter, -2), "Sexta-feira Santa");
  add(addDays(easter, -1), "Sábado de Aleluia (véspera de Páscoa)");
  add(easter, "Páscoa");
  add(iso(year, 4, 21), "Tiradentes");
  add(iso(year, 5, 1), "Dia do Trabalho");
  add(addDays(maes, -1), "Véspera do Dia das Mães");
  add(maes, "Dia das Mães");
  add(addDays(easter, 60), "Corpus Christi");
  add(iso(year, 6, 12), "Dia dos Namorados");
  add(iso(year, 6, 23), "Véspera de São João");
  add(iso(year, 6, 24), "São João");
  add(iso(year, 6, 29), "São Pedro");
  add(iso(year, 7, 2), "Independência da Bahia (2 de Julho)");
  add(addDays(pais, -1), "Véspera do Dia dos Pais");
  add(pais, "Dia dos Pais");
  add(iso(year, 9, 7), "Independência do Brasil");
  add(iso(year, 10, 12), "Dia das Crianças / N. Sra. Aparecida");
  add(iso(year, 11, 2), "Finados");
  add(iso(year, 11, 15), "Proclamação da República");
  add(iso(year, 11, 20), "Consciência Negra");
  add(blackFriday, "Black Friday");
  add(iso(year, 12, 24), "Véspera de Natal");
  add(iso(year, 12, 25), "Natal");
  add(iso(year, 12, 31), "Véspera de Ano Novo");

  // Salvador (BA). Datas de festas populares podem variar: confirmar na
  // programação da prefeitura.
  add(addDays(nth(year, 1, 4, 2), 0), "Lavagem do Bonfim");
  add(iso(year, 2, 2), "Festa de Iemanjá (Rio Vermelho)");
  add(addDays(easter, -51), "Abertura do Carnaval de Salvador");
  add(iso(year, 3, 29), "Aniversário de Salvador");
  add(iso(year, 12, 4), "Santa Bárbara");
  add(iso(year, 12, 8), "N. Sra. da Conceição da Praia (feriado municipal)");

  // Eleições: 1º domingo de outubro (2º turno no último domingo), anos pares.
  if (year % 2 === 0) {
    add(nth(year, 10, 0, 1), "Eleições (1º turno)");
    const ultimo = addDays(nth(year, 11, 0, 1), -7);
    add(ultimo, "Eleições (2º turno, onde houver)");
  }
  cache.set(year, map);
  return map;
}

/** Nome da data comemorativa (ou undefined). */
export function dataComemorativa(date: string) {
  return datasDoAno(Number(date.slice(0, 4))).get(date);
}

/** Datas comemorativas dentro de um período (no máximo `limite`). */
export function datasNoPeriodo(ini: string, fim: string, limite = 25) {
  const out: { date: string; event: string }[] = [];
  for (let y = Number(ini.slice(0, 4)); y <= Number(fim.slice(0, 4)); y++)
    for (const [date, event] of datasDoAno(y))
      if (date >= ini && date <= fim) out.push({ date, event });
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limite);
}

/** Feriados nacionais (para contar dias úteis bancários). */
function feriadosNacionais(year: number) {
  const easter = pascoa(year);
  return new Set([
    iso(year, 1, 1),
    addDays(easter, -48),
    addDays(easter, -47),
    addDays(easter, -2),
    iso(year, 4, 21),
    iso(year, 5, 1),
    addDays(easter, 60),
    iso(year, 9, 7),
    iso(year, 10, 12),
    iso(year, 11, 2),
    iso(year, 11, 15),
    iso(year, 11, 20),
    iso(year, 12, 25),
  ]);
}

function diasUteis(year: number, month: number) {
  const feriados = feriadosNacionais(year);
  const dias: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    const date = iso(year, month, d);
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6 && !feriados.has(date)) dias.push(date);
  }
  return dias;
}

export type JanelaPagamento = { event: string; start: string; end: string };

/**
 * Janelas de pagamento de benefícios que podem mexer com o comércio do
 * interior (aproximadas; o calendário oficial muda a cada ano, e em dezembro
 * o Bolsa Família costuma ser antecipado). São HIPÓTESES para testar nos dados.
 */
export function janelasPagamento(ini: string, fim: string): JanelaPagamento[] {
  const out: JanelaPagamento[] = [];
  let year = Number(ini.slice(0, 4));
  let month = Number(ini.slice(5, 7));
  const endKey = Number(fim.slice(0, 4)) * 12 + Number(fim.slice(5, 7));
  // Inclui o mês anterior: o INSS do fim do mês passado entra nos 5 primeiros dias úteis.
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  while (year * 12 + month <= endKey) {
    const uteis = diasUteis(year, month);
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    const proximos = diasUteis(ny, nm);
    if (month === 12) {
      const dez = uteis.filter(
        (d) => d >= iso(year, 12, 10) && d <= iso(year, 12, 23),
      );
      if (dez.length)
        out.push({
          event: "Pagamento do Bolsa Família antecipado de dezembro (aprox.)",
          start: dez[0],
          end: dez[dez.length - 1],
        });
    } else
      out.push({
        event: "Pagamento do Bolsa Família (últimos 10 dias úteis, aprox.)",
        start: uteis[uteis.length - 10],
        end: uteis[uteis.length - 1],
      });
    out.push({
      event:
        "Pagamento do INSS (últimos 5 dias úteis do mês e 5 primeiros do seguinte, aprox.)",
      start: uteis[uteis.length - 5],
      end: proximos[4],
    });
    month = nm;
    year = ny;
  }
  return out.filter((j) => j.end >= ini && j.start <= fim);
}
