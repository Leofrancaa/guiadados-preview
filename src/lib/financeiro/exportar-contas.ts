// Exporta o relatório de contas a pagar para a contabilidade (Excel e PDF).
// As bibliotecas só carregam no clique, para não pesar a abertura do painel.
import type { Relatorio } from "./relatorio-contas";

const COR = {
  marca: "BD480C",
  tinta: "282925",
  suave: "6D716B",
  borda: "E5E7E0",
  zebra: "F7F8F5",
  grupo: "FCF0E7",
  ok: "426148",
  okFundo: "EDF3E9",
  alerta: "825615",
  alertaFundo: "FFF4D9",
  perigo: "AC3535",
  perigoFundo: "FBECEC",
};
const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const FONTE = "Calibri";

const dataBr = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const emissao = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
/** Data do ISO como meia-noite UTC: o Excel mostra o mesmo dia em qualquer fuso. */
const dataExcel = (iso: string) => new Date(`${iso}T00:00:00Z`);

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const corSituacao = (s: string) =>
  s === "Pago"
    ? [COR.ok, COR.okFundo]
    : s === "Atrasado"
      ? [COR.perigo, COR.perigoFundo]
      : s === "Vence hoje"
        ? [COR.alerta, COR.alertaFundo]
        : [COR.tinta, "FFFFFF"];

