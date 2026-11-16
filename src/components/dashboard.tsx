"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Sparkles,
  Trophy,
  Repeat,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BakeryChat } from "./bakery-chat";
import { GuiaLogo } from "./guia-logo";
import { ProductsView } from "./products-view";
import { SegmentoIcone } from "./demo/segmento-icone";
import type { SegmentoResumo } from "@/lib/demo/segmentos";
import { RealSales } from "./real-sales";
import { canAccess, roleLabels, type Role } from "@/lib/roles";
import { logout } from "@/app/login/actions";

// Telas que não abrem primeiro só são baixadas quando a pessoa entra nelas
// (quem é da gerência nunca baixa o financeiro).
const carregando = () => (
  <p role="status" style={{ padding: 24 }}>
    Carregando…
  </p>
);
const FinanceiroView = dynamic(
  () => import("./financeiro/financeiro-view").then((m) => m.FinanceiroView),
  { loading: carregando },
);
const InsightsView = dynamic(
  () => import("./insights-view").then((m) => m.InsightsView),
  { loading: carregando },
);
const RetrospectiveView = dynamic(
  () => import("./retrospective-view").then((m) => m.RetrospectiveView),
  { loading: carregando },
);

type View =
  "vendas" | "produtos" | "financeiro" | "retrospectiva" | "insights" | "chat";

const navigation: {
  id: View;
  title: string;
  short: string;
  heading: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "vendas",
    short: "Visão geral",
    title: "Visão geral",
    heading: "Visão geral",
    description:
      "A história do período em capítulos: como foi, quando a loja vende, como o cliente compra e o que mais vende. Direto do caixa.",
    icon: LayoutDashboard,
  },
  {
    id: "produtos",
    short: "Produtos",
    title: "Produtos",
    heading: "Produtos",
    description:
      "Quem sustenta o faturamento, o que está subindo ou caindo e a ficha completa de cada item.",
    icon: Package,
  },
  {
    id: "financeiro",
    short: "Financeiro",
    title: "Financeiro",
    heading: "Financeiro",
    description:
      "Despesas, contas a pagar, equipe e o resultado de cada mês. Quanto entra, quanto sai e quanto a loja precisa vender por dia.",
    icon: Wallet,
  },
  {
    id: "retrospectiva",
    short: "Recordes",
    title: "Retrospectiva",
    heading: "Retrospectiva",
    description:
      "O dia que mais vendeu no ano ou no mês, o que aconteceu nele e os recordes do período.",
    icon: Trophy,
  },
  {
    id: "insights",
    short: "Insights",
    title: "Insights da GuIA",
    heading: "Insights da GuIA",
    description:
      "A inteligência artificial lê as vendas e aponta oportunidades, alertas e combos para testar.",
    icon: Sparkles,
  },
  {
    id: "chat",
    short: "GuIA",
    title: "Conversar com a GuIA",
    heading: "Conversar com a GuIA",
    description:
      "Pergunte sobre as vendas e entenda os números em linguagem simples.",
    icon: MessageCircle,
  },
];

const isGuia = (id: View) => id === "chat" || id === "insights";

