/**
 * Carga de datos demo por línea de comandos (alternativa al asistente web):
 *   docker compose exec app npm run db:seed
 * Si no existe ningún administrador, crea admin@demo.local / demo1234.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemo, DEMO_PASSWORD } from "../src/lib/seed";

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.treatment.count()) > 0) {
    console.log("La base de datos ya tiene datos; no se carga el dataset demo.");
    return;
  }
  if ((await prisma.user.count({ where: { role: "ADMIN" } })) === 0) {
    await prisma.user.create({
      data: { name: "Admin Demo", email: "admin@demo.local", role: "ADMIN", passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
    });
    await prisma.setting.upsert({ where: { key: "businessName" }, update: {}, create: { key: "businessName", value: "Peluquería Demo" } });
    console.log(`Administrador creado: admin@demo.local / ${DEMO_PASSWORD}`);
  }
  await seedDemo(prisma);
  console.log(`Dataset demo cargado. Clientes: lucia@demo.local, marcos@demo.local... (contraseña ${DEMO_PASSWORD})`);
}

main().finally(() => prisma.$disconnect());
