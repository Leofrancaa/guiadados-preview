// Modelos de IA em ordem de preferência. SÓ roda no servidor.
// 1º OpenRouter (pago): DeepSeek V4.1 Flash, que segue melhor as regras e usa
//    melhor as ferramentas; se não houver provedor (ou falhar), gpt-oss-120b.
//    Sempre provedores confiáveis, sem coleta de dados e com retenção zero.
// Depois, Groq direta (plano grátis) como reserva: 120b e, por fim, 20b.
// OPENROUTER_MODEL troca o modelo principal sem mexer no código.
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { generateText, LanguageModel } from "ai";

type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>;

export type Esforco = "low" | "medium";

export type ModeloIA = {
  id: string;
  model: LanguageModel;
  providerOptions: ProviderOptions;
};

const OPENROUTER_PRINCIPAL = "deepseek/deepseek-v4.1-flash";
const OPENROUTER_RESERVA = "openai/gpt-oss-120b";

const gptOss = (id: string) => id.startsWith("openai/gpt-oss");

/**
 * Roteamento no OpenRouter. gpt-oss: provedores rápidos conhecidos. Outros
 * (DeepSeek): o mais rápido entre os que custam até US$ 0,20 / 0,80 por
 * milhão de tokens, para não estourar o orçamento nem demorar.
 */
function roteamento(id: string) {
  return gptOss(id)
    ? { order: ["groq", "cerebras", "together", "amazon-bedrock"] }
    : {
        sort: "throughput" as const,
        max_price: { prompt: 0.2, completion: 0.8 },
      };
}

export function iaConfigurada() {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY);
}

export function modelosIA(
  esforco: Esforco,
  { pequeno = false }: { pequeno?: boolean } = {},
): ModeloIA[] {
  const lista: ModeloIA[] = [];
  const principal = pequeno
    ? "openai/gpt-oss-20b"
    : (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b");
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      appName: "GuIA",
    });
    const ids = pequeno
      ? [principal]
      : [
          ...new Set([
            process.env.OPENROUTER_MODEL ?? OPENROUTER_PRINCIPAL,
            OPENROUTER_RESERVA,
          ]),
        ];
    for (const id of ids)
      lista.push({
        id: `openrouter:${id}`,
        model: openrouter(id, {
          provider: {
            ...roteamento(id),
            allow_fallbacks: true,
            require_parameters: true,
            data_collection: "deny",
            zdr: true,
          },
        }),
        // DeepSeek raciocina bem com esforço baixo e fica bem mais rápido.
        providerOptions: {
          openrouter: {
            reasoning: { effort: gptOss(id) ? esforco : "low" },
          },
        },
      });
  }
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    for (const id of new Set([principal, "openai/gpt-oss-20b"]))
      lista.push({
        id: `groq:${id}`,
        model: groq(id),
        providerOptions: { groq: { reasoningEffort: esforco } },
      });
  }
  return lista;
}

export function statusDoErro(error: unknown) {
  return error && typeof error === "object" && "statusCode" in error
    ? Number(error.statusCode)
    : 0;
}

/** Vale tentar o próximo modelo? (limite, sobrecarga, saldo, provedor fora) */
export function erroDeProvedor(error: unknown) {
  const status = statusDoErro(error);
  return (
    status === 0 ||
    status === 402 ||
    status === 404 ||
    status === 408 ||
    status === 413 ||
    status === 429 ||
    status >= 500
  );
}

/** Roda com o 1º modelo; se o provedor falhar, tenta o próximo da lista. */
export async function comReserva<T>(
  modelos: ModeloIA[],
  executar: (modelo: ModeloIA) => Promise<T>,
  rotulo: string,
): Promise<T> {
  if (!modelos.length) throw new Error("Nenhuma IA configurada");
  for (const [index, modelo] of modelos.entries()) {
    try {
      return await executar(modelo);
    } catch (error) {
      if (index === modelos.length - 1 || !erroDeProvedor(error)) throw error;
      console.error(
        `${rotulo}: ${modelo.id} falhou, tentando o próximo`,
        statusDoErro(error),
        (error as Error)?.message?.slice(0, 300),
      );
    }
  }
  throw new Error("unreachable");
}
