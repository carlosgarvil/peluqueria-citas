"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { isSetupDone, saveSettings } from "@/lib/settings";
import { seedDemo } from "@/lib/seed";

const schema = z.object({
  businessName: z.string().trim().min(2, "Indica el nombre del negocio"),
  name: z.string().trim().min(2, "Indica tu nombre"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  demo: z.enum(["si", "no"]),
});

export async function setupAction(_: unknown, fd: FormData) {
  if (await isSetupDone()) redirect("/");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessName, name, email, password, demo } = parsed.data;

  const admin = await prisma.user.create({
    data: { name, email, role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  await saveSettings({ businessName });

  if (demo === "si") {
    await seedDemo(prisma);
  } else {
    // Horario por defecto editable: lunes a viernes 9-14 y 16-20
    await prisma.workingHour.createMany({
      data: [0, 1, 2, 3, 4].flatMap((d) => [
        { weekday: d, startMin: 540, endMin: 840 },
        { weekday: d, startMin: 960, endMin: 1200 },
      ]),
    });
  }

  await createSession({ id: admin.id, role: "ADMIN", name: admin.name });
  redirect(demo === "si" ? "/admin?ok=Datos+de+prueba+cargados" : "/admin/tratamientos?ok=Empieza+creando+tus+tratamientos");
}
