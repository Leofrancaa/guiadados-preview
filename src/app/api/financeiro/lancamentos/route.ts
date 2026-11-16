import { z } from "zod";
import { failure, guard, json } from "@/lib/api-route";
import { mesesHistorico } from "@/lib/financeiro/calculos";
import {
  lancamentoEntrada,
  listarLancamentos,
  pagarLancamentos,
  removerLancamento,
  salvarLancamentos,
} from "@/lib/financeiro/lancamentos-server";
import { todayInStore } from "@/lib/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = z.coerce.number().int().positive().max(2_147_483_647);
const corpoSalvar = z.object({
  itens: z.array(lancamentoEntrada).min(1).max(120),
});
const corpoPagar = z.object({
  ids: z.array(ID).min(1).max(500),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

const invalido = () => json({ error: "Dados inválidos." }, 400);

/** Lançamentos desde janeiro do ano anterior (mesmo período das vendas). */
export async function GET(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  try {
    const ini = `${mesesHistorico(todayInStore())[0]}-01`;
    return json({ lancamentos: await listarLancamentos(ini) });
  } catch (error) {
    return failure(error, "api/financeiro/lancamentos GET");
  }
}

/** Cria ou edita (id vazio cria). Devolve as linhas salvas, na mesma ordem. */
export async function POST(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const corpo = corpoSalvar.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return invalido();
  try {
    return json({ lancamentos: await salvarLancamentos(corpo.data.itens) });
  } catch (error) {
    return failure(error, "api/financeiro/lancamentos POST");
  }
}

/** Marca como pago na data ou, com data null, volta para em aberto. */
export async function PATCH(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const corpo = corpoPagar.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return invalido();
  try {
    const n = await pagarLancamentos(corpo.data.ids, corpo.data.data);
    return json({ atualizados: n });
  } catch (error) {
    return failure(error, "api/financeiro/lancamentos PATCH");
  }
}

export async function DELETE(request: Request) {
  const check = guard(request, "financeiro");
  if ("response" in check) return check.response;
  const id = ID.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return invalido();
  try {
    return json({ removidos: await removerLancamento(id.data) });
  } catch (error) {
    return failure(error, "api/financeiro/lancamentos DELETE");
  }
}
