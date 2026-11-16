// Preparação para datas especiais no servidor: lê o ano anterior e a base.
import {
  OCASIOES,
  calcPreparacao,
  diaMaisForte,
  proximasOcasioes,
} from "@/lib/datas-especiais";
import { shiftDate, todayInStore } from "@/lib/vendas";
import { painelProdutos, painelVendas } from "@/lib/vendas-server";

export async function preparacao(id?: string | null) {
  const proximas = proximasOcasioes(todayInStore());
  const proxima = proximas.find((p) => p.id === id) ?? proximas[0];
  const anterior = OCASIOES.find((o) => o.id === proxima.id)!.janela(
    proxima.ano - 1,
  );
  // Base: as 8 semanas antes da janela do ano anterior.
  const baseIni = shiftDate(anterior.ini, -56);
  const baseFim = shiftDate(anterior.ini, -1);
  const [janela, base, prodJanela, prodBase] = await Promise.all([
    painelVendas(anterior.ini, anterior.fim, "todas"),
    painelVendas(baseIni, baseFim, "todas"),
    painelProdutos(anterior.ini, anterior.fim, "todas"),
    painelProdutos(baseIni, baseFim, "todas"),
  ]);
  // O dia analisado em detalhe é o que mais vendeu de fato no ano anterior.
  const pico = diaMaisForte(janela);
  const [dia, prodDia] = pico
    ? await Promise.all([
        painelVendas(pico, pico, "todas"),
        painelProdutos(pico, pico, "todas"),
      ])
    : [null, null];
  return {
    proximas,
    preparacao: calcPreparacao({
      proxima,
      janela,
      base,
      prodJanela,
      prodBase,
      pico,
      dia,
      prodDia,
    }),
  };
}
