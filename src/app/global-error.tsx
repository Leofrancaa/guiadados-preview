"use client";

// Último recurso: erro no próprio layout. Precisa trazer <html> e <body>.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeContent: "center",
          gap: 12,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 22 }}>Algo deu errado</h1>
        <p>Não foi possível abrir o painel agora.</p>
        <button
          type="button"
          onClick={reset}
          style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600 }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
