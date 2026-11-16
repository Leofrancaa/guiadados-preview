"use client";

import { useState } from "react";
import {
  CalendarDays,
  Clock3,
  CreditCard,
  MessageCircle,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ApiErrorBanner } from "./sales-filters";
import { Chapter } from "./products-view";
import { Select } from "./ui/select";
import { SpecialDatesView } from "./special-dates-view";
import {
  dateBr,
  integer,
  money,
  moneyShort,
  percent,
  share,
  signedPercent,
  titleCase,
} from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type {
  DestaquesDia,
  DiaResumo,
  Retrospectiva,
} from "@/lib/retrospectiva";
import { FIRST_YEAR, formatQuantity, todayInStore } from "@/lib/vendas";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const longDate = (date: string) =>
  capitalize(dateBr(date, { weekday: "long", day: "numeric", month: "long" }));
const fullDate = (date: string) =>
  dateBr(date, { day: "2-digit", month: "2-digit", year: "numeric" });
const hourRange = (hora: number) => `${hora}h–${hora + 1}h`;

type Modo = "recordes" | "datas";

function lerUrl() {
  if (typeof window === "undefined") return { modo: "recordes" as Modo };
  const params = new URLSearchParams(window.location.search);
  return {
    modo: (params.get("rm") === "datas" ? "datas" : "recordes") as Modo,
    ocasiao: params.get("oc"),
  };
}

function gravarUrl(modo: Modo, ocasiao?: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (modo === "datas") params.set("rm", "datas");
  else params.delete("rm");
  if (modo === "datas" && ocasiao) params.set("oc", ocasiao);
  else params.delete("oc");
  window.history.replaceState(window.history.state, "", `?${params}`);
}

