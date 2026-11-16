/**
 * Cálculo de huecos libres para un día y una duración total (suma de los tratamientos
 * encadenados). Función pura: recibe horario, ocupación y "ahora" y devuelve las horas de
 * inicio posibles.
 */
import { addMinutes, weekdayMon0 } from "./time";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WorkingHourLite {
  weekday: number; // 0 = lunes
  startMin: number;
  endMin: number;
}

export interface SlotQuery {
  day: Date; // 00:00 del día (hora de pared)
  durationMin: number;
  workingHours: WorkingHourLite[];
  busy: Interval[]; // citas activas + bloqueos
  now: Date; // hora de pared actual
  minAdvanceMin?: number; // antelación mínima para reservar
  stepMin?: number; // separación entre posibles inicios
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

export function computeSlots(q: SlotQuery): Date[] {
  const step = Math.max(5, q.stepMin ?? 15);
  const earliest = addMinutes(q.now, q.minAdvanceMin ?? 0);
  if (q.durationMin <= 0) return [];

  const ranges = q.workingHours
    .filter((w) => w.weekday === weekdayMon0(q.day) && w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const slots: Date[] = [];
  for (const r of ranges) {
    for (let t = r.startMin; t + q.durationMin <= r.endMin; t += step) {
      const start = addMinutes(q.day, t);
      if (start < earliest) continue;
      const candidate = { start, end: addMinutes(start, q.durationMin) };
      if (q.busy.some((b) => overlaps(candidate, b))) continue;
      slots.push(start);
    }
  }
  return slots;
}

export function isSlotAvailable(q: SlotQuery, start: Date): boolean {
  return computeSlots(q).some((s) => s.getTime() === start.getTime());
}
