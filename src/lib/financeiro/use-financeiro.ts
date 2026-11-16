"use client";

// Estado do módulo financeiro.
//  * Receita: vendas reais do caixa via /api/financeiro/vendas.
//  * Lançamentos (contas a pagar e receitas extras): no banco, via
//    /api/financeiro/lancamentos. A tela muda na hora e grava em seguida; se o
//    banco recusar, recarrega o que está gravado e avisa.
//  * Equipe e encargos: no banco, via /api/financeiro/equipe, com a mesma
//    lógica (muda na tela, grava em seguida, desfaz se o banco recusar). A
//    equipe que antes ficava só no navegador sobe uma vez, com o banco vazio.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { todayInStore } from "@/lib/vendas";
import { gerarVendas } from "./mock";
import type {
  ConfigFinanceiro,
  DadosFinanceiro,
  Funcionario,
  Lancamento,
} from "./tipos";
import type { VendasFinanceiro } from "./vendas";

const URL_LANC = "/api/financeiro/lancamentos";
const URL_EQUIPE = "/api/financeiro/equipe";
const CHAVE_EQUIPE = "guiadados:financeiro:equipe:v1";
const CHAVE_ANTIGA = "guiadados:financeiro:v4";
/** FGTS 8% + 13º + férias com 1/3 + FGTS sobre provisões ≈ 29% (Simples Nacional). */
export const ENCARGOS_PADRAO = 29;

type Equipe = { funcionarios: Funcionario[]; config: ConfigFinanceiro };
type EquipeBanco = {
  funcionarios: Funcionario[];
  config: ConfigFinanceiro | null;
};

/** Equipe que versões anteriores guardavam só neste navegador. */
function lerEquipeLocal(): Equipe | null {
  try {
    const raw = window.localStorage.getItem(CHAVE_EQUIPE);
    if (raw) return JSON.parse(raw) as Equipe;
    // Migra a equipe salva pela versão anterior (tudo no navegador).
    const antigo = window.localStorage.getItem(CHAVE_ANTIGA);
    if (!antigo) return null;
    const d = JSON.parse(antigo) as DadosFinanceiro;
    return d?.funcionarios
      ? { funcionarios: d.funcionarios, config: d.config }
      : null;
  } catch {
    return null;
  }
}

function apagarEquipeLocal() {
  try {
    window.localStorage.removeItem(CHAVE_EQUIPE);
    window.localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* Armazenamento bloqueado: nada a apagar. */
  }
}

/** Ids "fx-" são da equipe de exemplo gerada pelo painel: não sobem. */
const deExemplo = (f: Funcionario) => f.id.startsWith("fx-");

