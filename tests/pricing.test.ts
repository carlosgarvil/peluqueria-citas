import { describe, expect, it } from "vitest";
import { applyPercent, calculatePrice, type TreatmentOfferLite, type UserOfferLite } from "@/lib/pricing";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const corte = { id: "corte", name: "Corte", priceCents: 2000, durationMin: 30 };
const tinte = { id: "tinte", name: "Tinte", priceCents: 5000, durationMin: 90 };
const DAY = d("2026-03-10");

describe("applyPercent", () => {
  it("aplica el porcentaje redondeando al céntimo", () => {
    expect(applyPercent(2000, 10)).toBe(1800);
    expect(applyPercent(999, 15)).toBe(849); // 149.85 -> 150 de descuento
    expect(applyPercent(1000, 0)).toBe(1000);
    expect(applyPercent(1000, 150)).toBe(0); // se limita a 100%
  });
});

describe("calculatePrice", () => {
  it("sin ofertas suma precios y duraciones", () => {
    const r = calculatePrice([corte, tinte], { date: DAY });
    expect(r.subtotalCents).toBe(7000);
    expect(r.totalCents).toBe(7000);
    expect(r.discountCents).toBe(0);
    expect(r.durationMin).toBe(120);
    expect(r.userOfferId).toBeNull();
  });

  it("aplica la oferta por fechas solo si el día está dentro del rango (incluidos extremos)", () => {
    const offers: TreatmentOfferLite[] = [{ treatmentId: "tinte", percent: 20, startDate: d("2026-03-01"), endDate: d("2026-03-10") }];
    expect(calculatePrice([tinte], { date: d("2026-03-10"), treatmentOffers: offers }).totalCents).toBe(4000);
    expect(calculatePrice([tinte], { date: d("2026-03-01"), treatmentOffers: offers }).totalCents).toBe(4000);
    expect(calculatePrice([tinte], { date: d("2026-03-11"), treatmentOffers: offers }).totalCents).toBe(5000);
  });

  it("con varias ofertas por fechas solapadas usa la mayor", () => {
    const offers: TreatmentOfferLite[] = [
      { treatmentId: "corte", percent: 10, startDate: d("2026-03-01"), endDate: d("2026-03-31") },
      { treatmentId: "corte", percent: 25, startDate: d("2026-03-05"), endDate: d("2026-03-15") },
    ];
    const r = calculatePrice([corte], { date: DAY, treatmentOffers: offers });
    expect(r.lines[0].discountPercent).toBe(25);
    expect(r.totalCents).toBe(1500);
  });

  it("la oferta personal sobre un tratamiento solo se usa si mejora la de temporada (no acumula)", () => {
    const tOffers: TreatmentOfferLite[] = [{ treatmentId: "tinte", percent: 20, startDate: d("2026-03-01"), endDate: d("2026-03-31") }];
    const worse: UserOfferLite[] = [{ id: "u1", treatmentId: "tinte", percent: 15, validUntil: null }];
    const better: UserOfferLite[] = [{ id: "u2", treatmentId: "tinte", percent: 30, validUntil: null }];

    const r1 = calculatePrice([tinte], { date: DAY, treatmentOffers: tOffers, userOffers: worse });
    expect(r1.totalCents).toBe(4000);
    expect(r1.userOfferId).toBeNull(); // no se consume

    const r2 = calculatePrice([tinte], { date: DAY, treatmentOffers: tOffers, userOffers: better });
    expect(r2.totalCents).toBe(3500);
    expect(r2.userOfferId).toBe("u2");
    expect(r2.lines[0].source).toBe("userOffer");
  });

  it("elige entre oferta sobre el total y ofertas por línea la más barata para el cliente", () => {
    // Tinte -50% por fechas: 2000 + 2500 = 4500. Total -10%: 6300. Gana la de línea.
    const tOffers: TreatmentOfferLite[] = [{ treatmentId: "tinte", percent: 50, startDate: d("2026-03-01"), endDate: d("2026-03-31") }];
    const uOffers: UserOfferLite[] = [{ id: "total10", treatmentId: null, percent: 10, validUntil: null }];
    const r = calculatePrice([corte, tinte], { date: DAY, treatmentOffers: tOffers, userOffers: uOffers });
    expect(r.totalCents).toBe(4500);
    expect(r.userOfferId).toBeNull();

    // Con un 40% sobre el total: 4200 < 4500 -> gana el total
    const r2 = calculatePrice([corte, tinte], {
      date: DAY,
      treatmentOffers: tOffers,
      userOffers: [{ id: "total40", treatmentId: null, percent: 40, validUntil: null }],
    });
    expect(r2.totalCents).toBe(4200);
    expect(r2.userOfferId).toBe("total40");
    expect(r2.lines.every((l) => l.discountPercent === 40)).toBe(true);
  });

  it("ignora ofertas personales caducadas o de tratamientos que no están en la cita", () => {
    const uOffers: UserOfferLite[] = [
      { id: "caducada", treatmentId: null, percent: 50, validUntil: d("2026-03-09") },
      { id: "otro", treatmentId: "mechas", percent: 50, validUntil: null },
    ];
    const r = calculatePrice([corte], { date: DAY, userOffers: uOffers });
    expect(r.totalCents).toBe(2000);
    expect(r.userOfferId).toBeNull();
  });

  it("la oferta que vence el mismo día de la cita sigue siendo válida", () => {
    const r = calculatePrice([corte], { date: DAY, userOffers: [{ id: "hoy", treatmentId: null, percent: 50, validUntil: DAY }] });
    expect(r.totalCents).toBe(1000);
  });
});
