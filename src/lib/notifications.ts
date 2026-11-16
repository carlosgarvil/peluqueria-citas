import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function notify(userId: string, message: string, link?: string, tx: Tx = prisma) {
  await tx.notification.create({ data: { userId, message, link } });
}

export async function notifyAdmins(message: string, link?: string, tx: Tx = prisma) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await tx.notification.createMany({ data: admins.map((a) => ({ userId: a.id, message, link })) });
}
