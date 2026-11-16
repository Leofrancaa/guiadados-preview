// Vendas da DEMONSTRAÇÃO: dados sintéticos gerados no servidor para o
// segmento escolhido (sem banco de dados). Mesmos formatos do painel real.
import type {
  Cesta,
  PainelProdutos,
  PainelVendas,
  ProdutoDetalhe,
  ProdutoHistorico,
  Situacao,
} from "@/lib/vendas";
import * as motor from "@/lib/demo/motor";
import { segmentoAtual } from "@/lib/demo/segmento-server";

/** Mantido por compatibilidade com as rotas (na demonstração nunca ocorre). */
export class VendasNaoConfiguradas extends Error {
  constructor() {
    super("Conexão com o banco de vendas não configurada no servidor.");
    this.name = "VendasNaoConfiguradas";
  }
}

export async function painelVendas(
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<PainelVendas> {
  return motor.painelVendas(await segmentoAtual(), ini, fim, situacao);
}

export type FaturamentoDiario = Pick<
  PainelVendas,
  "serie" | "atualizado_em"
> & {
  base: Pick<PainelVendas["base"], "ultimo_dia" | "ultimo_pedido">;
};

export async function faturamentoDiario(
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<FaturamentoDiario> {
  return motor.faturamentoDiario(await segmentoAtual(), ini, fim, situacao);
}

export async function painelProdutos(
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<PainelProdutos> {
  return motor.painelProdutos(await segmentoAtual(), ini, fim, situacao);
}

export async function produtoDetalhe(
  codigo: string,
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<ProdutoDetalhe> {
  return motor.produtoDetalhe(
    await segmentoAtual(),
    codigo,
    ini,
    fim,
    situacao,
  );
}

export async function produtoHistorico(
  codigo: string,
  situacao: Situacao,
): Promise<ProdutoHistorico> {
  return motor.produtoHistorico(await segmentoAtual(), codigo, situacao);
}

export async function cestasCompras(
  ini: string,
  fim: string,
  situacao: Situacao,
): Promise<Cesta[]> {
  return motor.cestasCompras(await segmentoAtual(), ini, fim, situacao, 15);
}
