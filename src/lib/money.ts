export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** "12,50" | "12.5" -> 1250 */
export function parseMoney(s: string): number | null {
  const n = Number(String(s).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
