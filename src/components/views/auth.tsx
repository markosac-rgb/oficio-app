"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { SIMPLIFIED_NOTICE } from "@/lib/legal-copy";
import { useSession } from "@/components/session";
import { LegalFooter } from "@/components/legal-footer";
import { DemoBanner } from "@/components/states";
import { Button, Field, Input } from "@/components/ui";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/inicio";
  return value;
}

function messageOf(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : "No se pudo completar.";
}

export function WelcomeScreen() {
  const { user } = useSession();
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-gradient-to-b from-[#083d34] via-[#0e6b56] to-paper px-5 py-8">
      <div className="flex items-center gap-2 text-xl font-extrabold text-white">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-clay text-white">O</span>
        Oficio
      </div>
      <p className="mt-10 text-sm font-extrabold tracking-wide text-white/80 uppercase">Servicios para tu casa</p>
      <h1 className="mt-2 text-4xl leading-tight font-extrabold text-white">Alguien de confianza para el trabajo de hoy.</h1>
      <p className="mt-4 text-lg leading-7 text-white/85">
        Pide un plomero, electricista, pintor o quien haga falta. Comparas, acuerdas el precio y sigues el trabajo desde el celular.
      </p>
      <ul className="mt-6 space-y-2 text-base font-bold">
        <li>1. Eliges el oficio cerca de tu casa.</li>
        <li>2. Recibes el precio antes de confirmar.</li>
        <li>3. Pagas o acuerdas efectivo, y dejas tu reseña.</li>
      </ul>
      <div className="mt-auto space-y-3 pt-10">
        {user ? (
          <Button asChild className="w-full">
            <Link href="/inicio">Continuar como {user.name}</Link>
          </Button>
        ) : null}
        <Button asChild className="w-full" data-testid="go-client">
          <Link href="/registro?rol=cliente">Necesito un servicio</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full" data-testid="go-provider">
          <Link href="/registro?rol=proveedor">Ofrezco mis servicios</Link>
        </Button>
        <Link href="/entrar" data-testid="go-login" className="block text-center text-base font-extrabold text-clay">
          Ya tengo cuenta
        </Link>
        <LegalFooter tone="light" />
      </div>
    </main>
  );
}

