// Limite de uso da IA na demonstração: contado na memória de cada instância
// do servidor (sem banco). É uma proteção de custo, não de segurança.
const usos = new Map<string, { inicio: number; n: number }>();

export async function dentroDoLimite(
  chave: string,
  max: number,
  janelaSegundos: number,
): Promise<boolean> {
  const agora = Date.now();
  const atual = usos.get(chave);
  if (!atual || agora - atual.inicio > janelaSegundos * 1000) {
    if (usos.size > 2000) usos.clear();
    usos.set(chave, { inicio: agora, n: 1 });
    return true;
  }
  atual.n++;
  return atual.n <= max;
}
