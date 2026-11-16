"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, createSession, destroySession, hashPassword } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

export async function loginAction(_: unknown, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) return { error: "Email o contraseña incorrectos" };
  if (!user.active) return { error: "Tu cuenta está desactivada. Contacta con la peluquería." };
  await createSession(user);
  redirect(safeNext(fd.get("next"), user.role === "ADMIN" ? "/admin" : "/mis-citas"));
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Indica tu nombre"),
    email: z.string().trim().toLowerCase().email("Email no válido"),
    phone: z.string().trim().max(20).optional(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    password2: z.string(),
  })
  .refine((d) => d.password === d.password2, { message: "Las contraseñas no coinciden" });

export async function registerAction(_: unknown, fd: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Ya existe una cuenta con ese email" };
  const user = await prisma.user.create({
    data: { name, email, phone: phone || null, passwordHash: await hashPassword(password) },
  });
  await notifyAdmins(`Nuevo cliente registrado: ${name}`, "/admin/usuarios");
  await createSession(user);
  redirect(safeNext(fd.get("next"), "/reservar"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
