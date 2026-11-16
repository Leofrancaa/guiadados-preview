import { failure, guard, json } from "@/lib/api-route";
import { retroRange } from "@/lib/retrospectiva";
import { destaquesDia, retrospectiva } from "@/lib/retrospectiva-server";
import { isIsoDate } from "@/lib/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET ?ano=2026[&mes=10]          → recordes do ano ou mês
// GET ?ano=2026[&mes=10]&dia=...  → destaques de um dia desse período
export async function GET(request: Request) {
  const check = guard(request, "retrospectiva");
  if ("response" in check) return check.response;
  const params = new URL(request.url).searchParams;
  const mesParam = params.get("mes");
  const periodo = retroRange(
    Number(params.get("ano")),
    mesParam ? Number(mesParam) : null,
  );
  if (!periodo) return json({ error: "Período inválido." }, 400);
  const dia = params.get("dia");
  if (
    dia !== null &&
    (!isIsoDate(dia) || dia < periodo.ini || dia > periodo.fim)
  )
    return json({ error: "Dia fora do período escolhido." }, 400);
  try {
    return json(
      dia ? await destaquesDia(periodo, dia) : await retrospectiva(periodo),
    );
  } catch (error) {
    return failure(error, "api/retrospectiva");
  }
}
