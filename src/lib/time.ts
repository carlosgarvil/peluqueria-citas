/**
 * Utilidades de fecha/hora.
 *
 * Estrategia: todas las horas de la agenda se manejan como "hora de pared" del negocio
 * codificada en los campos UTC de un Date. Es decir, una cita a las 10:00 en Madrid se
 * guarda como 10:00Z. Así el cálculo de huecos es idéntico en Docker, Vercel (UTC) o en
 * local, y no hay sorpresas con los cambios de horario de verano. Solo hace falta convertir
 * "ahora" a hora de pared con nowWall().
 */

export const BUSINESS_TZ = process.env.BUSINESS_TZ || "Europe/Madrid";

/** Momento actual expresado como hora de pared del negocio. */
export function nowWall(tz: string = BUSINESS_TZ, instant: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

/** "2026-03-15" -> Date a las 00:00 (UTC/pared). Devuelve null si el formato no es válido. */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> "YYYY-MM-DD" */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Día de la semana con lunes = 0 ... domingo = 6 */
export function weekdayMon0(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59 || (h === 24 && mm > 0)) return null;
  return h * 60 + mm;
}

export function fmtTime(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat("es-ES", { ...opts, timeZone: "UTC" }).format(d);
}

export function fmtDateShort(d: Date): string {
  return fmtDate(d, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
