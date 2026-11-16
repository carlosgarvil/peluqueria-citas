import { prisma } from "./db";

export interface Settings {
  businessName: string;
  slotStepMin: number;
  minAdvanceMin: number;
  minCancelHours: number;
  maxDaysAhead: number;
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: "Mi Peluquería",
  slotStepMin: 15,
  minAdvanceMin: 60,
  minCancelHours: 12,
  maxDaysAhead: 60,
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    businessName: map.businessName ?? DEFAULT_SETTINGS.businessName,
    slotStepMin: Number(map.slotStepMin ?? DEFAULT_SETTINGS.slotStepMin),
    minAdvanceMin: Number(map.minAdvanceMin ?? DEFAULT_SETTINGS.minAdvanceMin),
    minCancelHours: Number(map.minCancelHours ?? DEFAULT_SETTINGS.minCancelHours),
    maxDaysAhead: Number(map.maxDaysAhead ?? DEFAULT_SETTINGS.maxDaysAhead),
  };
}

export async function saveSettings(s: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(s).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }),
    ),
  );
}

export async function isSetupDone(): Promise<boolean> {
  return (await prisma.user.count({ where: { role: "ADMIN" } })) > 0;
}
