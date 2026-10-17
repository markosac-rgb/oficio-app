import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { demoGoogleAdapter } from "@/adapters/oauth";
import { demoOtpAdapter } from "@/adapters/otp";
import { DEFAULT_SCHEDULE, normalizePhone } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { Account } from "@/lib/types";
import { HttpError, asText, requiredText } from "./errors";

const COOKIE = "oficio_session";
const MONTH = 60 * 60 * 24 * 30;

export const userInclude = {
  clientProfile: true,
  providerProfile: true,
} satisfies Prisma.UserInclude;

export type AppUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function toAccount(user: AppUser): Account {
  return {
    id: user.id,
    role: user.role as Account["role"],
    name: user.name,
    email: user.email,
    phone: user.phone,
    isDemo: user.isDemo,
    authNote: user.authNote,
    suspended: user.suspended,
    acceptedRulesAt: user.acceptedRulesAt?.toISOString() ?? null,
    clientProfile: user.clientProfile
      ? {
          street: user.clientProfile.street,
          neighborhood: user.clientProfile.neighborhood,
          city: user.clientProfile.city,
          state: user.clientProfile.state,
          postalCode: user.clientProfile.postalCode,
          reference: user.clientProfile.reference,
          lat: user.clientProfile.lat,
          lng: user.clientProfile.lng,
          locationSet: user.clientProfile.locationSet,
        }
      : null,
    provider: user.providerProfile
      ? {
          id: user.providerProfile.id,
          trade: user.providerProfile.trade,
          profileReady: user.providerProfile.profileReady,
          availableNow: user.providerProfile.availableNow,
          city: user.providerProfile.city,
          zoneLabel: user.providerProfile.zoneLabel,
          identityStatus: user.providerProfile.identityStatus,
          certStatus: user.providerProfile.certStatus,
          referencesStatus: user.providerProfile.referencesStatus,
          isExample: user.providerProfile.isExample,
        }
      : null,
  };
}

async function cookieJar() {
  return cookies();
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + MONTH * 1000),
    },
  });
  const jar = await cookieJar();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MONTH,
  });
}

export async function clearSession() {
  const jar = await cookieJar();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const jar = await cookieJar();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: userInclude } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || session.user.suspended) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

function normalizeTarget(value: string) {
  const text = value.trim();
  if (text.includes("@")) return text.toLowerCase();
  return normalizePhone(text);
}

async function findByIdentifier(identifier: string) {
  const target = normalizeTarget(identifier);
  if (!target) return null;
  if (target.includes("@")) {
    return prisma.user.findUnique({ where: { email: target }, include: userInclude });
  }
  return prisma.user.findUnique({ where: { phone: target }, include: userInclude });
}

export async function registerAccount(input: Record<string, unknown>) {
  const role = input.role === "PROVIDER" ? "PROVIDER" : input.role === "CLIENT" ? "CLIENT" : "";
  if (!role) throw new HttpError(400, "Elige si necesitas un servicio o si ofreces el tuyo.");
  if (input.acceptedRules !== true) {
    throw new HttpError(400, "Acepta las reglas de cancelación, pagos y aclaraciones para crear la cuenta.");
  }
  const name = requiredText(input.name, "tu nombre", 3, 80);
  const emailRaw = asText(input.email).toLowerCase();
  const phone = normalizePhone(asText(input.phone));
  const password = asText(input.password);
  if (!emailRaw && !phone) {
    throw new HttpError(400, "Escribe un correo o un teléfono de 10 dígitos.");
  }
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw new HttpError(400, "Ese correo no se ve completo.");
  }
  if (phone && phone.length !== 10) {
    throw new HttpError(400, "El teléfono debe tener 10 dígitos.");
  }
  if (password.length < 8) {
    throw new HttpError(400, "La contraseña necesita al menos 8 caracteres.");
  }
  if (emailRaw) {
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) throw new HttpError(400, "Ese correo ya tiene cuenta. Entra con él.");
  }
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) throw new HttpError(400, "Ese teléfono ya tiene cuenta. Entra con él.");
  }
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      role,
      name,
      email: emailRaw || null,
      phone: phone || null,
      passwordHash: await bcrypt.hash(password, 8),
      isDemo: false,
      acceptedRulesAt: new Date(),
      clientProfile: role === "CLIENT" ? { create: {} } : undefined,
      providerProfile:
        role === "PROVIDER"
          ? {
              create: {
                id: randomUUID(),
                scheduleJson: JSON.stringify(DEFAULT_SCHEDULE),
                cancellationPolicy: "Trabajo con las reglas de cancelación de Oficio.",
              },
            }
          : undefined,
    },
    include: userInclude,
  });
  await createSession(user.id);
  return { user: toAccount(user) };
}

