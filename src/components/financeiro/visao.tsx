"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Chapter } from "@/components/products-view";
import {
  addDias,
  addMeses,
  calcularDre,
  despesasPorCategoria,
  diasNoMes,
  mesLabel,
  statusDe,
  vendasDe,
  type Dre,
} from "@/lib/financeiro/calculos";
import {
  GRUPOS,
  GRUPOS_DESPESA,
  type Grupo,
  type Lancamento,
} from "@/lib/financeiro/tipos";
import type { Financeiro } from "@/lib/financeiro/use-financeiro";
import {
  money,
  moneyShort,
  percent,
  shortDate,
  signedPercent,
} from "@/lib/format";
import type { Filtros } from "./financeiro-view";
import {
  BarrasHorizontais,
  ComparativoCategorias,
  GraficoDiario,
  GraficoMensal,
} from "./graficos";

export const COR_GRUPO: Record<Exclude<Grupo, "receita">, string> = {
  cmv: "#6a4bf0",
  pes: "#1f6fa8",
  ocu: "#775be5",
  imp: "#7a6a9e",
  srv: "#716c88",
  fin: "#9f9da7",
  inv: "#3f4a43",
  soc: "#c98a8a",
  cx: "#8b8a8f",
};

export function VisaoFinanceira({
  fin,
  filtros,
  meses,
  onIrContas,
  onMessage,
}: {
  fin: Financeiro;
  filtros: Filtros;
  meses: string[];
  onIrContas: () => void;
  onMessage: (t: string) => void;
}) {
  const dados = fin.dados!;
  const { mes } = filtros;
  const dres = useMemo(
    () =>
      meses.map((m) =>
        calcularDre(
          m,
          dados.lancamentos,
          dados.funcionarios,
          fin.vendas,
          dados.config,
        ),
      ),
    [meses, dados, fin.vendas],
  );
  const idx = meses.indexOf(mes);
  // O gráfico mês a mês mostra só o ano atual; anos anteriores ficam no "Ano a ano".
  const anoAtual = fin.hoje.slice(0, 4);
  const dresAno = dres.filter((d) => d.mes.startsWith(anoAtual));
  const dre = dres[idx];
  const anterior = idx > 0 ? dres[idx - 1] : null;
  const emAndamento = idx === meses.length - 1;
  const dim = diasNoMes(mes);

  const proximas = dados.lancamentos
    .filter(
      (l) =>
        l.tipo === "despesa" && !l.pago && l.vencimento <= addDias(fin.hoje, 7),
    )
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 6);

  // No mês em andamento, a média usa só os dias fechados (até ontem).
  const diasMes = vendasDe(fin.vendas, mes).dias;
  const fechados = emAndamento
    ? diasMes.slice(0, Number(fin.hoje.slice(8, 10)) - 1)
    : diasMes;
  const comVenda = fechados.filter((v) => v > 0);
  const media = comVenda.length
    ? comVenda.reduce((s, v) => s + v, 0) / comVenda.length
    : 0;
  const metaDia = dre.pontoEquilibrio / dim;
  const projecao = emAndamento ? media * dim : dre.vendas;

  return (
    <>
      {emAndamento && (
        <p className="rs-note">
          {mesLabel(mes, "longo")} está em andamento ({comVenda.length} de {dim}{" "}
          dias fechados). Despesas que ainda vão chegar, como insumos do fim do
          mês, pesam só quando forem lançadas.
        </p>
      )}
      <Kpis
        dre={dre}
        anterior={anterior}
        emAndamento={emAndamento}
        projecao={projecao}
      />

      <Chapter
        n={1}
        title={`Mês a mês em ${anoAtual}`}
        caption="Receita real do caixa (as duas lojas) mais encomendas, contra as despesas do mês pela data de competência (parcelas de empréstimo e faturas de cartão ficam fora: só mexem no caixa). A linha é o resultado, só nos meses com contas lançadas; o último mês, mais claro, ainda está em andamento."
      />
      <section className="panel chart-panel">
        <Legenda />
        <GraficoMensal
          destaque={dresAno.findIndex((d) => d.mes === mes)}
          parcial={dresAno.length - 1}
          pontos={dresAno.map((d) => ({
            label: mesLabel(d.mes),
            titulo: mesLabel(d.mes, "longo"),
            receita: d.receita,
            despesa: d.despesas,
            resultado: d.resultado,
            nota: d.despesas
              ? undefined
              : "Sem contas lançadas neste mês: o resultado ainda não vale.",
          }))}
        />
        <p className="fin-scroll-hint">
          Arraste o gráfico para ver os primeiros meses do ano.
        </p>
        <p className="sr-only">
          {dresAno
            .map(
              (d) =>
                `${mesLabel(d.mes, "longo")}: resultado ${money(d.resultado)}.`,
            )
            .join(" ")}
        </p>
      </section>

      <AnoAAno dres={dres} hoje={fin.hoje} />

      <Chapter
        n={3}
        title="Para onde foi o dinheiro"
        caption="Despesas do mês por grupo e a DRE simplificada, pela competência. Se a folha não estiver lançada nas contas, ela é estimada pelo cadastro de funcionários."
      />
      <div className="fin-grid-2">
        <section className="panel fin-pad">
          <div className="panel-heading">
            <div>
              <h3 className="fin-h3">Despesas por grupo</h3>
              <p className="section-description">
                Total de {money(dre.despesas)} em {mesLabel(mes, "longo")}.
              </p>
            </div>
          </div>
          {dre.despesas > 0 ? (
            <BarrasHorizontais
              total={dre.despesas}
              itens={GRUPOS_DESPESA.filter((g) => g !== "cx")
                .map((g) => ({
                  label: GRUPOS[g].label,
                  valor: dre.grupos[g],
                  cor: COR_GRUPO[g],
                }))
                .filter((i) => i.valor > 0)
                .sort((a, b) => b.valor - a.valor)}
            />
          ) : (
            <p className="fin-empty">
              Nenhuma conta lançada em {mesLabel(mes, "longo")}. As despesas
              aparecem aqui quando as contas do mês forem cadastradas em
              Lançamentos.
            </p>
          )}
        </section>
        <DreTabela dre={dre} />
      </div>
      <CategoriasDespesa
        dres={dres}
        idx={idx}
        lancamentos={dados.lancamentos}
        emAndamento={emAndamento}
      />

      <Chapter
        n={4}
        title="Quanto a loja precisa vender por dia"
        caption="Ponto de equilíbrio: o faturamento que paga os custos fixos (pessoal, ocupação e serviços) depois de tirar impostos, insumos e taxas, que crescem junto com as vendas."
      />
      <div className="fin-grid-2 fin-grid-wide">
        <section className="panel fin-pad">
          <div className="fin-pe">
            <div>
              <span>Precisa vender no mês</span>
              <strong>{money(dre.pontoEquilibrio)}</strong>
            </div>
            <div>
              <span>Por dia</span>
              <strong>{money(metaDia)}</strong>
            </div>
            <div>
              <span>
                {emAndamento
                  ? "Média vendida até ontem"
                  : "Média vendida por dia"}
              </span>
              <strong className={media >= metaDia ? "ok" : "abaixo"}>
                {money(media)}
              </strong>
            </div>
          </div>
          <GraficoDiario dias={diasMes} meta={metaDia} diasNoMes={dim} />
          <div className="fin-legend" aria-hidden="true">
            <span>
              <i className="fin-key-ok" />
              Dia acima do equilíbrio
            </span>
            <span>
              <i className="fin-key-abaixo" />
              Abaixo
            </span>
            <span>
              <i className="fin-key-meta" />
              Equilíbrio: {money(metaDia)}/dia
            </span>
          </div>
        </section>
        <section className="panel fin-pad">
          <div className="panel-heading">
            <div>
              <h3 className="fin-h3">Vencem até a próxima semana</h3>
              <p className="section-description">Inclui contas em atraso.</p>
            </div>
          </div>
          {proximas.length ? (
            <ul className="fin-due-list">
              {proximas.map((l) => {
                const st = statusDe(l, fin.hoje);
                return (
                  <li key={l.id}>
                    <div>
                      <strong>{l.descricao}</strong>
                      <span>
                        {l.unidade} · {st === "atrasado" ? "venceu" : "vence"}{" "}
                        {shortDate(l.vencimento)}
                      </span>
                    </div>
                    <span className="fin-due-right">
                      <b>{money(l.valor)}</b>
                      <StatusBadge status={st} />
                    </span>
                    <button
                      className="button secondary fin-pay"
                      onClick={() => {
                        fin.pagar(l.id, fin.hoje);
                        onMessage(`${l.descricao} marcada como paga.`);
                      }}
                    >
                      Pagar
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fin-empty">Nada vencendo nos próximos 7 dias.</p>
          )}
          <button className="rs-more" onClick={onIrContas}>
            Ver todas as contas <ArrowRight size={14} aria-hidden="true" />
          </button>
        </section>
      </div>
    </>
  );
}

export function StatusBadge({
  status,
}: {
  status: ReturnType<typeof statusDe>;
}) {
  const map = {
    pago: ["success", "Pago"],
    atrasado: ["danger", "Atrasado"],
    "vence-hoje": ["warning", "Vence hoje"],
    pendente: ["neutral", "Pendente"],
  } as const;
  const [tom, texto] = map[status];
  return (
    <span className={`badge ${tom}`}>
      <span />
      {texto}
    </span>
  );
}

function Kpis({
  dre,
  anterior,
  emAndamento,
  projecao,
}: {
  dre: Dre;
  anterior: Dre | null;
  emAndamento: boolean;
  projecao: number;
}) {
  const varPct = (a: number, b?: number) =>
    b ? ((a - b) / Math.abs(b)) * 100 : null;
  const cards: {
    title: string;
    icon: LucideIcon;
    value: string;
    foot: string;
    tone?: "positive" | "caution";
    featured?: boolean;
  }[] = [
    {
      title: "Receita",
      icon: TrendingUp,
      value: money(dre.receita),
      foot: emAndamento
        ? `Projeção do mês: ${moneyShort(projecao + dre.receitasExtras)}`
        : comparar(varPct(dre.receita, anterior?.receita), "mês anterior"),
    },
    {
      title: "Despesas",
      icon: Receipt,
      value: money(dre.despesas),
      foot: dre.grupos.cx
        ? `Fora: ${moneyShort(dre.grupos.cx)} em empréstimos e cartões`
        : anterior
          ? `Mês anterior: ${moneyShort(anterior.despesas)}`
          : "",
    },
    {
      title: "Resultado",
      icon: PiggyBank,
      value: money(dre.resultado),
      foot:
        dre.resultado >= 0
          ? "Sobrou dinheiro no mês"
          : "As despesas passaram a receita",
      tone: dre.resultado >= 0 ? "positive" : "caution",
      featured: true,
    },
    {
      title: "Margem líquida",
      icon: Landmark,
      value: percent(dre.margem),
      foot: anterior ? `Mês anterior: ${percent(anterior.margem)}` : "",
    },
  ];
  return (
    <section
      className="metrics rs-metrics fin-metrics"
      aria-label="Resumo financeiro do mês"
    >
      {cards.map(({ title, icon: Icon, value, foot, tone, featured }) => (
        <article
          key={title}
          className={`metric ${featured ? "rs-featured" : ""}`}
        >
          <div className="metric-heading">
            <span>{title}</span>
            <Icon size={19} aria-hidden="true" />
          </div>
          <strong
            className={
              featured ? (dre.resultado < 0 ? "fin-neg" : "fin-pos") : undefined
            }
          >
            {value}
          </strong>
          <span className={`metric-footer ${tone ?? ""}`}>{foot}</span>
        </article>
      ))}
    </section>
  );
}

function comparar(v: number | null, nome: string) {
  return v === null ? "" : `${signedPercent(v)} contra o ${nome}`;
}

function DreTabela({ dre }: { dre: Dre }) {
  const linhas: {
    label: string;
    valor: number;
    tipo?: "total" | "sub" | "menos";
  }[] = [
    { label: "Vendas no caixa", valor: dre.vendas, tipo: "sub" },
    {
      label: "Encomendas e outras receitas",
      valor: dre.receitasExtras,
      tipo: "sub",
    },
    { label: "Receita total", valor: dre.receita, tipo: "total" },
    { label: "Impostos", valor: -dre.grupos.imp, tipo: "menos" },
    {
      label: "Insumos e mercadorias (CMV)",
      valor: -dre.grupos.cmv,
      tipo: "menos",
    },
    { label: "Margem bruta", valor: dre.margemBruta, tipo: "total" },
    { label: "Pessoal", valor: -dre.grupos.pes, tipo: "menos" },
    { label: "Ocupação e utilidades", valor: -dre.grupos.ocu, tipo: "menos" },
    {
      label: "Serviços e outras despesas",
      valor: -dre.grupos.srv,
      tipo: "menos",
    },
    {
      label: "Financeiro (taxas e juros)",
      valor: -dre.grupos.fin,
      tipo: "menos",
    },
    {
      label: "Resultado operacional",
      valor: dre.resultadoOperacional,
      tipo: "total",
    },
    { label: "Investimentos", valor: -dre.grupos.inv, tipo: "menos" },
    {
      label: "Resultado da empresa",
      valor: dre.resultadoEmpresa,
      tipo: "total",
    },
    {
      label: "Retiradas e gastos dos sócios",
      valor: -dre.grupos.soc,
      tipo: "menos",
    },
    { label: "Resultado do mês", valor: dre.resultado, tipo: "total" },
    {
      label: "Parcelas de empréstimos e faturas de cartão",
      valor: -dre.grupos.cx,
      tipo: "menos",
    },
    { label: "Sobra de caixa do mês", valor: dre.caixa, tipo: "total" },
  ];
  return (
    <section className="panel fin-pad">
      <div className="panel-heading">
        <div>
          <h3 className="fin-h3">DRE simplificada</h3>
          <p className="section-description">
            Percentuais sobre a receita total.
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="fin-dre">
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label} className={l.tipo}>
                <th scope="row">{l.label}</th>
                <td className="rs-num">{money(l.valor)}</td>
                <td className="rs-num fin-pct">
                  {dre.receita ? percent((l.valor / dre.receita) * 100) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const MAX_CATEGORIAS = 10;

/** Despesas por categoria no mês contra o mês anterior ou a média dos 3 anteriores. */
function CategoriasDespesa({
  dres,
  idx,
  lancamentos,
  emAndamento,
}: {
  dres: Dre[];
  idx: number;
  lancamentos: Lancamento[];
  emAndamento: boolean;
}) {
  const [comparar, setComparar] = useState<"anterior" | "media3">("anterior");
  const dre = dres[idx];
  const bases = dres.slice(
    Math.max(0, idx - (comparar === "anterior" ? 1 : 3)),
    idx,
  );
  const rotuloAtual = mesLabel(dre.mes, "longo");
  const rotuloBase = !bases.length
    ? "Sem mês anterior"
    : comparar === "anterior"
      ? mesLabel(bases[0].mes, "longo")
      : `Média de ${bases.map((b) => mesLabel(b.mes)).join(", ")}`;

  const linhas = useMemo(() => {
    const dre = dres[idx];
    const bases = dres.slice(
      Math.max(0, idx - (comparar === "anterior" ? 1 : 3)),
      idx,
    );
    const atual = despesasPorCategoria(dre.mes, lancamentos, dre.folha);
    const base = new Map<string, { grupo: Grupo; valor: number }>();
    for (const b of bases)
      for (const [cat, v] of despesasPorCategoria(b.mes, lancamentos, b.folha))
        base.set(cat, {
          grupo: v.grupo,
          valor: (base.get(cat)?.valor ?? 0) + v.valor / bases.length,
        });
    return [...new Set([...atual.keys(), ...base.keys()])]
      .map((cat) => ({
        label: cat,
        grupo: (atual.get(cat) ?? base.get(cat))!.grupo,
        atual: atual.get(cat)?.valor ?? 0,
        base: base.get(cat)?.valor ?? 0,
      }))
      .sort((a, b) => b.atual - a.atual || b.base - a.base);
  }, [dres, idx, comparar, lancamentos]);

  const visiveis = linhas.slice(0, MAX_CATEGORIAS);
  const resto = linhas.slice(MAX_CATEGORIAS);
  const itens = [
    ...visiveis.map((l) => ({
      label: l.label,
      detalhe: GRUPOS[l.grupo].curto,
      atual: l.atual,
      base: l.base,
    })),
    ...(resto.length
      ? [
          {
            label: "Outras categorias",
            detalhe: `${resto.length} categorias`,
            atual: resto.reduce((s, l) => s + l.atual, 0),
            base: resto.reduce((s, l) => s + l.base, 0),
          },
        ]
      : []),
  ];
  const comBase = bases.length > 0;
  const difs = linhas.map((l) => ({ ...l, dif: l.atual - l.base }));
  const subiu = comBase
    ? difs.filter((d) => d.dif > 0.005).sort((a, b) => b.dif - a.dif)[0]
    : undefined;
  const caiu = comBase
    ? difs.filter((d) => d.dif < -0.005).sort((a, b) => a.dif - b.dif)[0]
    : undefined;
  const totalBase = linhas.reduce((s, l) => s + l.base, 0);

  return (
    <section className="panel fin-pad">
      <div className="panel-heading">
        <div>
          <h3 className="fin-h3">Despesas por categoria</h3>
          <p className="section-description">
            {rotuloAtual}: {money(dre.despesas)}
            {comBase
              ? ` contra ${money(totalBase)} (${rotuloBase.toLocaleLowerCase("pt-BR")}).`
              : "."}
            {emAndamento &&
              " O mês está em andamento: contas que ainda vão chegar não entram."}
          </p>
        </div>
        <div className="period-control" role="group" aria-label="Comparar com">
          {(["anterior", "media3"] as const).map((c) => (
            <button
              key={c}
              className={comparar === c ? "selected" : ""}
              aria-pressed={comparar === c}
              onClick={() => setComparar(c)}
            >
              {c === "anterior" ? "Mês anterior" : "Média de 3 meses"}
            </button>
          ))}
        </div>
      </div>
      {itens.length ? (
        <>
          {(subiu || caiu) && (
            <p className="fin-cmp-destaques">
              {subiu && (
                <span>
                  Mais subiu: <strong>{subiu.label}</strong> (+
                  {money(subiu.dif)})
                </span>
              )}
              {caiu && (
                <span>
                  Mais caiu: <strong>{caiu.label}</strong> (−
                  {money(-caiu.dif)})
                </span>
              )}
            </p>
          )}
          <ComparativoCategorias
            itens={itens}
            rotuloAtual={rotuloAtual}
            rotuloBase={rotuloBase}
          />
          <div className="sr-only">
            <table>
              <caption>
                Despesas por categoria: {rotuloAtual} e {rotuloBase}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">{rotuloAtual}</th>
                  <th scope="col">{rotuloBase}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.label}>
                    <th scope="row">{l.label}</th>
                    <td>{money(l.atual)}</td>
                    <td>{money(l.base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="fin-empty">
          Nenhuma despesa lançada em {rotuloAtual}
          {comBase ? ` nem em ${rotuloBase.toLocaleLowerCase("pt-BR")}` : ""}.
          As categorias aparecem quando as contas forem cadastradas em
          Lançamentos.
        </p>
      )}
    </section>
  );
}

function Legenda() {
  return (
    <div className="fin-legend" aria-hidden="true">
      <span>
        <i className="fin-key-receita" />
        Receita
      </span>
      <span>
        <i className="fin-key-despesa" />
        Despesas
      </span>
      <span>
        <i className="fin-key-linha" />
        Resultado
      </span>
    </div>
  );
}

type Soma = { receita: number; despesas: number; resultado: number };
const somar = (ds: Dre[]): Soma =>
  ds.reduce(
    (s, d) => ({
      receita: s.receita + d.receita,
      despesas: s.despesas + d.despesas,
      resultado: s.resultado + d.resultado,
    }),
    { receita: 0, despesas: 0, resultado: 0 },
  );

/** Receita x despesas por ano, e o acumulado do ano contra o mesmo período do ano anterior. */
function AnoAAno({ dres, hoje }: { dres: Dre[]; hoje: string }) {
  const anoAtual = hoje.slice(0, 4);
  const mesAtual = hoje.slice(0, 7);
  const anos = [...new Set(dres.map((d) => d.mes.slice(0, 4)))].sort();
  // Comparação justa: só meses fechados, de janeiro ao último mês completo.
  const ultimoFechado = addMeses(mesAtual, -1);
  const fechadosAno = dres.filter(
    (d) => d.mes.startsWith(anoAtual) && d.mes <= ultimoFechado,
  );
  const mesmoPeriodo = dres.filter((d) => {
    const [y, m] = d.mes.split("-");
    return (
      Number(y) === Number(anoAtual) - 1 && `${anoAtual}-${m}` <= ultimoFechado
    );
  });
  const atual = somar(fechadosAno);
  const antes = somar(mesmoPeriodo);
  const temComparacao = fechadosAno.length > 0 && mesmoPeriodo.length > 0;
  const periodo = fechadosAno.length
    ? `jan a ${mesLabel(ultimoFechado).split("/")[0]}`
    : "";
  const delta = (a: number, b: number) =>
    b ? signedPercent(((a - b) / Math.abs(b)) * 100) : "–";

  return (
    <>
      <Chapter
        n={2}
        title="Ano a ano"
        caption={`Total de cada ano. ${anoAtual} ainda está em andamento; ao lado, o acumulado de ${periodo || "este ano"} contra o mesmo período de ${Number(anoAtual) - 1}.`}
      />
      <div className="fin-grid-2 fin-grid-wide">
        <section className="panel chart-panel">
          <Legenda />
          <GraficoMensal
            destaque={anos.length - 1}
            parcial={anos.indexOf(anoAtual)}
            pontos={anos.map((ano) => {
              const s = somar(dres.filter((d) => d.mes.startsWith(ano)));
              const n = dres.filter((d) => d.mes.startsWith(ano)).length;
              return {
                label:
                  ano === anoAtual
                    ? `${ano} (até ${mesLabel(mesAtual).split("/")[0]})`
                    : ano,
                titulo: ano,
                ...s,
                despesa: s.despesas,
                nota:
                  ano === anoAtual
                    ? `${n} ${n === 1 ? "mês" : "meses"}, contando o mês em andamento.`
                    : undefined,
              };
            })}
          />
        </section>
        <section className="panel fin-pad">
          <h3 className="fin-h3">
            {anoAtual} até agora{periodo ? ` (${periodo})` : ""}
          </h3>
          <p className="section-description">
            Contra o mesmo período de {Number(anoAtual) - 1}, só com meses
            fechados.
          </p>
          {temComparacao ? (
            <table className="fin-dre fin-yoy">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Item</span>
                  </th>
                  <th scope="col" className="rs-num">
                    {anoAtual}
                  </th>
                  <th scope="col" className="rs-num">
                    {Number(anoAtual) - 1}
                  </th>
                  <th scope="col" className="rs-num">
                    Variação
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Receita", atual.receita, antes.receita],
                    ["Despesas", atual.despesas, antes.despesas],
                    ["Resultado", atual.resultado, antes.resultado],
                  ] as const
                ).map(([label, a, b]) => (
                  <tr
                    key={label}
                    className={label === "Resultado" ? "total" : undefined}
                  >
                    <th scope="row">{label}</th>
                    <td className="rs-num">{moneyShort(a)}</td>
                    <td className="rs-num">{moneyShort(b)}</td>
                    <td className="rs-num">{delta(a, b)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Margem</th>
                  <td className="rs-num">
                    {atual.receita
                      ? percent((atual.resultado / atual.receita) * 100)
                      : "–"}
                  </td>
                  <td className="rs-num">
                    {antes.receita
                      ? percent((antes.resultado / antes.receita) * 100)
                      : "–"}
                  </td>
                  <td className="rs-num" />
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="fin-empty">
              Ainda não há meses fechados de {anoAtual} para comparar.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
