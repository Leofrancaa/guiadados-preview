import { failure, guard, json } from "@/lib/api-route";
import { isSituacao } from "@/lib/vendas";
import { produtoHistorico } from "@/lib/vendas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Linha do tempo: todo o histórico do produto, independente do período do filtro.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const check = guard(request, "produtos");
  if ("response" in check) return check.response;
  const { codigo } = await params;
  const situacao = new URL(request.url).searchParams.get("situacao") ?? "todas";
  if (!/^\d{1,14}$/.test(codigo) || !isSituacao(situacao))
    return json({ error: "Produto ou filtro inválido." }, 400);
  try {
    return json(await produtoHistorico(codigo, situacao));
  } catch (error) {
    return failure(error, "api/produtos/[codigo]/historico");
  }
}