/** Recordes do ano/mês ou preparação para as próximas datas especiais. */
export function RetrospectiveView({
  onAsk,
}: {
  onAsk?: (question: string) => void;
}) {
  const [inicial] = useState(lerUrl);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  return (
    <>
      <div className="rs-tl-toggle sd-mode" role="group" aria-label="O que ver">
        {(
          [
            ["recordes", "Recordes"],
            ["datas", "Datas especiais"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={modo === key}
            className={modo === key ? "selected" : ""}
            onClick={() => {
              setModo(key);
              gravarUrl(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {modo === "datas" ? (
        <SpecialDatesView
          inicial={inicial.ocasiao}
          onChange={(id) => gravarUrl("datas", id)}
          onAsk={onAsk}
        />
      ) : (
        <RecordsView onAsk={onAsk} />
      )}
    </>
  );
}

function RecordsView({ onAsk }: { onAsk?: (question: string) => void }) {
  const today = todayInStore();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const [escolhido, setEscolhido] = useState<{
    key: string;
    dia: string;
  } | null>(null);

  const query = `ano=${ano}${mes ? `&mes=${mes}` : ""}`;
  const { data, error, loading } = useApi<Retrospectiva>(
    `/api/retrospectiva?${query}`,
    nonce,
  );
  const dia =
    escolhido?.key === query ? escolhido.dia : (data?.campeao?.data ?? null);
  const detalhe = useApi<DestaquesDia>(
    dia ? `/api/retrospectiva?${query}&dia=${dia}` : null,
    nonce,
  );
  const escolher = (date: string) => {
    setEscolhido({ key: query, dia: date });
    document
      .getElementById("retro-dia")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const anos = Array.from(
    { length: currentYear - FIRST_YEAR + 1 },
    (_, i) => currentYear - i,
  );
  const ultimoMes = ano === currentYear ? currentMonth : 12;
  const nomePeriodo = mes ? `${MESES[mes - 1]} de ${ano}` : String(ano);

  return (
    <div className="rs" aria-busy={loading}>
      <div
        className="rs-toolbar"
        role="group"
        aria-label="Período da retrospectiva"
      >
        <div className="period-field">
          <span aria-hidden="true">Ano</span>
          <Select
            ariaLabel="Ano"
            size="compact"
            value={String(ano)}
            options={anos.map((y) => ({ value: String(y), label: String(y) }))}
            onValueChange={(value) => {
              const y = Number(value);
              setAno(y);
              if (mes && y === currentYear && mes > currentMonth) setMes(null);
            }}
          />
        </div>
        <div className="period-field">
          <span aria-hidden="true">Mês</span>
          <Select
            ariaLabel="Mês"
            size="compact"
            value={mes ? String(mes) : "ano"}
            options={[
              { value: "ano", label: "Ano inteiro" },
              ...MESES.slice(0, ultimoMes).map((nome, i) => ({
                value: String(i + 1),
                label: nome,
              })),
            ]}
            onValueChange={(value) =>
              setMes(value === "ano" ? null : Number(value))
            }
          />
        </div>
        {data && (
          <span className="date-range">
            {dateBr(data.periodo.ini, { day: "2-digit", month: "short" })} —{" "}
            {dateBr(data.periodo.fim, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {data.periodo.excluiHoje && " · hoje fica de fora (em andamento)"}
          </span>
        )}
      </div>

      {error && (
        <ApiErrorBanner error={error} onRetry={() => setNonce((n) => n + 1)} />
      )}
      {!data && loading && !error && (
        <p className="rs-loading" role="status">
          Montando a retrospectiva…
        </p>
      )}

      {data && !data.campeao && (
        <section className="panel rs-empty">
          <h2>Sem vendas em {nomePeriodo}</h2>
          <p>Escolha outro ano ou mês.</p>
        </section>
      )}

      {data && data.campeao && (
        <div className={`rs-content ${loading ? "rs-stale" : ""}`}>
          <DiaDestaque
            id="retro-dia"
            campeao={data.campeao.data}
            detalhe={dia ? detalhe : null}
            dia={dia}
            nomePeriodo={nomePeriodo}
            onVoltar={() => escolher(data.campeao!.data)}
            onAsk={onAsk}
          />

          <Chapter
            n={2}
            title={`Recordes de ${nomePeriodo}`}
            caption={`${money(data.totais.faturamento)} em ${integer(data.totais.pedidos)} pedidos, em ${integer(data.totais.diasComVenda)} dias com venda (média de ${moneyShort(data.totais.mediaPorDia)} por dia).`}
          />
          <Recordes data={data} onPick={escolher} />

          <Chapter
            n={3}
            title="Os 5 melhores dias"
            caption="Toque em um dia para ver os destaques dele."
          />
          <TopDias
            dias={data.top5}
            selecionado={dia}
            media={data.totais.mediaPorDia}
            onPick={escolher}
          />
        </div>
      )}
    </div>
  );
}

function DiaDestaque({
  id,
  campeao,
  dia,
  detalhe,
  nomePeriodo,
  onVoltar,
  onAsk,
}: {
  id: string;
  campeao: string;
  dia: string | null;
  detalhe: ReturnType<typeof useApi<DestaquesDia>> | null;
  nomePeriodo: string;
  onVoltar: () => void;
  onAsk?: (question: string) => void;
}) {
  const ehCampeao = dia === campeao;
  const d =
    detalhe?.data && detalhe.data.dia.data === dia ? detalhe.data : null;
  return (
    <section id={id} className="retro-dia" aria-busy={detalhe?.loading}>
      <Chapter
        n={1}
        title={
          ehCampeao ? `O dia campeão de ${nomePeriodo}` : "Destaques do dia"
        }
        caption={
          d
            ? `${longDate(d.dia.data)}: ${money(d.dia.faturamento)} em ${integer(d.dia.pedidos)} pedidos${d.vsMediaPct !== null ? `, ${signedPercent(d.vsMediaPct, 0)} em relação a um dia médio do período` : ""}.`
            : "Carregando os destaques do dia…"
        }
      />
      {detalhe?.error && !d && (
        <p className="rs-note">
          Não foi possível carregar este dia: {detalhe.error.text}
        </p>
      )}
      {d && (
        <>
          <section className="panel rs-ai-hero retro-hero">
            <span className="rs-ai-label">
              <Trophy size={16} />
              {ehCampeao ? "Dia campeão" : "Dia escolhido"}
            </span>
            <h2>{longDate(d.dia.data)}</h2>
            <p className="retro-hero-value">{money(d.dia.faturamento)}</p>
            <div className="retro-tags">
              {d.dia.evento && (
                <span className="tag retro-evento">{d.dia.evento}</span>
              )}
              <span className="tag">{integer(d.dia.pedidos)} pedidos</span>
              <span className="tag">Ticket médio {money(d.dia.ticket)}</span>
              {d.vsDiaSemanaPct !== null && (
                <span className="tag">
                  {signedPercent(d.vsDiaSemanaPct, 0)} vs. média de{" "}
                  {d.dia.diaSemana} ({moneyShort(d.mediaDiaSemana)})
                </span>
              )}
            </div>
            <div className="retro-hero-actions">
              {onAsk && (
                <button
                  type="button"
                  className="button primary"
                  onClick={() =>
                    onAsk(
                      `O que explica o dia ${fullDate(d.dia.data)} (${d.dia.diaSemana}${d.dia.evento ? `, ${d.dia.evento}` : ""}) ter vendido ${money(d.dia.faturamento)}? Mostre quanto veio de mais pedidos e quanto de ticket maior, e quais categorias, produtos e horários trouxeram o extra em relação a uma ${d.dia.diaSemana} normal.`,
                    )
                  }
                >
                  <MessageCircle size={15} />
                  Perguntar à GuIA por que esse dia vendeu tanto
                </button>
              )}
              {!ehCampeao && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={onVoltar}
                >
                  <Trophy size={15} />
                  Voltar ao dia campeão
                </button>
              )}
            </div>
          </section>

          <section className="metrics rs-metrics" aria-label="Destaques do dia">
            <Card
              icon={Clock3}
              title="Hora que mais faturou"
              value={d.picoReceita ? hourRange(d.picoReceita.hora) : "—"}
              foot={
                d.picoReceita
                  ? `${money(d.picoReceita.faturamento)} · ${percent(share(d.picoReceita.faturamento, d.dia.faturamento), 0)} do dia`
                  : ""
              }
            />
            <Card
              icon={Receipt}
              title="Hora com mais pedidos"
              value={d.picoPedidos ? hourRange(d.picoPedidos.hora) : "—"}
              foot={
                d.picoPedidos ? `${integer(d.picoPedidos.pedidos)} pedidos` : ""
              }
            />
            <Card
              icon={CreditCard}
              title="Pagamento mais usado"
              value={d.pagamento ? titleCase(d.pagamento.forma) : "—"}
              foot={
                d.pagamento
                  ? `${percent(d.pagamento.sharePct, 0)} do faturamento`
                  : ""
              }
            />
            <Card
              icon={Wallet}
              title="Contra um dia médio"
              value={
                d.vsMediaPct !== null ? signedPercent(d.vsMediaPct, 0) : "—"
              }
              foot={`Média do período: ${money(d.mediaPorDia)}`}
            />
          </section>

          <div className="analytics-grid rs-grid retro-grid">
            <section className="panel analytics-panel">
              <div className="inline-title">
                <Sparkles size={17} />
                <h2>Mais vendidos do dia</h2>
              </div>
              <ol className="ranking-list rs-ranking">
                {d.topProdutos.map((p, index) => (
                  <li key={p.codigo}>
                    <span
                      className={`rank-number ${index === 0 ? "first" : ""}`}
                    >
                      {index + 1}
                    </span>
                    <div className="ranking-content">
                      <div className="ranking-label">
                        <span>
                          {titleCase(p.produto)}
                          <small className="rs-rank-detail">
                            {formatQuantity(p.qtd, p.unidade)}
                          </small>
                        </span>
                        <strong>{money(p.faturamento)}</strong>
                      </div>
                      <div className="ranking-track" aria-hidden="true">
                        <span
                          className={index === 0 ? "leading" : ""}
                          style={{
                            width: `${Math.max(1, share(p.faturamento, d.topProdutos[0].faturamento))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <section className="panel analytics-panel">
              <div className="inline-title">
                <TrendingUp size={17} />
                <h2>Fora do normal</h2>
              </div>
              <p className="section-description">
                Produtos que venderam bem acima da própria média diária no
                período.
              </p>
              {d.foraDoNormal.length ? (
                <ul className="retro-outliers">
                  {d.foraDoNormal.map((p) => (
                    <li key={p.codigo}>
                      <strong className="retro-times">
                        {p.vezes.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                        ×
                      </strong>
                      <div>
                        <span>{titleCase(p.produto)}</span>
                        <small>
                          {formatQuantity(p.qtd, p.unidade)} no dia · média de{" "}
                          {formatQuantity(p.mediaQtd, p.unidade)} por dia
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rs-note">
                  Nenhum produto saiu muito do normal: o dia foi forte no geral,
                  não por um item específico.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function Card({
  icon: Icon,
  title,
  value,
  foot,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  foot: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="metric-heading">
        <span>{title}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <span className="metric-footer">{foot}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="metric rs-metric-button" onClick={onClick}>
      {body}
    </button>
  ) : (
    <article className="metric">{body}</article>
  );
}

function Recordes({
  data,
  onPick,
}: {
  data: Retrospectiva;
  onPick: (date: string) => void;
}) {
  const { maisPedidos, maiorTicket, maisFraco, melhorSemana, melhorMes } =
    data.recordes;
  const dayCard = (
    icon: LucideIcon,
    title: string,
    item: DiaResumo | null,
    value: (d: DiaResumo) => string,
    foot: (d: DiaResumo) => string,
  ) =>
    item && (
      <Card
        key={title}
        icon={icon}
        title={title}
        value={value(item)}
        foot={`${dateBr(item.data, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${foot(item)}`}
        onClick={() => onPick(item.data)}
      />
    );
  return (
    <section className="retro-records" aria-label="Recordes do período">
      {dayCard(
        Receipt,
        "Mais pedidos em um dia",
        maisPedidos,
        (d) => integer(d.pedidos),
        (d) => money(d.faturamento),
      )}
      {dayCard(
        Wallet,
        "Maior ticket médio",
        maiorTicket,
        (d) => money(d.ticket),
        (d) => `${integer(d.pedidos)} pedidos`,
      )}
      {melhorSemana && (
        <Card
          icon={CalendarDays}
          title="Melhor semana"
          value={money(melhorSemana.faturamento)}
          foot={`${dateBr(melhorSemana.ini, { day: "2-digit", month: "2-digit" })} a ${dateBr(melhorSemana.fim, { day: "2-digit", month: "2-digit" })} · ${integer(melhorSemana.pedidos)} pedidos`}
        />
      )}
      {melhorMes && (
        <Card
          icon={Trophy}
          title="Melhor mês"
          value={MESES[Number(melhorMes.mes.slice(5)) - 1]}
          foot={`${money(melhorMes.faturamento)}${melhorMes.parcial ? " · mês em andamento" : ""}`}
        />
      )}
      {dayCard(
        TrendingDown,
        "Dia mais fraco",
        maisFraco,
        (d) => money(d.faturamento),
        (d) => `${integer(d.pedidos)} pedidos`,
      )}
    </section>
  );
}

function TopDias({
  dias,
  selecionado,
  media,
  onPick,
}: {
  dias: DiaResumo[];
  selecionado: string | null;
  media: number;
  onPick: (date: string) => void;
}) {
  const max = dias[0]?.faturamento ?? 1;
  return (
    <section className="panel analytics-panel">
      <ol className="ranking-list rs-ranking retro-top">
        {dias.map((d, index) => (
          <li key={d.data}>
            <button
              type="button"
              className={`retro-top-row ${selecionado === d.data ? "is-active" : ""}`}
              aria-pressed={selecionado === d.data}
              onClick={() => onPick(d.data)}
            >
              <span className={`rank-number ${index === 0 ? "first" : ""}`}>
                {index + 1}
              </span>
              <div className="ranking-content">
                <div className="ranking-label">
                  <span>
                    {longDate(d.data)}
                    {d.evento && (
                      <span className="tag retro-evento">{d.evento}</span>
                    )}
                    <small className="rs-rank-detail">
                      {integer(d.pedidos)} pedidos · ticket {money(d.ticket)}
                      {media > 0 &&
                        ` · ${signedPercent(((d.faturamento - media) / media) * 100, 0)} vs. dia médio`}
                    </small>
                  </span>
                  <strong>{money(d.faturamento)}</strong>
                </div>
                <div className="ranking-track" aria-hidden="true">
                  <span
                    className={index === 0 ? "leading" : ""}
                    style={{
                      width: `${Math.max(1, share(d.faturamento, max))}%`,
                    }}
                  />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
