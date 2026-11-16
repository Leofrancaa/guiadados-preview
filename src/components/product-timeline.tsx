"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CalendarRange } from "lucide-react";
import { ApiErrorBanner } from "./sales-filters";
import { dateBr, money, moneyShort, signedPercent } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import {
  formatQuantity,
  shiftDate,
  type ProdutoHistorico,
  type Situacao,
} from "@/lib/vendas";

type Metrica = "faturamento" | "qtd";
type Grao = "dia" | "semana" | "mes";
// Janelas móveis ou um ano-calendário ("a2025"). Nunca mais de 12 meses
// no gráfico: o ano anterior já aparece como a linha pontilhada.
type Janela = "3m" | "6m" | "1a" | `a${number}`;

const janelasMoveis: { key: Janela; label: string; meses: number }[] = [
  { key: "3m", label: "3 meses", meses: 3 },
  { key: "6m", label: "6 meses", meses: 6 },
  { key: "1a", label: "12 meses", meses: 12 },
];
const graos: { key: Grao; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

type Ponto = {
  start: string;
  end: string;
  valor: number;
  anterior: number | null; // mesmo período do ano anterior
  media: number | null; // média móvel de 7 dias (só no grão diário)
  parcial: boolean;
};

const W = 600;
const H = 200;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T12:00:00Z`);

function addMonths(date: string, months: number) {
  const d = utc(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return ymd(d);
}

function inicioDoGrao(date: string, grao: Grao) {
  if (grao === "semana")
    return shiftDate(date, -((utc(date).getUTCDay() + 6) % 7));
  if (grao === "mes") return `${date.slice(0, 7)}-01`;
  return date;
}

function fimDoGrao(start: string, grao: Grao) {
  if (grao === "semana") return shiftDate(start, 6);
  if (grao === "mes") return shiftDate(addMonths(start, 1), -1);
  return start;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const passo = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(
    (k) => k * p >= v * 1.05,
  )!;
  return passo * p;
}

function rotulo(p: Ponto, grao: Grao) {
  if (grao === "mes")
    return dateBr(p.start, { month: "long", year: "numeric" });
  if (grao === "semana")
    return `Semana de ${dateBr(p.start, { day: "2-digit", month: "short" })} a ${dateBr(p.end, { day: "2-digit", month: "short", year: "2-digit" })}`;
  return dateBr(p.start, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function ProductTimeline({
  codigo,
  situacao,
  unidade,
}: {
  codigo: string;
  situacao: Situacao;
  unidade: string;
}) {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useApi<ProdutoHistorico>(
    `/api/produtos/${encodeURIComponent(codigo)}/historico?situacao=${situacao}`,
    nonce,
  );
  const [metrica, setMetrica] = useState<Metrica>("faturamento");
  const [grao, setGrao] = useState<Grao>("semana");
  const [janelaEscolhida, setJanela] = useState<Janela | null>(null);
  const [ativo, setAtivo] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(560);

  // Quantos rótulos cabem no eixo X depende da largura real do gráfico.
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Somas acumuladas por dia: qualquer intervalo sai em O(1).
  const base = useMemo(() => {
    if (!data?.ini || !data.fim) return null;
    const idx = new Map<string, number>();
    const datas: string[] = [];
    for (let d = data.ini; d <= data.fim; d = shiftDate(d, 1)) {
      idx.set(d, datas.length);
      datas.push(d);
    }
    const acc = {
      faturamento: new Float64Array(datas.length + 1),
      qtd: new Float64Array(datas.length + 1),
    };
    const porDia = new Map(data.serie.map((s) => [s.data, s]));
    datas.forEach((d, i) => {
      const s = porDia.get(d);
      acc.faturamento[i + 1] = acc.faturamento[i] + (s?.faturamento ?? 0);
      acc.qtd[i + 1] = acc.qtd[i] + (s?.qtd ?? 0);
    });
    const ini = data.ini;
    const fim = data.fim;
    const soma = (m: Metrica, a: string, b: string): number | null => {
      if (a < ini || b > fim || b < a) return null;
      return acc[m][idx.get(b)! + 1] - acc[m][idx.get(a)!];
    };
    return { ini, fim, soma, temVenda: data.serie.length > 0 };
  }, [data]);

  const anos = useMemo(() => {
    if (!base) return [];
    const lista: number[] = [];
    for (let a = +base.fim.slice(0, 4); a >= +base.ini.slice(0, 4); a--)
      lista.push(a);
    return lista;
  }, [base]);
  // Padrão: o ano mais recente com dados.
  const janela: Janela = janelaEscolhida ?? (anos[0] ? `a${anos[0]}` : "1a");
  const janelas = useMemo(
    () => [
      ...janelasMoveis,
      ...anos.map((a) => ({ key: `a${a}` as Janela, label: String(a) })),
    ],
    [anos],
  );

  const pontos = useMemo<Ponto[]>(() => {
    if (!base) return [];
    const movel = janelasMoveis.find((j) => j.key === janela);
    const ano = movel ? null : janela.slice(1);
    let inicio = movel
      ? shiftDate(addMonths(base.fim, -movel.meses), 1)
      : `${ano}-01-01`;
    const limite = ano && `${ano}-12-31` < base.fim ? `${ano}-12-31` : base.fim;
    if (movel) inicio = inicioDoGrao(inicio, grao);
    if (inicio < base.ini) inicio = base.ini;
    const lista: Ponto[] = [];
    for (let s = inicio; s <= limite;) {
      const natural = fimDoGrao(inicioDoGrao(s, grao), grao);
      const e = natural > limite ? limite : natural;
      // Semana e dia: 364 dias atrás (mesmo dia da semana). Mês: mesmo mês.
      const anterior =
        grao === "mes"
          ? base.soma(metrica, addMonths(s, -12), addMonths(e, -12))
          : base.soma(metrica, shiftDate(s, -364), shiftDate(e, -364));
      const media =
        grao === "dia"
          ? (() => {
              const v = base.soma(metrica, shiftDate(s, -6), s);
              return v === null ? null : v / 7;
            })()
          : null;
      lista.push({
        start: s,
        end: e,
        valor: base.soma(metrica, s, e) ?? 0,
        anterior,
        media,
        parcial: natural > base.fim,
      });
      s = shiftDate(natural, 1);
    }
    return lista;
  }, [base, grao, janela, metrica]);

  const fmt = (v: number) =>
    metrica === "faturamento" ? money(v) : formatQuantity(v, unidade);
  const fmtCurto = (v: number) =>
    metrica === "faturamento"
      ? moneyShort(v)
      : formatQuantity(v, unidade).replace(/ (un|kg)$/i, "");

  const resumo = useMemo(() => {
    if (!base || !pontos.length) return null;
    const a = pontos[0].start;
    const b = pontos[pontos.length - 1].end;
    const total = base.soma(metrica, a, b) ?? 0;
    const antes = base.soma(metrica, shiftDate(a, -364), shiftDate(b, -364));
    const completos = pontos.filter((p) => !p.parcial);
    const melhor = completos.length
      ? completos.reduce((x, y) => (y.valor > x.valor ? y : x))
      : null;
    return {
      total,
      variacao: antes ? ((total - antes) / antes) * 100 : null,
      melhor,
    };
  }, [base, pontos, metrica]);

  if (error)
    return (
      <section className="rs-drawer-section">
        <ApiErrorBanner error={error} onRetry={() => setNonce((v) => v + 1)} />
      </section>
    );

  const head = (
    <h3>
      <CalendarRange size={17} /> Linha do tempo
      <small>independente do período do filtro</small>
    </h3>
  );

  if (loading && !data)
    return (
      <section className="rs-drawer-section">
        {head}
        <p className="rs-loading" role="status">
          Carregando o histórico…
        </p>
      </section>
    );

  if (!base?.temVenda || !pontos.length)
    return (
      <section className="rs-drawer-section">
        {head}
        <p className="rs-empty-text">Sem vendas registradas deste produto.</p>
      </section>
    );

  const temAnterior = pontos.some((p) => p.anterior !== null);
  const yMax = niceMax(
    Math.max(
      ...pontos.map((p) => Math.max(p.valor, p.anterior ?? 0, p.media ?? 0)),
    ),
  );
  const n = pontos.length;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / yMax) * H;
  const linha = (valores: (number | null)[]) => {
    let d = "";
    let aberto = false;
    valores.forEach((v, i) => {
      if (v === null) {
        aberto = false;
        return;
      }
      d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      aberto = true;
    });
    return d;
  };
  const atual = linha(pontos.map((p) => p.valor));
  const anterior = linha(pontos.map((p) => p.anterior));
  const media = grao === "dia" ? linha(pontos.map((p) => p.media)) : "";
  const area = `${atual}L${x(n - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`;

  // Rótulos do eixo X: inícios de mês, no máximo ~6.
  const marcas: { i: number; texto: string }[] = [];
  const inicios = pontos
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) =>
        i === 0 || p.start.slice(0, 7) !== pontos[i - 1].start.slice(0, 7),
    );
  const passo = Math.max(
    1,
    Math.ceil(inicios.length / Math.max(2, Math.floor(largura / 60))),
  );
  inicios.forEach(({ p, i }, k) => {
    if (k % passo === 0)
      marcas.push({
        i,
        texto: dateBr(p.start, { month: "short", year: "2-digit" }).replace(
          ". de ",
          "/",
        ),
      });
  });

  const sel = ativo !== null && ativo < n ? pontos[ativo] : null;

  const mover = (clientX: number) => {
    const el = plotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setAtivo(Math.round(f * (n - 1)));
  };
  const teclado = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowLeft" ? -1 : 1;
      setAtivo((a) => Math.min(n - 1, Math.max(0, (a ?? n - 1) + d)));
    } else if (e.key === "Escape") setAtivo(null);
  };

  const toggle = <T extends string>(
    label: string,
    opcoes: { key: T; label: string }[],
    valor: T,
    set: (v: T) => void,
  ) => (
    <div className="rs-tl-toggle" role="group" aria-label={label}>
      {opcoes.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={valor === o.key}
          className={valor === o.key ? "selected" : ""}
          onClick={() => {
            set(o.key);
            setAtivo(null);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const nomeGrao = { dia: "dia", semana: "semana", mes: "mês" }[grao];

  return (
    <section className="rs-drawer-section rs-tl">
      {head}
      <div className="rs-tl-controls">
        {toggle(
          "Métrica",
          [
            { key: "faturamento" as Metrica, label: "Faturamento" },
            { key: "qtd" as Metrica, label: "Quantidade" },
          ],
          metrica,
          setMetrica,
        )}
        {toggle("Agrupar por", graos, grao, setGrao)}
        {toggle("Período", janelas, janela, setJanela)}
      </div>

      {resumo && (
        <div className="rs-tl-summary">
          <div>
            <span>Total no período</span>
            <strong>{fmt(resumo.total)}</strong>
          </div>
          {resumo.variacao !== null && (
            <div>
              <span>vs. ano anterior</span>
              <strong className={resumo.variacao >= 0 ? "is-up" : "is-down"}>
                {signedPercent(resumo.variacao)}
              </strong>
            </div>
          )}
          {resumo.melhor && grao !== "dia" && (
            <div>
              <span>Melhor {nomeGrao}</span>
              <strong>{fmtCurto(resumo.melhor.valor)}</strong>
              <small>
                {grao === "mes"
                  ? dateBr(resumo.melhor.start, {
                      month: "short",
                      year: "numeric",
                    })
                  : `sem. de ${dateBr(resumo.melhor.start, { day: "2-digit", month: "2-digit", year: "2-digit" })}`}
              </small>
            </div>
          )}
        </div>
      )}

      <div className="rs-tl-chart">
        <div className="rs-tl-y" aria-hidden="true">
          {[1, 0.5, 0].map((f) => (
            <span key={f} style={{ top: `${(1 - f) * 100}%` }}>
              {fmtCurto(yMax * f)}
            </span>
          ))}
        </div>
        <div
          ref={plotRef}
          className="rs-tl-plot"
          role="img"
          tabIndex={0}
          aria-label={`${metrica === "faturamento" ? "Faturamento" : "Quantidade"} por ${nomeGrao} de ${dateBr(pontos[0].start, { month: "short", year: "numeric" })} a ${dateBr(pontos[n - 1].end, { month: "short", year: "numeric" })}. Use as setas para percorrer os pontos.`}
          onPointerMove={(e) => mover(e.clientX)}
          onPointerDown={(e) => mover(e.clientX)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1={0}
                x2={W}
                y1={H * f}
                y2={H * f}
                className="rs-tl-grid"
              />
            ))}
            <path d={area} className="rs-tl-area" />
            {temAnterior && <path d={anterior} className="rs-tl-prev" />}
            <path
              d={atual}
              className={grao === "dia" ? "rs-tl-raw" : "rs-tl-line"}
            />
            {media && <path d={media} className="rs-tl-line" />}
          </svg>
          {sel && (
            <>
              <i
                className="rs-tl-cursor"
                style={{ left: `${(x(ativo!) / W) * 100}%` }}
              />
              <i
                className="rs-tl-dot"
                style={{
                  left: `${(x(ativo!) / W) * 100}%`,
                  top: `${(y(grao === "dia" ? (sel.media ?? sel.valor) : sel.valor) / H) * 100}%`,
                }}
              />
              <div
                className={`rs-tl-tip ${x(ativo!) > W / 2 ? "left" : ""}`}
                style={{ left: `${(x(ativo!) / W) * 100}%` }}
                role="status"
              >
                <span>
                  {rotulo(sel, grao)}
                  {sel.parcial && " (parcial)"}
                </span>
                <strong>{fmt(sel.valor)}</strong>
                {sel.media !== null && (
                  <small>média 7 dias: {fmt(sel.media)}</small>
                )}
                {sel.anterior !== null && (
                  <small>
                    ano anterior: {fmt(sel.anterior)}
                    {sel.anterior > 0 &&
                      ` (${signedPercent(((sel.valor - sel.anterior) / sel.anterior) * 100)})`}
                  </small>
                )}
              </div>
            </>
          )}
        </div>
        <div className="rs-tl-x" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m.i} style={{ left: `${(x(m.i) / W) * 100}%` }}>
              {m.texto}
            </span>
          ))}
        </div>
      </div>

      <ul className="rs-tl-legend">
        <li>
          <i className="is-line" />
          {grao === "dia" ? "Média de 7 dias" : "Este período"}
        </li>
        {grao === "dia" && (
          <li>
            <i className="is-raw" />
            Dia a dia
          </li>
        )}
        {temAnterior && (
          <li>
            <i className="is-prev" />
            Ano anterior
          </li>
        )}
      </ul>
      {pontos[n - 1].parcial && (
        <p className="rs-note">
          O último ponto está incompleto (dados até{" "}
          {dateBr(base.fim, { day: "2-digit", month: "2-digit" })}).
        </p>
      )}
    </section>
  );
}
