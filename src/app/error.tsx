"use client";

// Erro inesperado numa tela: mostra um aviso com "tentar de novo" em vez de
// deixar o painel em branco.
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Algo deu errado</h1>
      <p style={{ maxWidth: 420 }}>
        Não foi possível mostrar esta tela agora. Seus dados continuam
        guardados.
      </p>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "1px solid currentColor",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        {/* Recarrega tudo: sai de um estado quebrado que o reset não resolve. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ padding: "10px 18px", fontWeight: 600 }}>
          Voltar ao início
        </a>
      </div>
    </main>
  );
}
