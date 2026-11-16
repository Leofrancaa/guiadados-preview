"use client";

import { useEffect, useRef, useState } from "react";
import { compact, money, percent } from "@/lib/format";

/** Topo de escala "redondo" e 4 divisões. */
export function escala(max: number) {
  if (max <= 0) return { topo: 1, ticks: [0, 1] };
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto)!;
  const topo = passo * Math.ceil(max / passo);
  const ticks: number[] = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(v);
  return { topo, ticks };
}

/** Receitas e despesas por mês (barras lado a lado) com o resultado em linha. */
export function GraficoMensal({
  pontos,
  destaque,
  parcial,
}: {
  pontos: {
    label: string;
    /** Nome do mês por extenso, para o tooltip. */
    titulo: string;
    /** Linha extra no tooltip; substitui a comparação automática. */
    nota?: string;
    receita: number;
    despesa: number;
    resultado: number;
  }[];
  destaque: number;
  /** Índice do mês em andamento, desenhado mais claro. */
  parcial?: number;
}) {
  // Cada período ganha uma largura mínima; quando não cabe (celular, muitos
  // meses), o gráfico rola na horizontal e abre mostrando os mais recentes.
  const larguraMin = 52 + 12 + pontos.length * 56;
  // Poucos períodos (ano a ano) usam um desenho mais estreito, para o texto
  // não encolher demais no celular.
  const compacto = pontos.length <= 4;
  const W = Math.max(compacto ? 380 : 760, larguraMin);
  const H = compacto ? 260 : 280;
  const pad = { l: 52, r: 12, t: 14, b: 30 };
  // Fora da linha de resultado: o mês em andamento (parcial) e os meses sem
  // nenhuma despesa lançada (o resultado seria a receita inteira).
  const naLinha = (p: { despesa: number }, i: number) =>
    i !== parcial && p.despesa > 0;
  // Só os resultados desenhados na linha abrem espaço abaixo do zero.
  const minimo = Math.min(0, ...pontos.filter(naLinha).map((p) => p.resultado));
  const { topo, ticks } = escala(
    Math.max(...pontos.map((p) => Math.max(p.receita, p.despesa))),
  );
  const base = minimo < 0 ? escala(-minimo).topo : 0;
  const y = (v: number) =>
    pad.t + ((topo - v) / (topo + base)) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / pontos.length;
  const bw = Math.min(16, slot * 0.28);
  const cx = (i: number) => pad.l + slot * i + slot / 2;
  // O mês em andamento fica fora da linha: o resultado parcial distorce a tendência.
  const fechados = pontos
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => naLinha(p, i));
  const linha = fechados
    .map(({ p, i }, k) => `${k ? "L" : "M"}${cx(i)},${y(p.resultado)}`)
    .join(" ");
  const [ativo, setAtivo] = useState<number | null>(null);
  const atual = ativo === null ? null : pontos[ativo];
  const anterior = ativo ? pontos[ativo - 1] : null;
  const rolagem = useRef<HTMLDivElement>(null);
  // O tooltip fica fora da área que rola, para não ser cortado por ela.
  const moldura = useRef<HTMLDivElement>(null);
  const [ancora, setAncora] = useState<{ x: number; esquerda: boolean } | null>(
    null,
  );
  const mostrar = (i: number, alvo: Element) => {
    const box = moldura.current?.getBoundingClientRect();
    const r = alvo.getBoundingClientRect();
    if (box) {
      const x = r.left + r.width / 2 - box.left;
      setAncora({ x, esquerda: x > box.width / 2 });
    }
    setAtivo(i);
  };
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [pontos.length]);

  return (
    <div
      className="fin-chart-wrap"
      ref={moldura}
      onMouseLeave={() => setAtivo(null)}
    >
      <div
        className="fin-chart-scroll"
        ref={rolagem}
        onScroll={() => setAtivo(null)}
      >
        <div className="fin-chart-box" style={{ minWidth: larguraMin }}>
          {!compacto && (
            // Eixo de valores fixo à esquerda enquanto o gráfico rola.
            <div className="fin-yaxis" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} style={{ top: `${(y(t) / H) * 100}%` }}>
                  {compact(t)}
                </span>
              ))}
            </div>
          )}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={compacto ? "fin-svg fin-svg-compact" : "fin-svg"}
            role="img"
            aria-label="Receitas, despesas e resultado por mês"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(t)}
                  y2={y(t)}
                  className="fin-grid"
                />
                {compacto && (
                  <text
                    x={pad.l - 8}
                    y={y(t) + 4}
                    className="fin-axis"
                    textAnchor="end"
                  >
                    {compact(t)}
                  </text>
                )}
              </g>
            ))}
            {base > 0 && (
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(0)}
                y2={y(0)}
                className="fin-zero"
              />
            )}
            {pontos.map((p, i) => (
              <g
                key={p.label}
                className={`fin-col${i === destaque ? " active" : ""}${i === parcial ? " parcial" : ""}${i === ativo ? " hover" : ""}`}
                tabIndex={0}
                aria-label={`${p.titulo}: receita ${money(p.receita)}, despesas ${money(p.despesa)}, resultado ${money(p.resultado)}`}
                onMouseEnter={(e) => mostrar(i, e.currentTarget)}
                onFocus={(e) => mostrar(i, e.currentTarget)}
                onBlur={() => setAtivo(null)}
                onClick={(e) => mostrar(i, e.currentTarget)}
              >
                <rect
                  x={pad.l + slot * i}
                  y={pad.t}
                  width={slot}
                  height={H - pad.t - pad.b}
                  className="fin-hit"
                />
                <rect
                  x={cx(i) - bw - 1}
                  y={y(p.receita)}
                  width={bw}
                  height={Math.max(0, y(0) - y(p.receita))}
                  rx={3}
                  className="fin-bar-receita"
                />
                <rect
                  x={cx(i) + 1}
                  y={y(p.despesa)}
                  width={bw}
                  height={Math.max(0, y(0) - y(p.despesa))}
                  rx={3}
                  className="fin-bar-despesa"
                />
                <text
                  x={cx(i)}
                  y={H - 10}
                  className="fin-axis"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              </g>
            ))}
            <path d={linha} className="fin-line" />
            {fechados.map(({ p, i }) => (
              <circle
                key={p.label}
                cx={cx(i)}
                cy={y(p.resultado)}
                r={i === destaque ? 4.5 : 3}
                className="fin-dot"
              />
            ))}
          </svg>
        </div>
      </div>
      {atual && ativo !== null && ancora && (
        <div
          className={`fin-tip${ancora.esquerda ? " left" : ""}`}
          style={{ left: ancora.x }}
          role="status"
        >
          <strong className="fin-tip-title">
            {atual.titulo}
            {ativo === parcial && <span>em andamento</span>}
          </strong>
          <dl>
            <div>
              <dt>
                <i className="fin-key-receita" />
                Receita
              </dt>
              <dd>{money(atual.receita)}</dd>
            </div>
            <div>
              <dt>
                <i className="fin-key-despesa" />
                Despesas
              </dt>
              <dd>{money(atual.despesa)}</dd>
            </div>
            <div className="fin-tip-total">
              <dt>Resultado</dt>
              <dd className={atual.resultado < 0 ? "neg" : "pos"}>
                {money(atual.resultado)}
              </dd>
            </div>
            <div>
              <dt>Margem</dt>
              <dd>
                {atual.receita
                  ? percent((atual.resultado / atual.receita) * 100)
                  : "–"}
              </dd>
            </div>
          </dl>
          {atual.nota ? (
            <p>{atual.nota}</p>
          ) : (
            anterior &&
            ativo !== parcial && (
              <p>
                {atual.resultado >= anterior.resultado ? "+" : "−"}
                {money(Math.abs(atual.resultado - anterior.resultado))} no
                resultado contra {anterior.label}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Vendas de cada dia do mês com a linha do ponto de equilíbrio diário. */
export function GraficoDiario({
  dias,
  meta,
  diasNoMes,
}: {
  dias: number[];
  meta: number;
  diasNoMes: number;
}) {
  const W = 560;
  const H = 210;
  const pad = { l: 52, r: 12, t: 14, b: 26 };
  const { topo, ticks } = escala(Math.max(meta * 1.1, ...dias));
  const y = (v: number) => pad.t + ((topo - v) / topo) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / diasNoMes;
  return (
    <div className="fin-chart-scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="fin-svg fin-svg-narrow"
        role="img"
        aria-label="Vendas por dia e meta diária"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              className="fin-grid"
            />
            <text
              x={pad.l - 8}
              y={y(t) + 4}
              className="fin-axis"
              textAnchor="end"
            >
              {compact(t)}
            </text>
          </g>
        ))}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const v = dias[i];
          const x = pad.l + slot * i + slot * 0.18;
          const w = slot * 0.64;
          return (
            <g key={i}>
              {v === undefined ? (
                <rect
                  x={x}
                  y={y(0) - 3}
                  width={w}
                  height={3}
                  rx={1.5}
                  className="fin-bar-futuro"
                />
              ) : (
                <rect
                  x={x}
                  y={y(v)}
                  width={w}
                  height={y(0) - y(v)}
                  rx={2}
                  className={v >= meta ? "fin-bar-ok" : "fin-bar-abaixo"}
                >
                  <title>{`Dia ${i + 1}: ${money(v)}`}</title>
                </rect>
              )}
              {(i === 0 || (i + 1) % 5 === 0) && (
                <text
                  x={pad.l + slot * i + slot / 2}
                  y={H - 8}
                  className="fin-axis"
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(meta)}
          y2={y(meta)}
          className="fin-meta"
        />
      </svg>
    </div>
  );
}

/** Lista de barras horizontais (para onde foi o dinheiro, custo por cargo). */
export function BarrasHorizontais({
  itens,
  total,
  formato = money,
}: {
  itens: { label: string; valor: number; detalhe?: string; cor?: string }[];
  total: number;
  formato?: (v: number) => string;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="fin-hbars">
      {itens.map((i) => (
        <li key={i.label}>
          <span className="fin-hbar-label">{i.label}</span>
          <span className="fin-hbar-track" aria-hidden="true">
            <span
              style={{ width: `${(i.valor / max) * 100}%`, background: i.cor }}
            />
          </span>
          <span className="fin-hbar-value">
            {formato(i.valor)}
            <small>
              {i.detalhe ??
                `${total ? ((i.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%`}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cada categoria com duas barras na mesma escala: o período escolhido (cor) e
 * o de comparação (cinza), mais a diferença em R$ e %.
 */
export function ComparativoCategorias({
  itens,
  rotuloAtual,
  rotuloBase,
}: {
  itens: { label: string; detalhe: string; atual: number; base: number }[];
  rotuloAtual: string;
  rotuloBase: string;
}) {
  const max = Math.max(...itens.flatMap((i) => [i.atual, i.base]), 1);
  return (
    <>
      <div className="fin-legend" aria-hidden="true">
        <span>
          <i className="fin-key-atual" />
          {rotuloAtual}
        </span>
        <span>
          <i className="fin-key-base" />
          {rotuloBase}
        </span>
      </div>
      <ul className="fin-hbars fin-cmp">
        {itens.map((i) => {
          const dif = i.atual - i.base;
          const pct = i.base > 0 ? (dif / i.base) * 100 : null;
          const variacao =
            i.base === 0 && i.atual > 0
              ? "novo no período"
              : i.atual === 0 && i.base > 0
                ? "sem gasto agora"
                : Math.abs(dif) < 0.005
                  ? "igual"
                  : `${dif > 0 ? "▲ +" : "▼ −"}${money(Math.abs(dif))}${
                      pct === null
                        ? ""
                        : ` (${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`
                    }`;
          return (
            <li
              key={i.label}
              title={`${i.label}: ${money(i.atual)} em ${rotuloAtual}, ${money(i.base)} em ${rotuloBase} (${variacao}).`}
            >
              <span className="fin-hbar-label">
                {i.label}
                <small>{i.detalhe}</small>
              </span>
              <span className="fin-cmp-bars" aria-hidden="true">
                <span className="fin-hbar-track">
                  <span style={{ width: `${(i.atual / max) * 100}%` }} />
                </span>
                <span className="fin-hbar-track fin-cmp-base">
                  <span style={{ width: `${(i.base / max) * 100}%` }} />
                </span>
              </span>
              <span className="fin-hbar-value">
                {money(i.atual)}
                <small>{variacao}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
