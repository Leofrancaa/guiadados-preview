"use client";

import { useState } from "react";
import {
  CalendarClock,
  Clock3,
  MessageCircle,
  PackageCheck,
} from "lucide-react";
import { ApiErrorBanner } from "./sales-filters";
import { Chapter } from "./products-view";
import {
  dateBr,
  integer,
  money,
  moneyShort,
  signedPercent,
  titleCase,
} from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type {
  DiaOcasiao,
  Preparacao,
  ProximaOcasiao,
} from "@/lib/datas-especiais";
import { formatQuantity, weekdayLong } from "@/lib/vendas";

type Resposta = { proximas: ProximaOcasiao[]; preparacao: Preparacao };

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const longDate = (date: string) =>
  capitalize(dateBr(date, { weekday: "long", day: "numeric", month: "long" }));
const ddmm = (date: string) =>
  dateBr(date, { day: "2-digit", month: "2-digit" });
const ddmmaa = (date: string) =>
  dateBr(date, { day: "2-digit", month: "2-digit", year: "numeric" });
const weekdayOf = (date: string) =>
  weekdayLong[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
const quando = (p: ProximaOcasiao) =>
  p.emAndamento
    ? "acontecendo agora"
    : p.diasAte === 0
      ? "começa hoje"
      : p.diasAte === 1
        ? "começa amanhã"
        : `em ${p.diasAte} dias`;

export function SpecialDatesView({
  inicial,
  onChange,
  onAsk,
}: {
  inicial?: string | null;
  onChange?: (id: string) => void;
  onAsk?: (question: string) => void;
}) {
  const [ocasiao, setOcasiao] = useState<string | null>(inicial ?? null);
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useApi<Resposta>(
    `/api/datas-especiais${ocasiao ? `?ocasiao=${ocasiao}` : ""}`,
    nonce,
  );
  const p = data?.preparacao;
  const escolhida = p?.proxima.id ?? ocasiao;

  return (
    <div aria-busy={loading}>
      {data && (
        <div
          className="sd-chips"
          role="group"
          aria-label="Próximas datas especiais"
        >
          {data.proximas.map((o) => (
            <button
              key={`${o.id}-${o.ano}`}
              type="button"
              aria-pressed={escolhida === o.id}
              className={escolhida === o.id ? "selected" : ""}
              onClick={() => {
                setOcasiao(o.id);
                onChange?.(o.id);
              }}
            >
              <strong>{o.nome}</strong>
              <small>
                {ddmm(o.ini)} · {quando(o)}
              </small>
            </button>
          ))}
        </div>
      )}

      {error && (
        <ApiErrorBanner error={error} onRetry={() => setNonce((n) => n + 1)} />
      )}
      {!data && loading && !error && (
        <p className="rs-loading" role="status">
          Buscando como foi no ano passado…
        </p>
      )}

      {p && p.semDados && (
        <section className="panel rs-empty">
          <h2>
            Sem vendas no {p.ocasiao.nome} de {p.anterior.ano}
          </h2>
          <p>
            Os dados da loja ainda não cobrem essa data no ano anterior. Escolha
            outra data especial.
          </p>
        </section>
      )}

      {p && !p.semDados && (
        <div className={`rs-content ${loading ? "rs-stale" : ""}`}>
          <Resumo p={p} onAsk={onAsk} />
          <Produtos p={p} />
          <Horas p={p} />
          <p className="rs-note">
            &quot;Dia normal&quot; = média do mesmo dia da semana nas 8 semanas
            antes de {ddmmaa(p.anterior.ini)}. Por produto, é uma estimativa
            pelo mix de vendas dessas semanas. Os números do ano passado são
            referência: confira o estoque, as encomendas e o clima antes de
            decidir a produção.
            {p.cobertura !== "complete" &&
              " Parte desse período está guardada só em resumo, então a lista de produtos pode estar incompleta."}
          </p>
        </div>
      )}
    </div>
  );
}

function Resumo({
  p,
  onAsk,
}: {
  p: Preparacao;
  onAsk?: (question: string) => void;
}) {
  const t = p.totais;
  const pico = p.pico;
  const max = Math.max(
    ...p.dias.map((d) => Math.max(d.faturamento, d.normal ?? 0)),
    1,
  );
  return (
    <>
      <Chapter
        n={1}
        title={`${p.ocasiao.nome} de ${p.anterior.ano}: como foi`}
        caption={`De ${ddmm(p.anterior.ini)} a ${ddmmaa(p.anterior.fim)}, a loja faturou ${money(t.faturamento)} em ${integer(t.pedidos)} pedidos${t.diffPct !== null ? `, ${signedPercent(t.diffPct, 0)} em relação a dias normais` : ""}.`}
      />
      {pico && (
        <section className="panel rs-ai-hero retro-hero">
          <span className="rs-ai-label">
            <CalendarClock size={16} />
            Dia mais forte · {p.proxima.nome} {p.proxima.ano}{" "}
            {p.proxima.emAndamento
              ? "está acontecendo"
              : `começa em ${p.proxima.diasAte} dias`}
          </span>
          <h2>
            {longDate(pico.data)} de {p.anterior.ano}
          </h2>
          <p className="retro-hero-value">{money(pico.faturamento)}</p>
          <div className="retro-tags">
            {pico.evento && (
              <span className="tag retro-evento">{pico.evento}</span>
            )}
            <span className="tag">{integer(pico.pedidos)} pedidos</span>
            <span className="tag">Ticket médio {money(pico.ticket)}</span>
            {pico.diffPct !== null && pico.normal !== null && (
              <span className="tag">
                {signedPercent(pico.diffPct, 0)} vs. {pico.diaSemana} normal (
                {moneyShort(pico.normal)})
              </span>
            )}
          </div>
          {p.picoEsteAno && (
            <p className="sd-este-ano">
              Em {p.proxima.ano}, esse dia cai{" "}
              {weekdayOf(p.picoEsteAno) === "sábado" ||
              weekdayOf(p.picoEsteAno) === "domingo"
                ? "num"
                : "numa"}{" "}
              <strong>{weekdayOf(p.picoEsteAno)}</strong> (
              {ddmmaa(p.picoEsteAno)})
              {weekdayOf(p.picoEsteAno) !== pico.diaSemana &&
                ` — no ano passado foi ${pico.diaSemana === "sábado" || pico.diaSemana === "domingo" ? "um" : "uma"} ${pico.diaSemana}`}
              .
            </p>
          )}
          {onAsk && (
            <div className="retro-hero-actions">
              <button
                type="button"
                className="button primary"
                onClick={() =>
                  onAsk(
                    `Consulte as vendas de ${ddmmaa(p.anterior.ini)} a ${ddmmaa(p.anterior.fim)} (${p.ocasiao.nome} de ${p.anterior.ano}). Quais dias, produtos e horários venderam acima do normal, comparando com o mesmo dia da semana nas semanas anteriores? Use isso para eu me preparar para o ${p.ocasiao.nome} de ${p.proxima.ano}: o que produzir a mais e em quais horários reforçar o atendimento.`,
                  )
                }
              >
                <MessageCircle size={15} />
                Perguntar à GuIA como se preparar
              </button>
            </div>
          )}
        </section>
      )}
      <section className="panel analytics-panel">
        <div className="inline-title">
          <CalendarClock size={17} />
          <h2>Dia a dia</h2>
        </div>
        <p className="section-description">
          Faturamento de cada dia contra a média do mesmo dia da semana (risco
          cinza).
        </p>
        <ul className="sd-days">
          {p.dias.map((d) => (
            <DiaLinha
              key={d.data}
              d={d}
              max={max}
              pico={d.data === pico?.data}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function DiaLinha({
  d,
  max,
  pico,
}: {
  d: DiaOcasiao;
  max: number;
  pico: boolean;
}) {
  return (
    <li className={pico ? "is-pico" : ""}>
      <span className="sd-day-label">
        <strong>{ddmm(d.data)}</strong>
        <small>{d.diaSemana}</small>
      </span>
      <span className="sd-day-bar" aria-hidden="true">
        <i style={{ width: `${(d.faturamento / max) * 100}%` }} />
        {d.normal !== null && (
          <b style={{ left: `${(d.normal / max) * 100}%` }} />
        )}
      </span>
      <span className="sd-day-value">
        <strong>{moneyShort(d.faturamento)}</strong>
        {d.diffPct !== null && (
          <small className={d.diffPct >= 0 ? "is-up" : "is-down"}>
            {signedPercent(d.diffPct, 0)}
          </small>
        )}
      </span>
      {d.evento && <span className="sd-day-event">{d.evento}</span>}
    </li>
  );
}

function Produtos({ p }: { p: Preparacao }) {
  if (!p.produtos.length) return null;
  return (
    <>
      <Chapter
        n={2}
        title="O que vendeu acima do normal"
        caption={`Os produtos que mais somaram em relação a dias normais. Referência de produção para o ${p.ocasiao.nome} de ${p.proxima.ano}.`}
      />
      <section className="panel analytics-panel">
        <div className="inline-title">
          <PackageCheck size={17} />
          <h2>Produtos para reforçar</h2>
        </div>
        <div className="sd-table-wrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">
                  Total {ddmm(p.anterior.ini)}–{ddmm(p.anterior.fim)}
                </th>
                {p.pico && <th scope="col">No dia {ddmm(p.pico.data)}</th>}
                <th scope="col">Dia normal</th>
                <th scope="col">Faturou a mais</th>
              </tr>
            </thead>
            <tbody>
              {p.produtos.map((x) => (
                <tr key={x.codigo}>
                  <th scope="row">
                    {titleCase(x.produto)}
                    {x.sazonal ? (
                      <span className="tag retro-evento">Só nessa época</span>
                    ) : (
                      x.multiplo !== null &&
                      x.multiplo >= 1.5 && (
                        <small>
                          {x.multiplo.toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })}
                          × um dia normal
                        </small>
                      )
                    )}
                  </th>
                  <td data-label="Total">{formatQuantity(x.qtd, x.unidade)}</td>
                  {p.pico && (
                    <td data-label={`Dia ${ddmm(p.pico.data)}`}>
                      {formatQuantity(x.qtdPico, x.unidade)}
                    </td>
                  )}
                  <td data-label="Dia normal">
                    {x.sazonal || x.qtdNormalDia <= 0
                      ? "—"
                      : formatQuantity(x.qtdNormalDia, x.unidade)}
                  </td>
                  <td data-label="A mais">{money(x.extra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Horas({ p }: { p: Preparacao }) {
  if (!p.pico || !p.horas.length) return null;
  const max = Math.max(
    ...p.horas.map((h) => Math.max(h.faturamento, h.normal)),
    1,
  );
  const top = [...p.horas].sort((a, b) => b.faturamento - a.faturamento)[0];
  return (
    <>
      <Chapter
        n={3}
        title="Quando o movimento aperta"
        caption={`Faturamento por hora em ${ddmmaa(p.pico.data)} contra ${p.pico.diaSemana === "sábado" || p.pico.diaSemana === "domingo" ? "um" : "uma"} ${p.pico.diaSemana} normal. Pico: ${top.hora}h–${top.hora + 1}h, ${money(top.faturamento)} em ${integer(top.pedidos)} pedidos.`}
      />
      <section className="panel analytics-panel">
        <div className="inline-title">
          <Clock3 size={17} />
          <h2>Hora a hora no dia mais forte</h2>
        </div>
        <ul className="sd-hours" aria-label="Faturamento por hora">
          {p.horas.map((h) => (
            <li key={h.hora}>
              <span className="sd-hour-label">{h.hora}h</span>
              <span className="sd-hour-bars" aria-hidden="true">
                <i
                  className="is-day"
                  style={{ width: `${(h.faturamento / max) * 100}%` }}
                />
                <i
                  className="is-normal"
                  style={{ width: `${(h.normal / max) * 100}%` }}
                />
              </span>
              <span className="sd-hour-value">
                {moneyShort(h.faturamento)}
                <small>normal {moneyShort(h.normal)}</small>
              </span>
            </li>
          ))}
        </ul>
        <ul className="sd-legend">
          <li>
            <i className="is-day" />
            {ddmm(p.pico.data)}
          </li>
          <li>
            <i className="is-normal" />
            {capitalize(p.pico.diaSemana)} normal
          </li>
        </ul>
      </section>
    </>
  );
}
