import { isStepCount, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  assistantInstructions,
  chatRequestSchema,
  avisoSemConsulta,
  createTextNormalizer,
  friendlyChatError,
  groqMessage,
  resolveScreenFilter,
} from "@/lib/chat-context";
import { sessionFromRequest } from "@/lib/auth";
import {
  basketPairsReport,
  chatPeriods,
  chatWeekdays,
  realSalesAvailable,
  realSalesReport,
  resolveChatPeriod,
} from "@/lib/vendas-chat";
import { canAccess } from "@/lib/roles";
import { dentroDoLimite } from "@/lib/limite-server";
import { comSegmento, segmentoAtual } from "@/lib/demo/segmento-server";
import {
  erroDeProvedor,
  iaConfigurada,
  modelosIA,
  statusDoErro,
} from "@/lib/ia";

export const runtime = "nodejs";
export const maxDuration = 60;
// Só o histórico da conversa vai no corpo (os dados são lidos no servidor).
const MAX_BODY_BYTES = 64_000;
const clients = new Map<string, { count: number; resetAt: number }>();

export function GET() {
  return Response.json(
    {
      configured: iaConfigurada() && realSalesAvailable(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session)
    return Response.json(
      { error: "Sessão expirada. Entre novamente." },
      { status: 401 },
    );
  if (!canAccess(session.role, "chat"))
    return Response.json(
      { error: "Seu perfil não tem acesso ao chat." },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  try {
    if (
      !origin ||
      new URL(origin).host !==
        (request.headers.get("host") ?? new URL(request.url).host)
    )
      throw new Error("Origin mismatch");
  } catch {
    return Response.json(
      { error: "Abra o chat dentro do painel GuIA Dados." },
      { status: 403 },
    );
  }
  if (!iaConfigurada() || !realSalesAvailable())
    return Response.json(
      {
        error:
          "A IA ainda não foi configurada nesta demonstração. O responsável precisa definir a chave da IA (OPENROUTER_API_KEY ou GROQ_API_KEY) no servidor.",
      },
      { status: 503 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json(
      { error: "Formato de mensagem inválido." },
      { status: 415 },
    );
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES)
    return Response.json(
      { error: "A conversa está muito longa. Envie uma pergunta mais curta." },
      { status: 413 },
    );
  let payload;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES)
      return Response.json(
        {
          error: "A conversa está muito longa. Envie uma pergunta mais curta.",
        },
        { status: 413 },
      );
    payload = chatRequestSchema.parse(JSON.parse(body));
  } catch {
    return Response.json(
      { error: "Mensagem inválida. Confira e tente novamente." },
      { status: 400 },
    );
  }
  const screenFilter = payload.filter
    ? resolveScreenFilter(payload.filter)
    : null;
  if (payload.filter && !screenFilter)
    return Response.json(
      { error: "Período do filtro inválido. Escolha outro período." },
      { status: 400 },
    );
  const now = Date.now();
  for (const [id, entry] of clients)
    if (entry.resetAt <= now) clients.delete(id);
  const address =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const entry = clients.get(address) ?? { count: 0, resetAt: now + 60000 };
  if (entry.count >= 8 || clients.size >= 5000)
    return Response.json(
      {
        error:
          "Você enviou muitas perguntas em sequência. Aguarde um minuto e tente novamente.",
      },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  entry.count++;
  clients.set(address, entry);
  // Teto diário por endereço e total da demonstração (protege o custo da IA).
  const limiteIp = Number(process.env.DEMO_LIMITE_CHAT_IP ?? 20);
  const limiteTotal = Number(process.env.DEMO_LIMITE_CHAT_DIA ?? 200);
  if (
    !(await dentroDoLimite(`chat:${address}`, limiteIp, 86_400)) ||
    !(await dentroDoLimite("chat:total", limiteTotal, 86_400))
  )
    return Response.json(
      {
        error:
          "Você atingiu o limite de perguntas de hoje. Amanhã a GuIA volta a responder.",
      },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  const controller = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    controller.signal,
    AbortSignal.timeout(50000),
  ]);
  const seg = await segmentoAtual();
  const modelos = modelosIA("medium");
  const createAgent = (modelo: (typeof modelos)[number]) =>
    new ToolLoopAgent({
      model: modelo.model,
      instructions: assistantInstructions(seg, undefined, screenFilter),
      // Até 3 consultas (ex.: comparar dois períodos) + a resposta.
      stopWhen: isStepCount(4),
      // O último passo não pode consultar de novo: tem de responder.
      prepareStep: ({ stepNumber }) =>
        stepNumber >= 3 ? { toolChoice: "none" } : {},
      // inclui o raciocínio do modelo (esforço médio); o DeepSeek pensa mais
      maxOutputTokens: 6000,
      temperature: 0.2,
      maxRetries: 0,
      prepareCall: (settings) => ({ ...settings, onError: () => {} }),
      providerOptions: modelo.providerOptions,
      tools: {
        getRealSales: tool({
          description:
            "Read-only sales of the business (point of sale): revenue, orders, average ticket, items per order, comparison period (month views: same days of last month; year views: same period last year; otherwise the same number of days just before), top products, payment methods, ticket bands, daily averages (all days, Monday-Friday, Saturday, Sunday), weekday averages, busiest hours, holidays/commemorative dates in the period (calendarEvents) and, for periods up to 14 days, a baseline from the 8 weeks before. Daily, weekday and hourly averages use only complete days (today's partial day is excluded). Set hourlyFor to a weekday to also get its hour-by-hour averages (orders, revenue, share of the day, revenue before/after each hour) — required for questions about opening hours, closing earlier/opening later, shifts or staffing by time of day. Use period for the dashboard periods (same dates as the screen); use personalizado with startDate/endDate (YYYY-MM-DD, up to today, max 800 days) only for other ranges. statusFilter: todas (default), finalizado or pendente.",
          inputSchema: z.object({
            period: z.enum(chatPeriods),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            statusFilter: z
              .enum(["todas", "finalizado", "pendente"])
              .optional(),
            hourlyFor: z.enum(chatWeekdays).optional(),
          }),
          execute: async ({
            period,
            startDate,
            endDate,
            statusFilter,
            hourlyFor,
          }) => {
            const range = resolveChatPeriod(period, startDate, endDate);
            if ("error" in range) return range;
            try {
              return await comSegmento(seg, () =>
                realSalesReport(
                  range.start,
                  range.end,
                  statusFilter ?? "todas",
                  range.label,
                  hourlyFor,
                ),
              );
            } catch {
              return {
                error:
                  "As vendas estão indisponíveis agora. Avise que não foi possível consultar as vendas.",
              };
            }
          },
        }),
        getBasketPairs: tool({
          description:
            "Read-only market-basket analysis of the orders (each order's items are recorded): pairs of products bought together in the same order more often than chance, with ordersWithBoth, the % of buyers of A who also took B (and of B who took A), the % of all orders with both, lift (how many times more likely than chance) and each product's category. Use it for questions about products sold together, combos, kits, cross-selling, venda casada or placing products side by side. Same period options as getRealSales; ranges longer than 120 days are reduced to their last 90 days (see period).",
          inputSchema: z.object({
            period: z.enum(chatPeriods),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            statusFilter: z
              .enum(["todas", "finalizado", "pendente"])
              .optional(),
          }),
          execute: async ({ period, startDate, endDate, statusFilter }) => {
            const range = resolveChatPeriod(period, startDate, endDate);
            if ("error" in range) return range;
            try {
              return await comSegmento(seg, () =>
                basketPairsReport(
                  range.start,
                  range.end,
                  statusFilter ?? "todas",
                  range.label,
                ),
              );
            } catch {
              return {
                error:
                  "A análise de produtos comprados juntos está indisponível agora. Avise que não foi possível consultar.",
              };
            }
          },
        }),
      },
    });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(output) {
      const send = (event: unknown) =>
        output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let text = "";
      let consultas = 0;
      const normalizer = createTextNormalizer();
      const emit = (chunk: string) => {
        if (!chunk) return;
        text += chunk;
        send({ type: "delta", text: chunk });
      };
      try {
        const consumeModel = async (modelo: (typeof modelos)[number]) => {
          const result = await createAgent(modelo).stream({
            messages: payload.messages,
            abortSignal: signal,
          });
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") emit(normalizer.push(part.text));
            // Só conta consulta que trouxe dados (erro não sustenta número).
            else if (
              part.type === "tool-result" &&
              !(
                part.output &&
                typeof part.output === "object" &&
                "error" in part.output
              )
            )
              consultas++;
            else if (part.type === "error") throw part.error;
            else if (part.type === "finish" && part.finishReason === "length") {
              const error = new Error("Output limit reached");
              error.name = "OutputLimitError";
              throw error;
            } else if (part.type === "abort")
              throw new DOMException("Request aborted", "AbortError");
          }
        };
        // Tenta cada modelo em ordem; só passa para o próximo se nada foi
        // escrito ainda e o erro for do provedor (limite, saldo, fora do ar).
        const inicio = Date.now();
        let modeloUsado = "";
        for (const [index, modelo] of modelos.entries()) {
          try {
            await consumeModel(modelo);
            modeloUsado = modelo.id;
            // Terminou sem escrever nada: tenta o próximo modelo.
            if (!text.trim() && index < modelos.length - 1 && !signal.aborted) {
              console.error(`chat: ${modelo.id} respondeu vazio`);
              continue;
            }
            break;
          } catch (error) {
            const ultimo = index === modelos.length - 1;
            if (ultimo || text || signal.aborted || !erroDeProvedor(error))
              throw error;
            console.error(
              `chat: ${modelo.id} falhou, tentando o próximo`,
              statusDoErro(error),
              groqMessage(error),
            );
          }
        }
        emit(normalizer.flush());
        console.info(
          "chat: respondido",
          modeloUsado,
          `${Math.round((Date.now() - inicio) / 1000)}s`,
          `${consultas} consultas`,
          text.trim() ? "" : "(vazio)",
        );
        if (!text.trim()) throw new Error("Empty assistant response");
        // Validador: valores em reais sem nenhuma consulta aos dados nesta resposta.
        const aviso = avisoSemConsulta(text, consultas);
        if (aviso) emit(aviso);
        send({ type: "done", modelo: modeloUsado.replace(/^[a-z]+:/, "") });
      } catch (error) {
        console.error(
          "chat: falha da IA",
          (error as { statusCode?: number })?.statusCode ?? "",
          groqMessage(error),
        );
        if (!request.signal.aborted && !controller.signal.aborted)
          send({ type: "error", message: friendlyChatError(error) });
      } finally {
        try {
          output.close();
        } catch {
          /* The client may have cancelled the stream. */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
