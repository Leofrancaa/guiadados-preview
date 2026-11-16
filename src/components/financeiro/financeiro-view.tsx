"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { ehAno, mesLabel, mesesHistorico } from "@/lib/financeiro/calculos";
import type { FiltroUnidade } from "@/lib/financeiro/tipos";
import { useFinanceiro } from "@/lib/financeiro/use-financeiro";
import { ContasView, type PeriodoContas } from "./contas";
import { ExportarContabilidade } from "./exportar";
import { FuncionariosView } from "./funcionarios";
import { LancamentosView } from "./lancamentos";
import { VisaoFinanceira } from "./visao";

type Aba = "visao" | "lancamentos" | "contas" | "funcionarios";

const ABAS: { id: Aba; label: string; icon: LucideIcon }[] = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "lancamentos", label: "Lançamentos", icon: ListOrdered },
  { id: "contas", label: "Contas a pagar", icon: CalendarClock },
  { id: "funcionarios", label: "Funcionários", icon: Users },
];

/**
 * mes: período da tela, um mês (AAAA-MM) ou, em Lançamentos, um ano (AAAA).
 * unidade: sempre "Todas" (o caixa não separa as lojas).
 */
export type Filtros = { mes: string; unidade: FiltroUnidade };

/** Opções de período agrupadas por ano: o ano inteiro e depois cada mês. */
function opcoesPeriodo(meses: string[], comAno: boolean) {
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))].sort().reverse();
  return anos.flatMap((ano) => [
    ...(comAno
      ? [{ value: ano, label: `${ano} (ano inteiro)`, group: ano }]
      : []),
    ...meses
      .filter((m) => m.startsWith(ano))
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: mesLabel(m, "longo"), group: ano })),
  ]);
}

