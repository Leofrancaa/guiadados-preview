"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { periodoLabel } from "@/lib/financeiro/calculos";
import { montarRelatorio } from "@/lib/financeiro/relatorio-contas";
import type { Financeiro } from "@/lib/financeiro/use-financeiro";

/** Exporta as contas a pagar do mês para a contabilidade (Excel e PDF). */
export function ExportarContabilidade({
  fin,
  periodo,
  onMessage,
}: {
  fin: Financeiro;
  /** Mês (AAAA-MM) ou ano (AAAA) que está na tela. */
  periodo: string;
  onMessage: (t: string) => void;
}) {
  const [gerando, setGerando] = useState<"xlsx" | "pdf" | null>(null);

  async function exportar(formato: "xlsx" | "pdf") {
    const r = montarRelatorio(
      fin.dados!.lancamentos,
      periodo,
      fin.hoje,
      fin.empresa,
    );
    if (!r.linhas.length) {
      onMessage(`Nenhuma conta em ${periodoLabel(periodo)} para exportar.`);
      return;
    }
    setGerando(formato);
    try {
      const { exportarExcel, exportarPdf } =
        await import("@/lib/financeiro/exportar-contas");
      await (formato === "xlsx" ? exportarExcel(r) : exportarPdf(r));
      onMessage(
        `${formato === "xlsx" ? "Planilha" : "PDF"} de ${r.periodoExtenso} baixado (${r.linhas.length} contas).`,
      );
    } catch {
      onMessage("Não foi possível gerar o arquivo. Tente de novo.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <div
      className="fin-export"
      role="group"
      aria-label={`Exportar contas de ${periodoLabel(periodo)} para a contabilidade`}
    >
      <span className="fin-export-label">Contabilidade</span>
      <button
        className="button secondary"
        onClick={() => exportar("xlsx")}
        disabled={gerando !== null}
        title={`Planilha das contas de ${periodoLabel(periodo)}`}
      >
        {gerando === "xlsx" ? (
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
        ) : (
          <FileSpreadsheet size={15} aria-hidden="true" />
        )}
        Planilha
      </button>
      <button
        className="button secondary"
        onClick={() => exportar("pdf")}
        disabled={gerando !== null}
        title={`PDF das contas de ${periodoLabel(periodo)}`}
      >
        {gerando === "pdf" ? (
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
        ) : (
          <FileText size={15} aria-hidden="true" />
        )}
        PDF
      </button>
    </div>
  );
}
