import { failure, guard, json } from "@/lib/api-route";
import { OCASIOES } from "@/lib/datas-especiais";
import { preparacao } from "@/lib/datas-especiais-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET [?ocasiao=natal] → próximas datas especiais e como foi a escolhida (ou a
// mais próxima) no ano anterior.
export async function GET(request: Request) {
  const check = guard(request, "retrospectiva");
  if ("response" in check) return check.response;
  const id = new URL(request.url).searchParams.get("ocasiao");
  if (id && !OCASIOES.some((o) => o.id === id))
    return json({ error: "Data especial desconhecida." }, 400);
  try {
    return json(await preparacao(id));
  } catch (error) {
    return failure(error, "api/datas-especiais");
  }
}
