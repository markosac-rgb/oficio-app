import { prisma } from "@/lib/prisma";

const KEY = "demoData";

/** On unless OFICIO_DEMO_DATA=0. A row written by an admin overrides the env. */
export async function demoDataEnabled() {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (row) return row.value !== "0";
  return process.env.OFICIO_DEMO_DATA !== "0";
}

export async function setDemoDataEnabled(enabled: boolean) {
  const value = enabled ? "1" : "0";
  await prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });
  return enabled;
}
