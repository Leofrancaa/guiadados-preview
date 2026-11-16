import { z } from "zod";
import { failure, guard, json } from "@/lib/api-route";
import {
  definirEncargos,
  encargosEntrada,
  funcionarioEntrada,
  importarEquipe,
  listarEquipe,
  removerFuncionario,
  salvarFuncionario,
} from "@/lib/financeiro/equipe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = z.coerce.number().int().positive().max(2_147_483_647);
const corpoSalvar = z.object({ funcionario: funcionarioEntrada });
const corpoImportar = z.object({
  importar: z.object({
    funcionarios: z.array(funcionarioEntrada).max(300),
    encargos: encargosEntrada.nullable(),
  }),
});
const corpoEncargos = z.object({ encargos: encargosEntrada });

const invalido = () => json({ error: "Dados inválidos." }, 400);

/** Funcionários e % de encargos (config null = nunca definida). */
export async function GET(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  try {
    return json(await listarEquipe());
  } catch (error) {
    return failure(error, "api/financeiro/equipe GET");
  }
}

/**
 * Cria ou edita um funcionário (id vazio cria) e devolve a linha salva.
 * Com { importar }, sobe a equipe que estava só no navegador (o banco só
 * aceita se ainda estiver vazio) e devolve a equipe gravada.
 */
export async function POST(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const raw = await request.json().catch(() => null);
  const importar = corpoImportar.safeParse(raw);
  const salvar = importar.success ? null : corpoSalvar.safeParse(raw);
  if (!importar.success && !salvar?.success) return invalido();
  try {
    if (importar.success) {
      const { funcionarios, encargos } = importar.data.importar;
      return json(await importarEquipe(funcionarios, encargos));
    }
    return json({
      funcionario: await salvarFuncionario(salvar!.data!.funcionario),
    });
  } catch (error) {
    return failure(error, "api/financeiro/equipe POST");
  }
}

/** Define o % de encargos sobre o salário (CLT). */
export async function PUT(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const corpo = corpoEncargos.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return invalido();
  try {
    return json({ encargos: await definirEncargos(corpo.data.encargos) });
  } catch (error) {
    return failure(error, "api/financeiro/equipe PUT");
  }
}

export async function DELETE(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const id = ID.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return invalido();
  try {
    return json({ removidos: await removerFuncionario(id.data) });
  } catch (error) {
    return failure(error, "api/financeiro/equipe DELETE");
  }
}
