import { describe, expect, it } from "vitest";
import { computeSlots, overlaps, type WorkingHourLite } from "@/lib/availability";
import { fmtTime, nowWall } from "@/lib/time";

const at = (s: string) => new Date(`${s}:00.000Z`);
// 2026-03-10 es martes -> weekday 1
const DAY = at("2026-03-10T00:00");
const HOURS: WorkingHourLite[] = [
  { weekday: 1, startMin: 9 * 60, endMin: 13 * 60 },
  { weekday: 1, startMin: 16 * 60, endMin: 18 * 60 },
];
const EARLY = at("2026-03-01T00:00");
const times = (slots: Date[]) => slots.map(fmtTime);

describe("overlaps", () => {
  it("intervalos contiguos no se solapan", () => {
    expect(overlaps({ start: at("2026-03-10T09:00"), end: at("2026-03-10T10:00") }, { start: at("2026-03-10T10:00"), end: at("2026-03-10T11:00") })).toBe(false);
    expect(overlaps({ start: at("2026-03-10T09:00"), end: at("2026-03-10T10:01") }, { start: at("2026-03-10T10:00"), end: at("2026-03-10T11:00") })).toBe(true);
  });
});

describe("computeSlots", () => {
  it("genera huecos que caben enteros dentro de cada franja", () => {
    const slots = times(computeSlots({ day: DAY, durationMin: 60, workingHours: HOURS, busy: [], now: EARLY, stepMin: 60 }));
    expect(slots).toEqual(["09:00", "10:00", "11:00", "12:00", "16:00", "17:00"]);
  });

  it("una cita no puede atravesar la pausa de mediodía", () => {
    const slots = times(computeSlots({ day: DAY, durationMin: 180, workingHours: HOURS, busy: [], now: EARLY, stepMin: 30 }));
    expect(slots).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("excluye los huecos que se solapan con citas o bloqueos", () => {
    const busy = [{ start: at("2026-03-10T10:00"), end: at("2026-03-10T11:00") }];
    const slots = times(computeSlots({ day: DAY, durationMin: 45, workingHours: HOURS.slice(0, 1), busy, now: EARLY, stepMin: 15 }));
    expect(slots).not.toContain("09:30"); // 09:30-10:15 pisa la cita
    expect(slots).toContain("09:15"); // 09:15-10:00 justo antes
    expect(slots).toContain("11:00"); // justo después
    expect(slots.some((s) => s >= "09:30" && s < "11:00")).toBe(false);
  });

  it("respeta la antelación mínima respecto a 'ahora'", () => {
    const now = at("2026-03-10T10:10");
    const slots = times(computeSlots({ day: DAY, durationMin: 30, workingHours: HOURS.slice(0, 1), busy: [], now, minAdvanceMin: 60, stepMin: 30 }));
    expect(slots[0]).toBe("11:30");
  });

  it("devuelve vacío en días sin horario", () => {
    const wednesday = at("2026-03-11T00:00");
    expect(computeSlots({ day: wednesday, durationMin: 30, workingHours: HOURS, busy: [], now: EARLY })).toEqual([]);
  });
});

describe("nowWall", () => {
  it("convierte un instante a hora de pared de Madrid (invierno UTC+1, verano UTC+2)", () => {
    expect(nowWall("Europe/Madrid", new Date("2026-01-15T10:00:00Z")).toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(nowWall("Europe/Madrid", new Date("2026-07-15T10:00:00Z")).toISOString()).toBe("2026-07-15T12:00:00.000Z");
  });
});
