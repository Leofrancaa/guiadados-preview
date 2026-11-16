// Conhecimento de domínio da GuIA para a demonstração (Salvador, BA).
// São REFERÊNCIAS externas, nunca fatos sobre a empresa da demonstração.
// Revisar uma vez por ano (setor, calendário, legislação).

export const CONHECIMENTO_REVISADO_EM = "2026-11";

const PADARIA = `- Brazilian bakery sector 2025: R$ 164,12 bi revenue (+6,8%); customer flow +1,27%; average ticket +5,46% to R$ 36,61 (Ideal/ABIP, abr/2026). The sector grows by selling more per visit (mix, convenience, quick meals), not by more visits, so always look at orders and ticket separately.
- In-house production was ~69% and resale ~31% of average bakery revenue (Ideal/ABIP, 2024). French bread (pão francês) is the anchor product that drives recurring visits (morning and late afternoon) and pulls coffee, cold cuts and dairy.
- Products that are "C" in revenue can be "A" in traffic (e.g. pão francês): never suggest cutting a product only by revenue.`;

const GERAL = `- Look at orders and average ticket separately: revenue = orders × ticket; ticket = items per order × average item price.
- Products that are "C" in revenue can still bring customers in: never suggest cutting a product only by revenue.`;

export function conhecimentoSetor(segmento: string) {
  return `SECTOR REFERENCES (cite as "referência do setor" with source and year when there is one; NEVER targets or facts about this business):
${segmento === "padaria" ? PADARIA : GERAL}
- Payments in Brazil: Pix was 54,7% of all transactions in H2/2025 (Banco Central). Card and Pix fees of this business are unknown: ask before estimating any saving. Cash has hidden costs (change, counting, theft and cash errors). Price differentiation by payment method is allowed in Brazil since 2017, with clear information to the customer.
- Costs, purchase prices and margins are NOT in the data: never compute margin or profit.

LOCAL CONTEXT (Salvador, BA):
- Carnaval is the biggest event of the year (circuits Barra-Ondina and Campo Grande), with the city crowded for about a week; the effect depends on where the store is and what it sells: compare only with the Carnaval of the previous year.
- Summer (dez–mar) is hot and beach-oriented; the rainy season is roughly abr–jul. Weather is a HYPOTHESIS only: there is no weather data.
- Other dates in calendarEvents: Lavagem do Bonfim (January), Festa de Iemanjá (02/02, Rio Vermelho), Aniversário de Salvador (29/03), São João (23–24/06, many residents travel to the interior), 2 de Julho (Independência da Bahia, feriado estadual), Conceição da Praia (08/12, feriado municipal). Festival dates change every year: say "aprox." and suggest confirming.

LABOR AND LEGAL (general information, never legal advice; always recommend confirming with the accountant/contador or the union):
- Holidays and Sundays in commerce depend on the collective agreement (CCT) of the category; a holiday worked without a compensatory day off is paid double.
- Rough cost of a CLT employee for a Simples Nacional company: about 28–33% on top of the salary before benefits (accounting estimates); with transport/meal vouchers, ~40–50%. General reference only.`;
}
