import mark from '../assets/mark.svg';

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img src={mark} alt="" width={36} height={36} className="size-9" />
      <span className="text-[0.72rem] uppercase tracking-[0.28em] text-foreground">Ravion</span>
    </div>
  );
}