export function Dashboard({
  role,
  userName,
  segmento,
}: {
  role: Role;
  userName?: string;
  segmento: SegmentoResumo;
}) {
  const allowed = navigation.filter((item) => canAccess(role, item.id));
  const home = allowed[0].id;
  const [view, setView] = useState<View>(home);
  const [message, setMessage] = useState("");
  const [prefill, setPrefill] = useState<{
    text: string;
    nonce: number;
  } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = navigation.find((item) => item.id === view)!;
  // Insights e chat ficam juntos em uma só entrada "GuIA" no menu (com abas na
  // página), para o menu do celular não ficar apertado.
  const guiaTarget: View | null = canAccess(role, "chat")
    ? "chat"
    : canAccess(role, "insights")
      ? "insights"
      : null;
  const navItems = [
    ...allowed.filter((item) => !isGuia(item.id)),
    ...(guiaTarget
      ? [
          {
            ...navigation.find((item) => item.id === guiaTarget)!,
            title: "GuIA",
            short: "GuIA",
            icon: Sparkles,
          },
        ]
      : []),
  ];
  const guiaTabs = (["chat", "insights"] as const).filter((id) =>
    canAccess(role, id),
  );

  useEffect(() => {
    const restore = () => {
      const section = new URLSearchParams(window.location.search).get(
        "view",
      ) as View;
      setView(
        navigation.some((item) => item.id === section) &&
          canAccess(role, section)
          ? section
          : home,
      );
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [role, home]);

  useEffect(() => {
    document.title = `${current.title} · ${segmento.empresa}`;
  }, [current.title, segmento.empresa]);

  function navigate(next: View) {
    if (!canAccess(role, next)) return;
    setView(next);
    setMessage("");
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    window.history.pushState({}, "", `?${params}`);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  const guiaNav =
    guiaTabs.length > 1 ? (
      <nav className="fin-tabs guia-tabs" aria-label="Seções da GuIA">
        {guiaTabs.map((id) => {
          const Icon = id === "chat" ? MessageCircle : Sparkles;
          const label = id === "chat" ? "Conversar" : "Insights";
          return (
            <button
              key={id}
              className={view === id ? "selected" : ""}
              aria-current={view === id ? "page" : undefined}
              aria-label={label}
              onClick={() => navigate(id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="guia-tab-label">{label}</span>
            </button>
          );
        })}
      </nav>
    ) : null;

  // "Aprofundar com a GuIA": abre o chat já com a pergunta.
  const ask = canAccess(role, "chat")
    ? (text: string) => {
        setPrefill((current) => ({ text, nonce: (current?.nonce ?? 0) + 1 }));
        navigate("chat");
      }
    : undefined;

  return (
    <div className={`app-shell ${view === "chat" ? "chat-mode" : ""}`}>
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link
          className="brand brand-demo"
          href="/"
          aria-label={`${segmento.empresa}, início`}
        >
          <span className="brand-symbol">
            <SegmentoIcone nome={segmento.icone} size={24} />
          </span>
          <span>
            {segmento.empresa}
            <span className="brand-description">
              {segmento.slogan.toUpperCase()}
            </span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">{segmento.empresa.charAt(0)}</span>
          <div>
            <strong>{segmento.lojas}</strong>
            <span>{segmento.local}</span>
          </div>
        </div>
        <Link className="seg-switch" href="/segmento">
          <Repeat size={14} aria-hidden="true" />
          Trocar tipo de negócio
        </Link>
        <span className="nav-label">{segmento.nome.toUpperCase()}</span>
        <nav aria-label="Menu principal">
          {navItems.map(({ id, title, short, icon: Icon }) => {
            const active = id === view || (isGuia(id) && isGuia(view));
            return (
              <button
                key={id}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={title}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                <span className="nav-long">{title}</span>
                <span className="nav-short" aria-hidden="true">
                  {short}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="powered">
            <GuiaLogo className="guia-logo" />
            <span>
              Dados que ajudam
              <br />a decidir melhor.
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {segmento.empresa} <ChevronRight size={14} />
            <span>{current.title}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-badge fin-demo-badge">
              <span />
              Demonstração · dados fictícios
            </span>
            <span className="role-badge">
              {userName && userName !== roleLabels[role]
                ? `${userName} · ${roleLabels[role]}`
                : roleLabels[role]}
            </span>
            <form action={logout}>
              <button className="button secondary logout-button" type="submit">
                <LogOut size={15} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="page-content">
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {current.heading}
              </h1>
              <p>{current.description}</p>
            </div>
          </div>
          {view === "insights" && guiaNav}
          <div
            className={`status-banner ${message ? "visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>

          {view === "vendas" && (
            <RealSales
              onMessage={setMessage}
              onNavigate={navigate}
              onAsk={ask}
              canInsights={canAccess(role, "insights")}
              canDatas={canAccess(role, "retrospectiva")}
            />
          )}
          {view === "produtos" && <ProductsView onMessage={setMessage} />}
          {view === "financeiro" && <FinanceiroView onMessage={setMessage} />}
          {view === "retrospectiva" && <RetrospectiveView onAsk={ask} />}
          {view === "insights" && <InsightsView onAsk={ask} />}

          {canAccess(role, "chat") && (
            <div className="chat-host" hidden={view !== "chat"}>
              <BakeryChat
                active={view === "chat"}
                prefill={prefill}
                leading={guiaNav}
              />
            </div>
          )}

          <footer className="page-footer">
            <span>
              {segmento.empresa} <span className="footer-dot">·</span> empresa
              fictícia de demonstração
            </span>
            <span>GuIA Dados · dados gerados para demonstração</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
