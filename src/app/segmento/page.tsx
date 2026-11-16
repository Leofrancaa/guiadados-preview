import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { segmentoEscolhido } from "@/lib/demo/segmento-server";
import { SEGMENTOS } from "@/lib/demo/segmentos";
import { GuiaLogo } from "@/components/guia-logo";
import { SegmentoIcone } from "@/components/demo/segmento-icone";
import { logout } from "@/app/login/actions";
import { escolherSegmento } from "./actions";

export const metadata: Metadata = {
  title: "Escolha o seu negócio · GuIA Dados",
};

export default async function SegmentoPage() {
  if (!(await getSession())) redirect("/login");
  const atual = await segmentoEscolhido();
  return (
    <main className="seg-shell">
      <header className="seg-top">
        <GuiaLogo className="seg-logo" />
        <form action={logout}>
          <button className="button secondary logout-button" type="submit">
            <LogOut size={15} />
            Sair
          </button>
        </form>
      </header>
      <section className="seg-intro" aria-labelledby="seg-title">
        <span className="seg-kicker">Demonstração · dados fictícios</span>
        <h1 id="seg-title">Qual é o tipo do seu negócio?</h1>
        <p>
          Escolha o segmento mais parecido com o seu. O painel abre com uma
          empresa de exemplo em Salvador, com dois anos de vendas (2025 e 2026
          até hoje), produtos e datas típicas do setor. Dá para trocar a
          qualquer momento.
        </p>
      </section>
      <form action={escolherSegmento} className="seg-grid">
        {SEGMENTOS.map((s) => (
          <button
            key={s.id}
            type="submit"
            name="segmento"
            value={s.id}
            className={`seg-card ${atual?.id === s.id ? "is-current" : ""}`}
            aria-label={`${s.nome}: ${s.empresa}`}
          >
            <span className="seg-icon">
              <SegmentoIcone nome={s.icone} size={22} />
            </span>
            <strong>{s.nome}</strong>
            <span className="seg-desc">{s.resumo}</span>
            <span className="seg-chips">
              {s.exemplos.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </span>
            <span className="seg-empresa">
              Exemplo: {s.empresa}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
            {atual?.id === s.id && <span className="seg-atual">Atual</span>}
          </button>
        ))}
      </form>
      <p className="seg-note">
        Todos os números são gerados para demonstração e não pertencem a nenhuma
        empresa real. Com a GuIA, o painel usa os dados do seu caixa.
      </p>
    </main>
  );
}