export async function loginWithPassword(input: Record<string, unknown>) {
  const identifier = requiredText(input.identifier, "tu correo o teléfono", 3, 120);
  const password = asText(input.password);
  const user = await findByIdentifier(identifier);
  if (!user || !user.passwordHash) {
    throw new HttpError(400, "No encontramos esa cuenta o la contraseña no coincide.");
  }
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new HttpError(400, "No encontramos esa cuenta o la contraseña no coincide.");
  if (user.suspended) throw new HttpError(403, "Esta cuenta está suspendida. Escribe desde Ayuda.");
  await createSession(user.id);
  return { user: toAccount(user) };
}

export async function startOtp(input: Record<string, unknown>) {
  const target = normalizeTarget(requiredText(input.target, "tu correo o teléfono", 3, 120));
  const user = await findByIdentifier(target);
  if (!user) throw new HttpError(404, "No hay una cuenta con ese teléfono o correo. Regístrate primero.");
  if (user.suspended) throw new HttpError(403, "Esta cuenta está suspendida. Escribe desde Ayuda.");
  const code = String(randomInt(100000, 1000000));
  await prisma.otpChallenge.create({
    data: {
      id: randomUUID(),
      target,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const delivery = await demoOtpAdapter.deliver(target, code);
  return {
    simulated: true as const,
    demoCode: delivery.demoCode,
    channel: delivery.channel,
    externalProviderNeeded: delivery.externalProviderNeeded,
    message:
      "Simulado / Demo: no enviamos SMS ni correo. El código solo aparece aquí porque la entrega real no está conectada.",
  };
}

export async function verifyOtp(input: Record<string, unknown>) {
  const target = normalizeTarget(requiredText(input.target, "tu correo o teléfono", 3, 120));
  const code = asText(input.code);
  const challenge = await prisma.otpChallenge.findFirst({
    where: { target, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.codeHash !== sha256(code)) {
    throw new HttpError(400, "Ese código no coincide o ya venció.");
  }
  const user = await findByIdentifier(target);
  if (!user) throw new HttpError(404, "No hay una cuenta con ese teléfono o correo.");
  if (user.suspended) throw new HttpError(403, "Esta cuenta está suspendida. Escribe desde Ayuda.");
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { used: true } });
  await createSession(user.id);
  return { user: toAccount(user), simulated: true as const };
}

export async function loginWithGoogle(input: Record<string, unknown>) {
  const role = input.role === "PROVIDER" ? "PROVIDER" : "CLIENT";
  const started = demoGoogleAdapter.start(role);
  const email = started.profile.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email }, include: userInclude });
  if (!user) {
    const id = randomUUID();
    user = await prisma.user.create({
      data: {
        id,
        role: started.profile.role,
        name: started.profile.name,
        email,
        isDemo: true,
        authNote: "Entrada con Google simulado. No se abrió una cuenta real de Google.",
        acceptedRulesAt: new Date(),
        clientProfile: started.profile.role === "CLIENT" ? { create: {} } : undefined,
        providerProfile:
          started.profile.role === "PROVIDER"
            ? {
                create: {
                  id: randomUUID(),
                  isExample: true,
                  scheduleJson: JSON.stringify(DEFAULT_SCHEDULE),
                  cancellationPolicy: "Trabajo con las reglas de cancelación de Oficio.",
                },
              }
            : undefined,
      },
      include: userInclude,
    });
  }
  if (!user) throw new HttpError(500, "No se pudo entrar con el acceso simulado.");
  if (user.suspended) throw new HttpError(403, "Esta cuenta está suspendida. Escribe desde Ayuda.");
  await createSession(user.id);
  return {
    user: toAccount(user),
    simulated: true as const,
    externalProviderNeeded: started.externalProviderNeeded,
    message: "Simulado / Demo: no abrimos Google. Entraste a una cuenta de demostración.",
  };
}

export async function updateAccount(user: AppUser, input: Record<string, unknown>) {
  const name = requiredText(input.name ?? user.name, "tu nombre", 3, 80);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name },
    include: userInclude,
  });
  return { user: toAccount(updated) };
}

export async function changePassword(user: AppUser, input: Record<string, unknown>) {
  if (!user.passwordHash) {
    throw new HttpError(400, "Esta cuenta no tiene contraseña. Entró con un acceso simulado.");
  }
  const current = asText(input.currentPassword);
  const next = asText(input.nextPassword);
  const matches = await bcrypt.compare(current, user.passwordHash);
  if (!matches) throw new HttpError(400, "La contraseña actual no coincide.");
  if (next.length < 8) throw new HttpError(400, "La nueva contraseña necesita al menos 8 caracteres.");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 8) },
  });
  return { ok: true };
}
