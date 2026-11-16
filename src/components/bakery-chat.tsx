"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  Info,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Square,
  SquarePen,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./ai-elements/conversation";
import { MessageResponse } from "./ai-elements/message";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { SalesToolbar } from "./sales-filters";
import { useSalesFilters } from "@/lib/use-sales-filters";
import { presetOptions } from "@/lib/vendas";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state: "complete" | "streaming" | "failed" | "cancelled";
  period: string;
  /** Modelo que respondeu (ex.: deepseek/deepseek-v4.1-flash). */
  modelo?: string;
};
type HistoryMessage = { role: "user" | "assistant"; content: string };
const questions = [
  "Como foram as vendas de hoje até agora?",
  "Qual foi o ticket médio deste mês e como ele mudou?",
  "Quais dias e horários vendem mais?",
  "Quais produtos mais faturam nos últimos 30 dias?",
  "Compare esta semana com a semana passada.",
  "Que combos poderiam aumentar o ticket médio?",
];

// Celular/tablet: Enter quebra a linha (o teclado virtual não tem Shift
// fácil); envia pelo botão.
const coarsePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function BakeryChat({
  active,
  prefill,
  leading,
}: {
  active: boolean;
  prefill?: { text: string; nonce: number } | null;
  /** Conteúdo no início da barra, antes do filtro (abas da GuIA). */
  leading?: ReactNode;
}) {
  const filters = useSalesFilters();
  const { sync } = filters;
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastRequest = useRef<{
    question: string;
    history: HistoryMessage[];
    userId: string;
  } | null>(null);

  // O chat fica montado em segundo plano: ao voltar para ele, pega o
  // filtro que estiver nas outras telas.
  useEffect(() => {
    if (active) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    fetch("/api/chat", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) =>
        setConnection(result.configured ? "ready" : "unavailable"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setConnection("unavailable");
      });
    return () => controller.abort();
  }, [active]);
  useEffect(() => () => abortRef.current?.abort(), []);
  // Campo cresce com o texto (até o limite do CSS), como no Claude.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Escondido (outra aba), scrollHeight é 0: mede só quando visível.
    if (!active) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, active]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  // Pergunta vinda de outra tela ("Aprofundar com a GuIA").
  const handledPrefill = useRef(0);
  useEffect(() => {
    if (!prefill || !active || connection !== "ready") return;
    if (handledPrefill.current === prefill.nonce) return;
    handledPrefill.current = prefill.nonce;
    const run = () => {
      void send(prefill.text);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, active, connection]);

  async function send(question: string, retry = false) {
    if (abortRef.current || !question.trim() || connection !== "ready") return;
    const previous = retry ? lastRequest.current : null;
    const history =
      previous?.history ??
      entries
        .filter((entry) => entry.state === "complete" && entry.content.trim())
        .slice(-10)
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, 3500),
        }));
    while (
      history.reduce((sum, message) => sum + message.content.length, 0) > 12000
    )
      history.shift();
    const userId = previous?.userId ?? crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const { preset, range, situacao, today } = filters;
    const presetLabel =
      presetOptions(today).find((option) => option.value === preset)?.label ??
      "Personalizado";
    const period = `${presetLabel} · ${
      range.ini === range.fim
        ? dayLabel(range.ini)
        : `${dayLabel(range.ini)} – ${dayLabel(range.fim)}`
    }`;
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequest.current = { question: question.trim(), history, userId };
    setBusy(true);
    setError("");
    setAnnouncement("A GuIA está analisando os dados.");
    setInput("");
    setEntries((current) => [
      ...(previous
        ? current.slice(
            0,
            current.findIndex((entry) => entry.id === userId),
          )
        : current),
      {
        id: userId,
        role: "user",
        content: question.trim(),
        state: "complete",
        period,
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        state: "streaming",
        period,
      },
    ]);
    let answer = "";
    let done = false;
    let modelo = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: question.trim() }],
          filter: { preset, ini: range.ini, fim: range.fim, situacao },
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(55000),
        ]),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error ?? "Não foi possível conectar à IA. Tente novamente.",
        );
      }
      if (!response.body)
        throw new Error("A resposta não pôde ser recebida. Tente novamente.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "error")
          throw new Error(
            event.message || "A resposta foi interrompida. Tente novamente.",
          );
        if (event.type === "done") {
          done = true;
          modelo = typeof event.modelo === "string" ? event.modelo : "";
        }
        if (event.type === "delta" && typeof event.text === "string") {
          answer += event.text;
          setEntries((current) =>
            current.map((entry) =>
              entry.id === assistantId ? { ...entry, content: answer } : entry,
            ),
          );
        }
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(consume);
        }
        buffer += decoder.decode();
        if (buffer.trim()) consume(buffer);
      } finally {
        reader.releaseLock();
      }
      if (!done || !answer.trim())
        throw new Error(
          "A resposta foi interrompida antes de terminar. Tente novamente.",
        );
      setEntries((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? { ...entry, state: "complete", modelo }
            : entry,
        ),
      );
      setAnnouncement("Resposta da GuIA concluída.");
    } catch (issue) {
      const cancelled = controller.signal.aborted;
      const message = cancelled
        ? "Resposta interrompida. Você pode tentar novamente."
        : issue instanceof Error && issue.name === "TimeoutError"
          ? "A resposta demorou mais que o esperado. Tente novamente."
          : issue instanceof Error
            ? issue.message
            : "Não foi possível responder. Tente novamente.";
      setError(message);
      setAnnouncement(
        cancelled ? "Resposta interrompida." : "A resposta não foi concluída.",
      );
      setEntries((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? { ...entry, state: cancelled ? "cancelled" : "failed" }
            : entry,
        ),
      );
      if (!cancelled)
        setInput((current) => (current.trim() ? current : question));
    } finally {
      abortRef.current = null;
      setBusy(false);
      if (active) inputRef.current?.focus();
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim().length > 1000) {
      setError("Envie uma pergunta com até 1.000 caracteres.");
      inputRef.current?.focus();
      return;
    }
    void send(input);
  }

  function novaConversa() {
    if (busy) return;
    setEntries([]);
    setError("");
    setInput("");
    lastRequest.current = null;
    setAnnouncement("Nova conversa iniciada.");
    inputRef.current?.focus();
  }

  return (
    <div className="chat-app">
      <div className="chat-bar">
        <div className="chat-bar-start">
          {leading}
          <SalesToolbar
            filters={filters}
            loading={busy}
            label="Período da conversa"
            showRefresh={false}
          />
        </div>
        <div className="chat-bar-actions">
          <span
            className={`chat-connection ${connection === "ready" ? "connected" : ""}`}
          >
            <span />
            {connection === "checking"
              ? "Conectando…"
              : connection === "ready"
                ? "IA conectada"
                : "Indisponível"}
          </span>
          {entries.length > 0 && (
            <button
              type="button"
              className="chat-new"
              onClick={novaConversa}
              disabled={busy}
            >
              <SquarePen size={15} />
              <span>Nova conversa</span>
            </button>
          )}
        </div>
      </div>

      <Conversation
        className="chat-conversation"
        aria-label="Histórico da conversa"
        initial={false}
        resize="instant"
        aria-live="off"
      >
        <SemSeguirResposta
          ultimaPergunta={
            [...entries].reverse().find((e) => e.role === "user")?.id
          }
        />
        <ConversationContent className="chat-transcript">
          {!entries.length ? (
            <div className="chat-empty">
              <span className="chat-welcome-icon">
                <Sparkles size={28} />
              </span>
              <h2>O que você quer entender hoje?</h2>
              <p>
                Pergunte sobre faturamento, ticket médio, produtos, horários e
                formas de pagamento. A GuIA consulta as vendas do caixa para
                responder.
              </p>
              <div className="chat-starter-questions">
                {questions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={connection !== "ready" || busy}
                    onClick={() => void send(question)}
                  >
                    {question}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <details className="chat-about">
                <summary>
                  <Info size={14} />
                  De onde vêm as respostas
                </summary>
                <p>
                  A GuIA vê pedidos, faturamento, produtos, horários e formas de
                  pagamento do caixa, no período que você perguntar (ou no
                  filtro acima). Custos, estoque e lucro não estão nos dados,
                  então ela não calcula margem. Ela explica e sugere, mas não
                  altera nada na loja nem nos sistemas.
                </p>
                <p>
                  Sua pergunta e resumos das vendas (totais, sem dados de
                  clientes) são enviados ao provedor de IA (OpenRouter). A
                  conversa fica só nesta sessão.
                </p>
              </details>
            </div>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className={`chat-entry ${entry.role}`}
                data-entry={entry.id}
                aria-label={
                  entry.role === "user" ? "Sua mensagem" : "Resposta da GuIA"
                }
              >
                {entry.role === "assistant" && (
                  <div className="chat-entry-label">
                    <span className="chat-avatar" aria-hidden="true">
                      <Sparkles size={13} />
                    </span>
                    <span>GuIA</span>
                    <span className="chat-entry-period">{entry.period}</span>
                  </div>
                )}
                {entry.content ? (
                  entry.role === "assistant" ? (
                    <MessageResponse
                      className="chat-markdown"
                      isAnimating={entry.state === "streaming"}
                      controls={false}
                    >
                      {entry.content}
                    </MessageResponse>
                  ) : (
                    <p className="chat-user-text">{entry.content}</p>
                  )
                ) : entry.state === "streaming" ? (
                  <p className="chat-thinking">
                    <LoaderCircle size={15} className="chat-spinner" />
                    Consultando as vendas…
                  </p>
                ) : (
                  <p className="chat-interrupted">Resposta não concluída.</p>
                )}
                {entry.content &&
                  (entry.state === "cancelled" || entry.state === "failed") && (
                    <p className="chat-interrupted">
                      Resposta parcial · não concluída
                    </p>
                  )}
                {entry.role === "assistant" && entry.state === "complete" && (
                  <div className="chat-entry-actions">
                    <button
                      type="button"
                      className="chat-copy"
                      aria-label="Copiar resposta da GuIA"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(entry.content);
                          setCopied(entry.id);
                          setAnnouncement("Resposta copiada.");
                        } catch {
                          setAnnouncement(
                            "Não foi possível copiar. Selecione o texto para copiar manualmente.",
                          );
                        }
                      }}
                    >
                      {copied === entry.id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copied === entry.id ? "Copiado" : "Copiar"}
                    </button>
                    {entry.modelo && (
                      <span className="chat-model">
                        {entry.modelo.split("/").pop()}
                      </span>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </ConversationContent>
        {entries.length > 0 && (
          <ConversationScrollButton
            className="chat-scroll-button"
            aria-label="Ir para a última mensagem"
          >
            <ArrowDown size={16} />
          </ConversationScrollButton>
        )}
      </Conversation>

      <div className="chat-dock">
        <div className="chat-feedback" role="alert">
          {error && (
            <>
              <span>{error}</span>
              {entries.some((entry) => entry.role === "user") && !busy && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void send(lastRequest.current!.question, true)}
                >
                  <RefreshCw size={14} />
                  Tentar novamente
                </button>
              )}
            </>
          )}
          {connection === "unavailable" && !error && (
            <span>
              A IA não está disponível agora. Verifique a conexão ou a
              configuração da IA com o responsável.
            </span>
          )}
        </div>
        <form className="chat-composer" noValidate onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-question">
            Sua pergunta para a GuIA
          </label>
          <textarea
            id="chat-question"
            ref={inputRef}
            rows={1}
            maxLength={1000}
            value={input}
            placeholder="Pergunte à GuIA…"
            aria-describedby="chat-input-help"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                !coarsePointer()
              ) {
                event.preventDefault();
                if (!busy) event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="chat-composer-actions">
            <span id="chat-input-help">
              Enter envia · Shift + Enter quebra a linha
            </span>
            {busy ? (
              <button
                type="button"
                className="chat-send stop"
                aria-label="Interromper resposta"
                onClick={() => abortRef.current?.abort()}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                className="chat-send"
                aria-label="Enviar pergunta"
                disabled={!input.trim() || connection !== "ready"}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </form>
        <p className="chat-footnote">
          Sem período na pergunta, a GuIA usa o filtro acima. IA pode errar:
          confira os números antes de decidir.
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </div>
    </div>
  );
}

/**
 * Ao enviar uma pergunta, leva a pergunta para o topo da área do chat e
 * para de acompanhar o texto da resposta: quem lê decide quando rolar.
 */
function SemSeguirResposta({ ultimaPergunta }: { ultimaPergunta?: string }) {
  const { stopScroll, scrollRef } = useStickToBottomContext();
  useEffect(() => {
    if (!ultimaPergunta) return;
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-entry="${CSS.escape(ultimaPergunta)}"]`,
      );
      stopScroll();
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [ultimaPergunta, stopScroll, scrollRef]);
  return null;
}
