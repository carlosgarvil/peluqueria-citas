/**
 * Cálculo del precio de una cita con varios tratamientos encadenados.
 *
 * Reglas (sin acumulación, siempre la más favorable para el cliente):
 *  - Cada tratamiento puede tener ofertas por rango de fechas (se usa la de mayor % vigente
 *    el día de la cita).
 *  - El usuario puede tener ofertas personales de UN SOLO USO:
 *      · sobre un tratamiento concreto -> compite con la oferta por fechas de esa línea.
 *      · sobre el total de la cita     -> se aplica a todas las líneas e ignora las demás.
 *  - Solo se usa como mucho una oferta personal por cita. Se calcula cada alternativa y
 *    se elige la de menor total. A igualdad, se prefiere NO consumir la oferta personal.
 */
import { dayKey } from "./time";

export interface PricingTreatment {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
}

export interface TreatmentOfferLite {
  treatmentId: string;
  percent: number;
  startDate: Date;
  endDate: Date;
  label?: string | null;
}

export interface UserOfferLite {
  id: string;
  treatmentId: string | null;
  percent: number;
  validUntil: Date | null;
}

export type DiscountSource = "treatmentOffer" | "userOffer" | "userTotalOffer" | null;

export interface PricedLine {
  treatmentId: string;
  name: string;
  durationMin: number;
  priceCents: number;
  discountPercent: number;
  finalCents: number;
  source: DiscountSource;
}

export interface PriceResult {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  durationMin: number;
  userOfferId: string | null;
  note: string | null;
}

export function applyPercent(cents: number, percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return cents - Math.round((cents * p) / 100);
}

function inRange(day: string, start: Date, end: Date): boolean {
  return dayKey(start) <= day && day <= dayKey(end);
}

/** Mejor oferta por fechas vigente para cada tratamiento el día indicado. */
export function bestTreatmentOffers(offers: TreatmentOfferLite[], date: Date): Map<string, number> {
  const day = dayKey(date);
  const best = new Map<string, number>();
  for (const o of offers) {
    if (!inRange(day, o.startDate, o.endDate)) continue;
    if (o.percent > (best.get(o.treatmentId) ?? 0)) best.set(o.treatmentId, o.percent);
  }
  return best;
}

export function validUserOffers(offers: UserOfferLite[], date: Date): UserOfferLite[] {
  const day = dayKey(date);
  return offers.filter((o) => o.percent > 0 && (!o.validUntil || dayKey(o.validUntil) >= day));
}

function build(lines: PricedLine[], userOfferId: string | null, note: string | null): PriceResult {
  const subtotalCents = lines.reduce((a, l) => a + l.priceCents, 0);
  const totalCents = lines.reduce((a, l) => a + l.finalCents, 0);
  return {
    lines,
    subtotalCents,
    totalCents,
    discountCents: subtotalCents - totalCents,
    durationMin: lines.reduce((a, l) => a + l.durationMin, 0),
    userOfferId,
    note,
  };
}

export function calculatePrice(
  treatments: PricingTreatment[],
  opts: { date: Date; treatmentOffers?: TreatmentOfferLite[]; userOffers?: UserOfferLite[] },
): PriceResult {
  const byTreatment = bestTreatmentOffers(opts.treatmentOffers ?? [], opts.date);
  const userOffers = validUserOffers(opts.userOffers ?? [], opts.date);

  const line = (t: PricingTreatment, percent: number, source: DiscountSource): PricedLine => ({
    treatmentId: t.id,
    name: t.name,
    durationMin: t.durationMin,
    priceCents: t.priceCents,
    discountPercent: percent,
    finalCents: applyPercent(t.priceCents, percent),
    source: percent > 0 ? source : null,
  });

  // Alternativa base: solo ofertas por fechas.
  const baseLines = treatments.map((t) => line(t, byTreatment.get(t.id) ?? 0, "treatmentOffer"));
  const hasDateOffers = baseLines.some((l) => l.discountPercent > 0);
  let best = build(baseLines, null, hasDateOffers ? "Ofertas de temporada aplicadas" : null);

  for (const uo of userOffers) {
    let candidate: PriceResult | null = null;

    if (uo.treatmentId === null) {
      const lines = treatments.map((t) => line(t, uo.percent, "userTotalOffer"));
      candidate = build(lines, uo.id, `Oferta personal del ${uo.percent}% sobre el total`);
    } else {
      const idx = treatments.findIndex((t) => t.id === uo.treatmentId);
      if (idx === -1) continue;
      const current = baseLines[idx].discountPercent;
      if (uo.percent <= current) continue; // no mejora: no se consume la oferta
      const lines = baseLines.map((l, i) => (i === idx ? line(treatments[i], uo.percent, "userOffer") : l));
      candidate = build(lines, uo.id, `Oferta personal del ${uo.percent}% en ${treatments[idx].name}`);
    }

    if (candidate.totalCents < best.totalCents) best = candidate;
  }

  return best;
}
