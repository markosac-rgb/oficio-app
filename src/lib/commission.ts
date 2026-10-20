/** Porcentaje de la comisión (10 = 10%). Por defecto 0. No se suma al precio: sale de él. */
export function commissionPct() {
  const raw = Number(process.env.OFIXIO_COMMISSION_PCT ?? "0");
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(100, raw);
}

export function commissionOf(serviceMxn: number) {
  const pct = commissionPct();
  const feeMxn = Math.round((serviceMxn * pct) / 100);
  return { pct, serviceMxn, feeMxn, totalMxn: serviceMxn };
}
