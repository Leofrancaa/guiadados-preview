// Segmento escolhido depois do login (cookie). SÓ no servidor.
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { SEGMENTO_PADRAO, segmentoPorId, type Segmento } from "./segmentos";

export const SEGMENTO_COOKIE = "gd_segmento";

/** Segmento escolhido ou null (ainda não escolheu). */
export async function segmentoEscolhido(): Promise<Segmento | null> {
  try {
    return segmentoPorId((await cookies()).get(SEGMENTO_COOKIE)?.value);
  } catch {
    return null;
  }
}

const fixado = new AsyncLocalStorage<Segmento>();

/** Roda fn com o segmento fixo (ferramentas do chat que rodam durante o stream). */
export function comSegmento<T>(seg: Segmento, fn: () => T): T {
  return fixado.run(seg, fn);
}

/** Segmento da requisição (cai na padaria se não houver). */
export async function segmentoAtual(): Promise<Segmento> {
  return (
    fixado.getStore() ??
    (await segmentoEscolhido()) ??
    segmentoPorId(SEGMENTO_PADRAO)!
  );
}
