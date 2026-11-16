// Retrospectiva no servidor: lê painel_vendas e aplica os cálculos puros.
import {
  calcDestaquesDia,
  calcRetrospectiva,
  type Retrospectiva,
} from "@/lib/retrospectiva";
import { painelVendas } from "@/lib/vendas-server";

type Periodo = Retrospectiva["periodo"];

export async function retrospectiva(periodo: Periodo) {
  const data = await painelVendas(periodo.ini, periodo.fim, "todas");
  return calcRetrospectiva(data, periodo);
}

export async function destaquesDia(periodo: Periodo, dia: string) {
  // O período usa o mesmo cache da retrospectiva (mesmos argumentos).
  const [diaData, periodoData] = await Promise.all([
    painelVendas(dia, dia, "todas"),
    painelVendas(periodo.ini, periodo.fim, "todas"),
  ]);
  return calcDestaquesDia(diaData, periodoData);
}
