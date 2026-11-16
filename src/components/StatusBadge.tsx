import type { AppointmentStatus } from "@prisma/client";

const MAP: Record<AppointmentStatus, [string, string]> = {
  CONFIRMED: ["Confirmada", "bg-sky-100 text-sky-800"],
  COMPLETED: ["Realizada", "bg-emerald-100 text-emerald-800"],
  CANCELLED: ["Cancelada", "bg-stone-200 text-stone-600"],
  NO_SHOW: ["No asistió", "bg-amber-100 text-amber-800"],
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const [label, cls] = MAP[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
