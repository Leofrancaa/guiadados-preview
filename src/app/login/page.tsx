import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { GuiaLogo } from "@/components/guia-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · GuIA Dados" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/segmento");
  return (
    <main className="login-shell">
      <section className="panel login-card" aria-labelledby="login-title">
        <GuiaLogo className="login-logo" />
        <h1 id="login-title">Demonstração do painel</h1>
        <p>Entre com o acesso que você recebeu da GuIA Dados.</p>
        <LoginForm />
        <p className="login-hint">
          Os números desta demonstração são fictícios.
        </p>
      </section>
    </main>
  );
}
