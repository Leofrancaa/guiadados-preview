// Equipe do financeiro na DEMONSTRAÇÃO: na memória do servidor, começando
// com funcionários de exemplo do segmento.
import { z } from "zod";
import { baseDemo } from "./lancamentos-server";
import {
  CONTRATOS,
  STATUS_FUNC,
  UNIDADES,
  type ConfigFinanceiro,
  type Funcionario,
} from "./tipos";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dinheiro = z.number().finite().min(0).max(1_000_000);

/** Funcionário vindo do painel. "id" vazio cria um novo. */
export const funcionarioEntrada = z.object({
  id: z.string().regex(/^\d*$/).max(10),
  nome: z.string().trim().min(1).max(120),
  cargo: z.string().trim().min(1).max(80),
  unidade: z.enum(UNIDADES),
  contrato: z.enum(CONTRATOS),
  admissao: data,
  desligamento: data.nullable(),
  turno: z.string().trim().min(1).max(60),
  jornadaSemanal: z.number().finite().min(0).max(80),
  salario: dinheiro,
  vt: dinheiro,
  va: dinheiro,
  status: z.enum(STATUS_FUNC),
  obs: z.string().max(500),
});

export const encargosEntrada = z.number().finite().min(0).max(100);

/** Config null = nunca definida (o painel usa o padrão). */
export type EquipeBanco = {
  funcionarios: Funcionario[];
  config: ConfigFinanceiro | null;
};

const equipe = (b: Awaited<ReturnType<typeof baseDemo>>): EquipeBanco => ({
  funcionarios: b.funcionarios,
  config: b.encargos == null ? null : { encargos: b.encargos },
});

export const listarEquipe = async () => equipe(await baseDemo());

export async function salvarFuncionario(f: z.infer<typeof funcionarioEntrada>) {
  const b = await baseDemo();
  const id = f.id || String(++b.seq);
  const linha = { ...f, id } as Funcionario;
  const i = b.funcionarios.findIndex((x) => x.id === id);
  if (i >= 0) b.funcionarios[i] = linha;
  else b.funcionarios.push(linha);
  return linha;
}

export async function removerFuncionario(id: number) {
  const b = await baseDemo();
  const antes = b.funcionarios.length;
  b.funcionarios = b.funcionarios.filter((x) => x.id !== String(id));
  return antes - b.funcionarios.length;
}

export async function definirEncargos(valor: number) {
  const b = await baseDemo();
  b.encargos = valor;
  return 1;
}

/** Na demonstração não há equipe antiga para importar. */
export async function importarEquipe(
  itens: z.infer<typeof funcionarioEntrada>[],
  encargos: number | null,
) {
  void itens;
  void encargos;
  return equipe(await baseDemo());
}
