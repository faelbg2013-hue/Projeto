export function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete = 'off',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  autoComplete?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={type === 'number' ? 'decimal' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}
