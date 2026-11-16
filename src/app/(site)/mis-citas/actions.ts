"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { addMinutes, fmtDate, fmtTime, nowWall } from "@/lib/time";
import { notifyAdmins } from "@/lib/notifications";

export async function cancelAppointment(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const app = await prisma.appointment.findUnique({ where: { id } });
  if (!app || app.userId !== user.id || app.status !== "CONFIRMED") redirect("/mis-citas?error=Cita+no+encontrada");

  const { minCancelHours } = await getSettings();
  if (addMinutes(nowWall(), minCancelHours * 60) > app.start) {
    redirect(`/mis-citas?error=${encodeURIComponent(`Solo se puede cancelar con ${minCancelHours} h de antelación. Llama a la peluquería.`)}`);
  }

  await prisma.$transaction([
    prisma.appointment.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    // La oferta personal vuelve a estar disponible
    prisma.userOffer.updateMany({ where: { appointmentId: id }, data: { appointmentId: null } }),
  ]);
  await notifyAdmins(`${user.name} ha cancelado su cita del ${fmtDate(app.start)} a las ${fmtTime(app.start)}.`, "/admin");
  revalidatePath("/mis-citas");
  redirect("/mis-citas?ok=Cita+cancelada");
}

const reviewSchema = z.object({
  id: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function reviewAppointment(fd: FormData) {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/mis-citas?error=${encodeURIComponent("Elige una puntuación de 1 a 5")}`);
  const { id, rating, comment } = parsed.data;
  const app = await prisma.appointment.findUnique({ where: { id }, include: { review: true } });
  if (!app || app.userId !== user.id || app.status !== "COMPLETED" || app.review) redirect("/mis-citas?error=No+se+puede+valorar+esta+cita");

  await prisma.review.create({ data: { appointmentId: id, userId: user.id, rating, comment: comment || null } });
  await notifyAdmins(`${user.name} ha valorado su cita con ${rating}★`, "/admin/valoraciones");
  revalidatePath("/mis-citas");
  redirect(`/mis-citas?ok=${encodeURIComponent("¡Gracias por tu valoración!")}`);
}

export async function markNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}
