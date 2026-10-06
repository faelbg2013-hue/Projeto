export function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete = 'off',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time';
  autoComplete?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 break-words text-[0.68rem] uppercase tracking-[0.28em] text-muted">
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}
