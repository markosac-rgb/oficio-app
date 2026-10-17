import { Badge } from "@/components/ui";

export function TrustList({
  identityStatus,
  certStatus,
  referencesStatus,
}: {
  identityStatus: string;
  certStatus: string;
  referencesStatus: string;
}) {
  const rows = [
    identityStatus === "verified"
      ? { text: "Identidad verificada", tone: "leaf" as const }
      : { text: "Identidad sin verificar", tone: "sand" as const },
    certStatus === "reviewed"
      ? { text: "Certificaciones revisadas", tone: "leaf" as const }
      : { text: "Certificaciones sin revisar", tone: "sand" as const },
    referencesStatus === "reviewed"
      ? { text: "Referencias revisadas", tone: "leaf" as const }
      : referencesStatus === "declared"
        ? { text: "Referencias declaradas (sin revisar)", tone: "gold" as const }
        : { text: "Sin referencias revisadas", tone: "sand" as const },
  ];
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <li key={row.text}>
            <Badge tone={row.tone}>{row.text}</Badge>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm leading-5 text-muted">
        Solo se marca como verificado o revisado lo que una persona de administración confirmó. Si no está en verde, no está revisado.
      </p>
    </div>
  );
}
