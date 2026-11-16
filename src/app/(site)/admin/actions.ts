"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { parseMoney } from "@/lib/money";
import { addDays, addMinutes, fmtDate, fmtTime, hhmmToMin, parseDay } from "@/lib/time";
import { notify } from "@/lib/notifications";

function back(path: string, kind: "ok" | "error", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const returnTo = (fd: FormData, fallback: string) => {
  const r = str(fd, "returnTo");
  return r.startsWith("/admin") ? r : fallback;
};

/* ------------------------------ Agenda ------------------------------ */

const STATUS_MSG: Partial<Record<AppointmentStatus, string>> = {
  CANCELLED: "La peluquería ha cancelado tu cita del",
  COMPLETED: "¡Gracias por tu visita! Ya puedes valorar tu cita del",
};

export async function setAppointmentStatus(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const status = z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).parse(str(fd, "status"));
  const app = await prisma.appointment.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.appointment.update({ where: { id }, data: { status, cancelledAt: status === "CANCELLED" ? new Date() : null } }),
    ...(status === "CANCELLED" ? [prisma.userOffer.updateMany({ where: { appointmentId: id }, data: { appointmentId: null } })] : []),
  ]);
  const prefix = STATUS_MSG[status];
  if (prefix) await notify(app.userId, `${prefix} ${fmtDate(app.start)} a las ${fmtTime(app.start)}.`, "/mis-citas");
  revalidatePath("/admin");
  back(returnTo(fd, "/admin"), "ok", "Cita actualizada");
}

export async function markAdminNotificationsRead() {
  const admin = await requireAdmin();
  await prisma.notification.updateMany({ where: { userId: admin.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}

/* ------------------------------ Horario ------------------------------ */

export async function addWorkingHour(fd: FormData) {
  await requireAdmin();
  const weekday = Number(str(fd, "weekday"));
  const startMin = hhmmToMin(str(fd, "start"));
  const endMin = hhmmToMin(str(fd, "end"));
  if (!(weekday >= 0 && weekday <= 6) || startMin === null || endMin === null || endMin <= startMin) back("/admin/horario", "error", "Franja no válida");
  const sameDay = await prisma.workingHour.findMany({ where: { weekday } });
  if (sameDay.some((h) => startMin! < h.endMin && endMin! > h.startMin)) back("/admin/horario", "error", "La franja se solapa con otra del mismo día");
  await prisma.workingHour.create({ data: { weekday, startMin: startMin!, endMin: endMin! } });
  revalidatePath("/admin/horario");
  back("/admin/horario", "ok", "Franja añadida");
}

export async function deleteWorkingHour(fd: FormData) {
  await requireAdmin();
  await prisma.workingHour.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/admin/horario");
  back("/admin/horario", "ok", "Franja eliminada");
}

export async function addTimeBlock(fd: FormData) {
  await requireAdmin();
  const from = parseDay(str(fd, "from"));
  const to = parseDay(str(fd, "to") || str(fd, "from"));
  const allDay = fd.get("allDay") === "on";
  const startMin = allDay ? 0 : hhmmToMin(str(fd, "start"));
  const endMin = allDay ? 24 * 60 : hhmmToMin(str(fd, "end"));
  if (!from || !to || to < from || startMin === null || endMin === null) back("/admin/horario", "error", "Datos del bloqueo no válidos");
  const start = addMinutes(from!, startMin!);
  const end = allDay ? addDays(to!, 1) : addMinutes(to!, endMin!);
  if (end <= start) back("/admin/horario", "error", "El fin debe ser posterior al inicio");

  await prisma.timeBlock.create({ data: { start, end, reason: str(fd, "reason") || null } });
  const conflicts = await prisma.appointment.count({ where: { status: "CONFIRMED", start: { lt: end }, end: { gt: start } } });
  revalidatePath("/admin/horario");
  back(
    "/admin/horario",
    conflicts ? "error" : "ok",
    conflicts ? `Bloqueo creado, pero hay ${conflicts} cita(s) confirmadas en ese periodo. Revísalas en la agenda.` : "Bloqueo creado",
  );
}

export async function deleteTimeBlock(fd: FormData) {
  await requireAdmin();
  await prisma.timeBlock.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/admin/horario");
  back("/admin/horario", "ok", "Bloqueo eliminado");
}

const settingsSchema = z.object({
  businessName: z.string().trim().min(2),
  slotStepMin: z.coerce.number().int().min(5).max(120),
  minAdvanceMin: z.coerce.number().int().min(0).max(10080),
  minCancelHours: z.coerce.number().int().min(0).max(168),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
});

export async function updateSettings(fd: FormData) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) back("/admin/horario", "error", "Revisa los valores de configuración");
  await saveSettings(parsed.data!);
  revalidatePath("/", "layout");
  back("/admin/horario", "ok", "Configuración guardada");
}

/* ------------------------------ Tratamientos ------------------------------ */

const treatmentSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  description: z.string().trim().max(300).optional(),
  durationMin: z.coerce.number().int().min(5, "Duración mínima 5 min").max(480),
  price: z.string(),
  sortOrder: z.coerce.number().int().default(0),
});