/** Id provisório de um lançamento que ainda não voltou do banco. */
export const novoId = () =>
  `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const provisorio = (id: string) => id.startsWith("tmp-");

class SessaoExpirada extends Error {}

async function enviar<T>(metodo: string, url: string, corpo?: unknown) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw new SessaoExpirada();
  if (!r.ok) throw new Error(body.error ?? "Não foi possível salvar.");
  return body as T;
}

export type FonteReceita =
  | { tipo: "caixa"; atualizadoEm: string | null }
  | { tipo: "exemplo"; motivo: string };

export function useFinanceiro() {
  const router = useRouter();
  const [nonceVendas, setNonceVendas] = useState(0);
  const [nonceLanc, setNonceLanc] = useState(0);
  const [nonceEquipe, setNonceEquipe] = useState(0);
  const api = useApi<VendasFinanceiro>("/api/financeiro/vendas", nonceVendas);
  const apiLanc = useApi<{ lancamentos: Lancamento[] }>(URL_LANC, nonceLanc);
  const apiEquipe = useApi<EquipeBanco>(URL_EQUIPE, nonceEquipe);
  const hoje = api.data?.hoje ?? todayInStore();

  // Sem resposta do banco de vendas, a receita cai para vendas de exemplo (avisado na tela).
  const vendas = useMemo(
    () => api.data?.vendas ?? (api.error ? gerarVendas(hoje) : null),
    [api.data, api.error, hoje],
  );
  const fonte: FonteReceita | null = api.data
    ? { tipo: "caixa", atualizadoEm: api.data.atualizado_em }
    : api.error
      ? { tipo: "exemplo", motivo: api.error.text }
      : null;

  const equipeBanco = useMemo<Equipe | null>(
    () =>
      apiEquipe.data
        ? {
            funcionarios: apiEquipe.data.funcionarios,
            config: apiEquipe.data.config ?? { encargos: ENCARGOS_PADRAO },
          }
        : null,
    [apiEquipe.data],
  );
  const [equipeEditada, setEquipeEditada] = useState<Equipe | null>(null);
  const equipe = equipeEditada ?? equipeBanco;

  const [lancEditados, setLancEditados] = useState<Lancamento[] | null>(null);
  const lancamentos = lancEditados ?? apiLanc.data?.lancamentos ?? null;
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const lancRef = useRef(lancamentos);
  const equipeRef = useRef(equipe);
  useEffect(() => {
    lancRef.current = lancamentos;
    equipeRef.current = equipe;
  }, [lancamentos, equipe]);

  // Banco vazio e equipe salva neste navegador (versão anterior): sobe uma vez.
  const importou = useRef(false);
  useEffect(() => {
    const banco = apiEquipe.data;
    if (importou.current || !banco) return;
    if (banco.funcionarios.length || banco.config) {
      importou.current = true;
      apagarEquipeLocal();
      return;
    }
    const local = lerEquipeLocal();
    const reais = local?.funcionarios.filter((f) => !deExemplo(f)) ?? [];
    if (!local || (!reais.length && local.config?.encargos == null)) return;
    importou.current = true;
    enviar<EquipeBanco>("POST", URL_EQUIPE, {
      importar: {
        funcionarios: reais.map((f) => ({ ...f, id: "" })),
        encargos: local.config?.encargos ?? null,
      },
    })
      .then((salva) => {
        apagarEquipeLocal();
        setEquipeEditada({
          funcionarios: salva.funcionarios,
          config: salva.config ?? { encargos: ENCARGOS_PADRAO },
        });
      })
      .catch(() => {
        // Fica no navegador; tenta de novo na próxima vez que abrir.
        importou.current = false;
      });
  }, [apiEquipe.data]);

  const dados: DadosFinanceiro | null = useMemo(
    () =>
      lancamentos && equipe ? { versao: 4, lancamentos, ...equipe } : null,
    [lancamentos, equipe],
  );

  /** Aplica na tela e grava; se o banco recusar, desfaz e mostra o erro. */
  const mudar = useCallback(
    async (
      fn: (ls: Lancamento[]) => Lancamento[],
      gravar: () => Promise<((ls: Lancamento[]) => Lancamento[]) | void>,
    ) => {
      const antes = lancRef.current;
      if (!antes) return;
      const depois = fn(antes);
      lancRef.current = depois;
      setLancEditados(depois);
      try {
        const ajuste = await gravar();
        setErroSalvar(null);
        if (ajuste && lancRef.current) {
          lancRef.current = ajuste(lancRef.current);
          setLancEditados(lancRef.current);
        }
      } catch (e) {
        if (e instanceof SessaoExpirada) {
          router.push("/login");
          return;
        }
        // Recarrega do banco: volta ao que está gravado de fato, inclusive se
        // outra mudança tiver sido feita enquanto esta era enviada.
        setLancEditados(null);
        setNonceLanc((n) => n + 1);
        setErroSalvar(
          `${e instanceof Error ? e.message : "Não foi possível salvar."} A alteração foi desfeita.`,
        );
      }
    },
    [router],
  );

  /** Igual a "mudar", para a equipe. */
  const mudarEquipe = useCallback(
    async (
      fn: (e: Equipe) => Equipe,
      gravar: () => Promise<((e: Equipe) => Equipe) | void>,
    ) => {
      if (!equipeRef.current) return;
      const nova = fn(equipeRef.current);
      equipeRef.current = nova;
      setEquipeEditada(nova);
      try {
        const ajuste = await gravar();
        setErroSalvar(null);
        if (ajuste && equipeRef.current) {
          equipeRef.current = ajuste(equipeRef.current);
          setEquipeEditada(equipeRef.current);
        }
      } catch (e) {
        if (e instanceof SessaoExpirada) {
          router.push("/login");
          return;
        }
        setEquipeEditada(null);
        setNonceEquipe((n) => n + 1);
        setErroSalvar(
          `${e instanceof Error ? e.message : "Não foi possível salvar."} A alteração foi desfeita.`,
        );
      }
    },
    [router],
  );

  const acoes = useMemo(() => {
    const salvar = (itens: Lancamento[]) =>
      enviar<{ lancamentos: Lancamento[] }>("POST", URL_LANC, {
        itens: itens.map((l) => ({ ...l, id: provisorio(l.id) ? "" : l.id })),
      });
    const marcar = (ids: string[], data: string | null) =>
      mudar(
        (ls) =>
          ls.map((x) =>
            ids.includes(x.id)
              ? { ...x, pago: data !== null, dataPagamento: data }
              : x,
          ),
        async () => {
          const reais = ids.filter((id) => !provisorio(id));
          if (reais.length)
            await enviar("PATCH", URL_LANC, { ids: reais, data });
        },
      );
    return {
      adicionarLancamentos: (novos: Lancamento[]) =>
        mudar(
          (ls) => [...ls, ...novos],
          async () => {
            const { lancamentos: salvos } = await salvar(novos);
            // Troca os ids provisórios pelos do banco.
            const porTmp = new Map(novos.map((n, i) => [n.id, salvos[i]]));
            return (ls) => ls.map((x) => porTmp.get(x.id) ?? x);
          },
        ),
      editarLancamento: (l: Lancamento) =>
        mudar(
          (ls) => ls.map((x) => (x.id === l.id ? l : x)),
          async () => {
            const {
              lancamentos: [salvo],
            } = await salvar([l]);
            return (ls) => ls.map((x) => (x.id === l.id ? salvo : x));
          },
        ),
      removerLancamento: (id: string) =>
        mudar(
          (ls) => ls.filter((x) => x.id !== id),
          async () => {
            if (!provisorio(id))
              await enviar(
                "DELETE",
                `${URL_LANC}?id=${encodeURIComponent(id)}`,
              );
          },
        ),
      pagar: (id: string, data: string) => marcar([id], data),
      pagarVarios: (ids: string[], data: string) => marcar(ids, data),
      desfazerPagamento: (ids: string[]) => marcar(ids, null),
      salvarFuncionario: (f: Funcionario) =>
        mudarEquipe(
          (e) => ({
            ...e,
            funcionarios: e.funcionarios.some((x) => x.id === f.id)
              ? e.funcionarios.map((x) => (x.id === f.id ? f : x))
              : [...e.funcionarios, f],
          }),
          async () => {
            const { funcionario: salvo } = await enviar<{
              funcionario: Funcionario;
            }>("POST", URL_EQUIPE, {
              funcionario: { ...f, id: provisorio(f.id) ? "" : f.id },
            });
            // Troca o id provisório pelo do banco.
            return (e) => ({
              ...e,
              funcionarios: e.funcionarios.map((x) =>
                x.id === f.id ? salvo : x,
              ),
            });
          },
        ),
      removerFuncionario: (id: string) =>
        mudarEquipe(
          (e) => ({
            ...e,
            funcionarios: e.funcionarios.filter((x) => x.id !== id),
          }),
          async () => {
            if (!provisorio(id))
              await enviar(
                "DELETE",
                `${URL_EQUIPE}?id=${encodeURIComponent(id)}`,
              );
          },
        ),
      definirEncargos: (encargos: number) =>
        mudarEquipe(
          (e) => ({ ...e, config: { ...e.config, encargos } }),
          async () => {
            await enviar("PUT", URL_EQUIPE, { encargos });
          },
        ),
      fecharErro: () => setErroSalvar(null),
      tentarVendasDeNovo: () => setNonceVendas((n) => n + 1),
      tentarLancamentosDeNovo: () => {
        setLancEditados(null);
        setNonceLanc((n) => n + 1);
        setEquipeEditada(null);
        setNonceEquipe((n) => n + 1);
      },
    };
  }, [mudar, mudarEquipe]);

  return {
    hoje,
    empresa: api.data?.empresa ?? "Empresa de demonstração",
    vendas: vendas ?? {},
    dados,
    carregando: !dados && !apiLanc.error && !apiEquipe.error,
    erroLancamentos:
      lancamentos && equipe
        ? null
        : (apiLanc.error?.text ?? apiEquipe.error?.text ?? null),
    fonte,
    erroSalvar,
    ...acoes,
  };
}

export type Financeiro = ReturnType<typeof useFinanceiro>;