// ------------------------------------------------------------------ Excel
export async function gerarExcel(r: Relatorio) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GuIA";
  wb.company = r.empresa;
  wb.title = `Contas a pagar – ${r.periodoExtenso}`;
  wb.created = r.emitidoEm;

  type Ws = ReturnType<typeof wb.addWorksheet>;
  const fill = (argb: string) =>
    ({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${argb}` },
    }) as const;
  const linhaFina = {
    style: "thin",
    color: { argb: `FF${COR.borda}` },
  } as const;

  function cabecalho(ws: Ws, titulo: string, ultimaCol: string) {
    ws.mergeCells(`A1:${ultimaCol}1`);
    ws.mergeCells(`A2:${ultimaCol}2`);
    const t = ws.getCell("A1");
    t.value = `${r.empresa.toUpperCase()}  ·  ${titulo}`;
    t.font = {
      name: FONTE,
      size: 16,
      bold: true,
      color: { argb: `FF${COR.tinta}` },
    };
    t.alignment = { vertical: "middle" };
    ws.getRow(1).height = 30;
    const s = ws.getCell("A2");
    s.value = `Competência: ${r.periodoExtenso}   |   Emitido em ${emissao(r.emitidoEm)}`;
    s.font = { name: FONTE, size: 10, color: { argb: `FF${COR.suave}` } };
    ws.getRow(2).height = 18;
    // Faixa da marca sob o título.
    ws.getRow(3).height = 4;
    for (let c = 1; c <= ws.getColumn(ultimaCol).number; c++)
      ws.getRow(3).getCell(c).fill = fill(COR.marca);
  }

  function estiloCabecalhoTabela(ws: Ws, linha: number, colunas: number) {
    const row = ws.getRow(linha);
    row.height = 22;
    for (let c = 1; c <= colunas; c++) {
      const cell = row.getCell(c);
      cell.font = {
        name: FONTE,
        size: 10,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = fill(COR.tinta);
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
    }
  }

  function configurarImpressao(ws: Ws, repetir: string) {
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.6,
        header: 0.2,
        footer: 0.25,
      },
      printTitlesRow: repetir,
    };
    ws.headerFooter = {
      oddFooter: `&L&8${r.empresa} · Contas a pagar · ${r.periodoExtenso}&R&8Página &P de &N`,
    };
  }

  // ---------------- Aba 1: lançamentos
  const ws = wb.addWorksheet("Contas a pagar", {
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
  });
  ws.columns = [
    { key: "n", width: 6 },
    { key: "venc", width: 12 },
    { key: "pag", width: 12 },
    { key: "desc", width: 42 },
    { key: "cat", width: 30 },
    { key: "grupo", width: 30 },
    { key: "comp", width: 12 },
    { key: "forma", width: 16 },
    { key: "sit", width: 12 },
    { key: "valor", width: 16 },
    { key: "obs", width: 44 },
  ];
  cabecalho(ws, "RELATÓRIO DE CONTAS A PAGAR", "K");

  const ini = 9;
  const fim = ini + r.linhas.length - 1;
  const faixa = (col: string) => `$${col}$${ini}:$${col}$${Math.max(fim, ini)}`;
  // Indicadores com fórmula: se a contabilidade editar a tabela, eles acompanham.
  const kpis: [string, string, string, number][] = [
    [
      "A",
      r.anual ? "Total do ano" : "Total do mês",
      `SUM(${faixa("J")})`,
      r.total,
    ],
    ["D", "Pago", `SUMIFS(${faixa("J")},${faixa("I")},"Pago")`, r.pago],
    [
      "E",
      "Em aberto",
      `SUM(${faixa("J")})-SUMIFS(${faixa("J")},${faixa("I")},"Pago")`,
      r.aberto,
    ],
    [
      "F",
      "Atrasado",
      `SUMIFS(${faixa("J")},${faixa("I")},"Atrasado")`,
      r.atrasado,
    ],
    ["H", "Lançamentos", `COUNT(${faixa("J")})`, r.linhas.length],
  ];
  ws.mergeCells("A5:C5");
  ws.mergeCells("A6:C6");
  ws.mergeCells("H5:I5");
  ws.mergeCells("H6:I6");
  ws.getRow(5).height = 16;
  ws.getRow(6).height = 26;
  for (const [col, rotulo, formula, valor] of kpis) {
    const l = ws.getCell(`${col}5`);
    l.value = rotulo.toUpperCase();
    l.font = {
      name: FONTE,
      size: 8,
      bold: true,
      color: { argb: `FF${COR.suave}` },
    };
    const v = ws.getCell(`${col}6`);
    v.value = { formula, result: valor };
    v.numFmt = rotulo === "Lançamentos" ? "0" : MOEDA;
    v.font = {
      name: FONTE,
      size: 15,
      bold: true,
      color: {
        argb: `FF${rotulo === "Atrasado" && valor > 0 ? COR.perigo : COR.tinta}`,
      },
    };
    v.alignment = { horizontal: "left", vertical: "middle" };
    l.border = { left: { style: "medium", color: { argb: `FF${COR.marca}` } } };
    v.border = { left: { style: "medium", color: { argb: `FF${COR.marca}` } } };
  }

  const cab = [
    "Nº",
    "Vencimento",
    "Pagamento",
    "Descrição / fornecedor",
    "Categoria",
    "Grupo contábil",
    "Competência",
    "Forma de pagamento",
    "Situação",
    "Valor (R$)",
    "Observações",
  ];
  ws.getRow(8).values = cab;
  estiloCabecalhoTabela(ws, 8, cab.length);
  ws.getCell("J8").alignment = { horizontal: "right", vertical: "middle" };

  r.linhas.forEach((l, i) => {
    const row = ws.getRow(ini + i);
    row.values = [
      l.n,
      dataExcel(l.vencimento),
      l.pagamento ? dataExcel(l.pagamento) : null,
      l.descricao,
      l.categoria,
      l.grupo,
      dataExcel(`${l.competencia}-01`),
      l.forma || "—",
      l.situacao,
      l.valor,
      l.obs,
    ];
    row.font = { name: FONTE, size: 10, color: { argb: `FF${COR.tinta}` } };
    row.height = 17;
    for (let c = 1; c <= cab.length; c++) {
      const cell = row.getCell(c);
      if (i % 2) cell.fill = fill(COR.zebra);
      cell.border = { bottom: linhaFina };
      cell.alignment = { vertical: "middle" };
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).numFmt = "dd/mm/yyyy";
    row.getCell(3).numFmt = "dd/mm/yyyy";
    row.getCell(7).numFmt = "mm/yyyy";
    row.getCell(10).numFmt = MOEDA;
    const [cor, fundo] = corSituacao(l.situacao);
    const sit = row.getCell(9);
    sit.font = {
      name: FONTE,
      size: 10,
      bold: true,
      color: { argb: `FF${cor}` },
    };
    if (fundo !== "FFFFFF") sit.fill = fill(fundo);
    if (l.categoria === "A classificar")
      row.getCell(5).font = {
        name: FONTE,
        size: 10,
        italic: true,
        color: { argb: `FF${COR.alerta}` },
      };
    row.getCell(11).font = {
      name: FONTE,
      size: 9,
      color: { argb: `FF${COR.suave}` },
    };
  });

  const tot = ws.getRow(fim + 1);
  ws.mergeCells(`A${fim + 1}:I${fim + 1}`);
  tot.getCell(1).value = "TOTAL (respeita os filtros da tabela)";
  // SUBTOTAL(109): soma só as linhas visíveis quando a contabilidade filtra.
  tot.getCell(10).value = {
    formula: `SUBTOTAL(109,${faixa("J")})`,
    result: r.total,
  };
  tot.getCell(10).numFmt = MOEDA;
  tot.height = 22;
  for (let c = 1; c <= cab.length; c++) {
    const cell = tot.getCell(c);
    cell.font = {
      name: FONTE,
      size: 11,
      bold: true,
      color: { argb: `FF${COR.tinta}` },
    };
    cell.fill = fill(COR.grupo);
    cell.border = {
      top: { style: "medium", color: { argb: `FF${COR.marca}` } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 ? "right" : undefined,
    };
  }
  ws.autoFilter = {
    from: { row: 8, column: 1 },
    to: { row: Math.max(fim, 8), column: 11 },
  };
  configurarImpressao(ws, "8:8");

  // ---------------- Aba 2: resumo por grupo e categoria (fórmulas sobre a aba 1)
  const rs = wb.addWorksheet("Resumo por categoria", {
    views: [{ showGridLines: false }],
  });
  rs.columns = [
    { width: 38 },
    { width: 36 },
    { width: 9 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 11 },
  ];
  cabecalho(rs, "RESUMO POR CATEGORIA", "G");
  rs.getRow(5).values = [
    "Grupo contábil",
    "Categoria",
    "Qtde",
    "Total",
    "Pago",
    "Em aberto",
    "% do total",
  ];
  estiloCabecalhoTabela(rs, 5, 7);
  for (const c of [3, 4, 5, 6, 7])
    rs.getRow(5).getCell(c).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

  const aba = "'Contas a pagar'!";
  const ref = (col: string) => `${aba}${faixa(col)}`;
  let li = 6;
  const linhasGrupo: number[] = [];
  const totalRef = `$D$__TOTAL__`;
  const formulasPct: { cell: ReturnType<Ws["getCell"]>; row: number }[] = [];
  for (const g of r.grupos) {
    const lg = li++;
    linhasGrupo.push(lg);
    const rowG = rs.getRow(lg);
    const primeiro = li;
    const ultimo = li + g.categorias.length - 1;
    rowG.values = [g.grupo, "", null, null, null, null, null];
    rowG.getCell(3).value = {
      formula: `SUM(C${primeiro}:C${ultimo})`,
      result: g.categorias.reduce((s, c) => s + c.qtde, 0),
    };
    rowG.getCell(4).value = {
      formula: `SUM(D${primeiro}:D${ultimo})`,
      result: g.total,
    };
    rowG.getCell(5).value = {
      formula: `SUM(E${primeiro}:E${ultimo})`,
      result: g.pago,
    };
    rowG.getCell(6).value = {
      formula: `SUM(F${primeiro}:F${ultimo})`,
      result: g.aberto,
    };
    formulasPct.push({ cell: rowG.getCell(7), row: lg });
    for (let c = 1; c <= 7; c++) {
      const cell = rowG.getCell(c);
      cell.font = {
        name: FONTE,
        size: 10.5,
        bold: true,
        color: { argb: `FF${COR.tinta}` },
      };
      cell.fill = fill(COR.grupo);
      cell.border = { top: linhaFina, bottom: linhaFina };
    }
    rowG.height = 20;
    for (const c of g.categorias) {
      const row = rs.getRow(li);
      const crit = `${ref("E")},$B${li}`;
      row.values = ["", c.categoria];
      row.getCell(3).value = { formula: `COUNTIFS(${crit})`, result: c.qtde };
      row.getCell(4).value = {
        formula: `SUMIFS(${ref("J")},${crit})`,
        result: c.total,
      };
      row.getCell(5).value = {
        formula: `SUMIFS(${ref("J")},${crit},${ref("I")},"Pago")`,
        result: c.pago,
      };
      row.getCell(6).value = { formula: `D${li}-E${li}`, result: c.aberto };
      formulasPct.push({ cell: row.getCell(7), row: li });
      row.font = {
        name: FONTE,
        size: 10,
        color: {
          argb: `FF${c.categoria === "A classificar" ? COR.alerta : COR.tinta}`,
        },
        italic: c.categoria === "A classificar",
      };
      for (let k = 1; k <= 7; k++)
        rs.getRow(li).getCell(k).border = { bottom: linhaFina };
      li++;
    }
  }
  const lt = li;
  const rowT = rs.getRow(lt);
  const somaGrupos = (col: string) =>
    linhasGrupo.map((n) => `${col}${n}`).join(",") || "0";
  rowT.values = ["TOTAL GERAL", ""];
  rowT.getCell(3).value = {
    formula: `SUM(${somaGrupos("C")})`,
    result: r.linhas.length,
  };
  rowT.getCell(4).value = {
    formula: `SUM(${somaGrupos("D")})`,
    result: r.total,
  };
  rowT.getCell(5).value = {
    formula: `SUM(${somaGrupos("E")})`,
    result: r.pago,
  };
  rowT.getCell(6).value = {
    formula: `SUM(${somaGrupos("F")})`,
    result: r.aberto,
  };
  rowT.getCell(7).value = {
    formula: `IF(D${lt}=0,0,D${lt}/D${lt})`,
    result: r.total ? 1 : 0,
  };
  for (const { cell, row } of formulasPct) {
    const val = rs.getRow(row).getCell(4).value as { result: number };
    cell.value = {
      formula: `IF(${totalRef.replace("__TOTAL__", String(lt))}=0,0,D${row}/${totalRef.replace("__TOTAL__", String(lt))})`,
      result: r.total ? val.result / r.total : 0,
    };
  }
  rowT.height = 24;
  for (let c = 1; c <= 7; c++) {
    const cell = rowT.getCell(c);
    cell.font = {
      name: FONTE,
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = fill(COR.tinta);
    cell.alignment = { vertical: "middle" };
  }
  for (let n = 6; n <= lt; n++) {
    for (const c of [4, 5, 6]) rs.getRow(n).getCell(c).numFmt = MOEDA;
    rs.getRow(n).getCell(7).numFmt = "0.0%";
    rs.getRow(n).getCell(3).numFmt = "0";
  }
  let nota = lt + 2;
  const notas = [
    `Valores somados por fórmula a partir da aba "Contas a pagar": editar uma categoria lá atualiza este resumo.`,
    `"Sócios (retiradas e gastos pessoais)" reúne pagamentos de natureza pessoal; avaliar se devem compor a despesa da empresa.`,
    `"Faturas de cartão de crédito" podem conter compras também lançadas individualmente; conferir para não duplicar despesa.`,
  ];
  if (r.aClassificar)
    notas.unshift(
      `${r.aClassificar} lançamento(s) estão como "A classificar" e precisam de definição de categoria.`,
    );
  rs.getCell(`A${nota}`).value = "Observações";
  rs.getCell(`A${nota}`).font = {
    name: FONTE,
    size: 10,
    bold: true,
    color: { argb: `FF${COR.tinta}` },
  };
  for (const t of notas) {
    nota++;
    rs.mergeCells(`A${nota}:G${nota}`);
    const c = rs.getCell(`A${nota}`);
    c.value = `• ${t}`;
    c.font = { name: FONTE, size: 9, color: { argb: `FF${COR.suave}` } };
  }
  configurarImpressao(rs, "5:5");

  // ---------------- Aba 3: fluxo por vencimento (mês) ou por competência (ano)
  const fluxo = r.anual
    ? r.meses.map((m) => ({ ...m, data: `${m.mes}-01` }))
    : r.dias;
  const fv = wb.addWorksheet(r.anual ? "Por mês" : "Por vencimento", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });
  fv.columns = [
    { width: 14 },
    { width: 14 },
    { width: 9 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 19 },
  ];
  cabecalho(
    fv,
    r.anual ? "CONTAS POR MÊS DE COMPETÊNCIA" : "CONTAS POR DATA DE VENCIMENTO",
    "G",
  );
  fv.getRow(5).values = [
    r.anual ? "Competência" : "Vencimento",
    r.anual ? "Mês" : "Dia da semana",
    "Qtde",
    "Total",
    "Pago",
    "Em aberto",
    r.anual ? "Acumulado no ano" : "Acumulado no mês",
  ];
  estiloCabecalhoTabela(fv, 5, 7);
  let acum = 0;
  fluxo.forEach((d, i) => {
    const n = 6 + i;
    const row = fv.getRow(n);
    acum += d.total;
    const crit = `${ref(r.anual ? "G" : "B")},$A${n}`;
    row.values = [dataExcel(d.data)];
    row.getCell(2).value = new Intl.DateTimeFormat(
      "pt-BR",
      r.anual
        ? { month: "long", timeZone: "UTC" }
        : { weekday: "long", timeZone: "UTC" },
    ).format(dataExcel(d.data));
    row.getCell(3).value = { formula: `COUNTIFS(${crit})`, result: d.qtde };
    row.getCell(4).value = {
      formula: `SUMIFS(${ref("J")},${crit})`,
      result: d.total,
    };
    row.getCell(5).value = {
      formula: `SUMIFS(${ref("J")},${crit},${ref("I")},"Pago")`,
      result: d.pago,
    };
    row.getCell(6).value = {
      formula: `D${n}-E${n}`,
      result: Math.round((d.total - d.pago) * 100) / 100,
    };
    row.getCell(7).value = {
      formula: i ? `G${n - 1}+D${n}` : `D${n}`,
      result: Math.round(acum * 100) / 100,
    };
    row.font = { name: FONTE, size: 10, color: { argb: `FF${COR.tinta}` } };
    row.getCell(1).numFmt = r.anual ? "mm/yyyy" : "dd/mm/yyyy";
    for (const c of [4, 5, 6, 7]) row.getCell(c).numFmt = MOEDA;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      if (i % 2) cell.fill = fill(COR.zebra);
      cell.border = { bottom: linhaFina };
    }
  });
  const ft = 6 + fluxo.length;
  const rowF = fv.getRow(ft);
  rowF.values = ["TOTAL", ""];
  const ultimaDia = Math.max(ft - 1, 6);
  rowF.getCell(3).value = {
    formula: `SUM(C6:C${ultimaDia})`,
    result: r.linhas.length,
  };
  rowF.getCell(4).value = { formula: `SUM(D6:D${ultimaDia})`, result: r.total };
  rowF.getCell(5).value = { formula: `SUM(E6:E${ultimaDia})`, result: r.pago };
  rowF.getCell(6).value = {
    formula: `SUM(F6:F${ultimaDia})`,
    result: r.aberto,
  };
  for (let c = 1; c <= 7; c++) {
    const cell = rowF.getCell(c);
    cell.font = {
      name: FONTE,
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = fill(COR.tinta);
    if (c >= 4) cell.numFmt = MOEDA;
  }
  rowF.height = 22;
  configurarImpressao(fv, "5:5");

  return wb.xlsx.writeBuffer();
}

export async function exportarExcel(r: Relatorio) {
  const buf = await gerarExcel(r);
  baixar(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${r.arquivo}.xlsx`,
  );
}