export function LoginScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const [mode, setMode] = useState<"password" | "code" | "google">("password");
  const [googleReady, setGoogleReady] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [secondary, setSecondary] = useState(false);
  const next = safeNext(params.get("next"));
  const googleError = params.get("error");

  useEffect(() => {
    api<{ configured: boolean }>("/api/auth/google/status")
      .then((result) => setGoogleReady(result.configured))
      .catch(() => setGoogleReady(false));
  }, []);

  async function enter(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await refresh();
      router.push(next);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="contenido" className="mx-auto min-h-dvh w-full max-w-lg px-5 py-8">
      <Link href="/" className="text-sm font-extrabold text-clay">Volver</Link>
      <h1 className="mt-4 text-3xl font-extrabold">Entra a tu cuenta</h1>
      <p className="mt-2 text-base text-muted">Con correo, teléfono o un acceso de demostración.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["password", "Contraseña"],
          ["code", "Código"],
          ["google", "Google"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id as typeof mode)}
            className={`h-11 rounded-2xl text-sm font-extrabold ${mode === id ? "bg-clay text-white" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error || googleError ? <p data-testid="form-error" className="mt-4 rounded-2xl bg-[#fff5f6] px-3 py-2 text-sm font-bold text-danger">{error || googleError}</p> : null}
      {mode === "password" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void enter("/api/auth/login", { identifier, password });
          }}
        >
          <Field label="Correo o teléfono">
            <Input data-testid="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
          </Field>
          <Field label="Contraseña">
            <Input data-testid="login-password" type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </Field>
          <button type="button" className="text-sm font-bold text-clay" onClick={() => setShow((value) => !value)}>
            {show ? "Ocultar contraseña" : "Ver contraseña"}
          </button>
          <Button data-testid="login-submit" className="w-full" disabled={busy}>Entrar</Button>
        </form>
      ) : null}
      {mode === "code" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void enter("/api/auth/otp/verify", { target: identifier, code });
          }}
        >
          <DemoBanner>No enviamos SMS ni correo. Si pides un código, aparece en esta pantalla.</DemoBanner>
          <Field label="Correo o teléfono de una cuenta que ya existe">
            <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void api<{ demoCode: string }>("/api/auth/otp/start", { method: "POST", body: JSON.stringify({ target: identifier }) })
                .then((result) => {
                  setDemoCode(result.demoCode);
                  setCode(result.demoCode);
                  setError("");
                })
                .catch((reason) => setError(messageOf(reason)));
            }}
          >
            Pedir código de prueba
          </Button>
          {demoCode ? <p className="text-sm font-bold">Código de prueba: {demoCode}</p> : null}
          <Field label="Código">
            <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" />
          </Field>
          <Button className="w-full" disabled={busy}>Entrar con código</Button>
        </form>
      ) : null}
      {mode === "google" ? (
        <div className="mt-4 space-y-3">
          <LegalChecks accepted={accepted} secondary={secondary} onAccepted={setAccepted} onSecondary={setSecondary} />
          {googleReady ? (
            <>
              <p className="text-sm leading-5 text-muted">Te llevamos a Google y regresas a Oficio. No guardamos tu contraseña de Google. Si ya tenías cuenta, no cambiamos la aceptación que ya estaba guardada.</p>
              <Button className="w-full" disabled={busy} onClick={() => startGoogle("CLIENT")}>
                Continuar con Google como cliente
              </Button>
              <Button className="w-full" variant="secondary" disabled={busy} onClick={() => startGoogle("PROVIDER")}>
                Continuar con Google como proveedor
              </Button>
            </>
          ) : (
            <>
              <DemoBanner>Este botón no abre Google. Entra a una cuenta demo fija.</DemoBanner>
              <Button className="w-full" data-testid="google-client" disabled={busy} onClick={() => startSimulatedGoogle("CLIENT")}>
                Continuar con Google como cliente (simulado)
              </Button>
              <Button className="w-full" variant="secondary" data-testid="google-provider" disabled={busy} onClick={() => startSimulatedGoogle("PROVIDER")}>
                Continuar con Google como proveedor (simulado)
              </Button>
            </>
          )}
        </div>
      ) : null}
      <details className="mt-6 rounded-2xl bg-white p-3" data-testid="demo-accounts">
        <summary className="cursor-pointer font-extrabold">Cuentas demo</summary>
        <ul className="mt-2 space-y-1 text-sm leading-6">
          <li>Cliente: ana.lopez@oficio.demo · demo1234</li>
          <li>Proveedor: jorge.ramirez@oficio.demo · demo1234</li>
          <li>Admin: admin@oficio.demo · demo1234</li>
        </ul>
      </details>
      <p className="mt-6 text-center text-base">
        ¿Aún no tienes cuenta? <Link href="/registro?rol=cliente" className="font-extrabold text-clay">Regístrate</Link>
      </p>
      <LegalFooter />
    </main>
  );

  function startGoogle(role: "CLIENT" | "PROVIDER") {
    if (!accepted) {
      setError("Acepta los términos y condiciones y el aviso de privacidad para continuar.");
      return;
    }
    const params = new URLSearchParams({ role, acepto: "1", secundarias: secondary ? "1" : "0" });
    window.location.href = `/api/auth/google/start?${params.toString()}`;
  }

  function startSimulatedGoogle(role: "CLIENT" | "PROVIDER") {
    if (!accepted) {
      setError("Acepta los términos y condiciones y el aviso de privacidad para continuar.");
      return;
    }
    void enter("/api/auth/google", { role, acceptedRules: true, acceptedSecondaryPurposes: secondary });
  }
}

export function RegisterScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const initial = params.get("rol") === "proveedor" ? "PROVIDER" : "CLIENT";
  const [role, setRole] = useState<"CLIENT" | "PROVIDER">(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [secondary, setSecondary] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main id="contenido" className="mx-auto min-h-dvh w-full max-w-lg px-5 py-8 pb-16">
      <Link href="/" className="text-sm font-extrabold text-clay">Volver</Link>
      <h1 className="mt-4 text-3xl font-extrabold">Crea tu cuenta</h1>
      <p className="mt-2 text-base text-muted">Es gratis. Luego puedes agregar tu dirección.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" data-testid="role-client" onClick={() => setRole("CLIENT")} className={`h-12 rounded-2xl font-extrabold ${role === "CLIENT" ? "bg-clay text-white" : "bg-white"}`}>
          Necesito un servicio
        </button>
        <button type="button" data-testid="role-provider" onClick={() => setRole("PROVIDER")} className={`h-12 rounded-2xl font-extrabold ${role === "PROVIDER" ? "bg-clay text-white" : "bg-white"}`}>
          Ofrezco servicios
        </button>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!accepted) {
            setError("Acepta los términos y condiciones y el aviso de privacidad para crear la cuenta.");
            return;
          }
          setBusy(true);
          setError("");
          void api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ role, name, email, phone, password, acceptedRules: true, acceptedSecondaryPurposes: secondary }),
          })
            .then(() => refresh())
            .then(() => router.push("/inicio"))
            .catch((reason) => setError(messageOf(reason)))
            .finally(() => setBusy(false));
        }}
      >
        {error ? <p data-testid="form-error" className="rounded-2xl bg-[#fff5f6] px-3 py-2 text-sm font-bold text-danger">{error}</p> : null}
        <Field label="Tu nombre">
          <Input data-testid="reg-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Correo" hint="Usa correo, teléfono o los dos.">
          <Input data-testid="reg-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Teléfono de 10 dígitos">
          <Input data-testid="reg-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <Input data-testid="reg-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <section data-testid="aviso-simplificado" className="rounded-2xl bg-white p-3 text-sm leading-6">
          <h2 className="font-extrabold">Aviso de privacidad simplificado</h2>
          {SIMPLIFIED_NOTICE.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-2">{paragraph}</p>
          ))}
        </section>
        <LegalChecks accepted={accepted} secondary={secondary} onAccepted={setAccepted} onSecondary={setSecondary} rulesTestId="reg-rules" secondaryTestId="reg-secondary" />
        <Button data-testid="reg-submit" className="w-full" disabled={busy}>Crear cuenta</Button>
      </form>
      <p className="mt-4 text-sm leading-5 text-muted">La administración no se crea desde aquí. Si ya tienes cuenta, entra con tu correo.</p>
      <LegalFooter />
    </main>
  );
}

function LegalChecks({
  accepted,
  secondary,
  onAccepted,
  onSecondary,
  rulesTestId,
  secondaryTestId,
}: {
  accepted: boolean;
  secondary: boolean;
  onAccepted: (value: boolean) => void;
  onSecondary: (value: boolean) => void;
  rulesTestId?: string;
  secondaryTestId?: string;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm leading-5">
        <input data-testid={rulesTestId} type="checkbox" checked={accepted} onChange={(event) => onAccepted(event.target.checked)} className="mt-1 h-5 w-5" />
        <span>
          Acepto los <Link href="/terminos" className="font-extrabold text-clay underline">términos y condiciones de uso</Link> y el <Link href="/privacidad" className="font-extrabold text-clay underline">aviso de privacidad</Link>, incluidas las finalidades primarias. Tengo 18 años o más.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input data-testid={secondaryTestId} type="checkbox" checked={secondary} onChange={(event) => onSecondary(event.target.checked)} className="mt-1 h-5 w-5" />
        <span>
          Quiero las finalidades secundarias (novedades de la plataforma y mejora del producto con datos que me identifican). Puedo no marcar esta casilla. Si la marco, puedo pedir que dejen de usarse en el correo de privacidad.
        </span>
      </label>
    </div>
  );
}