export function FinanceiroView({
  onMessage,
}: {
  onMessage: (text: string) => void;
}) {
  const fin = useFinanceiro();
  const meses = useMemo(() => mesesHistorico(fin.hoje), [fin.hoje]);
  // Aba e filtros na URL (?fin=, ?fm=, ?fp=), como os filtros de vendas.
  // Esta tela só monta no navegador, então a URL pode ser lida na inicialização.
  const [inicial] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("fin");
    const m = p.get("fm");
    const fp = p.get("fp");
    return {
      periodo: (fp && /^\d{4}(-\d{2})?$/.test(fp)
        ? fp
        : "proximos") as PeriodoContas,
      aba: (ABAS.some((x) => x.id === a) ? a : "visao") as Aba,
      filtros: {
        // Abre no mês corrente: é o que as contas reais da planilha cobrem.
        mes:
          m && (meses.includes(m) || meses.some((x) => x.startsWith(m)))
            ? m
            : meses[meses.length - 1],
        unidade: "Todas" as FiltroUnidade,
      },
    };
  });
  const [aba, setAba] = useState<Aba>(inicial.aba);
  const [filtros, setFiltros] = useState<Filtros>(inicial.filtros);
  const [periodo, setPeriodo] = useState<PeriodoContas>(inicial.periodo);
  // Meses com conta vencendo (inclui os futuros já lançados), do mais novo ao mais antigo.
  const mesesContas = useMemo(() => {
    const ms = new Set(meses.slice(-12));
    for (const l of fin.dados?.lancamentos ?? [])
      if (l.tipo === "despesa") ms.add(l.vencimento.slice(0, 7));
    return [...ms].sort().reverse();
  }, [fin.dados, meses]);

  function sincronizar(next: {
    aba?: Aba;
    filtros?: Filtros;
    periodo?: PeriodoContas;
  }) {
    const p = new URLSearchParams(window.location.search);
    const f = next.filtros ?? filtros;
    const per = next.periodo ?? periodo;
    if (per === "proximos") p.delete("fp");
    else p.set("fp", per);
    p.set("fin", next.aba ?? aba);
    p.set("fm", f.mes);
    p.delete("fu");
    window.history.replaceState({}, "", `?${p}`);
  }

  const mudarAba = (a: Aba) => {
    setAba(a);
    sincronizar({ aba: a });
  };
  const mudarPeriodo = (per: PeriodoContas) => {
    setPeriodo(per);
    sincronizar({ periodo: per });
  };
  const mudarFiltros = (f: Filtros) => {
    setFiltros(f);
    sincronizar({ filtros: f });
  };

  if (!fin.dados) {
    return fin.erroLancamentos ? (
      <div className="panel rs-loading" role="alert">
        Não foi possível carregar as contas ({fin.erroLancamentos}).{" "}
        <button className="text-button" onClick={fin.tentarLancamentosDeNovo}>
          Tentar de novo
        </button>
      </div>
    ) : (
      <div className="panel rs-loading" role="status">
        Carregando o financeiro…
      </div>
    );
  }

  // A visão geral é mensal (DRE): com um ano escolhido em Lançamentos, ela mostra o
  // último mês daquele ano que aparece no painel.
  const filtrosVisao: Filtros = ehAno(filtros.mes)
    ? {
        ...filtros,
        mes:
          meses.filter((m) => m.startsWith(filtros.mes)).pop() ??
          meses[meses.length - 1],
      }
    : filtros;
  // A exportação segue o período que está na tela.
  const periodoExportar =
    aba === "contas"
      ? periodo === "proximos"
        ? meses[meses.length - 1]
        : periodo
      : filtros.mes;

  return (
    <div className="fin">
      <div className="fin-demo" role="note">
        <FlaskConical size={18} aria-hidden="true" />
        <p>
          {fin.fonte?.tipo === "caixa" ? (
            <>
              <strong>Demonstração com dados fictícios.</strong> O faturamento
              vem do caixa, as duas lojas juntas
              {fin.fonte.atualizadoEm
                ? `, atualizado em ${new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(fin.fonte.atualizadoEm))}`
                : ""}
              . Pode editar à vontade: contas e funcionários são de exemplo e as
              alterações não ficam guardadas.
            </>
          ) : (
            <>
              <strong>Dados de exemplo.</strong> As vendas não carregaram (
              {fin.fonte?.motivo}), então a receita também é fictícia.{" "}
              <button className="text-button" onClick={fin.tentarVendasDeNovo}>
                Tentar de novo
              </button>
            </>
          )}
        </p>
      </div>
      {fin.erroSalvar && (
        <p className="fin-alert" role="alert">
          {fin.erroSalvar}{" "}
          <button className="text-button" onClick={fin.fecharErro}>
            Fechar
          </button>
        </p>
      )}

      <div className="fin-toolbar">
        <nav className="fin-tabs" aria-label="Seções do financeiro">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={aba === id ? "selected" : ""}
              aria-current={aba === id ? "page" : undefined}
              onClick={() => mudarAba(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="fin-toolbar-side">
          {(aba === "lancamentos" || aba === "contas") && (
            <ExportarContabilidade
              fin={fin}
              periodo={periodoExportar}
              onMessage={onMessage}
            />
          )}
          {aba !== "funcionarios" && (
            <div className="fin-filters">
              {aba === "contas" && (
                <Select
                  size="compact"
                  ariaLabel="Período das contas"
                  value={periodo}
                  onValueChange={mudarPeriodo}
                  options={[
                    { value: "proximos", label: "Próximos 30 dias" },
                    ...opcoesPeriodo(mesesContas, true),
                  ]}
                />
              )}
              {aba === "lancamentos" && (
                <Select
                  size="compact"
                  ariaLabel="Período"
                  value={filtros.mes}
                  onValueChange={(mes) => mudarFiltros({ ...filtros, mes })}
                  options={opcoesPeriodo(meses, true)}
                />
              )}
              {aba === "visao" && (
                <Select
                  size="compact"
                  ariaLabel="Mês de competência"
                  value={filtrosVisao.mes}
                  onValueChange={(mes) => mudarFiltros({ ...filtros, mes })}
                  options={opcoesPeriodo(meses, false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {aba === "visao" && (
        <VisaoFinanceira
          fin={fin}
          filtros={filtrosVisao}
          meses={meses}
          onIrContas={() => mudarAba("contas")}
          onMessage={onMessage}
        />
      )}
      {aba === "lancamentos" && (
        <LancamentosView
          fin={fin}
          filtros={filtros}
          meses={meses}
          onMessage={onMessage}
        />
      )}
      {aba === "contas" && (
        <ContasView fin={fin} periodo={periodo} onMessage={onMessage} />
      )}
      {aba === "funcionarios" && (
        <FuncionariosView
          fin={fin}
          unidade={filtros.unidade}
          mesAtual={meses[meses.length - 1]}
          onMessage={onMessage}
        />
      )}
    </div>
  );
}