// ------------------------------------------------------------------ PDF
export async function gerarPdf(r: Relatorio) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Cabeçalho da primeira página
  doc.setFillColor(...rgb(COR.marca));
  doc.rect(0, 0, W, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(COR.marca));
  doc.text(r.empresa.toUpperCase(), M, 13);
  doc.setFontSize(18);
  doc.setTextColor(...rgb(COR.tinta));
  doc.text("Relatório de Contas a Pagar", M, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(COR.suave));
  doc.text(
    `Competência: ${r.periodoExtenso}   |   Emitido em ${emissao(r.emitidoEm)}`,
    M,
    27,
  );

  // Indicadores
  const kpis: [string, string, string][] = [
    [r.anual ? "Total do ano" : "Total do mês", brl(r.total), COR.tinta],
    ["Pago", brl(r.pago), COR.ok],
    ["Em aberto", brl(r.aberto), COR.tinta],
    ["Atrasado", brl(r.atrasado), r.atrasado > 0 ? COR.perigo : COR.tinta],
    ["Lançamentos", String(r.linhas.length), COR.tinta],
  ];
  const gap = 4;
  const kw = (W - 2 * M - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([rot, val, cor], i) => {
    const x = M + i * (kw + gap);
    doc.setFillColor(...rgb(COR.zebra));
    doc.setDrawColor(...rgb(COR.borda));
    doc.roundedRect(x, 32, kw, 17, 1.5, 1.5, "FD");
    doc.setFillColor(...rgb(COR.marca));
    doc.rect(x, 32, 1.2, 17, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(COR.suave));
    doc.text(rot.toUpperCase(), x + 4, 38);
    doc.setFontSize(13);
    doc.setTextColor(...rgb(cor));
    doc.text(val, x + 4, 45.5);
  });

  const estiloBase = {
    font: "helvetica",
    fontSize: 8,
    textColor: rgb(COR.tinta),
    lineColor: rgb(COR.borda),
    lineWidth: 0.1,
    cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
  };
  const cabecalhoTabela = {
    fillColor: rgb(COR.tinta),
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    fontSize: 8,
  };
  const titulo = (txt: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...rgb(COR.tinta));
    doc.text(txt, M, y);
  };

  // Resumo por grupo e categoria
  titulo("Resumo por grupo e categoria", 57);
  const corpoResumo: (string | { content: string; styles: object })[][] = [];
  for (const g of r.grupos) {
    const st = { fontStyle: "bold", fillColor: rgb(COR.grupo) };
    corpoResumo.push([
      { content: g.grupo, styles: st },
      {
        content: String(g.categorias.reduce((s, c) => s + c.qtde, 0)),
        styles: { ...st, halign: "right" },
      },
      { content: brl(g.total), styles: { ...st, halign: "right" } },
      { content: brl(g.pago), styles: { ...st, halign: "right" } },
      { content: brl(g.aberto), styles: { ...st, halign: "right" } },
      {
        content: r.total
          ? `${((g.total / r.total) * 100).toFixed(1).replace(".", ",")}%`
          : "–",
        styles: { ...st, halign: "right" },
      },
    ]);
    for (const c of g.categorias)
      corpoResumo.push([
        {
          content: `    ${c.categoria}`,
          styles:
            c.categoria === "A classificar"
              ? { fontStyle: "italic", textColor: rgb(COR.alerta) }
              : {},
        },
        String(c.qtde),
        brl(c.total),
        brl(c.pago),
        brl(c.aberto),
        r.total
          ? `${((c.total / r.total) * 100).toFixed(1).replace(".", ",")}%`
          : "–",
      ]);
  }
  autoTable(doc, {
    startY: 60,
    margin: { left: M, right: M, top: 16, bottom: 14 },
    showFoot: "lastPage",
    head: [
      ["Grupo / categoria", "Qtde", "Total", "Pago", "Em aberto", "% do total"],
    ],
    body: corpoResumo,
    foot: [
      [
        "TOTAL GERAL",
        String(r.linhas.length),
        brl(r.total),
        brl(r.pago),
        brl(r.aberto),
        "100,0%",
      ],
    ],
    styles: estiloBase,
    headStyles: cabecalhoTabela,
    footStyles: { ...cabecalhoTabela, fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 16 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 32 },
      5: { halign: "right", cellWidth: 22 },
    },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index > 0)
        d.cell.styles.halign = "right";
      if (d.section === "foot" && d.column.index > 0)
        d.cell.styles.halign = "right";
    },
  });

  // Observações para a contabilidade, logo abaixo do resumo
  const notas = [
    ...(r.aClassificar
      ? [
          `${r.aClassificar} lançamento(s) estão como "A classificar" e precisam de definição de categoria.`,
        ]
      : []),
    'O grupo "Sócios" reúne retiradas e pagamentos de natureza pessoal; avaliar se compõem a despesa da empresa.',
    '"Faturas de cartão de crédito" podem conter compras também lançadas individualmente; conferir para não duplicar.',
  ];
  let yNota =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 7;
  if (yNota + 6 + notas.length * 4.5 > H - 14) {
    doc.addPage();
    yNota = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(COR.tinta));
  doc.text("Observações", M, yNota);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(COR.suave));
  notas.forEach((t, i) => doc.text(`•  ${t}`, M, yNota + 5 + i * 4.5));

  // Lançamentos
  doc.addPage();
  titulo(`Lançamentos: ${r.periodoExtenso}`, 14);
  autoTable(doc, {
    startY: 17,
    margin: { left: M, right: M, top: 16, bottom: 14 },
    head: [
      [
        "Nº",
        "Venc.",
        "Pagto.",
        "Descrição / fornecedor",
        "Categoria",
        "Comp.",
        "Forma",
        "Situação",
        "Valor",
      ],
    ],
    body: r.linhas.map((l) => [
      String(l.n),
      dataBr(l.vencimento).slice(0, 5),
      l.pagamento ? dataBr(l.pagamento).slice(0, 5) : "—",
      l.obs ? `${l.descricao}\n${l.obs}` : l.descricao,
      l.categoria,
      `${l.competencia.slice(5)}/${l.competencia.slice(2, 4)}`,
      l.forma || "—",
      l.situacao,
      brl(l.valor),
    ]),
    foot: [
      [
        { content: "TOTAL", colSpan: 8, styles: { halign: "right" } },
        brl(r.total),
      ],
    ],
    styles: estiloBase,
    headStyles: cabecalhoTabela,
    footStyles: { ...cabecalhoTabela, fontSize: 8.5 },
    alternateRowStyles: { fillColor: rgb(COR.zebra) },
    showFoot: "lastPage",
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 13 },
      2: { cellWidth: 13 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 55 },
      5: { cellWidth: 14 },
      6: { cellWidth: 26 },
      7: { cellWidth: 19, fontStyle: "bold" },
      8: { halign: "right", cellWidth: 27 },
    },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index === 8)
        d.cell.styles.halign = "right";
      if (d.section !== "body") return;
      if (d.column.index === 7) {
        const [cor] = corSituacao(String(d.cell.raw));
        d.cell.styles.textColor = rgb(cor);
      }
      if (d.column.index === 4 && d.cell.raw === "A classificar") {
        d.cell.styles.textColor = rgb(COR.alerta);
        d.cell.styles.fontStyle = "italic";
      }
    },
  });

  // Rodapé e numeração em todas as páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFillColor(...rgb(COR.marca));
      doc.rect(0, 0, W, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...rgb(COR.suave));
      doc.text(
        `${r.empresa} | Contas a pagar | ${r.periodoExtenso}`,
        W - M,
        8,
        { align: "right" },
      );
    }
    doc.setDrawColor(...rgb(COR.borda));
    doc.setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(COR.suave));
    doc.text(
      `${r.empresa} | Relatório de contas a pagar | ${r.periodoExtenso}`,
      M,
      H - 5,
    );
    doc.text("Gerado pelo painel GuIA", W / 2, H - 5, { align: "center" });
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 5, { align: "right" });
  }
  return doc;
}

export async function exportarPdf(r: Relatorio) {
  const doc = await gerarPdf(r);
  baixar(doc.output("blob"), `${r.arquivo}.pdf`);
}
