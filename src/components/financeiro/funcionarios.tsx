"use client";

import { Select } from "@/components/ui/select";
import { useRef, useState } from "react";
import {
  BadgeDollarSign,
  Pencil,
  Percent,
  Plus,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  addMeses,
  custoMensal,
  diffDias,
  fimExperiencia,
  folhaDoMes,
  proximoPeriodoFerias,
  tempoDeCasa,
  vendasDe,
} from "@/lib/financeiro/calculos";
import {
  CONTRATOS,
  STATUS_FUNC,
  TURNOS,
  UNIDADES,
  type Contrato,
  type FiltroUnidade,
  type Funcionario,
  type StatusFuncionario,
  type Unidade,
} from "@/lib/financeiro/tipos";
import { novoId, type Financeiro } from "@/lib/financeiro/use-financeiro";
import { dateBr, money, percent } from "@/lib/format";
import { BarrasHorizontais } from "./graficos";

const dataBr = (d: string) =>
  dateBr(d, { day: "2-digit", month: "2-digit", year: "numeric" });

export function FuncionariosView({
  fin,
  unidade,
  mesAtual,
  onMessage,
}: {
  fin: Financeiro;
  unidade: FiltroUnidade;
  mesAtual: string;
  onMessage: (t: string) => void;
}) {
  const dados = fin.dados!;
  const cfg = dados.config;
  const hoje = fin.hoje;
  const [situacao, setSituacao] = useState<"atuais" | "desligados" | "todos">(
    "atuais",
  );
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Funcionario | "novo" | null>(null);
  const [encargos, setEncargos] = useState(
    String(cfg.encargos).replace(".", ","),
  );
  const formRef = useRef<HTMLDivElement>(null);

  const daLoja = dados.funcionarios.filter(
    (f) => unidade === "Todas" || f.unidade === unidade,
  );
  const atuais = daLoja.filter((f) => f.status !== "Desligado");
  const folha = folhaDoMes(dados.funcionarios, mesAtual, unidade, cfg);
  const mesFechado = addMeses(mesAtual, -1);
  // O caixa não separa as lojas: a proporção é sempre das duas lojas juntas.
  const folhaTotalFechado = folhaDoMes(
    dados.funcionarios,
    mesFechado,
    "Todas",
    cfg,
  );
  const fatFechado = vendasDe(fin.vendas, mesFechado).total;

  const linhas = (() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return daLoja
      .filter((f) =>
        situacao === "todos"
          ? true
          : situacao === "desligados"
            ? f.status === "Desligado"
            : f.status !== "Desligado",
      )
      .filter(
        (f) =>
          !q || `${f.nome} ${f.cargo}`.toLocaleLowerCase("pt-BR").includes(q),
      )
      .sort(
        (a, b) =>
          a.unidade.localeCompare(b.unidade) || a.nome.localeCompare(b.nome),
      );
  })();

  // Marcos que pedem ação do dono nas próximas semanas.
  const avisos = atuais
    .flatMap((f) => {
      const out: {
        id: string;
        texto: string;
        tom: "warning" | "danger" | "neutral";
      }[] = [];
      if (f.contrato === "Experiência") {
        const fim = fimExperiencia(f.admissao);
        const d = diffDias(fim, hoje);
        if (d <= 20)
          out.push({
            id: `${f.id}-exp`,
            tom: d < 0 ? "danger" : "warning",
            texto: `${f.nome}: experiência ${d < 0 ? "venceu" : "termina"} em ${dataBr(fim)}. Decida se efetiva.`,
          });
      }
      if (f.contrato === "CLT" || f.contrato === "Experiência") {
        const per = proximoPeriodoFerias(f.admissao, hoje);
        const d = diffDias(per, hoje);
        if (d <= 30 && f.status === "Ativo")
          out.push({
            id: `${f.id}-fer`,
            tom: "neutral",
            texto: `${f.nome}: completa mais um período de férias em ${dataBr(per)}.`,
          });
      }
      if (f.status === "Afastado")
        out.push({
          id: `${f.id}-af`,
          tom: "warning",
          texto: `${f.nome} está afastado(a).${f.obs ? ` ${f.obs}` : ""}`,
        });
      if (f.contrato === "Temporário")
        out.push({
          id: `${f.id}-tmp`,
          tom: "neutral",
          texto: `${f.nome}: contrato temporário.${f.obs ? ` ${f.obs}` : ""}`,
        });
      return out;
    })
    .slice(0, 6);

  const porCargo = Object.entries(
    atuais.reduce<Record<string, { valor: number; n: number }>>((acc, f) => {
      const k = f.cargo;
      acc[k] ??= { valor: 0, n: 0 };
      acc[k].valor += custoMensal(f, cfg);
      acc[k].n += 1;
      return acc;
    }, {}),
  )
    .map(([label, v]) => ({
      label,
      valor: v.valor,
      detalhe: `${v.n} ${v.n === 1 ? "pessoa" : "pessoas"}`,
    }))
    .sort((a, b) => b.valor - a.valor);

  function abrir(f: Funcionario | "novo") {
    setEditando(f);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }

  function salvarEncargos() {
    const v = Number(encargos.replace(",", "."));
    if (v >= 0 && v <= 100) {
      fin.definirEncargos(v);
      onMessage(`Encargos estimados em ${percent(v)} do salário.`);
    } else setEncargos(String(cfg.encargos).replace(".", ","));
  }

  const ativos = atuais.filter((f) => f.status === "Ativo").length;

  return (
    <>
      <section
        className="metrics rs-metrics fin-metrics"
        aria-label="Resumo da equipe"
      >
        <article className="metric">
          <div className="metric-heading">
            <span>Equipe</span>
            <Users size={19} aria-hidden="true" />
          </div>
          <strong>{atuais.length}</strong>
          <span className="metric-footer">
            {ativos} trabalhando · {atuais.length - ativos} de férias ou
            afastados
          </span>
        </article>
        <article className="metric rs-featured">
          <div className="metric-heading">
            <span>Custo mensal da equipe</span>
            <BadgeDollarSign size={19} aria-hidden="true" />
          </div>
          <strong>{money(folha)}</strong>
          <span className="metric-footer">
            Salários + encargos + benefícios
          </span>
        </article>
        <article className="metric">
          <div className="metric-heading">
            <span>Custo médio por pessoa</span>
            <UserCheck size={19} aria-hidden="true" />
          </div>
          <strong>{money(atuais.length ? folha / atuais.length : 0)}</strong>
          <span className="metric-footer">Por mês, com encargos</span>
        </article>
        <article className="metric">
          <div className="metric-heading">
            <span>Folha sobre o faturamento</span>
            <Percent size={19} aria-hidden="true" />
          </div>
          <strong>
            {fatFechado ? percent((folhaTotalFechado / fatFechado) * 100) : "–"}
          </strong>
          <span
            className={`metric-footer ${fatFechado && folhaTotalFechado / fatFechado > 0.3 ? "caution" : ""}`}
          >
            Duas lojas, último mês fechado, contra o faturamento do caixa. Acima
            de 30% merece atenção.
          </span>
        </article>
      </section>

      <div className="fin-grid-2 fin-top-gap">
        <section className="panel fin-pad">
          <h3 className="fin-h3">Custo por função</h3>
          <p className="section-description">
            Equipe atual, custo mensal da empresa.
          </p>
          <BarrasHorizontais itens={porCargo} total={folha} />
        </section>
        <section className="panel fin-pad">
          <h3 className="fin-h3">Fique de olho</h3>
          <p className="section-description">
            Experiência, férias, afastamentos e temporários.
          </p>
          {avisos.length ? (
            <ul className="fin-avisos">
              {avisos.map((a) => (
                <li key={a.id} className={a.tom}>
                  {a.texto}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fin-empty">Nenhum marco nas próximas semanas.</p>
          )}
          <div className="fin-encargos">
            <label htmlFor="fn-enc">Encargos sobre o salário (CLT)</label>
            <div>
              <input
                id="fn-enc"
                inputMode="decimal"
                value={encargos}
                onChange={(e) => setEncargos(e.target.value)}
                onBlur={salvarEncargos}
                onKeyDown={(e) => e.key === "Enter" && salvarEncargos()}
              />
              <span>%</span>
            </div>
            <p className="section-description">
              Estimativa para o Simples Nacional: FGTS 8% + provisão de 13º e
              férias com 1/3. Confirme com o contador.
            </p>
          </div>
        </section>
      </div>

      <div ref={formRef}>
        {editando && (
          <FuncionarioForm
            key={editando === "novo" ? "novo" : editando.id}
            inicial={editando === "novo" ? null : editando}
            unidadePadrao={unidade === "Todas" ? "Loja 1" : unidade}
            hoje={hoje}
            cargos={[...new Set(dados.funcionarios.map((f) => f.cargo))].sort()}
            encargos={cfg.encargos}
            onCancel={() => setEditando(null)}
            onSave={(f) => {
              const novo = editando === "novo";
              fin.salvarFuncionario(f);
              setEditando(null);
              onMessage(
                novo
                  ? `${f.nome} cadastrado(a).`
                  : `Dados de ${f.nome} atualizados.`,
              );
            }}
            onRemove={(f) => {
              fin.removerFuncionario(f.id);
              setEditando(null);
              onMessage(`${f.nome} removido(a) do cadastro.`);
            }}
          />
        )}
      </div>

      <section className="panel fin-table-panel">
        <div className="fin-table-head">
          <div>
            <h3 className="fin-h3">Funcionários</h3>
            <p className="section-description">
              Clique no nome para ver ou editar a contratação.
            </p>
          </div>
          <button className="button primary" onClick={() => abrir("novo")}>
            <Plus size={16} aria-hidden="true" />
            Novo funcionário
          </button>
        </div>
        <div className="fin-filters-row">
          <div className="period-control" role="group" aria-label="Situação">
            {(["atuais", "desligados", "todos"] as const).map((s) => (
              <button
                key={s}
                className={situacao === s ? "selected" : ""}
                aria-pressed={situacao === s}
                onClick={() => setSituacao(s)}
              >
                {s === "atuais"
                  ? "Equipe atual"
                  : s === "desligados"
                    ? "Desligados"
                    : "Todos"}
              </button>
            ))}
          </div>
          <div className="fin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar funcionário"
              placeholder="Buscar nome ou função"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button aria-label="Limpar busca" onClick={() => setBusca("")}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="table-scroll">
          <table className="fin-table">
            <thead>
              <tr>
                <th scope="col">Funcionário</th>
                <th scope="col">Loja</th>
                <th scope="col">Contrato</th>
                <th scope="col">Admissão</th>
                <th scope="col">Turno</th>
                <th scope="col" className="rs-num">
                  Salário
                </th>
                <th scope="col" className="rs-num">
                  Benefícios
                </th>
                <th scope="col" className="rs-num">
                  Custo mensal
                </th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((f) => (
                <tr key={f.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className="rs-row-link"
                      onClick={() => abrir(f)}
                    >
                      {f.nome}
                    </button>
                    <small className="rs-code">{f.cargo}</small>
                  </th>
                  <td>{f.unidade}</td>
                  <td>
                    <span className="fin-cat">{f.contrato}</span>
                    {f.contrato === "Experiência" && (
                      <small className="rs-code">
                        até {dataBr(fimExperiencia(f.admissao))}
                      </small>
                    )}
                  </td>
                  <td>
                    {dataBr(f.admissao)}
                    <small className="rs-code">
                      {f.desligamento
                        ? `saiu em ${dataBr(f.desligamento)}`
                        : tempoDeCasa(f.admissao, hoje)}
                    </small>
                  </td>
                  <td>
                    {f.turno.split(" (")[0]}
                    <small className="rs-code">
                      {f.jornadaSemanal}h/semana
                    </small>
                  </td>
                  <td className="rs-num">{money(f.salario)}</td>
                  <td className="rs-num">
                    {money(f.vt + f.va)}
                    <small className="rs-code">
                      VT {money(f.vt)} · VA {money(f.va)}
                    </small>
                  </td>
                  <td className="rs-num">
                    <b>{money(custoMensal(f, cfg))}</b>
                  </td>
                  <td>
                    <SituacaoBadge status={f.status} />
                  </td>
                  <td className="fin-actions">
                    <button
                      className="fin-icon-btn"
                      aria-label={`Editar ${f.nome}`}
                      title="Editar"
                      onClick={() => abrir(f)}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!linhas.length && (
                <tr>
                  <td colSpan={10} className="rs-empty-row">
                    Ninguém com esses filtros. Use “Novo funcionário” para
                    cadastrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rs-table-footer">
          <span>{linhas.length} pessoas</span>
          <span className="fin-totals">
            <span>
              Salários{" "}
              <b>
                {money(
                  linhas
                    .filter((f) => f.status !== "Desligado")
                    .reduce((s, f) => s + f.salario, 0),
                )}
              </b>
            </span>
            <span>
              Custo total{" "}
              <b>
                {money(
                  linhas
                    .filter((f) => f.status !== "Desligado")
                    .reduce((s, f) => s + custoMensal(f, cfg), 0),
                )}
              </b>
            </span>
          </span>
        </div>
      </section>
      <p className="rs-note">
        O custo de cada pessoa entra automaticamente no grupo Pessoal da DRE,
        mês a mês, entre a admissão e o desligamento. Estágio e MEI/PJ não têm
        encargos.
      </p>
    </>
  );
}

function SituacaoBadge({ status }: { status: StatusFuncionario }) {
  const tom = {
    Ativo: "success",
    Férias: "neutral",
    Afastado: "warning",
    Desligado: "danger",
  }[status];
  return (
    <span className={`badge ${tom}`}>
      <span />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------- formulário
type ErrosF = Partial<
  Record<"nome" | "cargo" | "admissao" | "salario" | "desligamento", string>
>;

function FuncionarioForm({
  inicial,
  unidadePadrao,
  hoje,
  cargos,
  encargos,
  onSave,
  onCancel,
  onRemove,
}: {
  inicial: Funcionario | null;
  unidadePadrao: Unidade;
  hoje: string;
  cargos: string[];
  encargos: number;
  onSave: (f: Funcionario) => void;
  onCancel: () => void;
  onRemove: (f: Funcionario) => void;
}) {
  const num = (v: number) => String(v).replace(".", ",");
  const [f, setF] = useState({
    nome: inicial?.nome ?? "",
    cargo: inicial?.cargo ?? "",
    unidade: inicial?.unidade ?? unidadePadrao,
    contrato: inicial?.contrato ?? ("Experiência" as Contrato),
    admissao: inicial?.admissao ?? hoje,
    desligamento: inicial?.desligamento ?? "",
    turno: inicial?.turno ?? TURNOS[1],
    jornada: inicial ? String(inicial.jornadaSemanal) : "44",
    salario: inicial ? num(inicial.salario) : "",
    vt: inicial ? num(inicial.vt) : "0",
    va: inicial ? num(inicial.va) : "0",
    status: inicial?.status ?? ("Ativo" as StatusFuncionario),
    obs: inicial?.obs ?? "",
  });
  const [erros, setErros] = useState<ErrosF>({});
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const dec = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  const previa: Funcionario = {
    id: inicial?.id ?? "previa",
    nome: f.nome,
    cargo: f.cargo,
    unidade: f.unidade,
    contrato: f.contrato,
    admissao: f.admissao,
    desligamento: f.status === "Desligado" ? f.desligamento || null : null,
    turno: f.turno,
    jornadaSemanal: Number(f.jornada) || 0,
    salario: dec(f.salario) || 0,
    vt: dec(f.vt) || 0,
    va: dec(f.va) || 0,
    status: f.status,
    obs: f.obs.trim(),
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const er: ErrosF = {};
    if (!f.nome.trim()) er.nome = "Informe o nome completo.";
    if (!f.cargo.trim()) er.cargo = "Informe a função, por exemplo “Padeiro”.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.admissao))
      er.admissao = "Escolha a data de admissão.";
    if (!(previa.salario > 0))
      er.salario = "Informe o salário (ou valor mensal, para MEI/PJ).";
    if (f.status === "Desligado" && !f.desligamento)
      er.desligamento = "Informe a data do desligamento.";
    else if (f.status === "Desligado" && f.desligamento < f.admissao)
      er.desligamento = "O desligamento não pode ser antes da admissão.";
    setErros(er);
    if (Object.keys(er).length) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${Object.keys(er)[0]}"]`)
        ?.focus();
      return;
    }
    onSave({
      ...previa,
      id: inicial?.id ?? novoId(),
      nome: f.nome.trim(),
      cargo: f.cargo.trim(),
    });
  }

  const semEncargos = f.contrato === "Estágio" || f.contrato === "MEI/PJ";

  return (
    <form ref={formRef} className="panel fin-form" onSubmit={enviar} noValidate>
      <div className="fin-form-head">
        <h3 className="fin-h3">
          {inicial ? `Contratação de ${inicial.nome}` : "Novo funcionário"}
        </h3>
        {inicial && (
          <span className="section-description">
            {tempoDeCasa(inicial.admissao, inicial.desligamento ?? hoje)} de
            casa
            {(inicial.contrato === "CLT" ||
              inicial.contrato === "Experiência") &&
              !inicial.desligamento &&
              ` · próximo período de férias completa em ${dataBr(proximoPeriodoFerias(inicial.admissao, hoje))}`}
          </span>
        )}
      </div>
      <div className="fin-form-grid">
        <div className="field fin-span-2">
          <label htmlFor="fn-nome">Nome completo</label>
          <input
            id="fn-nome"
            name="nome"
            value={f.nome}
            onChange={(e) => set("nome", e.target.value)}
            aria-invalid={!!erros.nome}
          />
          <p className="fin-err">{erros.nome}</p>
        </div>
        <div className="field">
          <label htmlFor="fn-cargo">Função</label>
          <input
            id="fn-cargo"
            name="cargo"
            list="fn-cargos"
            value={f.cargo}
            onChange={(e) => set("cargo", e.target.value)}
            aria-invalid={!!erros.cargo}
          />
          <datalist id="fn-cargos">
            {cargos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="fin-err">{erros.cargo}</p>
        </div>
        <div className="field">
          <label htmlFor="fn-uni">Loja</label>
          <Select
            id="fn-uni"
            value={f.unidade}
            onValueChange={(v) => set("unidade", v as Unidade)}
            options={UNIDADES.map((x) => ({ value: x, label: x }))}
          />
        </div>
        <div className="field">
          <label htmlFor="fn-contrato">Tipo de contrato</label>
          <Select
            id="fn-contrato"
            value={f.contrato}
            onValueChange={(v) => set("contrato", v as Contrato)}
            options={CONTRATOS.map((x) => ({ value: x, label: x }))}
          />
          <p className="fin-err fin-hint">
            {f.contrato === "Experiência" &&
            /^\d{4}-\d{2}-\d{2}$/.test(f.admissao)
              ? `Termina em ${dataBr(fimExperiencia(f.admissao))} (90 dias).`
              : ""}
          </p>
        </div>
        <div className="field">
          <label htmlFor="fn-adm">Admissão</label>
          <input
            id="fn-adm"
            name="admissao"
            type="date"
            value={f.admissao}
            onChange={(e) => set("admissao", e.target.value)}
            aria-invalid={!!erros.admissao}
          />
          <p className="fin-err">{erros.admissao}</p>
        </div>
        <div className="field">
          <label htmlFor="fn-turno">Turno</label>
          <Select
            id="fn-turno"
            value={f.turno}
            onValueChange={(v) => set("turno", v)}
            options={TURNOS.map((x) => ({ value: x, label: x }))}
          />
        </div>
        <div className="field">
          <label htmlFor="fn-jor">
            Jornada<span>horas por semana</span>
          </label>
          <input
            id="fn-jor"
            type="number"
            min={1}
            max={44}
            value={f.jornada}
            onChange={(e) => set("jornada", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fn-sal">
            {f.contrato === "MEI/PJ"
              ? "Valor mensal (R$)"
              : f.contrato === "Estágio"
                ? "Bolsa (R$)"
                : "Salário bruto (R$)"}
          </label>
          <input
            id="fn-sal"
            name="salario"
            inputMode="decimal"
            value={f.salario}
            onChange={(e) => set("salario", e.target.value)}
            aria-invalid={!!erros.salario}
            placeholder="0,00"
          />
          <p className="fin-err">{erros.salario}</p>
        </div>
        <div className="field">
          <label htmlFor="fn-vt">
            Vale-transporte<span>custo da empresa/mês</span>
          </label>
          <input
            id="fn-vt"
            inputMode="decimal"
            value={f.vt}
            onChange={(e) => set("vt", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fn-va">
            Vale-alimentação<span>por mês</span>
          </label>
          <input
            id="fn-va"
            inputMode="decimal"
            value={f.va}
            onChange={(e) => set("va", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fn-status">Situação</label>
          <Select
            id="fn-status"
            value={f.status}
            onValueChange={(v) => set("status", v as StatusFuncionario)}
            options={STATUS_FUNC.map((x) => ({ value: x, label: x }))}
          />
        </div>
        {f.status === "Desligado" && (
          <div className="field">
            <label htmlFor="fn-desl">Data do desligamento</label>
            <input
              id="fn-desl"
              name="desligamento"
              type="date"
              value={f.desligamento}
              onChange={(e) => set("desligamento", e.target.value)}
              aria-invalid={!!erros.desligamento}
            />
            <p className="fin-err">{erros.desligamento}</p>
          </div>
        )}
        <div className="field fin-span-full">
          <label htmlFor="fn-obs">
            Observação<span>opcional</span>
          </label>
          <input
            id="fn-obs"
            value={f.obs}
            onChange={(e) => set("obs", e.target.value)}
            placeholder="Ex.: insalubridade, acordo de horas, motivo do afastamento"
          />
        </div>
      </div>
      <div className="fin-cost-preview" aria-live="polite">
        <span>Custo mensal para a empresa</span>
        <strong>{money(custoMensal(previa, { encargos }))}</strong>
        <small>
          {money(previa.salario)}{" "}
          {semEncargos
            ? "sem encargos"
            : `+ ${percent(encargos, 0)} de encargos (${money((previa.salario * encargos) / 100)})`}{" "}
          + benefícios {money(previa.vt + previa.va)}
        </small>
      </div>
      <div className="fin-form-actions">
        {inicial &&
          (confirmarRemover ? (
            <button
              type="button"
              className="button secondary fin-danger"
              onClick={() => onRemove(inicial)}
            >
              Confirmar remoção
            </button>
          ) : (
            <button
              type="button"
              className="button secondary fin-danger"
              onClick={() => setConfirmarRemover(true)}
            >
              Remover do cadastro
            </button>
          ))}
        <span className="fin-spacer" />
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button primary">
          {inicial ? "Salvar alterações" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
