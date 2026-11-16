"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  expandirLancamento,
  mesDe,
  mesLabel,
  ehAno,
  noPeriodo,
  periodoLabel,
  statusDe,
  type Repeticao,
  type StatusConta,
} from "@/lib/financeiro/calculos";
import {
  CATEGORIAS,
  FORMAS_PAGAMENTO,
  GRUPOS,
  grupoDe,
  type Grupo,
  type Lancamento,
  type UnidadeLancamento,
} from "@/lib/financeiro/tipos";
import { novoId, type Financeiro } from "@/lib/financeiro/use-financeiro";
import { money, shortDate } from "@/lib/format";
import type { Filtros } from "./financeiro-view";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "./visao";

export function LancamentosView({
  fin,
  filtros,
  meses,
  onMessage,
}: {
  fin: Financeiro;
  filtros: Filtros;
  meses: string[];
  onMessage: (t: string) => void;
}) {
  const dados = fin.dados!;
  const [tipo, setTipo] = useState<"todos" | "despesa" | "receita">("todos");
  const [grupo, setGrupo] = useState<Grupo | "todos">("todos");
  const [status, setStatus] = useState<StatusConta | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Lancamento | "novo" | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const linhas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return dados.lancamentos
      .filter((l) => noPeriodo(l.competencia, filtros.mes))
      .filter((l) => tipo === "todos" || l.tipo === tipo)
      .filter((l) => grupo === "todos" || grupoDe(l.categoria) === grupo)
      .filter((l) => status === "todos" || statusDe(l, fin.hoje) === status)
      .filter(
        (l) =>
          !q ||
          `${l.descricao} ${l.fornecedor} ${l.categoria}`
            .toLocaleLowerCase("pt-BR")
            .includes(q),
      )
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [dados.lancamentos, filtros, tipo, grupo, status, busca, fin.hoje]);

  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);
  const despesas = linhas.filter((l) => l.tipo === "despesa");
  const totalDespesas = soma(despesas);
  const pago = soma(despesas.filter((l) => l.pago));
  const receitas = soma(linhas.filter((l) => l.tipo === "receita"));

  function abrir(l: Lancamento | "novo") {
    setEditando(l);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }

  return (
    <>
      <div ref={formRef}>
        {editando && (
          <LancamentoForm
            key={editando === "novo" ? "novo" : editando.id}
            inicial={editando === "novo" ? null : editando}
            mesPadrao={ehAno(filtros.mes) ? fin.hoje.slice(0, 7) : filtros.mes}
            unidadePadrao="Geral"
            hoje={fin.hoje}
            fornecedores={[
              ...new Set(
                dados.lancamentos.map((l) => l.fornecedor).filter(Boolean),
              ),
            ].sort()}
            onCancel={() => setEditando(null)}
            onSave={(itens, editado) => {
              if (editado) fin.editarLancamento(itens[0]);
              else fin.adicionarLancamentos(itens);
              setEditando(null);
              onMessage(
                editado
                  ? "Lançamento atualizado."
                  : itens.length > 1
                    ? `${itens.length} lançamentos criados (${mesLabel(itens[0].competencia)} a ${mesLabel(itens[itens.length - 1].competencia)}).`
                    : "Lançamento salvo.",
              );
            }}
          />
        )}
      </div>

      <section className="panel fin-table-panel">
        <div className="fin-table-head">
          <div>
            <h3 className="fin-h3">Lançamentos: {periodoLabel(filtros.mes)}</h3>
            <p className="section-description">Pela competência.</p>
          </div>
          <button className="button primary" onClick={() => abrir("novo")}>
            <Plus size={16} aria-hidden="true" />
            Novo lançamento
          </button>
        </div>
        <div className="fin-filters-row">
          <div className="period-control" role="group" aria-label="Tipo">
            {(["todos", "despesa", "receita"] as const).map((t) => (
              <button
                key={t}
                className={tipo === t ? "selected" : ""}
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                {t === "todos"
                  ? "Tudo"
                  : t === "despesa"
                    ? "Despesas"
                    : "Receitas"}
              </button>
            ))}
          </div>
          <label className="fin-inline-select">
            <span className="sr-only">Grupo</span>
            <Select
              ariaLabel="Grupo"
              value={grupo}
              onValueChange={(v) => setGrupo(v as Grupo | "todos")}
              options={[
                { value: "todos", label: "Todos os grupos" },
                ...(Object.keys(GRUPOS) as Grupo[]).map((g) => ({
                  value: g,
                  label: GRUPOS[g].label,
                })),
              ]}
            />
          </label>
          <label className="fin-inline-select">
            <span className="sr-only">Situação</span>
            <Select
              ariaLabel="Situação"
              value={status}
              onValueChange={(v) => setStatus(v as StatusConta | "todos")}
              options={[
                { value: "todos", label: "Qualquer situação" },
                { value: "pago", label: "Pagos" },
                { value: "pendente", label: "Pendentes" },
                { value: "vence-hoje", label: "Vencem hoje" },
                { value: "atrasado", label: "Atrasados" },
              ]}
            />
          </label>
          <div className="fin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar lançamento"
              placeholder="Buscar descrição ou fornecedor"
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
                <th scope="col">Vencimento</th>
                <th scope="col">Descrição</th>
                <th scope="col">Categoria</th>
                <th scope="col" className="rs-num">
                  Valor
                </th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const st = statusDe(l, fin.hoje);
                return (
                  <tr key={l.id}>
                    <td className="rs-num-left">{shortDate(l.vencimento)}</td>
                    <th scope="row">
                      <span className="fin-desc">
                        {l.descricao}
                        {l.recorrente && <span className="tag">Mensal</span>}
                      </span>
                      {l.fornecedor && l.fornecedor !== l.descricao && (
                        <small className="rs-code">{l.fornecedor}</small>
                      )}
                    </th>
                    <td>
                      <span className="fin-cat">{l.categoria}</span>
                    </td>
                    <td
                      className={`rs-num ${l.tipo === "receita" ? "fin-pos" : ""}`}
                    >
                      {l.tipo === "receita" ? "+" : ""}
                      {money(l.valor)}
                    </td>
                    <td>
                      {l.tipo === "receita" ? (
                        <span
                          className={`badge ${l.pago ? "success" : "neutral"}`}
                        >
                          <span />
                          {l.pago ? "Recebido" : "A receber"}
                        </span>
                      ) : (
                        <StatusBadge status={st} />
                      )}
                    </td>
                    <td className="fin-actions">
                      {!l.pago && (
                        <button
                          className="fin-icon-btn"
                          aria-label={`Marcar ${l.descricao} como ${l.tipo === "receita" ? "recebido" : "pago"}`}
                          title={
                            l.tipo === "receita"
                              ? "Marcar como recebido"
                              : "Marcar como pago"
                          }
                          onClick={() => {
                            fin.pagar(l.id, fin.hoje);
                            onMessage(
                              `${l.descricao}: ${l.tipo === "receita" ? "recebido" : "pago"} hoje.`,
                            );
                          }}
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        className="fin-icon-btn"
                        aria-label={`Editar ${l.descricao}`}
                        title="Editar"
                        onClick={() => abrir(l)}
                      >
                        <Pencil size={15} />
                      </button>
                      {excluir === l.id ? (
                        <button
                          className="button secondary fin-confirm"
                          onClick={() => {
                            fin.removerLancamento(l.id);
                            setExcluir(null);
                            onMessage("Lançamento excluído.");
                          }}
                          onBlur={() => setExcluir(null)}
                          autoFocus
                        >
                          Excluir?
                        </button>
                      ) : (
                        <button
                          className="fin-icon-btn"
                          aria-label={`Excluir ${l.descricao}`}
                          title="Excluir"
                          onClick={() => setExcluir(l.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!linhas.length && (
                <tr>
                  <td colSpan={7} className="rs-empty-row">
                    Nenhum lançamento com esses filtros. Use “Novo lançamento”
                    para registrar uma conta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rs-table-footer">
          <span>{linhas.length} lançamentos</span>
          <span className="fin-totals">
            <span>
              Despesas <b>{money(totalDespesas)}</b>
            </span>
            <span>
              Pago <b>{money(pago)}</b>
            </span>
            <span>
              Em aberto <b>{money(totalDespesas - pago)}</b>
            </span>
            {receitas > 0 && (
              <span>
                Receitas extras <b className="fin-pos">{money(receitas)}</b>
              </span>
            )}
          </span>
        </div>
      </section>
      <p className="rs-note">
        Vendas do caixa não aparecem aqui: elas vêm do caixa. Lance apenas
        despesas e receitas fora do caixa (encomendas faturadas, eventos).
        Competências disponíveis: {mesLabel(meses[0])} a{" "}
        {mesLabel(meses[meses.length - 1])}.
      </p>
    </>
  );
}

// ---------------------------------------------------------------- formulário
type Erros = Partial<
  Record<"descricao" | "valor" | "vencimento" | "repeticao", string>
>;

function LancamentoForm({
  inicial,
  mesPadrao,
  unidadePadrao,
  hoje,
  fornecedores,
  onSave,
  onCancel,
}: {
  inicial: Lancamento | null;
  mesPadrao: string;
  unidadePadrao: UnidadeLancamento;
  hoje: string;
  fornecedores: string[];
  onSave: (itens: Lancamento[], editado: boolean) => void;
  onCancel: () => void;
}) {
  const vencPadrao = mesDe(hoje) === mesPadrao ? hoje : `${mesPadrao}-10`;
  const [tipo, setTipo] = useState<Lancamento["tipo"]>(
    inicial?.tipo ?? "despesa",
  );
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [categoria, setCategoria] = useState(
    inicial?.categoria ?? "Farinha e insumos de panificação",
  );
  const [valor, setValor] = useState(
    inicial ? String(inicial.valor).replace(".", ",") : "",
  );
  // O caixa não separa as lojas: mantém a loja que já estava gravada.
  const unidade: UnidadeLancamento = inicial?.unidade ?? unidadePadrao;
  const [vencimento, setVencimento] = useState(
    inicial?.vencimento ?? vencPadrao,
  );
  const [competencia, setCompetencia] = useState(
    inicial?.competencia ?? mesDe(vencPadrao),
  );
  const [compManual, setCompManual] = useState(Boolean(inicial));
  const [forma, setForma] = useState(inicial?.forma ?? "Boleto");
  const [fornecedor, setFornecedor] = useState(inicial?.fornecedor ?? "");
  const [pago, setPago] = useState(inicial?.pago ?? false);
  const [dataPagamento, setDataPagamento] = useState(
    inicial?.dataPagamento ?? hoje,
  );
  const [repTipo, setRepTipo] = useState<Repeticao["tipo"]>("unica");
  const [repN, setRepN] = useState("12");
  const [obs, setObs] = useState(inicial?.obs ?? "");
  const [erros, setErros] = useState<Erros>({});
  const formRef = useRef<HTMLFormElement>(null);

  const categorias = CATEGORIAS.filter((c) =>
    tipo === "receita" ? c.grupo === "receita" : c.grupo !== "receita",
  );
  const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
  const n = Number(repN);

  function trocarTipo(t: Lancamento["tipo"]) {
    setTipo(t);
    const primeira = CATEGORIAS.find((c) =>
      t === "receita" ? c.grupo === "receita" : c.grupo !== "receita",
    );
    if (primeira && (grupoDe(categoria) === "receita") !== (t === "receita"))
      setCategoria(primeira.nome);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const er: Erros = {};
    if (!descricao.trim())
      er.descricao = "Descreva o lançamento, por exemplo “Conta de energia”.";
    if (!(valorNum > 0))
      er.valor = "Informe um valor maior que zero, como 1.250,90.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento))
      er.vencimento = "Escolha a data de vencimento.";
    if (repTipo !== "unica" && !(Number.isInteger(n) && n >= 2 && n <= 36))
      er.repeticao = "Use de 2 a 36 vezes.";
    setErros(er);
    if (Object.keys(er).length) {
      const campo = Object.keys(er)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${campo}"]`)?.focus();
      return;
    }
    const base: Omit<Lancamento, "id"> = {
      tipo,
      descricao: descricao.trim(),
      categoria,
      valor: Math.round(valorNum * 100) / 100,
      unidade,
      competencia,
      vencimento,
      pago,
      dataPagamento: pago ? dataPagamento : null,
      forma,
      fornecedor: fornecedor.trim(),
      recorrente: inicial?.recorrente ?? false,
      obs: obs.trim(),
    };
    if (inicial) return onSave([{ ...base, id: inicial.id }], true);
    const rep: Repeticao =
      repTipo === "mensal"
        ? { tipo: "mensal", meses: n }
        : repTipo === "parcelada"
          ? { tipo: "parcelada", parcelas: n }
          : { tipo: "unica" };
    onSave(expandirLancamento(base, rep, novoId), false);
  }

  return (
    <form ref={formRef} className="panel fin-form" onSubmit={enviar} noValidate>
      <div className="fin-form-head">
        <h3 className="fin-h3">
          {inicial ? "Editar lançamento" : "Novo lançamento"}
        </h3>
        <div
          className="period-control"
          role="group"
          aria-label="Tipo de lançamento"
        >
          <button
            type="button"
            className={tipo === "despesa" ? "selected" : ""}
            aria-pressed={tipo === "despesa"}
            onClick={() => trocarTipo("despesa")}
          >
            Despesa
          </button>
          <button
            type="button"
            className={tipo === "receita" ? "selected" : ""}
            aria-pressed={tipo === "receita"}
            onClick={() => trocarTipo("receita")}
          >
            Receita extra
          </button>
        </div>
      </div>

      <div className="fin-form-grid">
        <div className="field fin-span-2">
          <label htmlFor="fl-desc">Descrição</label>
          <input
            id="fl-desc"
            name="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-invalid={!!erros.descricao}
            aria-describedby="fl-desc-err"
            placeholder="Ex.: Compra de farinha – 20 sacos"
          />
          <p id="fl-desc-err" className="fin-err">
            {erros.descricao}
          </p>
        </div>
        <div className="field">
          <label htmlFor="fl-valor">Valor (R$)</label>
          <input
            id="fl-valor"
            name="valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={!!erros.valor}
            aria-describedby="fl-valor-err"
            placeholder="0,00"
          />
          <p id="fl-valor-err" className="fin-err">
            {erros.valor}
          </p>
        </div>
        <div className="field">
          <label htmlFor="fl-cat">Categoria</label>
          <Select
            id="fl-cat"
            value={categoria}
            onValueChange={setCategoria}
            options={(Object.keys(GRUPOS) as Grupo[]).flatMap((g) =>
              categorias
                .filter((c) => c.grupo === g)
                .map((c) => ({
                  value: c.nome,
                  label: c.nome,
                  group: GRUPOS[g].label,
                })),
            )}
          />
        </div>
        <div className="field">
          <label htmlFor="fl-forn">
            {tipo === "receita" ? "Cliente" : "Fornecedor"}
            <span>opcional</span>
          </label>
          <input
            id="fl-forn"
            list="fl-forn-list"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
          />
          <datalist id="fl-forn-list">
            {fornecedores.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="fl-venc">
            {tipo === "receita" ? "Previsão de recebimento" : "Vencimento"}
          </label>
          <input
            id="fl-venc"
            name="vencimento"
            type="date"
            value={vencimento}
            aria-invalid={!!erros.vencimento}
            onChange={(e) => {
              setVencimento(e.target.value);
              if (!compManual && e.target.value)
                setCompetencia(mesDe(e.target.value));
            }}
          />
          <p className="fin-err">{erros.vencimento}</p>
        </div>
        <div className="field">
          <label htmlFor="fl-comp">
            Competência<span>mês da DRE</span>
          </label>
          <input
            id="fl-comp"
            type="month"
            value={competencia}
            onChange={(e) => {
              setCompManual(true);
              if (e.target.value) setCompetencia(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="fl-forma">Forma de pagamento</label>
          <Select
            id="fl-forma"
            value={forma}
            placeholder="Não informada"
            onValueChange={setForma}
            options={FORMAS_PAGAMENTO.map((f) => ({ value: f, label: f }))}
          />
        </div>
        <div className="field fin-check-field">
          <label className="fin-check">
            <input
              type="checkbox"
              checked={pago}
              onChange={(e) => setPago(e.target.checked)}
            />
            {tipo === "receita" ? "Já recebido" : "Já pago"}
          </label>
          {pago && (
            <input
              type="date"
              aria-label="Data do pagamento"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          )}
        </div>
        {!inicial && (
          <div className="field fin-span-2">
            <label htmlFor="fl-rep">Repetição</label>
            <div className="fin-rep">
              <Select
                id="fl-rep"
                value={repTipo}
                onValueChange={(v) => setRepTipo(v as Repeticao["tipo"])}
                options={[
                  { value: "unica", label: "Lançamento único" },
                  { value: "mensal", label: "Repetir todo mês" },
                  { value: "parcelada", label: "Parcelar o valor" },
                ]}
              />
              {repTipo !== "unica" && (
                <input
                  name="repeticao"
                  type="number"
                  min={2}
                  max={36}
                  value={repN}
                  onChange={(e) => setRepN(e.target.value)}
                  aria-label={
                    repTipo === "mensal"
                      ? "Quantidade de meses"
                      : "Quantidade de parcelas"
                  }
                  aria-invalid={!!erros.repeticao}
                />
              )}
            </div>
            <p className="fin-err">
              {erros.repeticao ??
                (repTipo === "mensal" && n >= 2
                  ? `${n} lançamentos de ${valorNum > 0 ? money(valorNum) : "R$ —"}, um por mês.`
                  : repTipo === "parcelada" && n >= 2
                    ? `${n} parcelas de ${valorNum > 0 ? money(valorNum / n) : "R$ —"}.`
                    : "")}
            </p>
          </div>
        )}
        <div className="field fin-span-full">
          <label htmlFor="fl-obs">
            Observação<span>opcional</span>
          </label>
          <input
            id="fl-obs"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Número da nota, combinado com o fornecedor…"
          />
        </div>
      </div>
      <div className="fin-form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button primary">
          {inicial ? "Salvar alterações" : "Salvar lançamento"}
        </button>
      </div>
    </form>
  );
}
