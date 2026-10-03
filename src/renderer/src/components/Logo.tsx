// Marca de Ventamas: una V con un signo de más. Toma el color del tema activo.
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="var(--accent)" />
      <path
        d="M13 23 L25.5 46 L38 23"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M49 13.5 V24.5 M43.5 19 H54.5" fill="none" stroke="var(--accent-ink)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