function parseTreatment(fd: FormData) {
  const parsed = treatmentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) back("/admin/tratamientos", "error", parsed.error.issues[0].message);
  const priceCents = parseMoney(parsed.data!.price);
  if (priceCents === null) back("/admin/tratamientos", "error", "Precio no válido");
  const { price: _p, ...rest } = parsed.data!;
  return { ...rest, description: rest.description || null, priceCents: priceCents! };
}

export async function createTreatment(fd: FormData) {
  await requireAdmin();
  await prisma.treatment.create({ data: parseTreatment(fd) });
  revalidatePath("/admin/tratamientos");
  back("/admin/tratamientos", "ok", "Tratamiento creado");
}

export async function updateTreatment(fd: FormData) {
  await requireAdmin();
  await prisma.treatment.update({ where: { id: str(fd, "id") }, data: { ...parseTreatment(fd), active: fd.get("active") === "on" } });
  revalidatePath("/admin/tratamientos");
  back("/admin/tratamientos", "ok", "Tratamiento actualizado");
}

export async function deleteTreatment(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const used = await prisma.appointmentItem.count({ where: { treatmentId: id } });
  if (used) {
    await prisma.treatment.update({ where: { id }, data: { active: false } });
    revalidatePath("/admin/tratamientos");
    back("/admin/tratamientos", "ok", "El tratamiento tiene citas asociadas: se ha desactivado en lugar de borrarlo");
  }
  await prisma.treatment.delete({ where: { id } });
  revalidatePath("/admin/tratamientos");
  back("/admin/tratamientos", "ok", "Tratamiento eliminado");
}

export async function addTreatmentOffer(fd: FormData) {
  await requireAdmin();
  const percent = Number(str(fd, "percent"));
  const startDate = parseDay(str(fd, "startDate"));
  const endDate = parseDay(str(fd, "endDate"));
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) back("/admin/tratamientos", "error", "El porcentaje debe estar entre 1 y 100");
  if (!startDate || !endDate || endDate < startDate) back("/admin/tratamientos", "error", "Rango de fechas no válido");
  await prisma.treatmentOffer.create({
    data: { treatmentId: str(fd, "treatmentId"), percent, startDate: startDate!, endDate: endDate!, label: str(fd, "label") || null },
  });
  revalidatePath("/admin/tratamientos");
  back("/admin/tratamientos", "ok", "Oferta creada");
}

export async function deleteTreatmentOffer(fd: FormData) {
  await requireAdmin();
  await prisma.treatmentOffer.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/admin/tratamientos");
  back("/admin/tratamientos", "ok", "Oferta eliminada");
}

/* ------------------------------ Usuarios ------------------------------ */

export async function toggleUserActive(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (id === admin.id) back(`/admin/usuarios/${id}`, "error", "No puedes desactivar tu propia cuenta");
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/usuarios");
  back(`/admin/usuarios/${id}`, "ok", u.active ? "Usuario desactivado" : "Usuario activado");
}

export async function giveUserOffer(fd: FormData) {
  await requireAdmin();
  const userId = str(fd, "userId");
  const percent = Number(str(fd, "percent"));
  const treatmentId = str(fd, "treatmentId") || null;
  const validUntil = str(fd, "validUntil") ? parseDay(str(fd, "validUntil")) : null;
  const path = `/admin/usuarios/${userId}`;
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) back(path, "error", "El porcentaje debe estar entre 1 y 100");
  if (str(fd, "validUntil") && !validUntil) back(path, "error", "Fecha no válida");

  const offer = await prisma.userOffer.create({
    data: { userId, percent, treatmentId, validUntil, note: str(fd, "note") || null },
    include: { treatment: true },
  });
  await notify(
    userId,
    `🎁 Tienes una oferta del ${percent}% ${offer.treatment ? `en ${offer.treatment.name}` : "sobre el total de tu próxima cita"}.`,
    "/mis-citas",
  );
  revalidatePath(path);
  back(path, "ok", "Oferta enviada al cliente");
}

export async function deleteUserOffer(fd: FormData) {
  await requireAdmin();
  const offer = await prisma.userOffer.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  if (offer.appointmentId) back(`/admin/usuarios/${offer.userId}`, "error", "La oferta ya se ha usado en una cita");
  await prisma.userOffer.delete({ where: { id: offer.id } });
  revalidatePath(`/admin/usuarios/${offer.userId}`);
  back(`/admin/usuarios/${offer.userId}`, "ok", "Oferta eliminada");
}

/* ------------------------------ Valoraciones ------------------------------ */

export async function toggleReviewVisible(fd: FormData) {
  await requireAdmin();
  const r = await prisma.review.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.review.update({ where: { id: r.id }, data: { visible: !r.visible } });
  revalidatePath("/admin/valoraciones");
  revalidatePath("/");
  back(returnTo(fd, "/admin/valoraciones"), "ok", r.visible ? "Valoración oculta" : "Valoración visible");
}

export async function replyReview(fd: FormData) {
  await requireAdmin();
  const r = await prisma.review.update({ where: { id: str(fd, "id") }, data: { reply: str(fd, "reply") || null } });
  if (r.reply) await notify(r.userId, "La peluquería ha respondido a tu valoración.", "/mis-citas");
  revalidatePath("/admin/valoraciones");
  back(returnTo(fd, "/admin/valoraciones"), "ok", "Respuesta guardada");
}
