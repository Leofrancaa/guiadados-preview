"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Wallet,
  Search,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { addDias, diffDias, periodoLabel } from "@/lib/financeiro/calculos";
import type { Lancamento } from "@/lib/financeiro/tipos";
import type { Financeiro } from "@/lib/financeiro/use-financeiro";
import { dateBr, money } from "@/lib/format";

const HORIZONTE = 30;
const ATRASADAS = "atrasadas";

/** "proximos" = em aberto até 30 dias (com as atrasadas); ou um mês (AAAA-MM) ou ano (AAAA) inteiro. */
export type PeriodoContas = "proximos" | string;

type Grupo = {
  id: string;
  data: string | null;
  itens: Lancamento[];
  total: number;
};

const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);

/** "Ter, 10 nov" */
function diaCurto(data: string) {
  const semana = dateBr(data, { weekday: "short" }).replace(".", "");
  const dia = dateBr(data, { day: "2-digit", month: "short" })
    .replace(".", "")
    .replace(" de ", " ");
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${dia}`;
}

function quando(data: string, hoje: string) {
  const d = diffDias(data, hoje);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "ontem";
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}

export function ContasView({
  fin,
  periodo,
  onMessage,
}: {
  fin: Financeiro;
  periodo: PeriodoContas;
  onMessage: (t: string) => void;
}) {
  const hoje = fin.hoje;
  const doMes = periodo !== "proximos";
  const limite = addDias(hoje, HORIZONTE);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string> | null>(null);
  const [pagarDia, setPagarDia] = useState<string | null>(null);
  // Último pagamento feito aqui, para desfazer um clique sem querer.
  const [ultimo, setUltimo] = useState<{ ids: string[]; texto: string } | null>(
    null,
  );

  function pagar(itens: Lancamento[], texto: string) {
    fin.pagarVarios(
      itens.map((l) => l.id),
      hoje,
    );
    setUltimo({ ids: itens.map((l) => l.id), texto });
  }

  // Próximos 30 dias: só as em aberto. Um mês: todas que vencem nele, pagas ou não.
  const contas = useMemo(
    () =>
      fin
        .dados!.lancamentos.filter(
          (l) =>
            l.tipo === "despesa" &&
            (doMes
              ? l.vencimento.startsWith(periodo)
              : !l.pago && l.vencimento <= limite),
        )
        .sort(
          (a, b) =>
            a.vencimento.localeCompare(b.vencimento) ||
            Number(a.pago) - Number(b.pago) ||
            b.valor - a.valor,
        ),
    [fin.dados, limite, doMes, periodo],
  );
  const abertas = contas.filter((l) => !l.pago);

  const resumo: {
    id: string;
    titulo: string;
    icon: LucideIcon;
    tom: string;
    itens: Lancamento[];
  }[] = doMes
    ? [
        {
          id: "total",
          titulo: `Total de ${periodoLabel(periodo)}`,
          icon: CalendarRange,
          tom: "neutral",
          itens: contas,
        },
        {
          id: "pago",
          titulo: "Pago",
          icon: CalendarCheck,
          tom: "success",
          itens: contas.filter((l) => l.pago),
        },
        {
          id: "aberto",
          titulo: "Em aberto",
          icon: Wallet,
          tom: abertas.some((l) => l.vencimento < hoje) ? "danger" : "neutral",
          itens: abertas,
        },
      ]
    : [
        {
          id: "atrasadas",
          titulo: "Atrasadas",
          icon: AlertTriangle,
          tom: "danger",
          itens: abertas.filter((l) => l.vencimento < hoje),
        },
        {
          id: "semana",
          titulo: "Hoje e próximos 7 dias",
          icon: CalendarDays,
          tom: "warning",
          itens: abertas.filter(
            (l) => l.vencimento >= hoje && l.vencimento <= addDias(hoje, 7),
          ),
        },
        {
          id: "mes",
          titulo: "De 8 a 30 dias",
          icon: CalendarRange,
          tom: "neutral",
          itens: abertas.filter((l) => l.vencimento > addDias(hoje, 7)),
        },
      ];

  const q = busca.trim().toLocaleLowerCase("pt-BR");
  const grupos = useMemo(() => {
    const filtradas = q
      ? contas.filter((l) =>
          `${l.descricao} ${l.fornecedor} ${l.categoria} ${l.forma}`
            .toLocaleLowerCase("pt-BR")
            .includes(q),
        )
      : contas;
    const out: Grupo[] = [];
    const atrasadas = doMes ? [] : filtradas.filter((l) => l.vencimento < hoje);
    if (atrasadas.length)
      out.push({
        id: ATRASADAS,
        data: null,
        itens: atrasadas,
        total: soma(atrasadas),
      });
    for (const l of filtradas) {
      if (!doMes && l.vencimento < hoje) continue;
      const ultimo = out[out.length - 1];
      if (ultimo?.data === l.vencimento) {
        ultimo.itens.push(l);
        ultimo.total += l.valor;
      } else
        out.push({
          id: l.vencimento,
          data: l.vencimento,
          itens: [l],
          total: l.valor,
        });
    }
    return out;
  }, [contas, q, hoje, doMes]);

  const maior = Math.max(1, ...grupos.map((g) => g.total));
  // Abre as atrasadas e o primeiro dia com conta a pagar; o resto fica recolhido.
  const primeiroAPagar = grupos.find(
    (g) => g.id !== ATRASADAS && g.itens.some((l) => !l.pago),
  )?.id;
  const padrao = new Set(
    grupos
      .filter((g) => g.id === ATRASADAS || g.id === primeiroAPagar)
      .map((g) => g.id),
  );
  const abertosAgora = q
    ? new Set(grupos.map((g) => g.id))
    : (abertos ?? padrao);
  const tudoAberto =
    grupos.length > 0 && grupos.every((g) => abertosAgora.has(g.id));

  const alternar = (id: string) => {
    const novo = new Set(abertosAgora);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setAbertos(novo);
  };

  function pagarTodas(itens: Lancamento[]) {
    setPagarDia(null);
    pagar(
      itens,
      `${itens.length} ${itens.length === 1 ? "conta marcada" : "contas marcadas"} como paga${itens.length === 1 ? "" : "s"} (${money(soma(itens))}).`,
    );
  }

  return (
    <>
      <section
        className="metrics rs-metrics fin-metrics fin-metrics-3"
        aria-label="Resumo das contas a pagar"
      >
        {resumo.map((c) => (
          <article key={c.id} className="metric">
            <div className="metric-heading">
              <span>{c.titulo}</span>
              <c.icon size={19} aria-hidden="true" />
            </div>
            <strong
              className={
                c.tom === "danger" && c.itens.length
                  ? "fin-neg"
                  : c.tom === "success" && c.itens.length
                    ? "fin-pos"
                    : undefined
              }
            >
              {money(soma(c.itens))}
            </strong>
            <span className="metric-footer">
              {c.itens.length} {c.itens.length === 1 ? "conta" : "contas"}
            </span>
          </article>
        ))}
      </section>

      {ultimo && (
        <div className="fin-undo" role="status">
          <span>{ultimo.texto}</span>
          <button
            className="button secondary fin-pay"
            onClick={() => {
              fin.desfazerPagamento(ultimo.ids);
              onMessage("Pagamento desfeito: a conta voltou para a agenda.");
              setUltimo(null);
            }}
          >
            <Undo2 size={15} aria-hidden="true" />
            Desfazer
          </button>
          <button
            className="fin-undo-close"
            aria-label="Fechar aviso"
            onClick={() => setUltimo(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="panel fin-agenda" aria-labelledby="agenda-titulo">
        <header className="fin-agenda-head">
          <div>
            <h3 id="agenda-titulo" className="fin-h3">
              Agenda de pagamentos
            </h3>
            <p className="section-description">
              {doMes ? (
                <>
                  Todas as contas que vencem em {periodoLabel(periodo)}, pagas e
                  em aberto, por dia.
                </>
              ) : (
                <>
                  Contas em aberto até{" "}
                  {dateBr(limite, { day: "2-digit", month: "short" })}, por dia
                  de vencimento.
                </>
              )}{" "}
              Toque em um dia para ver as contas.
            </p>
          </div>
          <div className="fin-agenda-tools">
            <div className="fin-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar conta"
                placeholder="Buscar fornecedor ou categoria"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button aria-label="Limpar busca" onClick={() => setBusca("")}>
                  <X size={14} />
                </button>
              )}
            </div>
            {!q && grupos.length > 1 && (
              <button
                className="text-button"
                onClick={() =>
                  setAbertos(
                    tudoAberto ? new Set() : new Set(grupos.map((g) => g.id)),
                  )
                }
              >
                {tudoAberto ? "Recolher tudo" : "Expandir tudo"}
              </button>
            )}
          </div>
        </header>

        {grupos.length ? (
          <ol className="fin-days">
            {grupos.map((g) => {
              const aberto = abertosAgora.has(g.id);
              const atrasada = g.id === ATRASADAS;
              const aPagar = g.itens.filter((l) => !l.pago);
              const pagas = g.itens.length - aPagar.length;
              const quitado = aPagar.length === 0;
              const vencido = !atrasada && g.data! < hoje && !quitado;
              const dataTitulo = g.data ? diaCurto(g.data) : "Atrasadas";
              return (
                <li
                  key={g.id}
                  className={`fin-day${atrasada || vencido ? " danger" : quitado ? " done" : g.data === hoje ? " today" : ""}${aberto ? " open" : ""}`}
                >
                  <button
                    className="fin-day-head"
                    aria-expanded={aberto}
                    aria-controls={`dia-${g.id}`}
                    onClick={() => alternar(g.id)}
                  >
                    <span className="fin-day-date">
                      <strong>{dataTitulo}</strong>
                      <span>
                        {atrasada
                          ? "pague primeiro"
                          : quitado
                            ? "tudo pago"
                            : vencido
                              ? `vencida ${quando(g.data!, hoje)}`
                              : quando(g.data!, hoje)}
                      </span>
                    </span>
                    <span className="fin-day-count">
                      {g.itens.length}{" "}
                      {g.itens.length === 1 ? "conta" : "contas"}
                      {doMes && pagas > 0 && !quitado && (
                        <small>
                          {pagas} {pagas === 1 ? "paga" : "pagas"}
                        </small>
                      )}
                    </span>
                    <span className="fin-day-bar" aria-hidden="true">
                      <i style={{ width: `${(g.total / maior) * 100}%` }} />
                    </span>
                    <b className="fin-day-total">{money(g.total)}</b>
                    <ChevronDown
                      size={16}
                      className="fin-day-chevron"
                      aria-hidden="true"
                    />
                  </button>
                  {aberto && (
                    <div id={`dia-${g.id}`} className="fin-day-body">
                      <ul className="fin-day-list">
                        {g.itens.map((l) => (
                          <li
                            key={l.id}
                            className={l.pago ? "pago" : undefined}
                          >
                            <div className="fin-bill-main">
                              <strong>{l.descricao}</strong>
                              <span>
                                {[
                                  l.pago &&
                                    l.dataPagamento &&
                                    `Pago em ${dateBr(l.dataPagamento, { day: "2-digit", month: "2-digit" })}`,
                                  atrasada &&
                                    dateBr(l.vencimento, {
                                      day: "2-digit",
                                      month: "short",
                                    }),
                                  l.categoria,
                                  l.forma,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </div>
                            <b className="fin-day-valor">{money(l.valor)}</b>
                            {l.pago ? (
                              <button
                                className="button secondary fin-pay"
                                onClick={() => {
                                  fin.desfazerPagamento([l.id]);
                                  setUltimo(null);
                                  onMessage(
                                    `${l.descricao} voltou para em aberto.`,
                                  );
                                }}
                              >
                                Desmarcar
                              </button>
                            ) : (
                              <button
                                className="button secondary fin-pay"
                                onClick={() => {
                                  pagar(
                                    [l],
                                    `${l.descricao} marcada como paga (${money(l.valor)}).`,
                                  );
                                }}
                              >
                                Pagar
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {aPagar.length > 1 && (
                        <div className="fin-day-foot">
                          {pagarDia === g.id ? (
                            <>
                              <span>
                                Marcar as {aPagar.length} contas em aberto (
                                {money(soma(aPagar))}) como pagas hoje?
                              </span>
                              <button
                                className="button primary fin-pay"
                                onClick={() => pagarTodas(aPagar)}
                              >
                                Confirmar
                              </button>
                              <button
                                className="button secondary fin-pay"
                                onClick={() => setPagarDia(null)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() => setPagarDia(g.id)}
                            >
                              Marcar{" "}
                              {atrasada ? "todas as atrasadas" : "as do dia"}{" "}
                              como pagas
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="fin-empty fin-agenda-empty">
            {q
              ? "Nenhuma conta encontrada."
              : doMes
                ? `Nenhuma conta vence em ${periodoLabel(periodo)}.`
                : "Nenhuma conta em aberto nos próximos 30 dias."}
          </p>
        )}
      </section>
    </>
  );
}
