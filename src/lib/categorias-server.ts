// Categorias da DEMONSTRAÇÃO: vêm direto do catálogo do segmento escolhido.
// SÓ roda no servidor.
import { categoriaDe } from "@/lib/demo/motor";
import { segmentoAtual } from "@/lib/demo/segmento-server";

export type ResolverCategoria = (nome: string, codigo?: string) => string;

export async function resolverCategorias(): Promise<ResolverCategoria> {
  return categoriaDe(await segmentoAtual());
}
