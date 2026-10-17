import { STATUS_LABEL } from "./constants";

export function statusHeadline(status: string, selectedQuoteId?: string | null) {
  if (status === "QUOTED" && selectedQuoteId) return "Cotización aceptada";
  return STATUS_LABEL[status] ?? "En curso";
}
